const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5050/api';

async function quizRequest(path, { method = 'GET', body } = {}) {
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

export const quizApi = {
  listQuizzes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.courseId) query.set('courseId', params.courseId);
    if (params.lessonId) query.set('lessonId', params.lessonId);
    const qs = query.toString();
    return quizRequest(`/quizzes${qs ? `?${qs}` : ''}`);
  },

  startQuiz: (quizId) => quizRequest(`/quizzes/${quizId}/start`),

  autoSave: (quizId, answers) =>
    quizRequest(`/quizzes/${quizId}/auto-save`, { method: 'POST', body: { answers } }),

  submitQuiz: (quizId, answers, startedAt) =>
    quizRequest(`/quizzes/${quizId}/submit`, { method: 'POST', body: { answers, startedAt } }),

  getResult: (submissionId) => quizRequest(`/quizzes/submissions/${submissionId}/result`),

  getSubmissionHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.quizId) query.set('quizId', params.quizId);
    if (params.courseId) query.set('courseId', params.courseId);
    const qs = query.toString();
    return quizRequest(`/quizzes/submissions/history${qs ? `?${qs}` : ''}`);
  },
};