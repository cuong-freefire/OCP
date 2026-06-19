# API CATALOG - Online Course Platform (OCP)

**Version:** V2 CORRECTED | **Total APIs:** 66 | **Owners:** 5 Members (A-E) | **Updated:** 2026-06-18

---

## MEMBER A - Auth & Profile (8 APIs)

| # | Method | Endpoint | Purpose | Auth | Owner |
|----|--------|----------|---------|------|-------|
| 1 | POST | `/auth/register` | Register learner/mentor account | None | A |
| 2 | POST | `/auth/login` | Login via email + password | None | A |
| 3 | POST | `/auth/verify-otp` | Verify email OTP | None | A |
| 4 | POST | `/auth/refresh-token` | Refresh access token | Refresh JWT | A |
| 5 | POST | `/auth/logout` | Logout & revoke refresh token | Access JWT | A |
| 6 | PUT | `/admin/users/:userId/role` | Admin change user role | Admin JWT | A |
| 7 | GET | `/profile/me` | Get current user profile | User JWT | A |
| 8 | PUT | `/profile/me` | Update current user profile | User JWT | A |

---

## MEMBER B - Mentor Course Studio (24 APIs)

| # | Method | Endpoint | Purpose | Auth | Owner |
|----|--------|----------|---------|------|-------|
| 9 | POST | `/mentor/courses` | Create new course (draft) | Mentor JWT | B |
| 10 | GET | `/mentor/courses` | List mentor's courses | Mentor JWT | B |
| 11 | GET | `/mentor/courses/:courseId` | Get course detail | Mentor JWT | B |
| 12 | PUT | `/mentor/courses/:courseId` | Edit course metadata (draft/rejected only - E1.2) | Mentor JWT | B |
| 13 | DELETE | `/mentor/courses/:courseId` | Soft delete course | Mentor JWT | B |
| 14 | POST | `/mentor/courses/:courseId/sections` | Create section | Mentor JWT | B |
| 15 | GET | `/mentor/sections/:sectionId` | Get section detail | Mentor JWT | B |
| 16 | PUT | `/mentor/sections/:sectionId` | Edit section | Mentor JWT | B |
| 17 | DELETE | `/mentor/sections/:sectionId` | Delete section | Mentor JWT | B |
| 18 | POST | `/mentor/sections/:sectionId/lessons` | Create lesson | Mentor JWT | B |
| 19 | GET | `/mentor/lessons/:lessonId` | Get lesson detail | Mentor JWT | B |
| 20 | PUT | `/mentor/lessons/:lessonId` | Edit lesson | Mentor JWT | B |
| 21 | DELETE | `/mentor/lessons/:lessonId` | Delete lesson | Mentor JWT | B |
| 22 | GET | `/mentor/lessons/:lessonId/upload-signature` | Get Cloudinary upload signature (E2.1) | Mentor JWT | B |
| 23 | POST | `/mentor/lessons/:lessonId/quizzes` | Create quiz for lesson | Mentor JWT | B |
| 24 | GET | `/mentor/quizzes/:quizId` | Get quiz detail | Mentor JWT | B |
| 25 | PUT | `/mentor/quizzes/:quizId` | Edit quiz | Mentor JWT | B |
| 26 | DELETE | `/mentor/quizzes/:quizId` | Delete quiz | Mentor JWT | B |
| 27 | POST | `/mentor/quizzes/:quizId/questions` | Create quiz question | Mentor JWT | B |
| 28 | GET | `/mentor/questions/:questionId` | Get question detail | Mentor JWT | B |
| 29 | PUT | `/mentor/questions/:questionId` | Edit question | Mentor JWT | B |
| 30 | DELETE | `/mentor/questions/:questionId` | Delete question | Mentor JWT | B |
| 31 | PUT | `/mentor/courses/:courseId/reorder` | Reorder sections/lessons (UPDATE loop, NO CASCADE - E3.2) | Mentor JWT | B |
| 32 | POST | `/mentor/courses/:courseId/submit-review` | Submit course revision for manager approval (E1.4) | Mentor JWT | B |

---

## MEMBER C - Payment & Enrollment & Catalog (12 APIs)

| # | Method | Endpoint | Purpose | Auth | Owner |
|----|--------|----------|---------|------|-------|
| 33 | GET | `/courses` | Get course catalog (published only) | None/User | C |
| 34 | GET | `/courses/:courseId` | Get course detail | None/User | C |
| 35 | POST | `/payments/create` | Create payment order (userId from JWT - E4.2) | Learner JWT | C |
| 36 | GET | `/payments/:paymentId` | Get payment status | Learner JWT | C |
| 37 | POST | `/payments/vnpay/callback` | VNPAY IPN callback (verify signature, validate course status - E1.3, create enrollment) | VNPAY signature | C |
| 38 | GET | `/enrollments/check` | Check enrollment status (E1.5 contract - canAccessCourse) | User JWT | C |
| 39 | GET | `/enrollments/my-courses` | Get learner's enrolled courses | Learner JWT | C |
| 40 | GET | `/internal/courses/:courseId/stats` | Internal: Course analytics (enrollments/revenue - E4.1) | SERVICE_TOKEN \| Manager JWT | C |
| 41 | GET | `/admin/payments` | Admin view all payments | Admin JWT | C |
| 42 | GET | `/admin/orders` | Admin view all orders | Admin JWT | C |
| 43 | GET | `/admin/enrollments` | Admin view all enrollments | Admin JWT | C |
| 44 | DELETE | `/admin/enrollments/:enrollmentId` | Admin cancel enrollment | Admin JWT | C |

