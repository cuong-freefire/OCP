const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5050/api';

async function projectRequest(path, { method = 'GET', body } = {}) {
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

export const projectApi = {
  submitProject: (data) =>
    projectRequest('/projects/submit', { method: 'POST', body: data }),

  getSubmissionHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.finalProjectId) query.set('finalProjectId', params.finalProjectId);
    const qs = query.toString();
    return projectRequest(`/projects/history${qs ? `?${qs}` : ''}`);
  },

  getSubmissionDetail: (submissionId) =>
    projectRequest(`/projects/submissions/${submissionId}`),

  getCurrentStatus: (finalProjectId) =>
    projectRequest(`/projects/status?finalProjectId=${finalProjectId}`),
};