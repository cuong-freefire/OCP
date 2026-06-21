# Context: Ratings & Feedback (feat-ratings-feedback)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Feature ID:** feat-ratings-feedback | **Inherits:** CLAUDE.md, share_context.md, DATABASE.md

## 1. Feature Overview

Tính năng này cho phép Learner đánh giá (rating) và gửi phản hồi (feedback) cho khóa học đã mua. Đồng thời cung cấp Internal Analytics API cho Manager/Admin xem thống kê đánh giá.

## 2. Related Business Requirements

- Learner chỉ được rating/feedback khi có enrollment active (E2.4)
- Mỗi learner chỉ được rating 1 lần cho 1 khóa học (UNIQUE constraint trên course_id + user_id)
- Learner có thể feedback nhiều lần (không giới hạn)
- Rating value từ 1-5 (INT, CHECK constraint)
- Internal API (T065) phục vụ Manager Dashboard (Member E) và Mentor analytics (Member B)

## 3. Related Tasks

| ID | Task | Dependencies |
|----|------|-------------|
| T062 | POST /ratings (E2.4: enrollment.status='active' only) | T044 (EnrollmentService từ C) |
| T062 | PUT /ratings/:ratingId (update rating) | T062 |
| T062 | DELETE /ratings/:ratingId (delete rating) | T062 |
| T063 | POST /feedbacks (learner feedback) | T060 |
| T065 | GET /internal/courses/:courseId/rating-stats (Internal API) | T064 |

## 4. Critical Fix - E2.4: Enrollment Status for Rating

```javascript
// T062: POST /ratings
const enrollment = await db.enrollments.findUnique({
  where: { user_id_course_id: { user_id: userId, course_id: courseId } }
});

if (!enrollment || enrollment.status !== 'active') {
  throw new ForbiddenError('NOT_ENROLLED_ACTIVE');
}

// Chỉ tạo đánh giá nếu đang hoạt động
await db.ratings.create({
  data: { course_id: courseId, user_id: userId, rating_value: body.rating }
});
```

## 5. Module Ownership

- **Member D (Learning):** Owns `ratings`, `feedbacks` tables
- **Member C (Payment/Enrollment):** Provides `EnrollmentService.canSubmitRating()` via DI
- **Member A (Auth):** Provides AUTH_MIDDLEWARE

## 6. Internal API Contract (T065)

```
GET /internal/courses/:courseId/rating-stats
Authorization: SERVICE_TOKEN or Manager/Admin JWT

Response:
{
  courseId: "uuid",
  avgRating: 4.2,
  totalRatings: 142,
  feedbackCount: 89,
  recentFeedbacks: [
    { userId: "uuid", text: "...", createdAt: "..." }
  ]
}