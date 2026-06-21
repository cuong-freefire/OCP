# TASKS.md - Ratings & Feedback Implementation Tasks

**Version:** 1.0  
**Feature:** Ratings & Feedback + Internal Rating Stats API  
**Owner:** Member D  
**Created:** 2026-06-18  
**Status:** Ready for Implementation

---

## Task Overview

Total: 6 tasks, Estimated: 15 hours

---

### T001: Create Rating Validator

**Tên**: Zod schemas for rating and feedback validation

**Files**:
- `backend/src/validators/rating.validator.js` (new)

**Est. Time**: 1.5h

**Description**:
```javascript
const createRatingSchema = z.object({
  courseId: z.string().uuid(),
  rating: z.number().int().min(1).max(5)
});

const updateRatingSchema = z.object({
  rating: z.number().int().min(1).max(5)
});

const createFeedbackSchema = z.object({
  courseId: z.string().uuid(),
  feedbackText: z.string().min(10).max(1000)
});
```

---

### T002: Implement Rating Repository

**Tên**: Data access for ratings, feedbacks, and statistics

**Files**:
- `backend/src/repositories/rating.repository.js` (new)

**Est. Time**: 3h

**Description**:
Functions:
1. `findRatingByUserAndCourse(userId, courseId)` - Check duplicate
2. `findRatingById(ratingId)` - For ownership check
3. `createRating({ courseId, userId, ratingValue })` - INSERT
4. `updateRating(id, { ratingValue })` - UPDATE
5. `deleteRating(id)` - DELETE (hard delete)
6. `createFeedback({ courseId, userId, feedbackText })` - INSERT
7. `getAverageRating(courseId)` - AVG(rating_value)
8. `getTotalRatings(courseId)` - COUNT(*)
9. `getRecentFeedbacks(courseId, limit)` - SELECT 5 recent
10. `getFeedbackCount(courseId)` - COUNT(*)

---

### T003: Implement RatingService

**Tên**: Rating service with enrollment check (E2.4)

**Files**:
- `backend/src/services/rating.service.js` (new)

**Est. Time**: 4h

**Dependencies**: T001, T002

**Description**:
```javascript
class RatingService {
  constructor(enrollmentService, repository) {
    this.enrollmentService = enrollmentService;
    this.repository = repository;
  }
  
  async createRating(userId, courseId, ratingValue) {
    const canSubmit = await this.enrollmentService.canSubmitRating(userId, courseId);
    if (!canSubmit) throw new ForbiddenError('NOT_ENROLLED_ACTIVE');
    
    const existing = await this.repository.findRatingByUserAndCourse(userId, courseId);
    if (existing) throw new ConflictError('ALREADY_RATED');
    
    return await this.repository.createRating({ courseId, userId, ratingValue });
  }
  
  async updateRating(userId, ratingId, ratingValue) {
    const rating = await this.repository.findRatingById(ratingId);
    if (!rating) throw new NotFoundError('RATING_NOT_FOUND');
    if (rating.user_id !== userId) throw new ForbiddenError('NOT_RATING_OWNER');
    
    const canSubmit = await this.enrollmentService.canSubmitRating(userId, rating.course_id);
    if (!canSubmit) throw new ForbiddenError('NOT_ENROLLED_ACTIVE');
    
    return await this.repository.updateRating(ratingId, { ratingValue });
  }
  
  async deleteRating(userId, ratingId) {
    const rating = await this.repository.findRatingById(ratingId);
    if (!rating) throw new NotFoundError('RATING_NOT_FOUND');
    if (rating.user_id !== userId) throw new ForbiddenError('NOT_RATING_OWNER');
    
    await this.repository.deleteRating(ratingId);
  }
  
  async createFeedback(userId, courseId, feedbackText) {
    const canSubmit = await this.enrollmentService.canSubmitRating(userId, courseId);
    if (!canSubmit) throw new ForbiddenError('NOT_ENROLLED_ACTIVE');
    
    return await this.repository.createFeedback({ courseId, userId, feedbackText });
  }
  
  async getRatingStats(courseId) {
    const [avgRating, totalRatings, feedbackCount, recentFeedbacks] = await Promise.all([
      this.repository.getAverageRating(courseId),
      this.repository.getTotalRatings(courseId),
      this.repository.getFeedbackCount(courseId),
      this.repository.getRecentFeedbacks(courseId, 5)
    ]);
    
    return {
      courseId,
      avgRating: avgRating || 0,
      totalRatings,
      feedbackCount,
      recentFeedbacks: recentFeedbacks.map(f => ({
        userId: f.user_id, // UUID only - no PII
        text: f.feedback_text,
        createdAt: f.created_at
      }))
    };
  }
}
```

---

### T004: Implement Controller & Routes

**Tên**: Rating controllers + route mounting

**Files**:
- `backend/src/controllers/rating.controller.js` (new)
- `backend/src/api/learning.routes.js` (update - add rating/feedback routes)

**Est. Time**: 2.5h

**Dependencies**: T003

**Description**:
Controllers:
1. `createRating(req, res, next)` → POST /ratings
2. `updateRating(req, res, next)` → PUT /ratings/:ratingId
3. `deleteRating(req, res, next)` → DELETE /ratings/:ratingId
4. `createFeedback(req, res, next)` → POST /feedbacks
5. `getRatingStats(req, res, next)` → GET /internal/courses/:courseId/rating-stats

Routes:
```
POST /ratings → authMiddleware → requireRole(LEARNER) → validateCreateRating → createRating
PUT /ratings/:ratingId → authMiddleware → requireRole(LEARNER) → validateUpdateRating → updateRating
DELETE /ratings/:ratingId → authMiddleware → requireRole(LEARNER) → deleteRating
POST /feedbacks → authMiddleware → requireRole(LEARNER) → validateCreateFeedback → createFeedback
GET /internal/courses/:courseId/rating-stats → authMiddleware (SERVICE_TOKEN or Manager/Admin) → getRatingStats
```

---

### T005: Internal API Auth Middleware

**Tên**: Auth middleware for /internal/* endpoints (E4.1)

**Files**:
- `backend/src/middlewares/internal.middleware.js` (new)

**Est. Time**: 2h

**Description**:
Support two auth methods for `/internal/*`:
1. Bearer SERVICE_TOKEN (from env var) - for service-to-service
2. Manager/Admin JWT (httpOnly cookie) - for dashboard users

Reject LEARNER/MENTOR roles with 403.

---

### T006: Unit & Integration Tests

**Tên**: Tests for ratings, feedbacks, and internal API

**Files**:
- `backend/tests/unit/services/rating.service.test.js` (new)
- `backend/tests/integration/rating.test.js` (new)

**Est. Time**: 2h

**Dependencies**: T004

**Description**:
Unit tests: create/update/delete rating, duplicate protection, ownership check, feedback creation, rating stats
Integration tests: full HTTP flow for all endpoints

---

## SUMMARY

| ID | Task | Est. Time |
|----|------|-----------|
| T001 | Rating Validator | 1.5h |
| T002 | Rating Repository | 3h |
| T003 | RatingService with DI | 4h |
| T004 | Controller & Routes | 2.5h |
| T005 | Internal API Middleware | 2h |
| T006 | Tests | 2h |
| **Total** | | **15h** |

---

**Status**: Ready. Depends on EnrollmentService.canSubmitRating() from Member C.