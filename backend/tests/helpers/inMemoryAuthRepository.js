import { randomUUID } from 'node:crypto';

const clone = (value) => {
  if (value === null || value === undefined) return value;
  return structuredClone(value);
};

export class InMemoryAuthRepository {
  constructor() {
    this.roles = new Map();
    this.users = new Map();
    this.verifications = new Map();
    this.resetOtps = new Map();
    this.refreshTokens = new Map();
    this.oauthAccounts = new Map();
    this.role = this.createRole({ code: 'LEARNER', name: 'Learner', isActive: true });
  }

  createRole(data) {
    const role = { id: randomUUID(), ...data };
    this.roles.set(role.id, role);
    return role;
  }

  withRole(user) {
    if (!user) return null;
    return clone({ ...user, role: this.roles.get(user.roleId) });
  }

  findActiveLearnerRole() {
    return clone([...this.roles.values()].find((role) => role.code === 'LEARNER' && role.isActive));
  }

  findUserByEmail(email) {
    return this.withRole([...this.users.values()].find((user) => user.email === email));
  }

  findUserById(id) {
    return this.withRole(this.users.get(id));
  }

  createLocalUser({ name, email, passwordHash, roleId }) {
    const user = {
      id: randomUUID(),
      roleId,
      name,
      email,
      avatarUrl: null,
      passwordHash,
      emailVerified: false,
      status: 'pending_verification',
      deletedAt: null,
    };
    this.users.set(user.id, user);
    return this.withRole(user);
  }

  createUser(data) {
    const roleId = data.roleId || this.role.id;
    const user = {
      id: randomUUID(),
      roleId,
      name: data.name || data.email,
      email: data.email,
      avatarUrl: null,
      passwordHash: data.passwordHash ?? null,
      emailVerified: data.emailVerified ?? true,
      status: data.status || 'active',
      deletedAt: data.deletedAt || null,
    };
    this.users.set(user.id, user);
    return this.withRole(user);
  }

  updatePendingLocalUser(userId, { name, passwordHash }) {
    const user = this.users.get(userId);
    Object.assign(user, { name, passwordHash, avatarUrl: null });
    return this.withRole(user);
  }

  updatePasswordHash(userId, passwordHash) {
    const user = this.users.get(userId);
    user.passwordHash = passwordHash;
    return this.withRole(user);
  }

  invalidateVerificationOtps(userId) {
    for (const record of this.verifications.values()) {
      if (record.userId === userId && !record.usedAt) record.usedAt = new Date();
    }
  }

  createVerificationOtp(data) {
    const record = { id: randomUUID(), failedAttempts: 0, lockedAt: null, usedAt: null, createdAt: new Date(), ...data };
    this.verifications.set(record.id, record);
    return clone(record);
  }

  findLatestVerificationOtp(userId) {
    return clone(
      [...this.verifications.values()]
        .filter((record) => record.userId === userId && !record.usedAt)
        .sort((a, b) => b.createdAt - a.createdAt)[0],
    );
  }

  updateVerificationAttempts(id, data) {
    Object.assign(this.verifications.get(id), data);
    return clone(this.verifications.get(id));
  }

  consumeVerificationOtpAndActivateUser({ otpId, userId }) {
    this.verifications.get(otpId).usedAt = new Date();
    const user = this.users.get(userId);
    user.status = 'active';
    user.emailVerified = true;
    return this.withRole(user);
  }

  invalidateResetOtps(userId) {
    for (const record of this.resetOtps.values()) {
      if (record.userId === userId && !record.usedAt) record.usedAt = new Date();
    }
  }

  createResetOtp(data) {
    const record = { id: randomUUID(), failedAttempts: 0, lockedAt: null, usedAt: null, createdAt: new Date(), ...data };
    this.resetOtps.set(record.id, record);
    return clone(record);
  }

  findLatestResetOtp(userId) {
    return clone(
      [...this.resetOtps.values()]
        .filter((record) => record.userId === userId && !record.usedAt)
        .sort((a, b) => b.createdAt - a.createdAt)[0],
    );
  }

  updateResetAttempts(id, data) {
    Object.assign(this.resetOtps.get(id), data);
    return clone(this.resetOtps.get(id));
  }

  consumeResetOtpAndUpdatePassword({ otpId, userId, passwordHash }) {
    this.resetOtps.get(otpId).usedAt = new Date();
    const user = this.users.get(userId);
    user.passwordHash = passwordHash;
    return this.withRole(user);
  }

  createRefreshToken(data) {
    const record = { id: randomUUID(), revokedAt: null, replacedByTokenId: null, createdAt: new Date(), ...data };
    this.refreshTokens.set(record.id, record);
    return clone(record);
  }

  findRefreshTokenByHash(tokenHash) {
    const record = [...this.refreshTokens.values()].find((token) => token.tokenHash === tokenHash);
    if (!record) return null;
    return clone({ ...record, user: this.withRole(this.users.get(record.userId)) });
  }

  revokeRefreshToken(id, replacedByTokenId = null) {
    const record = this.refreshTokens.get(id);
    record.revokedAt = new Date();
    record.replacedByTokenId = replacedByTokenId;
    return clone(record);
  }

  findOAuthAccount(provider, providerUserId) {
    const account = [...this.oauthAccounts.values()].find(
      (item) => item.provider === provider && item.providerUserId === providerUserId,
    );
    if (!account) return null;
    return clone({ ...account, user: this.withRole(this.users.get(account.userId)) });
  }

  findOAuthAccountForUser(userId, provider) {
    return clone([...this.oauthAccounts.values()].find((item) => item.userId === userId && item.provider === provider));
  }

  linkOAuthAccount(data) {
    const account = { id: randomUUID(), ...data };
    this.oauthAccounts.set(account.id, account);
    return clone(account);
  }

  createGoogleUserWithOAuth({ roleId, name, email, providerUserId, providerName, providerAvatarUrl }) {
    const user = this.createUser({ roleId, name, email, passwordHash: null, emailVerified: true, status: 'active' });
    this.linkOAuthAccount({
      userId: user.id,
      provider: 'GOOGLE',
      providerUserId,
      providerEmail: email,
      providerName,
      providerAvatarUrl,
    });
    return user;
  }
}
