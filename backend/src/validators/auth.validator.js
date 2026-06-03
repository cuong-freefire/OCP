import { z } from 'zod';

const email = z.string().trim().email().max(255);
const otp = z.string().regex(/^\d{6}$/, 'OTP must be exactly six digits');
const password = z.string().min(8).max(128);

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1).max(255),
    email,
    password,
  })
  .strict();

export const emailOnlySchema = z
  .object({
    email,
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    email,
    otp,
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email,
    otp,
    newPassword: password,
  })
  .strict();

export const googleLoginSchema = z
  .object({
    credential: z.string().min(1),
  })
  .strict();

export const setPasswordSchema = z
  .object({
    newPassword: password,
  })
  .strict();
