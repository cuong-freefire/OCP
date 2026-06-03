const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5050/api';

export const withCredentials = true;

async function authRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({
    success: false,
    message: 'Phản hồi không hợp lệ.',
    code: 'UNEXPECTED_RESPONSE',
  }));

  if (!response.ok) {
    const error = new Error(payload.message || 'Yêu cầu không thành công.');
    error.code = payload.code;
    error.details = payload.details;
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const authApi = {
  register: (body) => authRequest('/auth/register', { method: 'POST', body }),
  verifyEmail: (body) => authRequest('/auth/verify-email', { method: 'POST', body }),
  resendVerification: (body) => authRequest('/auth/resend-verification', { method: 'POST', body }),
  login: (body) => authRequest('/auth/login', { method: 'POST', body }),
  refresh: () => authRequest('/auth/refresh', { method: 'POST' }),
  logout: () => authRequest('/auth/logout', { method: 'POST' }),
  me: () => authRequest('/auth/me'),
  forgotPassword: (body) => authRequest('/auth/forgot-password', { method: 'POST', body }),
  resetPassword: (body) => authRequest('/auth/reset-password', { method: 'POST', body }),
  googleConfig: () => authRequest('/auth/google/config'),
  googleLogin: (body) => authRequest('/auth/google', { method: 'POST', body }),
  setPassword: (body) => authRequest('/auth/set-password', { method: 'POST', body }),
};
