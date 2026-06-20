# Implementation Plan: Ratings & Feedback (feat-ratings-feedback)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Generated:** 2026-06-18 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy

- **Enrollment-gated (E2.4)**: All rating/feedback operations check `enrollment.status === 'active'` via `EnrollmentService.canSubmitRating()`
- **Ownership Enforcement**: PUT/DELETE ratings validate `rating.user_id === req.user.userId` (IDOR prevention)
- **Internal API Security**: `/internal/*` endpoints accept Bearer SERVICE_TOKEN or Manager/Admin JWT only
- **No PII Leak**: Internal API returns aggregate data only; recentFeedbacks contain userId (UUID) but NOT email/name

### Key Patterns

1. **E2.4 Fix**: Use `canSubmitRating()` from EnrollmentService (DI) - NOT direct enrollment table query
2. **UNIQUE Constraint**: Database-level UNIQUE (course_id, user_id) prevents duplicate ratings
3. **Hard Delete for Ratings**: Ratings are not business-critical data - hard delete is acceptable
4. **Aggregate Query**: Use Prisma aggregate (AVG, COUNT) for rating-stats

---

## 2. COMPONENTS

### Backend Module Structure

#### A. Controllers (`rating.controller.js`)

- **POST `/ratings`**: Create rating → call RatingService.createRating()
- **PUT `/ratings/:ratingId`**: Update rating → call RatingService.updateRating()
- **DELETE `/ratings/:ratingId`**: Delete rating → call RatingService.deleteRating()
- **POST `/feedbacks`**: Create feedback → call RatingService.createFeedback()
- **GET `/internal/courses/:courseId/rating-stats`**: Get stats → call RatingService.getRatingStats()

#### B. Service (`rating.service.js`)

- **constructor(enrollmentService)**: DI from Member C
- **createRating(userId, courseId, ratingValue)**: Check enrollment → check duplicate → create
- **updateRating(userId, ratingId, ratingValue)**: Check ownership → check enrollment → update
- **deleteRating(userId, ratingId)**: Check ownership → delete
- **createFeedback(userId, courseId, feedbackText)**: Check enrollment → create
- **getRatingStats(courseId)**: Aggregate AVG, COUNT from ratings + recent feedbacks

#### C. Repository (`rating.repository.js`)

- **findRatingByUserAndCourse(userId, courseId)**: Check duplicate
- **findRatingById(ratingId)**: For ownership check
- **createRating(data)**: INSERT
- **updateRating(id, data)**: UPDATE rating_value
- **deleteRating(id)**: DELETE
- **createFeedback(data)**: INSERT
- **getRatingStats(courseId)**: AVG(rating_value), COUNT(*)
- **getRecentFeedbacks(courseId, limit)**: SELECT recent 5 feedbacks

---

## 3. DATA FLOW

### 3.1 Create Rating Flow

```
Learner: POST /ratings { courseId, rating }
  ↓
authMiddleware(requireRole=LEARNER) → validate body
  ↓
RatingService.createRating(userId, courseId, ratingValue):
  - Call this.enrollmentService.canSubmitRating(userId, courseId)
  - If not active → throw ForbiddenError('NOT_ENROLLED_ACTIVE')
  - Check duplicate: findRatingByUserAndCourse(userId, courseId)
  - If exists → throw ConflictError('ALREADY_RATED')
  - Create rating record
  - Return rating object
  ↓
Controller: HTTP 201
```

### 3.2 Internal Rating Stats Flow

```
Manager/Admin: GET /internal/courses/:courseId/rating-stats
  ↓
authMiddleware (SERVICE_TOKEN or Manager/Admin JWT)
  ↓
RatingService.getRatingStats(courseId):
  - AVG(rating_value) → avgRating
  - COUNT(ratings) → totalRatings
  - COUNT(feedbacks) → feedbackCount
  - SELECT 5 recent feedbacks (id, user_id, feedback_text, created_at)
  - Return aggregate data
  ↓
Controller: HTTP 200 (NO learner PII)
```

---

## 4. DEPENDENCIES

| Package | Purpose |
|---------|---------|
| `zod` | Request validation (rating 1-5, UUID, feedbackText min 10 chars) |

Implementation order: Validator → Repository → Service → Controller → Route

---

## 5. RISKS

### Risk: EnrollmentService unavailable (LOW)
**Mitigation**: Fail closed - deny rating/feedback if canSubmitRating throws error.

### Risk: Concurrent duplicate rating (LOW)
**Mitigation**: UNIQUE constraint at DB level catches race condition. Prisma throws P2002 → map to ConflictError.

---

## Sign-Off

**Plan Owner:** Member D (Learning Module)  
**Next Step:** Human approval → implement tasks.md