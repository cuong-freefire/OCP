export class QuizRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findActiveQuizzesByCourse(courseId) {
    return this.prisma.quiz.findMany({
      where: { courseId, status: 'active' },
      include: {
        _count: { select: { questions: true } },
        submissions: {
          where: { userId: '' },
          select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true },
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveQuizzesByLesson(lessonId) {
    return this.prisma.quiz.findMany({
      where: { lessonId, status: 'active' },
      include: {
        _count: { select: { questions: true } },
        submissions: {
          where: { userId: '' },
          select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true },
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findQuizById(quizId) {
    return this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { _count: { select: { questions: true } } },
    });
  }

  async findActiveQuizById(quizId) {
    return this.prisma.quiz.findFirst({
      where: { id: quizId, status: 'active' },
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

  async findExistingSubmission(userId, quizId) {
    return this.prisma.quizSubmission.findFirst({
      where: { userId, quizId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async countUserSubmissions(userId, quizId) {
    return this.prisma.quizSubmission.count({
      where: { userId, quizId },
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
        id: true,
        score: true,
        maxScore: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
        createdAt: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findSubmissionsByCourse(userId, courseId) {
    return this.prisma.quizSubmission.findMany({
      where: {
        userId,
        quiz: { courseId },
      },
      select: {
        id: true,
        score: true,
        maxScore: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
        createdAt: true,
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
}