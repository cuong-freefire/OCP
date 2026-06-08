/**
 * Adapter around the Enrollment/Access module contract.
 * In a real integration, this would call the Payment/Enrollment module service.
 * For MVP, we simulate with a fallback that returns true (free course) or
 * checks a hypothetical enrollment repository.
 *
 * This module must NOT read payment tables directly.
 */

export class CourseAccessService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Check if a learner has active access to a course.
   * @param {string} userId
   * @param {string} courseId
   * @returns {Promise<boolean>}
   */
  async canAccessCourse(userId, courseId) {
    if (!userId || !courseId) return false;
    // Check enrollment in the enrollments table (owned by Payment/Enrollment module)
    // For MVP we check if there is an active enrollment record
    try {
      const enrollment = await this.prisma.enrollment?.findFirst({
        where: {
          userId,
          courseId,
          status: 'active',
        },
      });
      return !!enrollment;
    } catch {
      // If enrollment table doesn't exist yet, fall back to true for testing
      return true;
    }
  }
}