import { toast } from 'react-toastify';

const DEFAULT_TOAST_OPTIONS = {
  autoClose: 3500,
  pauseOnHover: true,
};

const ERROR_MESSAGES_BY_CODE = {
  UNEXPECTED_RESPONSE: 'Phản hồi không hợp lệ.',
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ.',
  AUTH_REQUIRED: 'Vui lòng đăng nhập.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  FORBIDDEN: 'Bạn không có quyền truy cập.',
  ROLE_FORBIDDEN: 'Bạn không có quyền truy cập.',
  ACCOUNT_UNAVAILABLE: 'Tài khoản không khả dụng.',
  EMAIL_ALREADY_REGISTERED: 'Email đã được sử dụng.',
  EMAIL_DELIVERY_UNAVAILABLE: 'Chưa thể gửi email. Vui lòng thử lại sau.',
  OTP_INVALID: 'Mã xác thực không đúng.',
  OTP_EXPIRED: 'Mã xác thực đã hết hạn.',
  OTP_LOCKED: 'Mã xác thực đã bị khóa.',
  OTP_COOLDOWN: 'Vui lòng chờ hết thời gian đếm ngược.',
  GOOGLE_NOT_CONFIGURED: 'Đăng nhập Google chưa khả dụng.',
  GOOGLE_ACCOUNT_CONFLICT: 'Tài khoản Google đã được liên kết.',
  PASSWORD_ALREADY_EXISTS: 'Tài khoản đã có mật khẩu.',
  INTERNAL_ERROR: 'Hệ thống đang lỗi. Vui lòng thử lại sau.',
  LEARNER_ROLE_MISSING: 'Chưa thể tạo tài khoản. Vui lòng liên hệ quản trị viên.',
};

const ERROR_MESSAGES_BY_TEXT = {
  'Unexpected response': 'Phản hồi không hợp lệ.',
  'Request failed': 'Yêu cầu không thành công.',
  'Google sign-in could not be loaded.': 'Chưa thể tải đăng nhập Google.',
  'Google sign-in did not return a credential.': 'Đăng nhập Google chưa hoàn tất.',
  'Google sign-in is not available on this page.': 'Đăng nhập Google chưa khả dụng.',
};

function resolveErrorMessage(error) {
  if (!error) return 'Yêu cầu không thành công.';
  if (typeof error === 'string') return ERROR_MESSAGES_BY_TEXT[error] || error;
  if (error.code && ERROR_MESSAGES_BY_CODE[error.code]) return ERROR_MESSAGES_BY_CODE[error.code];
  if (error.message && ERROR_MESSAGES_BY_TEXT[error.message]) return ERROR_MESSAGES_BY_TEXT[error.message];
  return error.message || 'Yêu cầu không thành công.';
}

export function showSuccessToast(message) {
  toast.success(message || 'Hoàn tất.', DEFAULT_TOAST_OPTIONS);
}

export function showErrorToast(error) {
  toast.error(resolveErrorMessage(error), DEFAULT_TOAST_OPTIONS);
}
