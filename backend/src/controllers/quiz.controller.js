import { sendSuccess } from '../utils/response.util.js';

export async function listQuizzes(req, res, next) {
  try {
    const quizService = req.app.locals.quizService;
    const { courseId, lessonId } = req.query;
    const result = await quizService.listQuizzes(req.user.id, { courseId, lessonId });
    sendSuccess(res, { data: { quizzes: result }, message: 'Danh sách bài kiểm tra.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function startQuiz(req, res, next) {
  try {
    const quizService = req.app.locals.quizService;
    const { quizId } = req.params;
    const result = await quizService.startQuiz(req.user.id, quizId);
    sendSuccess(res, { data: result, message: 'Bắt đầu bài kiểm tra.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function autoSaveAnswers(req, res, next) {
  try {
    const quizService = req.app.locals.quizService;
    const { quizId } = req.params;
    const { answers } = req.body;
    const result = await quizService.autoSaveAnswers(req.user.id, quizId, answers);
    sendSuccess(res, { data: result, message: 'Đã lưu tạm câu trả lời.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function submitQuiz(req, res, next) {
  try {
    const quizService = req.app.locals.quizService;
    const { quizId } = req.params;
    const { answers, startedAt } = req.body;
    const result = await quizService.submitQuiz(req.user.id, quizId, answers, startedAt);
    sendSuccess(res, { data: result, message: 'Nộp bài thành công.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function getResult(req, res, next) {
  try {
    const quizService = req.app.locals.quizService;
    const { submissionId } = req.params;
    const result = await quizService.getResult(req.user.id, submissionId);
    sendSuccess(res, { data: result, message: 'Kết quả bài kiểm tra.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionHistory(req, res, next) {
  try {
    const quizService = req.app.locals.quizService;
    const { quizId, courseId } = req.query;
    let result;
    if (courseId) {
      result = await quizService.getCourseSubmissionHistory(req.user.id, courseId);
    } else if (quizId) {
      result = await quizService.getSubmissionHistory(req.user.id, quizId);
    } else {
      result = [];
    }
    sendSuccess(res, { data: { submissions: result }, message: 'Lịch sử bài kiểm tra.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}