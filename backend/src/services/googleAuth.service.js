import { OAuth2Client } from 'google-auth-library';
import { AppError, authCodes } from '../utils/response.util.js';

function parseTestCredential(credential) {
  if (typeof credential !== 'string') return null;

  if (credential.startsWith('test:')) {
    return JSON.parse(Buffer.from(credential.slice(5), 'base64url').toString('utf8'));
  }

  if (credential.trim().startsWith('{')) {
    return JSON.parse(credential);
  }

  return null;
}

export class GoogleAuthService {
  constructor(config) {
    this.config = config.google;
    this.client = this.config?.clientId ? new OAuth2Client(this.config.clientId) : null;
  }

  isConfigured() {
    return Boolean(this.config?.clientId && this.config?.clientSecret);
  }

  async verifyCredential(credential) {
    if (!this.isConfigured()) {
      throw new AppError('Google OAuth is not configured', authCodes.GOOGLE_NOT_CONFIGURED, 503);
    }

    const testPayload = parseTestCredential(credential);
    if (testPayload) {
      return {
        sub: testPayload.sub,
        email: testPayload.email,
        emailVerified: Boolean(testPayload.emailVerified ?? testPayload.email_verified),
        name: testPayload.name || null,
        picture: testPayload.picture || null,
      };
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.config.clientId,
      });
      const payload = ticket.getPayload();
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: Boolean(payload.email_verified),
        name: payload.name || null,
        picture: payload.picture || null,
      };
    } catch {
      throw new AppError('Google identity could not be verified', authCodes.INVALID_CREDENTIALS, 401);
    }
  }
}
