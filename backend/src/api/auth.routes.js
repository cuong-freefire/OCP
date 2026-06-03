import { Router } from 'express';
import {
  emailOnlySchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';
import { validate } from '../middlewares/validation.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/auth.controller.js';

export function createAuthRouter() {
  const router = Router();

  router.post('/register', validate(registerSchema), controller.register);
  router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
  router.post('/resend-verification', validate(emailOnlySchema), controller.resendVerification);
  router.post('/login', validate(loginSchema), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);
  router.post('/forgot-password', validate(emailOnlySchema), controller.forgotPassword);
  router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
  router.get('/google/config', controller.googleConfig);
  router.post('/google', validate(googleLoginSchema), controller.googleLogin);
  router.post('/set-password', requireAuth, validate(setPasswordSchema), controller.setPassword);

  return router;
}
