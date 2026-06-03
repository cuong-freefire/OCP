import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app.js';
import { getAuthConfig } from '../../src/config/auth.config.js';
import { InMemoryAuthRepository } from './inMemoryAuthRepository.js';
import { AppError, authCodes } from '../../src/utils/response.util.js';

class FakeEmailService {
  constructor({ configured = true } = {}) {
    this.configured = configured;
    this.outbox = [];
  }

  canSend() {
    return this.configured;
  }

  async sendVerificationOtp(message) {
    if (!this.configured) {
      throw new AppError('Email delivery is not configured', authCodes.EMAIL_DELIVERY_UNAVAILABLE, 503);
    }
    this.outbox.push({ type: 'verification', ...message });
  }

  async sendPasswordResetOtp(message) {
    if (!this.configured) {
      throw new AppError('Email delivery is not configured', authCodes.EMAIL_DELIVERY_UNAVAILABLE, 503);
    }
    this.outbox.push({ type: 'reset', ...message });
  }

  latest(type) {
    return [...this.outbox].reverse().find((item) => item.type === type);
  }
}

class FakeGoogleAuthService {
  constructor({ configured = true, claims = null } = {}) {
    this.configured = configured;
    this.claims = claims;
  }

  isConfigured() {
    return this.configured;
  }

  async verifyCredential() {
    if (!this.configured) {
      throw new AppError('Google OAuth is not configured', authCodes.GOOGLE_NOT_CONFIGURED, 503);
    }
    return this.claims || {
      sub: 'google-sub-1',
      email: 'google@example.com',
      emailVerified: true,
      name: 'Google User',
      picture: 'https://example.test/avatar.png',
    };
  }
}

export async function createActiveLocalUser(repo, overrides = {}) {
  const password = overrides.password || 'Password123';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = repo.createUser({
    email: overrides.email || `user-${Date.now()}@example.com`,
    name: overrides.name || 'Test User',
    passwordHash,
    status: overrides.status || 'active',
    emailVerified: overrides.emailVerified ?? true,
    deletedAt: overrides.deletedAt || null,
  });
  return { user, password };
}

export function createTestContext(options = {}) {
  const config = getAuthConfig({
    NODE_ENV: 'test',
    AUTH_SECRET: 'test-auth-secret',
    COOKIE_ACCESS_NAME: 'ocp_access_token',
    COOKIE_REFRESH_NAME: 'ocp_refresh_token',
    COOKIE_SECURE: 'false',
    FRONTEND_ORIGIN: 'http://localhost:3000',
    BCRYPT_SALT_ROUNDS: '4',
    ...options.env,
  });
  const repository = options.repository || new InMemoryAuthRepository();
  const emailService = options.emailService || new FakeEmailService(options.email);
  const googleAuthService = options.googleAuthService || new FakeGoogleAuthService(options.google);
  const app = createApp({ config, repository, emailService, googleAuthService });

  return { app, config, repository, emailService, googleAuthService };
}
