export class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', status = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const quizCodes = {
  QUIZ_NOT_FOUND: 'QUIZ_NOT_FOUND',
  QUIZ_INACTIVE: 'QUIZ_INACTIVE',
  QUIZ_NO_QUESTIONS: 'QUIZ_NO_QUESTIONS',
  QUIZ_ACCESS_DENIED: 'QUIZ_ACCESS_DENIED',
  QUIZ_ALREADY_SUBMITTED: 'QUIZ_ALREADY_SUBMITTED',
  QUIZ_LATE_SUBMISSION: 'QUIZ_LATE_SUBMISSION',
  QUIZ_INVALID_ANSWERS: 'QUIZ_INVALID_ANSWERS',
  QUIZ_SUBMISSION_NOT_FOUND: 'QUIZ_SUBMISSION_NOT_FOUND',
  QUIZ_NOT_OWNER: 'QUIZ_NOT_OWNER',
  QUIZ_ALREADY_STARTED: 'QUIZ_ALREADY_STARTED',
  QUESTION_NOT_FOUND: 'QUESTION_NOT_FOUND',
  INVALID_QUESTION_TYPE: 'INVALID_QUESTION_TYPE',
};

export const authCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  ROLE_FORBIDDEN: 'ROLE_FORBIDDEN',
  ACCOUNT_UNAVAILABLE: 'ACCOUNT_UNAVAILABLE',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  EMAIL_DELIVERY_UNAVAILABLE: 'EMAIL_DELIVERY_UNAVAILABLE',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_LOCKED: 'OTP_LOCKED',
  OTP_COOLDOWN: 'OTP_COOLDOWN',
  GOOGLE_NOT_CONFIGURED: 'GOOGLE_NOT_CONFIGURED',
  GOOGLE_ACCOUNT_CONFLICT: 'GOOGLE_ACCOUNT_CONFLICT',
  PASSWORD_ALREADY_EXISTS: 'PASSWORD_ALREADY_EXISTS',
};

export function sendSuccess(res, { status = 200, message = 'OK', code = 'OK', data = null, details = null } = {}) {
  return res.status(status).json({
    success: true,
    message,
    code,
    ...(data === null ? {} : { data }),
    ...(details === null ? {} : { details }),
  });
}

export function toErrorPayload(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: null,
    },
  };
}
