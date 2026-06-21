# Implementation Plan: Learning Lessons (feat-learning-lessons)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Generated:** 2026-06-18 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy

- **Backend as Source of Truth**: Lesson access always validated through `EnrollmentService.canAccessCourse()` (Member C contract) - NEVER query enrollments table directly
- **Dependency Injection (E4.4 Fix)**: `EnrollmentService` injected into `LearningService` via constructor - NEVER HTTP fetch() for internal module communication
- **Role-based Access**: Support dynamic role parameter for MANAGER/ADMIN bypass and MENTOR ownership check
- **Layered Architecture**: Route → Middleware → Controller → Service → Repository (no business logic leakage)
- **Read-only Module**: This feature primarily reads from Member B's tables (lessons, sections, courses) - no writes except quiz_submissions

### Key Patterns

1. **Cross-module DI (E4.4)**: `LearningService` receives `EnrollmentService` instance in constructor
2. **Cloudinary Signed URLs**: Generate signed URLs on-the-fly (expire 1 hour) - NEVER store in DB
3. **Progress Calculation**: Read-only derived data from quiz_submissions (pass/fail), no dedicated progress table
4. **IDOR Prevention**: All queries use `userId` from JWT payload, never from request body/params

### Why These Choices

- DI over HTTP fetch: Modular monolith pattern - faster, more reliable, no network overhead
- Dynamic role parameter: Support multiple user types without separate endpoints
- No progress table: Avoid data sync issues; progress is always real-time from submissions
- Cloudinary signed URLs: Secure asset delivery without backend serving large files

---

## 2. COMPONENTS

### Backend Module Structure

#### A. Controllers (`learning.controller.js`)

- **GET `/lessons/:lessonId`**: Parse lessonId → call LearningService.getLesson() → return lesson data
- **GET `/lessons/:lessonId/assets`**: Parse lessonId → call LearningService.getLessonAssets() → return assets with signed URLs
- **GET `/quizzes/:quizId/submissions`**: Parse quizId → call LearningService.getSubmissions() → return submission history
- **GET `/progress/:courseId`**: Parse courseId → call LearningService.getProgress() → return progress data

**Responsibility**: Parse request, call service, return response. No business logic.

---

#### B. Services (`learning.service.js`)

- **constructor(enrollmentService)**: DI injection of EnrollmentService from Member C
- **getLesson(userId, lessonId, role)**: Validate access → query lesson + section → return lesson data
- **getLessonAssets(userId, lessonId, role)**: Validate access → query assets → generate Cloudinary signed URLs → return asset list
- **getSubmissions(userId, quizId)**: Validate access → query quiz_submissions where userId + quizId → return list
- **getProgress(userId, courseId, role)**: Validate access → count total lessons → count passed quizzes → calculate percentage

**Responsibility**: Business logic, access control orchestration. Does NOT import Prisma directly.

---

#### C. Repositories (`learning.repository.js`)

- **findLessonById(lessonId)**: SELECT lesson + JOIN section + course (for courseId + mentor_id access check)
- **findLessonAssets(lessonId)**: SELECT lesson_assets where lessonId
- **findCourseLessonsCount(courseId)**: COUNT lessons via sections → course (aggregate)
- **findQuizSubmissions(userId, quizId)**: SELECT quiz_submissions where userId + quizId, order by submitted_at DESC
- **findCompletedQuizzesByCourse(userId, courseId)**: SELECT passed quiz_submissions via quizzes JOIN lessons JOIN sections JOIN course
- **findTotalQuizzesByCourse(courseId)**: COUNT quizzes via lessons JOIN sections JOIN course

**Responsibility**: ALL Prisma calls across owned tables (quiz_submissions) and READ-ONLY queries on Member B tables. No business logic.

---

#### D. Middleware (`learning.middleware.js`) - Optional/Reuse

- **authMiddleware**: Import from Member A (AUTH_MIDDLEWARE)
- **validateUUID**: Zod schema for UUID params (lessonId, courseId, quizId)

