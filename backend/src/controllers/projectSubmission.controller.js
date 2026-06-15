import { sendSuccess } from '../utils/response.util.js';

export async function submitProject(req, res, next) {
  try {
    const { courseId, repositoryUrl, demoUrl } = req.body;
    if (!courseId) {
      return sendSuccess(res, { status: 400, message: 'courseId is required.', code: 'VALIDATION_ERROR' });
    }
    const result = await req.app.locals.projectSubmissionService.submitProject(req.user.id, { courseId, repositoryUrl, demoUrl });
    sendSuccess(res, { status: 201, data: result, message: 'Project submitted successfully.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionHistory(req, res, next) {
  try {
    const { finalProjectId } = req.query;
    const result = await req.app.locals.projectSubmissionService.getSubmissionHistory(req.user.id, finalProjectId);
    sendSuccess(res, { data: { submissions: result }, message: 'Submission history retrieved.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionDetail(req, res, next) {
  try {
    const { submissionId } = req.params;
    const result = await req.app.locals.projectSubmissionService.getSubmissionDetail(req.user.id, submissionId);
    sendSuccess(res, { data: result, message: 'Submission detail retrieved.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentStatus(req, res, next) {
  try {
    const { finalProjectId } = req.query;
    if (!finalProjectId) {
      return sendSuccess(res, { status: 400, message: 'finalProjectId is required.', code: 'VALIDATION_ERROR' });
    }
    const result = await req.app.locals.projectSubmissionService.getCurrentSubmissionStatus(req.user.id, finalProjectId);
    sendSuccess(res, { data: result, message: 'Current submission status retrieved.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}