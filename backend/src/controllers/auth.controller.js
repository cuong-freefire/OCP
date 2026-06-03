import { sendSuccess } from '../utils/response.util.js';

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const authService = (req) => req.app.locals.authService;
const authConfig = (req) => req.app.locals.authConfig;

export const register = asyncHandler(async (req, res) => {
  const user = await authService(req).register(req.body);
  sendSuccess(res, {
    status: 201,
    message: 'Registration created. Verify email to continue.',
    code: 'REGISTER_PENDING_VERIFICATION',
    data: { user },
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService(req).verifyEmail(req.body);
  authService(req).setAuthCookies(res, result.session);
  sendSuccess(res, {
    message: 'Email verified.',
    code: 'EMAIL_VERIFIED',
    data: { user: result.user },
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService(req).resendVerification(req.body);
  sendSuccess(res, { message: result.message, code: 'VERIFICATION_RESEND_HANDLED' });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService(req).login(req.body);
  authService(req).setAuthCookies(res, result.session);
  sendSuccess(res, {
    message: 'Login successful.',
    code: 'LOGIN_SUCCESS',
    data: { user: result.user },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[authConfig(req).cookieRefreshName];
  const result = await authService(req).refresh(rawRefreshToken);
  authService(req).setAuthCookies(res, result.session);
  sendSuccess(res, {
    message: 'Session refreshed.',
    code: 'SESSION_REFRESHED',
    data: { user: result.user },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[authConfig(req).cookieRefreshName];
  await authService(req).logout(rawRefreshToken);
  authService(req).clearAuthCookies(res);
  sendSuccess(res, { message: 'Logged out.', code: 'LOGOUT_SUCCESS' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService(req).me(req.user.id);
  sendSuccess(res, { message: 'Current user.', code: 'CURRENT_USER', data: { user } });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService(req).forgotPassword(req.body);
  sendSuccess(res, { message: result.message, code: 'FORGOT_PASSWORD_HANDLED' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService(req).resetPassword(req.body);
  sendSuccess(res, { message: result.message, code: 'PASSWORD_RESET_COMPLETE' });
});

export const googleConfig = asyncHandler(async (req, res) => {
  const data = authService(req).getGoogleConfig();
  sendSuccess(res, { message: 'Google configuration status.', code: 'GOOGLE_CONFIG', data });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService(req).googleLogin(req.body);
  authService(req).setAuthCookies(res, result.session);
  sendSuccess(res, {
    message: 'Google login successful.',
    code: 'GOOGLE_LOGIN_SUCCESS',
    data: { user: result.user },
  });
});

export const setPassword = asyncHandler(async (req, res) => {
  const user = await authService(req).setPassword(req.user.id, req.body.newPassword);
  sendSuccess(res, {
    message: 'Password set.',
    code: 'PASSWORD_SET',
    data: { user },
  });
});
