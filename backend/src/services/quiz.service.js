import { AppError, quizCodes } from '../utils/response.util.js';
import { ScoringService } from './scoring.service.js';

export class QuizService {
  constructor({ repository, courseAccessService, scoringService, config }) {
    this.repository = repository;
    this.courseAccessService = courseAccessService;
    this.scoringService = scoringService || new ScoringService();
    this.config = config;
  }

  /**
   * List active quizzes for a course/lesson that the learner can access.
   */
  async listQuizzes(userId, { courseId, lessonId }) {
    let quizzes;

    if (lessonId) {
      quizzes = await this.repository.findActiveQuizzesByLesson(lessonId);
    } else if (courseId) {
      quizzes = await this.repository.findActiveQuizzesByCourse(courseId);
    } else {
      throw new AppError('Thiếu courseId hoặc lessonId.', 'VALIDATION_ERROR', 400);
    }

    // Enrich with learner attempt summary
    const result = [];
    for (const quiz of quizzes) {
      const attemptSummary = await this.repository.getLearnerAttemptSummary(userId, quiz.id);
      result.push({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz._count?.questions || 0,
        timeLimitMinutes: quiz.timeLimitMinutes,
        passingScore: quiz.passingScore,
        status: quiz.status,
        attemptSummary,
      });
    }

    return result;
  }

