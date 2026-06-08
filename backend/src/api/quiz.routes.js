import { Router } from 'express';
import {
  quizIdParamSchema,
  submitAnswerSchema,
  quizListQuerySchema,
} from '../validators/quiz.validator.js';
import { validate } from '../middlewares/validation.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/quiz.controller.js';

export function createQuizRouter() {
  const router = Router();

  // All quiz routes require authentication
  router.use(requireAuth);

  // GET /quizzes?courseId=xxx&lessonId=xxx - list active quizzes
  router.get('/', validate(quizListQuerySchema, 'query'), controller.listQuizzes);

  // GET /quizzes/:quizId/start - start a quiz (get safe questions)
  router.get('/:quizId/start', controller.startQuiz);

  // POST /quizzes/:quizId/auto-save - auto-save answers (fire-and-forget)
  router.post('/:quizId/auto-save', validate(submitAnswerSchema), controller.autoSaveAnswers);

  // POST /quizzes/:quizId/submit - submit answers for grading
  router.post('/:quizId/submit', validate(submitAnswerSchema), controller.submitQuiz);

  // GET /submissions/:submissionId/result - get quiz result
  router.get('/submissions/:submissionId/result', controller.getResult);

  // GET /submissions/history?quizId=xxx&courseId=xxx - submission history
  router.get('/submissions/history', controller.getSubmissionHistory);

  return router;
}