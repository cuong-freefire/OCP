import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/adminQuiz.controller.js';

export function createAdminQuizRouter() {
  const router = Router();

  // All mentor quiz routes require auth + MENTOR role
  router.use(requireAuth, requireRole('MENTOR'));

  // Quiz CRUD
  router.get('/', controller.listQuizzes);           // GET /admin/quizzes?page=1&pageSize=20&search=&status=&courseId=
  router.get('/:quizId', controller.getQuiz);         // GET /admin/quizzes/:quizId
  router.post('/', controller.createQuiz);             // POST /admin/quizzes
  router.put('/:quizId', controller.updateQuiz);       // PUT /admin/quizzes/:quizId
  router.delete('/:quizId', controller.deleteQuiz);    // DELETE /admin/quizzes/:quizId

  // Question CRUD within a quiz
  router.get('/:quizId/questions', controller.listQuestions);         // GET /admin/quizzes/:quizId/questions
  router.post('/:quizId/questions', controller.createQuestion);        // POST /admin/quizzes/:quizId/questions
  router.put('/:quizId/questions/:questionId', controller.updateQuestion); // PUT /admin/quizzes/:quizId/questions/:questionId
  router.delete('/:quizId/questions/:questionId', controller.deleteQuestion); // DELETE /admin/quizzes/:quizId/questions/:questionId

  // Bulk import
  router.post('/:quizId/questions/import', controller.bulkImportQuestions); // POST /admin/quizzes/:quizId/questions/import

  return router;
}