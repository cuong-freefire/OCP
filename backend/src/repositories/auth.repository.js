import { prisma as defaultPrisma } from '../config/prisma.config.js';

const userInclude = {
  role: true,
};

export class AuthRepository {
  constructor(prisma = defaultPrisma) {
    this.prisma = prisma;
  }

  findActiveLearnerRole() {
    return this.prisma.role.findFirst({
      where: { code: 'LEARNER', isActive: true },
    });
  }

  findUserByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email },
      include: userInclude,
    });
  }

  findUserById(id) {
    return this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
  }

  createLocalUser({ name, email, passwordHash, roleId }) {
    return this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roleId,
        status: 'pending_verification',
        emailVerified: false,
        avatarUrl: null,
      },
      include: userInclude,
    });
  }

  updatePendingLocalUser(userId, { name, passwordHash }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name, passwordHash, avatarUrl: null },
      include: userInclude,
    });
  }

  updatePasswordHash(userId, passwordHash) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      include: userInclude,
    });
  }

  invalidateVerificationOtps(userId) {
    return this.prisma.emailVerification.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  createVerificationOtp({ userId, otpHash, expiresAt, lastSentAt }) {
    return this.prisma.emailVerification.create({
      data: { userId, otpHash, expiresAt, lastSentAt },
    });
  }

  findLatestVerificationOtp(userId) {
    return this.prisma.emailVerification.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateVerificationAttempts(id, { failedAttempts, lockedAt }) {
    return this.prisma.emailVerification.update({
      where: { id },
      data: { failedAttempts, lockedAt },
    });
  }

  async consumeVerificationOtpAndActivateUser({ otpId, userId }) {
    const [, user] = await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: otpId },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, status: 'active' },
        include: userInclude,
      }),
    ]);
    return user;
  }

  invalidateResetOtps(userId) {
    return this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  createResetOtp({ userId, otpHash, expiresAt, lastSentAt }) {
    return this.prisma.passwordResetToken.create({
      data: { userId, otpHash, expiresAt, lastSentAt },
    });
  }

  findLatestResetOtp(userId) {
    return this.prisma.passwordResetToken.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateResetAttempts(id, { failedAttempts, lockedAt }) {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { failedAttempts, lockedAt },
    });
  }

  async consumeResetOtpAndUpdatePassword({ otpId, userId, passwordHash }) {
    const [, user] = await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: otpId },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        include: userInclude,
      }),
    ]);
    return user;
  }

  createRefreshToken({ userId, tokenHash, expiresAt }) {
    return this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  findRefreshTokenByHash(tokenHash) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: userInclude } },
    });
  }

  revokeRefreshToken(id, replacedByTokenId = null) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedByTokenId },
    });
  }

  findOAuthAccount(provider, providerUserId) {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: { include: userInclude } },
    });
  }

  findOAuthAccountForUser(userId, provider) {
    return this.prisma.oAuthAccount.findUnique({
      where: { userId_provider: { userId, provider } },
    });
  }

  linkOAuthAccount({ userId, provider, providerUserId, providerEmail, providerName, providerAvatarUrl }) {
    return this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerUserId,
        providerEmail,
        providerName,
        providerAvatarUrl,
      },
    });
  }

  async createGoogleUserWithOAuth({ roleId, name, email, providerUserId, providerName, providerAvatarUrl }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          roleId,
          name,
          email,
          passwordHash: null,
          avatarUrl: null,
          emailVerified: true,
          status: 'active',
        },
        include: userInclude,
      });

      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerUserId,
          providerEmail: email,
          providerName,
          providerAvatarUrl,
        },
      });

      return user;
    });
  }
}