---

#### E. Utilities/Config

- **cloudinary.util.js**: Generate signed URL for asset delivery (expire 1 hour)
- **learning.validator.js**: Zod schemas for request validation

---

## 3. DATA FLOW

### 3.1 Get Lesson Flow

```
User Request: GET /lessons/:lessonId
  ↓
authMiddleware: Verify JWT from httpOnly cookie → attach req.user
  ↓
Controller: Extract lessonId from params
  ↓
LearningService.getLesson(userId, lessonId, role):
  - Query lesson + section + course (to get courseId + mentor_id)
  - IF lesson not found → throw NotFoundError
  - Call this.enrollmentService.canAccessCourse(userId, courseId, role)
    - LEARNER: Check enrollment active
    - MENTOR: Check course.mentor_id === userId
    - MANAGER/ADMIN: Return true (bypass)
  - IF canAccessCourse returns false → throw ForbiddenError(NOT_ENROLLED)
  - Return lesson data: { id, type, title, content, order_index, is_required_complete, section_id }
  ↓
Controller: HTTP 200 with lesson data
```

### 3.2 Get Lesson Assets Flow

```
User Request: GET /lessons/:lessonId/assets
  ↓
authMiddleware → Controller → Service (access check same as 3.1)
  ↓
LearningService.getLessonAssets(userId, lessonId, role):
  - Access check (same as getLesson)
  - Query lesson_assets from DB
  - For each asset:
    - Call cloudinary.util.generateSignedUrl(cloudinary_public_id, { expires: 3600 })
    - Build asset object: { id, asset_type, signed_url, expires_at }
  - Return asset list
  ↓
Controller: HTTP 200 with assets array
```

### 3.3 Get Quiz Submissions Flow

```
User Request: GET /quizzes/:quizId/submissions
  ↓
authMiddleware → Controller → LearningService.getSubmissions(userId, quizId):
  - Query lesson from quizId (to get courseId for access check)
  - Access check (same as getLesson)
  - Query quiz_submissions WHERE user_id = userId AND quiz_id = quizId
  - ORDER BY submitted_at DESC
  - Return submissions: [{ id, score, passed, submitted_at }]
  - NOT include answers_json in response (privacy)
  ↓
Controller: HTTP 200 with submissions array
```

### 3.4 Get Progress Flow

```
User Request: GET /progress/:courseId
  ↓
authMiddleware → Controller → LearningService.getProgress(userId, courseId, role):
  - Access check via canAccessCourse
  - Count total lessons: 
    SELECT COUNT(*) FROM lessons 
    JOIN course_sections ON lessons.section_id = course_sections.id
    WHERE course_sections.course_id = courseId
  - Count passed quizzes for user:
    SELECT COUNT(DISTINCT quiz_submissions.quiz_id) FROM quiz_submissions
    JOIN quizzes ON quiz_submissions.quiz_id = quizzes.id
    JOIN lessons ON quizzes.lesson_id = lessons.id
    JOIN course_sections ON lessons.section_id = course_sections.id
    WHERE course_sections.course_id = courseId
    AND quiz_submissions.user_id = userId
    AND quiz_submissions.passed = true
  - Count total quizzes:
    SELECT COUNT(*) FROM quizzes
    JOIN lessons ON quizzes.lesson_id = lessons.id
    JOIN course_sections ON lessons.section_id = course_sections.id
    WHERE course_sections.course_id = courseId
  - Calculate: progressPercent = (completedLessons / totalLessons) * 100
  - Return: { courseId, totalLessons, completedLessons, progressPercent, passedQuizzes, totalQuizzes }
  ↓
Controller: HTTP 200 with progress data
```

---

## 4. DEPENDENCIES

### External Libraries

| Package | Purpose | Version | Why |
|---------|---------|---------|-----|
| `cloudinary` | Generate signed URLs | ^1.41.0 | Cloudinary SDK for signed URL generation |
| `zod` | Request validation | ^3.22.0 | UUID param validation |

