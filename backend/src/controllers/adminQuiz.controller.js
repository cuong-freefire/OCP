import { sendSuccess } from '../utils/response.util.js';

export async function listQuizzes(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { page = '1', pageSize = '20', search, status, courseId } = req.query;
    const result = await quizRepository.findQuizzesAdmin({
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      search,
      status,
      courseId,
    });
    sendSuccess(res, { data: result, message: 'Quiz list retrieved.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function getQuiz(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { quizId } = req.params;
    const quiz = await quizRepository.findQuizById(quizId);
    if (!quiz) {
      return sendSuccess(res, { status: 404, message: 'Quiz not found.', code: 'QUIZ_NOT_FOUND' });
    }
    sendSuccess(res, { data: quiz, message: 'Quiz retrieved.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function createQuiz(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { courseId, lessonId, title, description, timeLimitMinutes, passingScore, status } = req.body;
    if (!title || !courseId) {
      return sendSuccess(res, { status: 400, message: 'title and courseId are required.', code: 'VALIDATION_ERROR' });
    }
    const quiz = await quizRepository.createQuiz({ courseId, lessonId, title, description, timeLimitMinutes, passingScore, status });
    sendSuccess(res, { status: 201, data: quiz, message: 'Quiz created.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function updateQuiz(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { quizId } = req.params;
    const existing = await quizRepository.findQuizById(quizId);
    if (!existing) {
      return sendSuccess(res, { status: 404, message: 'Quiz not found.', code: 'QUIZ_NOT_FOUND' });
    }
    const quiz = await quizRepository.updateQuiz(quizId, req.body);
    sendSuccess(res, { data: quiz, message: 'Quiz updated.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function deleteQuiz(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { quizId } = req.params;
    const existing = await quizRepository.findQuizById(quizId);
    if (!existing) {
      return sendSuccess(res, { status: 404, message: 'Quiz not found.', code: 'QUIZ_NOT_FOUND' });
    }
    await quizRepository.deleteQuiz(quizId);
    sendSuccess(res, { message: 'Quiz and all associated data deleted.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

// ========== Question CRUD ==========

export async function listQuestions(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { quizId } = req.params;
    const questions = await quizRepository.findQuestionsByQuiz(quizId);
    sendSuccess(res, { data: { questions }, message: 'Questions retrieved.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function createQuestion(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { quizId } = req.params;
    const { questionText, questionType, options, correctAnswer, explanation, points, order } = req.body;

    if (!questionText || !questionType || !options) {
      return sendSuccess(res, { status: 400, message: 'questionText, questionType, and options are required.', code: 'VALIDATION_ERROR' });
    }

    const question = await quizRepository.createQuestion({
      quizId,
      questionText,
      questionType,
      options,
      correctAnswer,
      explanation: explanation || null,
      points: parseInt(points, 10) || 1,
      order: order !== undefined ? parseInt(order, 10) : undefined,
    });
    sendSuccess(res, { status: 201, data: question, message: 'Question created.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function updateQuestion(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { questionId } = req.params;
    const existing = await quizRepository.findQuestionById(questionId);
    if (!existing) {
      return sendSuccess(res, { status: 404, message: 'Question not found.', code: 'QUESTION_NOT_FOUND' });
    }
    const question = await quizRepository.updateQuestion(questionId, req.body);
    sendSuccess(res, { data: question, message: 'Question updated.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

export async function deleteQuestion(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { questionId } = req.params;
    const existing = await quizRepository.findQuestionById(questionId);
    if (!existing) {
      return sendSuccess(res, { status: 404, message: 'Question not found.', code: 'QUESTION_NOT_FOUND' });
    }
    await quizRepository.deleteQuestion(questionId);
    sendSuccess(res, { message: 'Question deleted.', code: 'OK' });
  } catch (error) {
    next(error);
  }
}

// ========== Bulk Import ==========

export async function bulkImportQuestions(req, res, next) {
  try {
    const quizRepository = req.app.locals.quizService.repository;
    const { quizId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return sendSuccess(res, { status: 400, message: 'questions array is required with at least one entry.', code: 'VALIDATION_ERROR' });
    }

    const result = await quizRepository.bulkCreateQuestions(quizId, questions);
    sendSuccess(res, { data: result, message: `${result.created} questions created.`, code: 'OK' });
  } catch (error) {
    next(error);
  }
}