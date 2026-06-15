export class ProjectSubmissionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findActiveFinalProject(courseId) {
    return this.prisma.finalProject.findFirst({
      where: { courseId, status: 'active' },
    });
  }

  async findCurrentSubmission(userId, finalProjectId) {
    return this.prisma.projectSubmission.findFirst({
      where: { userId, finalProjectId, isCurrent: true },
    });
  }

  async findAllSubmissions(userId, finalProjectId) {
    return this.prisma.projectSubmission.findMany({
      where: { userId, finalProjectId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async createSubmission(data) {
    return this.prisma.projectSubmission.create({ data });
  }

  async archivePreviousSubmissions(userId, finalProjectId) {
    return this.prisma.projectSubmission.updateMany({
      where: { userId, finalProjectId, isCurrent: true },
      data: { isCurrent: false, status: 'ARCHIVED' },
    });
  }

  async getLatestAttemptNumber(userId, finalProjectId) {
    const last = await this.prisma.projectSubmission.findFirst({
      where: { userId, finalProjectId },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });
    return last?.attemptNumber || 0;
  }

  async findSubmissionsByUser(userId) {
    return this.prisma.projectSubmission.findMany({
      where: { userId },
      include: {
        finalProject: { select: { id: true, title: true, courseId: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findSubmissionById(id) {
    return this.prisma.projectSubmission.findUnique({
      where: { id },
      include: {
        finalProject: { select: { id: true, title: true, endDate: true } },
      },
    });
  }
}