### Internal Dependencies (Module Ownership)

- **Member A**: `authMiddleware` - JWT verification and user context
- **Member C**: `EnrollmentService` - course access check (DI injection)
- **Member B**: Tables `lessons`, `lesson_assets`, `course_sections`, `courses`, `quizzes` (READ ONLY)

### Implementation Order

```
1. Validators (learning.validator.js)
   ↓
2. Cloudinary Util (cloudinary.util.js) - signed URL generation
   ↓
3. Repository (learning.repository.js) - READ queries on Member B tables + own tables
   ↓
4. Service (learning.service.js) - access control + business logic (DI: EnrollmentService)
   ↓
5. Controller (learning.controller.js)
   ↓
6. Routes (learning.routes.js) - mount endpoints
```

---

## 5. RISKS & MITIGATIONS

### Risk 1: Cross-module Table Access (Member D reads Member B tables) (MEDIUM)

**Scenario**: Member D needs to read lessons, sections, courses (owned by Member B) for access check and progress calculation.

**Mitigation**: Member D creates read-only repository functions that query these tables via Prisma. No writes. This is explicitly allowed per DATABASE.md section "Member D read access to Member B tables."

**Code Pattern:**
```javascript
// learning.repository.js - READ ONLY on Member B tables
async findLessonById(lessonId) {
  return await prisma.lessons.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: true }
      }
    }
  });
}
```

---

### Risk 2: EnrollmentService Unavailable (LOW)

**Scenario**: EnrollmentService throws error (DB timeout, internal error) during access check.

**Mitigation**: Catch error from canAccessCourse → log error → throw `ServiceUnavailableError('ACCESS_CHECK_FAILED')`. Fail closed (deny access) not open.

**Code Pattern:**
```javascript
try {
  const hasAccess = await this.enrollmentService.canAccessCourse(userId, courseId, role);
  if (!hasAccess) throw new ForbiddenError('NOT_ENROLLED');
} catch (err) {
  if (err instanceof ForbiddenError) throw err;
  logger.error('Access check failed', { userId, courseId, error: err.message });
  throw new ServiceUnavailableError('ACCESS_CHECK_FAILED');
}
```

---

### Risk 3: Cloudinary Credentials Missing (MEDIUM)

**Scenario**: Cloudinary env vars not configured → signed URL generation fails.

**Mitigation**: Fail gracefully - return assets with signed_url = null, log error. Don't fail the entire request.

**Code Pattern:**
```javascript
async generateSignedUrl(publicId) {
  try {
    return cloudinary.utils.private_download_url(publicId, 'auto', {
      resource_type: 'video',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    });
  } catch (err) {
    logger.error('Cloudinary signed URL failed', { publicId, error: err.message });
    return null; // Graceful degradation
  }
}
```

---

## 6. QUESTIONS FOR HUMAN

### Q1: Có cần pagination cho GET /quizzes/:quizId/submissions?

**Question**: Nếu learner submit quiz nhiều lần, có cần pagination cho danh sách submissions không?

**Current Decision**: MVP không pagination (giả định learner không submit > 20 lần cho 1 quiz).

---

### Q2: Progress calculation - quiz pass hay lesson complete?

**Question**: Progress tính dựa trên quiz pass (như spec) hay cần "Mark as Complete" cho lesson không có quiz?

**Current Decision**: Chỉ tính quiz passed. Lesson không có quiz được coi là "watched" và không ảnh hưởng tới progress.

---

### Q3: Cloudinary cloud name và API key config?

**Question**: Cloudinary env variables format? Cần confirm tên biến môi trường.

**Expected**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` từ `.env`.

---

## Sign-Off

**Plan Owner:** Member D (Learning Module)  
**Reviewed By:** [PENDING HUMAN REVIEW]  
**Approved On:** [PENDING]  
**Next Step:** Human approval → implement tasks.md