import { randomInt } from 'node:crypto';

export function generateNumericOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function buildVerificationEmail({ name, otp }) {
  return {
    subject: 'OCP email verification code',
    text: `Hello ${name},\n\nYour OCP verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
  };
}

export function buildPasswordResetEmail({ name, otp }) {
  return {
    subject: 'OCP password reset code',
    text: `Hello ${name},\n\nYour OCP password reset code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
  };
}
