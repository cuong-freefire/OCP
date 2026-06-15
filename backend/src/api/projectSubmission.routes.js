import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/projectSubmission.controller.js';

export function createProjectSubmissionRouter() {
  const router = Router();

  // All project submission routes require auth + LEARNER role
  router.use(requireAuth, requireRole('LEARNER'));

  // POST /projects/submit - submit a final project
  router.post('/submit', controller.submitProject);

  // GET /projects/history?finalProjectId=xxx - get submission history
  router.get('/history', controller.getSubmissionHistory);

  // GET /projects/status?finalProjectId=xxx - get current submission status
  router.get('/status', controller.getCurrentStatus);

  // GET /projects/submissions/:submissionId - get submission detail
  router.get('/submissions/:submissionId', controller.getSubmissionDetail);

  return router;
}