import { z } from 'zod';

const email = z.string().trim().min(1, 'Vui lòng nhập email.').email('Email không hợp lệ.').max(255);
const otp = z.string().trim().regex(/^\d{6}$/, 'Mã xác thực gồm 6 chữ số.');
const password = z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự.').max(128);

export const loginFormSchema = z.object({
  email,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.').max(128),
});

export const registerFormSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(255),
    email,
    password,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.').max(128),
  })
  .superRefine((data, context) => {
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Mật khẩu xác nhận không khớp.',
      });
    }
  });

export const emailOnlyFormSchema = z.object({
  email,
});

export const verifyEmailFormSchema = z.object({
  email,
  otp,
});

export const resetPasswordFormSchema = z.object({
  email,
  otp,
  newPassword: password,
});

export const setPasswordFormSchema = z.object({
  newPassword: password,
});

export function validateForm(schema, values) {
  const result = schema.safeParse(values);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const firstIssue = result.error.issues[0];
  return {
    success: false,
    message: firstIssue?.message || 'Vui lòng kiểm tra lại thông tin.',
  };
}