---

## MEMBER D - Learning & Quiz & Rating (10 APIs)

| # | Method | Endpoint | Purpose | Auth | Owner |
|----|--------|----------|---------|------|-------|
| 45 | GET | `/lessons/:lessonId` | Get lesson content (check access via canAccessCourse - E4.4, dynamic role) | User JWT | D |
| 46 | GET | `/lessons/:lessonId/assets` | Get lesson assets (with signed URLs) | User JWT | D |
| 47 | POST | `/quizzes/:quizId/submit` | Submit quiz answers (auto-grade, DI injection - E4.4) | Learner JWT | D |
| 48 | GET | `/quizzes/:quizId/submissions` | Get learner's quiz submissions | Learner JWT | D |
| 49 | POST | `/ratings` | Create course rating (E2.4: enrollment.status='active' only) | Learner JWT | D |
| 50 | PUT | `/ratings/:ratingId` | Update course rating | Learner JWT | D |
| 51 | DELETE | `/ratings/:ratingId` | Delete course rating | Learner JWT | D |
| 52 | POST | `/feedbacks` | Create course feedback | Learner JWT | D |
| 53 | GET | `/progress/:courseId` | Get learner's course progress | Learner JWT | D |
| 54 | GET | `/internal/courses/:courseId/rating-stats` | Internal: Course rating analytics (E4.1) | SERVICE_TOKEN \| Manager JWT | D |

---

## MEMBER E - Manager Approval & Admin & Reports (12 APIs)

| # | Method | Endpoint | Purpose | Auth | Owner |
|----|--------|----------|---------|------|-------|
| 55 | GET | `/manager/reviews/pending` | Get pending course revisions | Manager JWT | E |
| 56 | GET | `/manager/reviews/:revisionId` | Get revision detail with snapshot | Manager JWT | E |
| 57 | POST | `/manager/reviews/:revisionId/publish` | Publish course (restore from snapshot in transaction, self-approval check E2.3, E1.1) | Manager JWT | E |
| 58 | POST | `/manager/reviews/:revisionId/reject` | Reject course revision | Manager JWT | E |
| 59 | GET | `/manager/dashboard` | Manager dashboard (uses analytics from C, D) | Manager JWT | E |
| 60 | GET | `/admin/users` | Admin list users | Admin JWT | E |
| 61 | GET | `/admin/users/:userId` | Admin get user detail | Admin JWT | E |
| 62 | PUT | `/admin/users/:userId` | Admin update user | Admin JWT | E |
| 63 | DELETE | `/admin/users/:userId` | Admin block user (set status=blocked) | Admin JWT | E |
| 64 | GET | `/admin/reports/revenue` | Admin revenue report | Admin JWT | E |
| 65 | GET | `/admin/reports/enrollments` | Admin enrollment report | Admin JWT | E |
| 66 | GET | `/admin/reports/courses` | Admin course status report | Admin JWT | E |

---

## 📊 API SUMMARY

| Member | Role | Total APIs |
|--------|------|-----------|
| A | Auth & Profile | 8 |
| B | Mentor Course Studio | 24 |
| C | Payment & Enrollment & Catalog | 12 |
| D | Learning & Quiz & Rating | 10 |
| E | Manager & Admin & Reports | 12 |
| **TOTAL** | - | **66** |

---

## � AUTHENTICATION MATRIX

| Auth Type | Endpoints | Issued By | Storage |
|-----------|-----------|-----------|---------|
| **User JWT (Access)** | Public APIs (most) | Member A | httpOnly Cookie |
| **Refresh JWT** | `/auth/refresh-token` | Member A | httpOnly Cookie |
| **SERVICE_TOKEN** | `/internal/*` APIs | Backend config | Environment variable |
| **Admin JWT** | `/admin/*` APIs | Member A | httpOnly Cookie (role=ADMIN) |
| **Manager JWT** | `/manager/*` APIs | Member A | httpOnly Cookie (role=MANAGER) |
| **Mentor JWT** | `/mentor/*` APIs | Member A | httpOnly Cookie (role=MENTOR) |
| **Learner JWT** | `/payments/*`, `/ratings/*`, `/feedbacks/*`, `/progress/*` | Member A | httpOnly Cookie (role=LEARNER) |

---

## ⚠️ CRITICAL ERROR FIXES EMBEDDED IN APIs

