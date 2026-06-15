const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5050/api';

async function adminRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({
    success: false,
    message: 'Invalid response from server.',
    code: 'UNEXPECTED_RESPONSE',
  }));

  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed.');
    error.code = payload.code;
    error.details = payload.details;
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const adminQuizApi = {
  // Quiz CRUD
  listQuizzes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.pageSize) query.set('pageSize', params.pageSize);
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.courseId) query.set('courseId', params.courseId);
    const qs = query.toString();
    return adminRequest(`/admin/quizzes${qs ? `?${qs}` : ''}`);
  },

  getQuiz: (quizId) => adminRequest(`/admin/quizzes/${quizId}`),

  createQuiz: (data) =>
    adminRequest('/admin/quizzes', { method: 'POST', body: data }),

  updateQuiz: (quizId, data) =>
    adminRequest(`/admin/quizzes/${quizId}`, { method: 'PUT', body: data }),

  deleteQuiz: (quizId) =>
    adminRequest(`/admin/quizzes/${quizId}`, { method: 'DELETE' }),

  // Question CRUD
  listQuestions: (quizId) =>
    adminRequest(`/admin/quizzes/${quizId}/questions`),

  createQuestion: (quizId, data) =>
    adminRequest(`/admin/quizzes/${quizId}/questions`, { method: 'POST', body: data }),

  updateQuestion: (quizId, questionId, data) =>
    adminRequest(`/admin/quizzes/${quizId}/questions/${questionId}`, { method: 'PUT', body: data }),

  deleteQuestion: (quizId, questionId) =>
    adminRequest(`/admin/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' }),

  // Bulk import
  bulkImportQuestions: (quizId, questions) =>
    adminRequest(`/admin/quizzes/${quizId}/questions/import`, {
      method: 'POST',
      body: { questions },
    }),
};