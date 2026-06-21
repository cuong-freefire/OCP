# Context: Learning Lessons (feat-learning-lessons)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Feature ID:** feat-learning-lessons | **Inherits:** CLAUDE.md, share_context.md, DATABASE.md

## 1. Feature Overview

Tính năng này cung cấp API cho Learner truy cập nội dung bài học (lesson) và theo dõi tiến độ học tập (progress) trong khóa học.

## 2. Related Business Requirements

- Learner chỉ được xem lesson khi có enrollment active (kiểm tra qua EnrollmentService từ Member C)
- Lesson assets (video/document) được Cloudinary signed URLs, expire sau 1 giờ
- Progress tracking tính phần trăm lessons đã hoàn thành trong course
- MENTOR/MANAGER/ADMIN bypass enrollment check (role-based bypass)

## 3. Related Tasks

| ID | Task | Dependencies |
|----|------|-------------|
| T060 | GET /lessons/:lessonId (lesson content + assets with signed URLs) | T008 (auth Middleware from A) |
| T064 | GET /progress/:courseId (learner progress tracking) | T062 (ratings done first) |

## 4. Module Ownership

- **Member D (Learning):** Owns `quiz_submissions`, `ratings`, `feedbacks` tables
- **Member C (Payment/Enrollment):** Provides `EnrollmentService.canAccessCourse()` via DI
- **Member A (Auth):** Provides AUTH_MIDDLEWARE for protected routes

## 5. Cross-Module Contracts Used

- `authMiddleware` from Member A - all endpoints require User JWT
- `EnrollmentService.canAccessCourse(userId, courseId, role)` from Member C via DI (NOT HTTP)
- Role-based bypass: MANAGER/ADMIN always access; MENTOR access own courses

## 6. Constraints & Business Rules

- 100% paid courses - no free content preview beyond catalog
- Lesson access requires `enrollment.status === 'active'` (for LEARNER role)
- Cloudinary signed URL expires in 1 hour (not stored in DB)
- Backend NEVER returns raw video/document URLs - only signed URLs
- Backend NEVER handles multipart file uploads - Cloudinary direct upload only
- Progress tracking is read-only derived data (no progress table in MVP)