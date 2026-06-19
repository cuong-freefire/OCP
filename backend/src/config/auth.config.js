import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const asInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

export function getAuthConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };

  return {
    port: asInt(env.PORT, 5050),
    apiPrefix: env.API_PREFIX || '/api',
    frontendOrigin: env.FRONTEND_ORIGIN || 'http://localhost:3000',
    authSecret: env.AUTH_SECRET || (env.NODE_ENV === 'test' ? 'test-auth-secret' : undefined),
    cookieAccessName: env.COOKIE_ACCESS_NAME || 'ocp_access_token',
    cookieRefreshName: env.COOKIE_REFRESH_NAME || 'ocp_refresh_token',
    cookieSameSite: env.COOKIE_SAME_SITE || 'lax',
    cookieSecure: asBool(env.COOKIE_SECURE, false),
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
    jwtAccessExpiresIn: env.JWT_ACCESS_EXPIRES_IN || '15m',
    bcryptSaltRounds: asInt(env.BCRYPT_SALT_ROUNDS, 12),
    emailOtpExpiresMinutes: asInt(env.EMAIL_OTP_EXPIRES_MINUTES, 10),
    emailOtpMaxFailedAttempts: asInt(env.EMAIL_OTP_MAX_FAILED_ATTEMPTS, 5),
    emailOtpResendCooldownSeconds: asInt(env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS, 60),
    resetOtpExpiresMinutes: asInt(env.RESET_OTP_EXPIRES_MINUTES, 10),
    resetOtpMaxFailedAttempts: asInt(env.RESET_OTP_MAX_FAILED_ATTEMPTS, 5),
    resetOtpResendCooldownSeconds: asInt(env.RESET_OTP_RESEND_COOLDOWN_SECONDS, 60),
    smtp: {
      host: env.SMTP_HOST,
      port: asInt(env.SMTP_PORT, 587),
      secure: asBool(env.SMTP_SECURE, false),
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      fromName: env.SMTP_FROM_NAME || 'OCP',
      fromEmail: env.SMTP_FROM_EMAIL || env.SMTP_USER,
    },
    google: {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    },
  };
}

export const authConfig = getAuthConfig();