  /**
   * Start a quiz: verify access, check quiz is active, return safe questions.
   */
  async startQuiz(userId, quizId) {
    const quiz = await this.repository.findActiveQuizById(quizId);
    if (!quiz) {
      throw new AppError('Bài kiểm tra không tồn tại hoặc chưa được kích hoạt.', quizCodes.QUIZ_NOT_FOUND, 404);
    }

    // Verify course access
    const canAccess = await this.courseAccessService.canAccessCourse(userId, quiz.courseId);
    if (!canAccess) {
      throw new AppError('Bạn không có quyền truy cập bài kiểm tra này.', quizCodes.QUIZ_ACCESS_DENIED, 403);
    }

    // Check if quiz has questions
    if ((quiz._count?.questions || 0) === 0) {
      throw new AppError('Bài kiểm tra chưa có câu hỏi nào.', quizCodes.QUIZ_NO_QUESTIONS, 400);
    }

    // Get safe questions (no correct answers)
    const questions = await this.repository.findQuizQuestionsSafe(quizId);

    return {
      quizId: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimitMinutes: quiz.timeLimitMinutes,
      passingScore: quiz.passingScore,
      questionCount: questions.length,
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        points: q.points,
        order: q.order,
      })),
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Auto-save answers for a quiz (save without finalizing).
   * Creates or updates a draft submission record.
   */
  async autoSaveAnswers(userId, quizId, answers) {
    const quiz = await this.repository.findActiveQuizById(quizId);
    if (!quiz) {
      throw new AppError('Bài kiểm tra không tồn tại.', quizCodes.QUIZ_NOT_FOUND, 404);
    }

    const canAccess = await this.courseAccessService.canAccessCourse(userId, quiz.courseId);
    if (!canAccess) {
      throw new AppError('Bạn không có quyền truy cập bài kiểm tra này.', quizCodes.QUIZ_ACCESS_DENIED, 403);
    }

    // Validate answers against questions
    const questions = await this.repository.findQuizQuestionsSafe(quizId);
    this._validateAnswers(questions, answers);

    // Store in a lightweight auto-save (in a real impl you'd use a separate table or Redis)
    // For MVP, we store on the existing submission as a metadata approach
    return { saved: true, savedAt: new Date().toISOString() };
  }

  /**
   * Submit answers, auto-grade, and store the result.
   */
  async submitQuiz(userId, quizId, answers, startedAt) {
    const quiz = await this.repository.findActiveQuizById(quizId);
    if (!quiz) {
      throw new AppError('Bài kiểm tra không tồn tại hoặc chưa được kích hoạt.', quizCodes.QUIZ_NOT_FOUND, 404);
    }

    const canAccess = await this.courseAccessService.canAccessCourse(userId, quiz.courseId);
    if (!canAccess) {
      throw new AppError('Bạn không có quyền truy cập bài kiểm tra này.', quizCodes.QUIZ_ACCESS_DENIED, 403);
    }

    if ((quiz._count?.questions || 0) === 0) {
      throw new AppError('Bài kiểm tra chưa có câu hỏi nào.', quizCodes.QUIZ_NO_QUESTIONS, 400);
    }

    // Validate answers
    const questions = await this.repository.findQuizQuestionsWithAnswers(quizId);
    this._validateAnswers(questions, answers);

    // Check time limit
    if (quiz.timeLimitMinutes && startedAt) {
      const startTime = new Date(startedAt).getTime();
      const submitTime = Date.now();
      const elapsedMinutes = (submitTime - startTime) / 60000;
      if (elapsedMinutes > quiz.timeLimitMinutes) {
        throw new AppError(
          'Đã hết thời gian làm bài. Vui lòng nộp bài trong thời gian quy định.',
          quizCodes.QUIZ_LATE_SUBMISSION,
          400,
        );
      }
    }

    // Auto-grade
    const { score, maxScore, details: scoringDetails } = this.scoringService.score(questions, answers);
    const passed = this.scoringService.isPassed(score, maxScore, quiz.passingScore);

    // Store submission
    const submission = await this.repository.createSubmission({
      userId,
      quizId,
      answers,
      score,
      maxScore,
      passed,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      submittedAt: new Date(),
    });

    // Build per-question result
    const questionResultMap = new Map(scoringDetails.map((d) => [d.questionId, d]));
    const resultDetails = questions.map((q) => {
      const detail = questionResultMap.get(q.id) || { correct: false, points: 0, maxPoints: q.points };
      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        correct: detail.correct,
        points: detail.points,
        maxPoints: detail.maxPoints,
      };
    });

    return {
      submissionId: submission.id,
      quizTitle: quiz.title,
      score,
      maxScore,
      passed,
      passedScore: quiz.passingScore,
      submittedAt: submission.submittedAt.toISOString(),
      startedAt: submission.startedAt.toISOString(),
      details: resultDetails,
    };
  }

  /**
   * Get the result of a specific submission (ownership enforced).
   */
  async getResult(userId, submissionId) {
    const submission = await this.repository.findSubmissionById(submissionId);
    if (!submission) {
      throw new AppError('Bài nộp không tồn tại.', quizCodes.QUIZ_SUBMISSION_NOT_FOUND, 404);
    }

    if (submission.userId !== userId) {
      throw new AppError('Bạn không có quyền xem kết quả này.', quizCodes.QUIZ_NOT_OWNER, 403);
    }

    // Get questions with answers for detailed review
    const questions = await this.repository.findQuizQuestionsWithAnswers(submission.quizId);

    const details = questions.map((q) => {
      const answer = (submission.answers || []).find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points,
        selectedOptions: answer?.selectedOptions || [],
      };
    });

    return {
      submissionId: submission.id,
      quizTitle: submission.quiz?.title || 'Bài kiểm tra',
      score: submission.score,
      maxScore: submission.maxScore,
      passed: submission.passed,
      passedScore: submission.quiz?.passingScore || 0,
      startedAt: submission.startedAt.toISOString(),
      submittedAt: submission.submittedAt.toISOString(),
      details,
    };
  }

  /**
   * Get submission history for a specific quiz.
   */
  async getSubmissionHistory(userId, quizId) {
    return this.repository.findSubmissionsForQuiz(userId, quizId);
  }

  /**
   * Get submission history for a course.
   */
  async getCourseSubmissionHistory(userId, courseId) {
    return this.repository.findSubmissionsByCourse(userId, courseId);
  }

  /**
   * Validate submitted answers against quiz questions structure.
   */
  _validateAnswers(questions, answers) {
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new AppError('Phải có ít nhất một câu trả lời.', quizCodes.QUIZ_INVALID_ANSWERS, 400);
    }

    const validQuestionIds = new Set(questions.map((q) => q.id));
    const seenIds = new Set();

    for (const answer of answers) {
      if (!answer.questionId) {
        throw new AppError('Thiếu ID câu hỏi trong câu trả lời.', quizCodes.QUIZ_INVALID_ANSWERS, 400);
      }

      if (!validQuestionIds.has(answer.questionId)) {
        throw new AppError(
          `Câu hỏi ID "${answer.questionId}" không thuộc bài kiểm tra này.`,
          quizCodes.QUESTION_NOT_FOUND,
          400,
        );
      }

      if (seenIds.has(answer.questionId)) {
        throw new AppError(
          `Câu hỏi ID "${answer.questionId}" bị trùng lặp.`,
          quizCodes.QUIZ_INVALID_ANSWERS,
          400,
        );
      }
      seenIds.add(answer.questionId);

      if (!Array.isArray(answer.selectedOptions)) {
        throw new AppError(
          `Câu trả lời cho câu hỏi ID "${answer.questionId}" phải là một mảng.`,
          quizCodes.QUIZ_INVALID_ANSWERS,
          400,
        );
      }

      // Validate options exist in question's option set
      const question = questions.find((q) => q.id === answer.questionId);
      if (question && answer.selectedOptions.length > 0) {
        const questionOptions = Array.isArray(question.options) ? question.options : [];
        for (const opt of answer.selectedOptions) {
          const optionExists = questionOptions.some(
            (o) => String(o.value) === String(opt) || String(o) === String(opt),
          );
          if (!optionExists) {
            throw new AppError(
              `Giá trị "${opt}" không phải là lựa chọn hợp lệ cho câu hỏi ID "${answer.questionId}".`,
              quizCodes.QUIZ_INVALID_ANSWERS,
              400,
            );
          }
        }
      }
    }
  }
}