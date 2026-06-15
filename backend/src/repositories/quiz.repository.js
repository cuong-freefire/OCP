export class QuizRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // ========== Learner-facing (published quizzes only) ==========

  async findActiveQuizzesByCourse(courseId) {
    return this.prisma.quiz.findMany({
      where: { courseId, status: 'published' },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveQuizzesByLesson(lessonId) {
    return this.prisma.quiz.findMany({
      where: { lessonId, status: 'published' },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveQuizById(quizId) {
    return this.prisma.quiz.findFirst({
      where: { id: quizId, status: 'published' },
      include: { _count: { select: { questions: true } } },
    });
  }

  async findQuizQuestionsSafe(quizId) {
    return this.prisma.quizQuestion.findMany({
      where: { quizId },
      select: {
        id: true,
        questionText: true,
        questionType: true,
        options: true,
        points: true,
        order: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async findQuizQuestionsWithAnswers(quizId) {
    return this.prisma.quizQuestion.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
    });
  }

  async createSubmission(data) {
    return this.prisma.quizSubmission.create({ data });
  }

  async findSubmissionById(submissionId) {
    return this.prisma.quizSubmission.findUnique({
      where: { id: submissionId },
      include: {
        quiz: {
          select: { id: true, title: true, description: true, passingScore: true },
        },
      },
    });
  }

  async findSubmissionsForQuiz(userId, quizId) {
    return this.prisma.quizSubmission.findMany({
      where: { userId, quizId },
      select: {
        id: true, score: true, maxScore: true, passed: true,
        startedAt: true, submittedAt: true, createdAt: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findSubmissionsByCourse(userId, courseId) {
    return this.prisma.quizSubmission.findMany({
      where: { userId, quiz: { courseId } },
      select: {
        id: true, score: true, maxScore: true, passed: true,
        startedAt: true, submittedAt: true, createdAt: true,
        quiz: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getLearnerAttemptSummary(userId, quizId) {
    const submissions = await this.prisma.quizSubmission.findMany({
      where: { userId, quizId },
      select: { score: true, maxScore: true, passed: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    });
    if (submissions.length === 0) return null;
    return {
      attempts: submissions.length,
      bestScore: Math.max(...submissions.map((s) => s.score)),
      lastPassed: submissions[0].passed,
      lastSubmittedAt: submissions[0].submittedAt,
    };
  }

  // ========== Admin CRUD: Quiz ==========

  async findQuizById(quizId) {
    return this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { _count: { select: { questions: true } } },
    });
  }

  /**
   * Paginated quiz listing with search, status, and courseId filters.
   */
  async findQuizzesAdmin({ page = 1, pageSize = 20, search, status, courseId }) {
    const where = {};
    if (search) {
      where.title = { contains: search };
    }
    if (status) {
      where.status = status;
    }
    if (courseId) {
      where.courseId = courseId;
    }

    const [quizzes, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        include: { _count: { select: { questions: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.quiz.count({ where }),
    ]);

    return {
      quizzes: quizzes.map((q) => ({
        id: q.id,
        courseId: q.courseId,
        lessonId: q.lessonId,
        title: q.title,
        description: q.description,
        timeLimitMinutes: q.timeLimitMinutes,
        passingScore: q.passingScore,
        status: q.status,
        questionCount: q._count?.questions || 0,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createQuiz(data) {
    return this.prisma.quiz.create({
      data: {
        courseId: data.courseId,
        lessonId: data.lessonId || null,
        title: data.title,
        description: data.description || null,
        timeLimitMinutes: data.timeLimitMinutes ? Number(data.timeLimitMinutes) : null,
        passingScore: Number(data.passingScore) || 70,
        status: data.status || 'draft',
      },
    });
  }

  async updateQuiz(quizId, data) {
    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.timeLimitMinutes !== undefined) updateData.timeLimitMinutes = data.timeLimitMinutes ? Number(data.timeLimitMinutes) : null;
    if (data.passingScore !== undefined) updateData.passingScore = Number(data.passingScore);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.courseId !== undefined) updateData.courseId = data.courseId;
    if (data.lessonId !== undefined) updateData.lessonId = data.lessonId || null;

    return this.prisma.quiz.update({
      where: { id: quizId },
      data: updateData,
    });
  }

  async deleteQuiz(quizId) {
    // Delete submissions first, then questions, then quiz
    await this.prisma.quizSubmission.deleteMany({ where: { quizId } });
    await this.prisma.quizQuestion.deleteMany({ where: { quizId } });
    return this.prisma.quiz.delete({ where: { id: quizId } });
  }

  // ========== Admin CRUD: Questions ==========

  async findQuestionsByQuiz(quizId) {
    return this.prisma.quizQuestion.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
    });
  }

  async findQuestionById(questionId) {
    return this.prisma.quizQuestion.findUnique({ where: { id: questionId } });
  }

  async createQuestion(data) {
    // Auto-assign order if not provided
    if (data.order === undefined || data.order === null) {
      const lastQuestion = await this.prisma.quizQuestion.findFirst({
        where: { quizId: data.quizId },
        orderBy: { order: 'desc' },
      });
      data.order = (lastQuestion?.order ?? -1) + 1;
    }
    return this.prisma.quizQuestion.create({ data });
  }

  async updateQuestion(questionId, data) {
    return this.prisma.quizQuestion.update({
      where: { id: questionId },
      data,
    });
  }

  async deleteQuestion(questionId) {
    return this.prisma.quizQuestion.delete({ where: { id: questionId } });
  }

  /**
   * Bulk create questions for a quiz. Validates and returns errors per item.
   * @param {string} quizId
   * @param {Array} questions - Array of question objects
   * @returns {{ created: number, errors: Array, questions: Array }}
   */
  async bulkCreateQuestions(quizId, questions) {
    const validQuestionTypes = ['single_choice', 'multiple_choice', 'true_false'];
    const errors = [];
    const validQuestions = [];
    let nextOrder = 0;

    const lastQuestion = await this.prisma.quizQuestion.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
    });
    nextOrder = (lastQuestion?.order ?? -1) + 1;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const itemErrors = [];

      if (!q.questionText || String(q.questionText).trim().length === 0) {
        itemErrors.push('questionText is required.');
      }
      if (!q.questionType || !validQuestionTypes.includes(q.questionType)) {
        itemErrors.push(`questionType must be one of: ${validQuestionTypes.join(', ')}.`);
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        itemErrors.push('options must be an array with at least 2 entries.');
      }
      if (q.correctAnswer === undefined || q.correctAnswer === null) {
        itemErrors.push('correctAnswer is required.');
      }
      if (q.questionType === 'single_choice' && !q.options.some((o) => String(o.value || o) === String(q.correctAnswer))) {
        itemErrors.push('correctAnswer does not match any option value for single_choice.');
      }
      if (q.questionType === 'multiple_choice') {
        if (!Array.isArray(q.correctAnswer)) {
          itemErrors.push('correctAnswer must be an array for multiple_choice.');
        } else {
          for (const ans of q.correctAnswer) {
            if (!q.options.some((o) => String(o.value || o) === String(ans))) {
              itemErrors.push(`correctAnswer value "${ans}" does not match any option value.`);
            }
          }
        }
      }

      if (itemErrors.length > 0) {
        errors.push({ index: i, questionText: q.questionText || '(empty)', errors: itemErrors });
      } else {
        validQuestions.push({
          quizId,
          questionText: String(q.questionText).trim(),
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
          points: Number(q.points) || 1,
          order: nextOrder + validQuestions.length,
        });
      }
    }

    let created = 0;
    const createdQuestions = [];
    if (validQuestions.length > 0) {
      // Prisma doesn't support createMany with JSON for MySQL easily, so create one by one
      for (const q of validQuestions) {
        const createdQ = await this.prisma.quizQuestion.create({ data: q });
        createdQuestions.push(createdQ);
        created++;
      }
    }

    return { created, errors, questions: createdQuestions };
  }
}