import bcrypt from 'bcryptjs';
import { AppError, authCodes } from '../utils/response.util.js';
import { generateNumericOtp } from '../utils/email.util.js';
import { hashSecret, normalizeEmail, safeCompareHash } from '../utils/crypto.util.js';

const PROVIDER_GOOGLE = 'GOOGLE';
const GENERIC_RESET_MESSAGE = 'If the account is eligible, a reset code will be sent.';

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function isDeleted(user) {
  return Boolean(user?.deletedAt || user?.deleted_at);
}

function isActiveUser(user) {
  return Boolean(user && user.status === 'active' && !isDeleted(user));
}

function isBlockedOrDeleted(user) {
  return Boolean(!user || user.status === 'blocked' || isDeleted(user));
}

export class AuthService {
  constructor({ repository, emailService, tokenService, googleAuthService, config }) {
    this.repository = repository;
    this.emailService = emailService;
    this.tokenService = tokenService;
    this.googleAuthService = googleAuthService;
    this.config = config;
  }

  safeUser(user) {
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role?.code || user.role || null,
      status: user.status,
      emailVerified: Boolean(user.emailVerified),
      hasLocalPassword: Boolean(user.passwordHash),
    };
  }

  async hashPassword(password) {
    return bcrypt.hash(password, this.config.bcryptSaltRounds);
  }

  async comparePassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }

  otpHash(type, userId, otp) {
    return hashSecret(otp, `${this.config.authSecret}:${type}:${userId}`);
  }

  verifyOtpHash(type, userId, otp, otpHash) {
    return safeCompareHash(otp, otpHash, `${this.config.authSecret}:${type}:${userId}`);
  }

  async createSession(user) {
    const accessToken = this.tokenService.signAccessToken(user);
    const refreshToken = this.tokenService.createRefreshToken();
    const refreshRecord = await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshToken.raw,
      refreshRecord,
    };
  }

  setAuthCookies(res, session) {
    this.tokenService.setAuthCookies(res, session);
  }

  clearAuthCookies(res) {
    this.tokenService.clearAuthCookies(res);
  }

  async getLearnerRole() {
    const role = await this.repository.findActiveLearnerRole();
    if (!role) {
      throw new AppError('Learner role is not available', 'LEARNER_ROLE_MISSING', 500);
    }
    return role;
  }

  async issueVerificationOtp(user, now = new Date()) {
    const latest = await this.repository.findLatestVerificationOtp(user.id);
    if (latest?.lastSentAt && latest.usedAt === null) {
      const nextAllowed = addSeconds(latest.lastSentAt, this.config.emailOtpResendCooldownSeconds);
      if (nextAllowed > now) {
        throw new AppError('Verification code resend is cooling down', authCodes.OTP_COOLDOWN, 429);
      }
    }

    const otp = generateNumericOtp();
    await this.repository.invalidateVerificationOtps(user.id);
    await this.repository.createVerificationOtp({
      userId: user.id,
      otpHash: this.otpHash('email-verification', user.id, otp),
      expiresAt: addMinutes(now, this.config.emailOtpExpiresMinutes),
      lastSentAt: now,
    });
    await this.emailService.sendVerificationOtp({ to: user.email, name: user.name, otp });
  }

  async register({ fullName, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.repository.findUserByEmail(normalizedEmail);
    const passwordHash = await this.hashPassword(password);
    let user;

    if (existing) {
      const canReusePending =
        existing.status === 'pending_verification' &&
        !existing.emailVerified &&
        !isDeleted(existing) &&
        Boolean(existing.passwordHash);

      if (!canReusePending) {
        throw new AppError('Email is already registered', authCodes.EMAIL_ALREADY_REGISTERED, 409);
      }

      user = await this.repository.updatePendingLocalUser(existing.id, {
        name: fullName,
        passwordHash,
      });
    } else {
      const learnerRole = await this.getLearnerRole();
      user = await this.repository.createLocalUser({
        name: fullName,
        email: normalizedEmail,
        passwordHash,
        roleId: learnerRole.id,
      });
    }

    await this.issueVerificationOtp(user);
    return this.safeUser(user);
  }

  async resendVerification({ email }) {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (!user || user.status !== 'pending_verification' || isDeleted(user)) {
      return { message: 'If verification is pending, a new code will be sent.' };
    }

    await this.issueVerificationOtp(user);
    return { message: 'Verification code sent.' };
  }

  async verifyEmail({ email, otp }) {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (!user || user.status !== 'pending_verification' || isDeleted(user)) {
      throw new AppError('Verification code is invalid', authCodes.OTP_INVALID, 401);
    }

    const record = await this.repository.findLatestVerificationOtp(user.id);
    const verifiedUser = await this.consumeOtp({
      type: 'email-verification',
      user,
      record,
      otp,
      maxFailedAttempts: this.config.emailOtpMaxFailedAttempts,
      updateAttempts: (id, data) => this.repository.updateVerificationAttempts(id, data),
      consume: (id) => this.repository.consumeVerificationOtpAndActivateUser({ otpId: id, userId: user.id }),
    });
    const session = await this.createSession(verifiedUser);

    return { user: this.safeUser(verifiedUser), session };
  }

  async consumeOtp({ type, user, record, otp, maxFailedAttempts, updateAttempts, consume }) {
    const now = new Date();
    if (!record || record.usedAt) {
      throw new AppError('OTP is invalid', authCodes.OTP_INVALID, 401);
    }
    if (record.lockedAt || record.failedAttempts >= maxFailedAttempts) {
      throw new AppError('OTP is locked', authCodes.OTP_LOCKED, 401);
    }
    if (record.expiresAt <= now) {
      throw new AppError('OTP has expired', authCodes.OTP_EXPIRED, 401);
    }
    if (!this.verifyOtpHash(type, user.id, otp, record.otpHash)) {
      const failedAttempts = record.failedAttempts + 1;
      await updateAttempts(record.id, {
        failedAttempts,
        lockedAt: failedAttempts >= maxFailedAttempts ? now : null,
      });
      throw new AppError('OTP is invalid', authCodes.OTP_INVALID, 401);
    }

    return consume(record.id);
  }

  async login({ email, password }) {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));

    if (
      !isActiveUser(user) ||
      !user.emailVerified ||
      !user.passwordHash ||
      !(await this.comparePassword(password, user.passwordHash))
    ) {
      throw new AppError('Invalid credentials', authCodes.INVALID_CREDENTIALS, 401);
    }

    const session = await this.createSession(user);
    return { user: this.safeUser(user), session };
  }

  async getAuthenticatedUserFromAccessToken(accessToken) {
    if (!accessToken) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }

    const payload = this.tokenService.verifyAccessToken(accessToken);
    const user = await this.repository.findUserById(payload.sub);
    if (!isActiveUser(user)) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }

    return this.safeUser(user);
  }

  async refresh(rawRefreshToken) {
    if (!rawRefreshToken) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }

    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const current = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!current || current.revokedAt || current.expiresAt <= new Date() || !isActiveUser(current.user)) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }

    const nextRefresh = this.tokenService.createRefreshToken();
    const nextRecord = await this.repository.createRefreshToken({
      userId: current.userId,
      tokenHash: nextRefresh.hash,
      expiresAt: nextRefresh.expiresAt,
    });
    await this.repository.revokeRefreshToken(current.id, nextRecord.id);

    return {
      user: this.safeUser(current.user),
      session: {
        accessToken: this.tokenService.signAccessToken(current.user),
        refreshToken: nextRefresh.raw,
        refreshRecord: nextRecord,
      },
    };
  }

  async logout(rawRefreshToken) {
    if (!rawRefreshToken) return;

    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const current = await this.repository.findRefreshTokenByHash(tokenHash);
    if (current && !current.revokedAt) {
      await this.repository.revokeRefreshToken(current.id);
    }
  }

  async me(userId) {
    const user = await this.repository.findUserById(userId);
    if (!isActiveUser(user)) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }
    return this.safeUser(user);
  }

  async forgotPassword({ email }) {
    if (!this.emailService.canSend()) {
      throw new AppError('Email delivery is not configured', authCodes.EMAIL_DELIVERY_UNAVAILABLE, 503);
    }

    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (!isActiveUser(user) || !user.passwordHash) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    await this.issueResetOtp(user);
    return { message: GENERIC_RESET_MESSAGE };
  }

  async issueResetOtp(user, now = new Date()) {
    const latest = await this.repository.findLatestResetOtp(user.id);
    if (latest?.lastSentAt && latest.usedAt === null) {
      const nextAllowed = addSeconds(latest.lastSentAt, this.config.resetOtpResendCooldownSeconds);
      if (nextAllowed > now) {
        throw new AppError('Reset code resend is cooling down', authCodes.OTP_COOLDOWN, 429);
      }
    }

    const otp = generateNumericOtp();
    await this.repository.invalidateResetOtps(user.id);
    await this.repository.createResetOtp({
      userId: user.id,
      otpHash: this.otpHash('password-reset', user.id, otp),
      expiresAt: addMinutes(now, this.config.resetOtpExpiresMinutes),
      lastSentAt: now,
    });
    await this.emailService.sendPasswordResetOtp({ to: user.email, name: user.name, otp });
  }

  async resetPassword({ email, otp, newPassword }) {
    const user = await this.repository.findUserByEmail(normalizeEmail(email));
    if (!isActiveUser(user) || !user.passwordHash) {
      throw new AppError('Reset code is invalid', authCodes.OTP_INVALID, 401);
    }

    const record = await this.repository.findLatestResetOtp(user.id);
    const passwordHash = await this.hashPassword(newPassword);
    await this.consumeOtp({
      type: 'password-reset',
      user,
      record,
      otp,
      maxFailedAttempts: this.config.resetOtpMaxFailedAttempts,
      updateAttempts: (id, data) => this.repository.updateResetAttempts(id, data),
      consume: (id) =>
        this.repository.consumeResetOtpAndUpdatePassword({
          otpId: id,
          userId: user.id,
          passwordHash,
        }),
    });

    return { message: 'Password reset complete.' };
  }

  getGoogleConfig() {
    return {
      configured: this.googleAuthService.isConfigured(),
      clientId: this.googleAuthService.isConfigured() ? this.config.google.clientId : null,
    };
  }

  async googleLogin({ credential }) {
    const claims = await this.googleAuthService.verifyCredential(credential);
    if (!claims.sub || !claims.email || !claims.emailVerified) {
      throw new AppError('Google identity could not be verified', authCodes.INVALID_CREDENTIALS, 401);
    }

    const normalizedEmail = normalizeEmail(claims.email);
    const linked = await this.repository.findOAuthAccount(PROVIDER_GOOGLE, claims.sub);
    let user = linked?.user || null;

    if (user && isBlockedOrDeleted(user)) {
      throw new AppError('Account is unavailable', authCodes.ACCOUNT_UNAVAILABLE, 401);
    }

    if (!user) {
      const existingUser = await this.repository.findUserByEmail(normalizedEmail);

      if (existingUser) {
        if (!isActiveUser(existingUser)) {
          throw new AppError('Account is unavailable', authCodes.ACCOUNT_UNAVAILABLE, 401);
        }

        const existingGoogleLink = await this.repository.findOAuthAccountForUser(existingUser.id, PROVIDER_GOOGLE);
        if (existingGoogleLink) {
          throw new AppError('Google account conflict', authCodes.GOOGLE_ACCOUNT_CONFLICT, 409);
        }

        await this.repository.linkOAuthAccount({
          userId: existingUser.id,
          provider: PROVIDER_GOOGLE,
          providerUserId: claims.sub,
          providerEmail: normalizedEmail,
          providerName: claims.name,
          providerAvatarUrl: claims.picture,
        });
        user = existingUser;
      } else {
        const learnerRole = await this.getLearnerRole();
        user = await this.repository.createGoogleUserWithOAuth({
          roleId: learnerRole.id,
          name: claims.name || normalizedEmail,
          email: normalizedEmail,
          providerUserId: claims.sub,
          providerName: claims.name,
          providerAvatarUrl: claims.picture,
        });
      }
    }

    const session = await this.createSession(user);
    return { user: this.safeUser(user), session };
  }

  async setPassword(userId, newPassword) {
    const user = await this.repository.findUserById(userId);
    if (!isActiveUser(user)) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }
    if (user.passwordHash) {
      throw new AppError('Local password already exists', authCodes.PASSWORD_ALREADY_EXISTS, 400);
    }

    const passwordHash = await this.hashPassword(newPassword);
    const updated = await this.repository.updatePasswordHash(user.id, passwordHash);
    return this.safeUser(updated);
  }

  async requireRole(userId, allowedRoles) {
    const user = await this.repository.findUserById(userId);
    if (!isActiveUser(user)) {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }

    const role = user.role?.code;
    if (!allowedRoles.includes(role)) {
      throw new AppError('Forbidden', authCodes.ROLE_FORBIDDEN, 403);
    }

    return this.safeUser(user);
  }
}
