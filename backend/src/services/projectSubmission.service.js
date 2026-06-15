import { AppError } from '../utils/response.util.js';

const projectCodes = {
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  SUBMISSION_INVALID_URL: 'SUBMISSION_INVALID_URL',
  SUBMISSION_ALREADY_PENDING: 'SUBMISSION_ALREADY_PENDING',
  SUBMISSION_ALREADY_GRADED: 'SUBMISSION_ALREADY_GRADED',
  SUBMISSION_REQUIRES_REJECTION: 'SUBMISSION_REQUIRES_REJECTION',
};

export { projectCodes };

export class ProjectSubmissionService {
  constructor({ repository, config }) {
    this.repository = repository;
    this.config = config;
  }

  isValidUrl(str) {
    if (!str || typeof str !== 'string') return false;
    return /^https?:\/\/.+/.test(str.trim());
  }

  async submitProject(userId, { courseId, repositoryUrl, demoUrl }) {
    // Trim whitespace
    const repoUrl = (repositoryUrl || '').trim();
    const demo = (demoUrl || '').trim();

    // Validate URL
    if (!repoUrl) {
      throw new AppError('Repository URL is required.', 'VALIDATION_ERROR', 400);
    }
    if (!this.isValidUrl(repoUrl)) {
      throw new AppError('Repository URL must be a valid URL starting with http:// or https://.', 'VALIDATION_ERROR', 400);
    }
    if (demo && !this.isValidUrl(demo)) {
      throw new AppError('Demo URL must be a valid URL starting with http:// or https://.', 'VALIDATION_ERROR', 400);
    }

    // Find active final project for this course
    const finalProject = await this.repository.findActiveFinalProject(courseId);
    if (!finalProject) {
      throw new AppError('No active final project found for this course.', 'PROJECT_NOT_FOUND', 404);
    }

    // Check current submission status
    const current = await this.repository.findCurrentSubmission(userId, finalProject.id);
    if (current) {
      if (current.status === 'PENDING') {
        throw new AppError(
          'You already have a pending submission. Please wait for mentor feedback before resubmitting.',
          'SUBMISSION_ALREADY_PENDING',
          400,
        );
      }
      if (current.status === 'GRADED') {
        throw new AppError(
          'Your project has already been graded. Resubmission is not available.',
          'SUBMISSION_ALREADY_GRADED',
          400,
        );
      }
    }

    // Archive previous if this is a resubmission after REJECTED
    if (current && current.status === 'REJECTED') {
      await this.repository.archivePreviousSubmissions(userId, finalProject.id);
    }

    // Check deadline
    const now = new Date();
    const submittedLate = finalProject.endDate ? now > new Date(finalProject.endDate) : false;

    // Get next attempt number
    const latestAttempt = await this.repository.getLatestAttemptNumber(userId, finalProject.id);
    const attemptNumber = latestAttempt + 1;

    // Create submission
    const submission = await this.repository.createSubmission({
      userId,
      finalProjectId: finalProject.id,
      courseId,
      repositoryUrl: repoUrl,
      demoUrl: demo || null,
      status: 'PENDING',
      submittedLate,
      attemptNumber,
      isCurrent: true,
      submittedAt: now,
    });

    return {
      id: submission.id,
      courseId: submission.courseId,
      finalProjectId: submission.finalProjectId,
      finalProjectTitle: finalProject.title,
      repositoryUrl: submission.repositoryUrl,
      demoUrl: submission.demoUrl,
      status: submission.status,
      submittedLate: submission.submittedLate,
      attemptNumber: submission.attemptNumber,
      isCurrent: submission.isCurrent,
      submittedAt: submission.submittedAt.toISOString(),
    };
  }

  async getSubmissionHistory(userId, finalProjectId) {
    let submissions;
    if (finalProjectId) {
      submissions = await this.repository.findAllSubmissions(userId, finalProjectId);
    } else {
      submissions = await this.repository.findSubmissionsByUser(userId);
    }
    return submissions.map((s) => ({
      id: s.id,
      finalProjectId: s.finalProjectId,
      courseId: s.courseId,
      finalProjectTitle: s.finalProject?.title || null,
      repositoryUrl: s.repositoryUrl,
      demoUrl: s.demoUrl,
      status: s.status,
      submittedLate: s.submittedLate,
      attemptNumber: s.attemptNumber,
      isCurrent: s.isCurrent,
      submittedAt: s.submittedAt.toISOString(),
      mentorNotes: s.mentorNotes || null,
    }));
  }

  async getSubmissionDetail(userId, submissionId) {
    const submission = await this.repository.findSubmissionById(submissionId);
    if (!submission) {
      throw new AppError('Submission not found.', 'SUBMISSION_NOT_FOUND', 404);
    }
    if (submission.userId !== userId) {
      throw new AppError('You do not have access to this submission.', 'FORBIDDEN', 403);
    }
    return {
      id: submission.id,
      finalProjectId: submission.finalProjectId,
      courseId: submission.courseId,
      finalProjectTitle: submission.finalProject?.title || null,
      repositoryUrl: submission.repositoryUrl,
      demoUrl: submission.demoUrl,
      status: submission.status,
      submittedLate: submission.submittedLate,
      attemptNumber: submission.attemptNumber,
      isCurrent: submission.isCurrent,
      submittedAt: submission.submittedAt.toISOString(),
      mentorNotes: submission.mentorNotes || null,
    };
  }

  async getCurrentSubmissionStatus(userId, finalProjectId) {
    const current = await this.repository.findCurrentSubmission(userId, finalProjectId);
    if (!current) return null;
    return {
      canSubmit: current.status === 'REJECTED',
      currentStatus: current.status,
      currentAttempt: current.attemptNumber,
      message: current.status === 'PENDING'
        ? 'Your submission is pending review.'
        : current.status === 'GRADED'
          ? 'Your project has been graded.'
          : current.status === 'REJECTED'
            ? 'Your project was not approved. You may resubmit.'
            : null,
    };
  }
}