import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function hashSecret(value, pepper = '') {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function safeCompareHash(value, expectedHash, pepper = '') {
  const actualHash = hashSecret(value, pepper);
  const actualBuffer = Buffer.from(actualHash);
  const expectedBuffer = Buffer.from(expectedHash || '');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
