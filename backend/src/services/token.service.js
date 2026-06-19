import jwt from 'jsonwebtoken';
import { generateOpaqueToken, hashSecret } from '../utils/crypto.util.js';
import { AppError, authCodes } from '../utils/response.util.js';

function parseDurationMs(value) {
  const match = /^(\d+)(ms|s|m|h|d)?$/i.exec(String(value || ''));
  if (!match) return 0;

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] || 'ms').toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

export class TokenService {
  constructor(config) {
    this.config = config;
  }

  requireSecret() {
    if (!this.config.authSecret) {
      throw new AppError('Auth secret is not configured', 'AUTH_SECRET_MISSING', 500);
    }
  }

  signAccessToken(user) {
    this.requireSecret();
    return jwt.sign(
      {
        sub: user.id,
        role: user.role?.code || user.role,
        status: user.status,
      },
      this.config.authSecret,
      { expiresIn: this.config.jwtAccessExpiresIn },
    );
  }

  verifyAccessToken(token) {
    this.requireSecret();

    try {
      return jwt.verify(token, this.config.authSecret);
    } catch {
      throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
    }
  }

  createRefreshToken() {
    this.requireSecret();
    const raw = generateOpaqueToken(48);
    return {
      raw,
      hash: hashSecret(raw, this.config.authSecret),
      expiresAt: new Date(Date.now() + parseDurationMs(this.config.jwtRefreshExpiresIn)),
    };
  }

  cookieOptions(maxAge) {
    return {
      httpOnly: true,
      sameSite: this.config.cookieSameSite,
      secure: this.config.cookieSecure,
      path: '/',
      ...(maxAge ? { maxAge } : {}),
    };
  }

  // Hàm khởi tạo token + refresh token mới
  setAuthCookies(res, { accessToken, refreshToken }) {
    res.cookie(
      this.config.cookieAccessName,
      accessToken,
      this.cookieOptions(parseDurationMs(this.config.jwtAccessExpiresIn)),
    );
    res.cookie(
      this.config.cookieRefreshName,
      refreshToken,
      this.cookieOptions(parseDurationMs(this.config.jwtRefreshExpiresIn)),
    );
  }

  clearAuthCookies(res) {
    res.clearCookie(this.config.cookieAccessName, this.cookieOptions());
    res.clearCookie(this.config.cookieRefreshName, this.cookieOptions());
  }

  hashRefreshToken(rawToken) {
    this.requireSecret();
    return hashSecret(rawToken, this.config.authSecret);
  }
}