### E1.1 - Snapshot Publish with Full Curriculum (T081)
```
POST /manager/reviews/:revisionId/publish
- Must restore FULL curriculum from snapshot_data
- Structure: {title, description, thumbnail, price, category, level, sections, lessons, quizzes, quiz_questions}
- Transaction: Serializable isolation, 30s timeout
- Error: revision.status = 'failed_publish' if timeout/fail
```

### E1.2 - Lock Published Courses (T021)
```
PUT /mentor/courses/:courseId
- FORBIDDEN if course.status = 'published'
- ONLY allow: draft, rejected
```

### E1.3 - Validate Course Status in Payment Callback (T042)
```
POST /payments/vnpay/callback
- Must check course.status = 'published' before enrollment
- If NOT published: payment.status = 'failed'
```

### E1.4 - Restrict Revision Submit (T025)
```
POST /mentor/courses/:courseId/submit-review
- ONLY allow if course.status in ['draft', 'rejected']
- FORBIDDEN if course.status = 'published'
```

### E1.5 - canAccessCourse API Endpoint (T043)
```
GET /enrollments/check
- Response: { hasAccess, enrollment, course }
- Learner: check enrollment active
- Mentor: check canEditCourse ownership
- Manager/Admin: always true
```

### E2.1 - Lesson Ownership Validation (T023)
```
GET /mentor/lessons/:lessonId/upload-signature
- Must validate: lesson.section.course.mentor_id === req.user.id
- Throw ForbiddenError if not owned
```

### E2.2 - Role Version Check (E2.2)
```
All protected endpoints
- Check req.user.roleVersion match users.role_version
- Throw UnauthorizedError if TOKEN_REVOKED
- TTL: 5 minutes (not 15)
```

### E2.3 - Prevent Self-Approval (T081)
```
POST /manager/reviews/:revisionId/publish
- IF canEditCourse(req.user.id, courseId) === true
- Throw ForbiddenError('SELF_APPROVAL_FORBIDDEN')
```

### E2.4 - Enrollment Status for Rating (T062)
```
POST /ratings
- Must check enrollment.status === 'active'
- ONLY active enrollments can rate
```

### E3.2 - Reorder without CASCADE Delete (T024)
```
PUT /mentor/courses/:courseId/reorder
- Use UPDATE loop (NOT DELETE then CREATE)
- Prevents CASCADE delete of lessons/quizzes/assets
```

### E3.3 - Price as BIGINT (No decimals)
```
All price/amount fields
- Store as BIGINT (đồng, not decimals)
- Exact match validation: paymentAmount === orderAmount
```

### E4.1 - Internal Analytics APIs (T045, T065)
```
GET /internal/courses/:courseId/stats (Member C)
GET /internal/courses/:courseId/rating-stats (Member D)
- Authorization: SERVICE_TOKEN OR Manager/Admin JWT
- Response: aggregate data ONLY (counts, sums, averages)
- NO learner PII in response
```

### E4.2 - Remove userId from Request Body (T041)
```
POST /payments/create
- userId ONLY from JWT (req.user.id)
- NEVER accept userId from request body
- Validate learner.role === 'LEARNER'
```

### E4.4 - Dependency Injection (NOT HTTP) (T061)
```
POST /quizzes/submit
- Call canAccessCourse(userId, courseId, req.user.role) via DI
- NEVER use HTTP fetch() between modules
- Support dynamic role (NOT hardcode 'LEARNER')
```

---

## 📋 API ORGANIZATION IN CODEBASE

**Backend structure (per Member):**

```text
backend/src/
  api/                      # Express routes
    auth.routes.js          # Member A routes (8 APIs)
    mentor.routes.js        # Member B routes (24 APIs)
    payment.routes.js       # Member C routes (12 APIs)
    learning.routes.js      # Member D routes (10 APIs)
    manager.routes.js       # Member E routes (12 APIs)
  
  controllers/
    auth.controller.js
    mentor.controller.js
    payment.controller.js
    learning.controller.js
    manager.controller.js
  
  services/
    auth.service.js
    mentor.service.js
    payment.service.js
    learning.service.js
    manager.service.js
    enrollment.service.js   # Member C export for Member D (E4.4 DI)
  
  repositories/
    (all database access - 19 tables per DATABASE.md)
```

**Frontend API clients:**

```text
frontend/src/api/
  authApi.js               # Call Member A endpoints (8 APIs)
  mentorApi.js             # Call Member B endpoints (24 APIs)
  paymentApi.js            # Call Member C endpoints (public only)
  learningApi.js           # Call Member D endpoints (10 APIs)
  managerApi.js            # Call Member E endpoints (12 APIs)
```

---

## 📌 REFERENCES

- **Database:** `DATABASE.md` (19 tables, ownership per member)
- **Contracts:** `share_context.md` (Section 3 - Cross-Module, 6 contracts)
- **Config:** `AGENTS.md`, `CLAUDE.md`, `constitution.md`

**Last Updated:** 2026-06-18 | **Scope:** 66 APIs + All Error Fixes (E1-E4)
