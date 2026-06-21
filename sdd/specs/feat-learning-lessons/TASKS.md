# TASKS.md - Learning Lessons Implementation Tasks

**Version:** 1.0  
**Feature:** Learning Lessons (Lesson Access, Assets, Submissions, Progress)  
**Owner:** Member D  
**Created:** 2026-06-18  
**Status:** Ready for Implementation

---

## Task Overview

Total: 12 tasks across 5 phases

- Phase 1 (Foundation): 3 tasks - 5h
- Phase 2 (Data Layer): 2 tasks - 5.5h
- Phase 3 (Service Layer): 2 tasks - 6h
- Phase 4 (API Layer): 3 tasks - 5h
- Phase 5 (Testing): 2 tasks - 6h

**Total Estimated Time**: 27.5 hours

---

## PHASE 1: FOUNDATION (5 hours)

### T001: Create Learning Error Classes

**Tên**: Implement custom error classes for learning module

**Files**:
- `backend/src/errors/LearningError.js` (new)
- `backend/src/errors/index.js` (update - add new exports)

**Est. Time**: 1.5h

**Dependencies**: None

**SPEC Refs**:
- SPEC Section 6 (Error Handling)

**Description**:
Custom error classes for learning module:

1. `NotFoundError` (404): Lesson/course/submission not found
2. `ForbiddenError` (403): Not enrolled, no access
3. `ServiceUnavailableError` (503): EnrollmentService/Cloudinary unavailable
4. `ValidationError` (400): Invalid UUID, invalid params

**Done Criteria**:
- [ ] 4 error classes implemented
- [ ] Each error has statusCode, message, code properties
- [ ] Export from centralized errors/index.js

---

### T002: Setup Learning Validators

**Tên**: Create Zod schemas for learning module validation

**Files**:
- `backend/src/validators/learning.validator.js` (new)

**Est. Time**: 1.5h

**Dependencies**: None

**SPEC Refs**:
- SPEC Section 3.1, 3.2, 3.3, 3.4 (UUID validation)
- SPEC Section 6 (Error Handling)

**Description**:
Implement Zod schemas:

1. `uuidParamSchema`: Validate UUID v4 format for path params
   - lessonId, courseId, quizId must be valid UUIDs
2. `lessonIdParam`: z.string().uuid()
3. `courseIdParam`: z.string().uuid()
4. `quizIdParam`: z.string().uuid()

**Done Criteria**:
- [ ] UUID validation schemas created
- [ ] Reject invalid UUIDs with clear error messages
- [ ] Unit tests for validation schemas

---

### T003: Implement Cloudinary Utility

**Tên**: Create Cloudinary signed URL generation utility

**Files**:
- `backend/src/utils/cloudinary.util.js` (new)
- `backend/.env.example` (update - add Cloudinary vars)

**Est. Time**: 2h

**Dependencies**: None

**SPEC Refs**:
- SPEC Section 3.2 (Asset signed URLs)
- SPEC Section 4 (Non-functional: < 200ms)

**Description**:
Implement `generateSignedUrl(publicId, options)`:

- Configure Cloudinary SDK from env variables
- Generate private download URL with `type: 'authenticated'`
- Expire: 1 hour (3600 seconds)
- Handle errors gracefully (return null, log error)
- Support both 'video' and 'document' resource types

**Done Criteria**:
- [ ] Cloudinary SDK configured from env vars
- [ ] generateSignedUrl returns signed URL with 1h expiry
- [ ] Graceful degradation (return null on fail, log error)
- [ ] Error does not crash the entire request

---

## PHASE 2: DATA LAYER (5.5 hours)

### T004: Implement Learning Repository - Lesson & Course Queries

**Tên**: Create repository for lesson/course read queries

**Files**:
- `backend/src/repositories/learning.repository.js` (new)

**Est. Time**: 3h

**Dependencies**: T001, T003

**SPEC Refs**:
- SPEC Section 5 (Data Model)
- PLAN Section 2 Component C (Repository)

**Description**:
Implement repository functions (READ ONLY on Member B tables):

1. `findLessonById(lessonId)`:
   - Query lessons + JOIN section + JOIN course
   - Return lesson with section.course data for access check
   
2. `findLessonAssets(lessonId)`:
   - Query lesson_assets WHERE lesson_id = lessonId
   
3. `findCourseLessonsCount(courseId)`:
   - COUNT lessons via sections for course
   
4. `findTotalQuizzesByCourse(courseId)`:
   - COUNT quizzes via lessons + sections for course
   
5. `findQuizById(quizId)`:
   - Query quiz + JOIN lesson + JOIN section + JOIN course (for access check)

**Done Criteria**:
- [ ] All 5 repository functions implemented
- [ ] Dùng Prisma client, KHÔNG raw SQL
- [ ] READ ONLY on Member B tables (no writes to lessons/sections/courses/quizzes)
- [ ] Include course data for access check (courseId + mentor_id)

---

### T005: Implement Learning Repository - Submissions & Progress

**Tên**: Create repository for quiz submissions and progress queries

**Files**:
- `backend/src/repositories/learning.repository.js` (update - add functions)

**Est. Time**: 2.5h

**Dependencies**: T004

**SPEC Refs**:
- SPEC Section 3.3 (Submissions)
- SPEC Section 3.4 (Progress)

**Description**:
Add repository functions:

1. `findQuizSubmissions(userId, quizId)`:
   - SELECT quiz_submissions WHERE user_id = userId AND quiz_id = quizId
   - ORDER BY submitted_at DESC
   
2. `findPassedQuizzesByCourse(userId, courseId)`:
   - SELECT COUNT(DISTINCT quiz_submissions.quiz_id)
   - FROM quiz_submissions JOIN quizzes JOIN lessons JOIN course_sections
   - WHERE course_sections.course_id = courseId
   - AND quiz_submissions.user_id = userId AND passed = true
   
3. `findUserQuizSubmissionsByCourse(userId, courseId)`:
   - All user's quiz submissions for a course (for detailed progress)

**Done Criteria**:
- [ ] 3 new repository functions implemented
- [ ] Owns quiz_submissions table (Member D ownership)
- [ ] Aggregation queries optimized with indexes

---

## PHASE 3: SERVICE LAYER (6 hours)

### T006: Implement Learning Service - Lesson Access

**Tên**: Create LearningService with lesson access and asset delivery

**Files**:
- `backend/src/services/learning.service.js` (new)

**Est. Time**: 3.5h

**Dependencies**: T002, T003, T004, T005 (repositories)

**SPEC Refs**:
- SPEC Section 3.1 (Lesson content)
- SPEC Section 3.2 (Assets with signed URLs)
- SPEC Section 4 (DI pattern E4.4)
- PLAN Section 3.1, 3.2

**Description**:
Implement LearningService with DI:

```javascript
class LearningService {
  constructor(enrollmentService) {
    this.enrollmentService = enrollmentService; // DI injection from Member C
    this.repository = new LearningRepository();
  }
}
```

Functions:

1. `getLesson(userId, lessonId, role)`:
   - Call repository.findLessonById(lessonId)
   - If not found → throw NotFoundError('LESSON_NOT_FOUND')
   - Call this.enrollmentService.canAccessCourse(userId, courseId, role)
   - If no access → throw ForbiddenError('NOT_ENROLLED')
   - Return lesson data (exclude sensitive fields)

2. `getLessonAssets(userId, lessonId, role)`:
   - Access check (same as getLesson)
   - Find assets from repository
   - For each asset, generate Cloudinary signed URL
   - Return assets with signed URLs

**Done Criteria**:
- [ ] LearningService receives EnrollmentService via constructor (DI - E4.4)
- [ ] No HTTP fetch() for internal communication
- [ ] Access denied throws ForbiddenError('NOT_ENROLLED')
- [ ] Lesson not found throws NotFoundError('LESSON_NOT_FOUND')
- [ ] Dynamic role parameter supported (not hardcoded 'LEARNER')
- [ ] Cloudinary failure doesn't crash request

---

### T007: Implement Learning Service - Submissions & Progress

**Tên**: Add submission history and progress tracking to LearningService

**Files**:
- `backend/src/services/learning.service.js` (update - add functions)

**Est. Time**: 2.5h

**Dependencies**: T006 (LearningService base)

**SPEC Refs**:
- SPEC Section 3.3 (Submissions)
- SPEC Section 3.4 (Progress)
- PLAN Section 3.3, 3.4

**Description**:
Add functions to LearningService:

1. `getSubmissions(userId, quizId)`:
   - Find lesson from quizId (for access check)
   - Call canAccessCourse with courseId
   - Query quiz_submissions WHERE userId + quizId
   - Return submissions WITHOUT answers_json (privacy)

2. `getProgress(userId, courseId, role)`:
   - Call canAccessCourse
   - Count total lessons in course
   - Count passed quizzes for user in course
   - Count total quizzes in course
   - Calculate progressPercent
   - Return progress object

**Integration with quiz submission (T061/T008)**:
- After POST /quizzes/:quizId/submit creates a submission
- GET /quizzes/:quizId/submissions returns history
- Progress reflects latest passed quizzes

**Done Criteria**:
- [ ] getSubmissions returns list WITHOUT answers_json
- [ ] getProgress calculates accurate percentage
- [ ] Progress = 0% when no quizzes passed
- [ ] Progress = 100% when all quizzes passed
- [ ] Access check enforced on all functions

---

## PHASE 4: API LAYER (5 hours)

### T008: Implement Learning Controllers

**Tên**: Create controller layer for learning endpoints

**Files**:
- `backend/src/controllers/learning.controller.js` (new)

**Est. Time**: 2.5h

**Dependencies**: T006, T007 (LearningService)

**SPEC Refs**:
- SPEC Section 3 (All endpoints)
- PLAN Section 2 Component A (Controller)

**Description**:
Implement 4 controller functions:

1. `getLesson(req, res, next)`:
   - Extract lessonId từ req.params
   - Call learningService.getLesson(req.user.userId, lessonId, req.user.role)
   - Return HTTP 200 with lesson data

2. `getLessonAssets(req, res, next)`:
   - Extract lessonId từ req.params
   - Call learningService.getLessonAssets(...)
   - Return HTTP 200 with assets array

3. `getSubmissions(req, res, next)`:
   - Extract quizId từ req.params
   - Call learningService.getSubmissions(req.user.userId, quizId)
   - Return HTTP 200 with submissions array

4. `getProgress(req, res, next)`:
   - Extract courseId từ req.params
   - Call learningService.getProgress(req.user.userId, courseId, req.user.role)
   - Return HTTP 200 with progress object

**Done Criteria**:
- [ ] Controllers thin, KHÔNG business logic
- [ ] Extract userId from req.user (JWT), NEVER from params/body
- [ ] Error handling delegate to error middleware (try-catch → next(err))
- [ ] Response format consistent (successResponse helper)

---

### T009: Create Learning Routes

**Tên**: Define and mount learning API routes

**Files**:
- `backend/src/api/learning.routes.js` (new)

**Est. Time**: 1h

**Dependencies**: T008 (controllers), T002 (validators), T001 (error middleware)

**SPEC Refs**:
- SPEC Section 3 (All 4 endpoints)
- API_CATALOG.md (APIs #45, #46, #48, #53)

**Description**:
Define 4 routes:

1. `GET /lessons/:lessonId` → authMiddleware → validateUUID → getLesson
2. `GET /lessons/:lessonId/assets` → authMiddleware → validateUUID → getLessonAssets
3. `GET /quizzes/:quizId/submissions` → authMiddleware → requireRole('LEARNER') → validateUUID → getSubmissions
4. `GET /progress/:courseId` → authMiddleware → validateUUID → getProgress

Export router for mounting.

**Done Criteria**:
- [ ] 4 routes defined đúng methods và paths
- [ ] authMiddleware attached to all routes
- [ ] requireRole('LEARNER') for submissions endpoint
- [ ] UUID validation middleware attached
- [ ] Router exported

---

### T010: Wire Up Learning Module in Express App

**Tên**: Mount learning routes and DI setup in main app

**Files**:
- `backend/src/app.js` (update - mount learning routes, DI setup)

**Est. Time**: 1.5h

**Dependencies**: T009 (learning routes)

**SPEC Refs**:
- SPEC Section 4 (DI pattern E4.4)

**Description**:
- Import learning routes
- Import EnrollmentService (from Member C/service)
- Create EnrollmentService instance
- Create LearningService instance with DI: `new LearningService(enrollmentService)`
- Create LearningController instance with LearningService
- Mount routes: `app.use('/', learningRoutes)`

**DI Setup Pattern**:
```javascript
// DI Container
const enrollmentService = new EnrollmentService(prisma);
const learningService = new LearningService(enrollmentService);
const learningController = new LearningController(learningService);

// Mount
app.use('/', learningRoutes(learningController));
```

**Done Criteria**:
- [ ] DI wiring correctly injects EnrollmentService
- [ ] Routes mounted and functional
- [ ] Server starts without errors
- [ ] Integration test passes

---

## PHASE 5: TESTING (6 hours)

### T011: Unit Tests - Learning Service & Repository

**Tên**: Write unit tests for learning service and repository

**Files**:
- `backend/tests/unit/services/learning.service.test.js` (new)
- `backend/tests/unit/repositories/learning.repository.test.js` (new)

**Est. Time**: 3h

**Dependencies**: T006, T007 (service), T004, T005 (repository)

**SPEC Refs**:
- SPEC Section 7 (Acceptance Criteria)

**Description**:
Unit tests:

1. LearningService:
   - getLesson: happy path, not found, not enrolled, role bypass (MANAGER/ADMIN)
   - getLessonAssets: happy path, Cloudinary failure (graceful)
   - getSubmissions: happy path, access denied
   - getProgress: 0%, 50%, 100%, empty course

2. LearningRepository:
   - findLessonById: returns lesson with course
   - findLessonAssets: returns assets
   - findQuizSubmissions: returns only user's submissions
   - findCourseLessonsCount: correct count

**Done Criteria**:
- [ ] Service tests cover all error paths
- [ ] Repository tests use mock Prisma
- [ ] DI injection verified (mock EnrollmentService)
- [ ] Role-based bypass tested (MANAGER/ADMIN)
- [ ] Code coverage > 80% for service + repository

---

### T012: Integration Tests - Learning Endpoints

**Tên**: Write integration tests for learning API endpoints

**Files**:
- `backend/tests/integration/learning.test.js` (new)

**Est. Time**: 3h

**Dependencies**: T010 (full app setup), T011 (test patterns)

**SPEC Refs**:
- SPEC Section 7 (Acceptance Criteria)

**Description**:
Integration tests for 4 endpoints:

1. GET /lessons/:lessonId:
   - Success with valid enrollment
   - 403 when not enrolled
   - 404 when lesson not found
   - Success as MANAGER (bypass)
   - 400 with invalid UUID

2. GET /lessons/:lessonId/assets:
   - Success returns assets with signed URLs
   - 403 without enrollment

3. GET /quizzes/:quizId/submissions:
   - Success returns submissions
   - 403 without enrollment
   - Only returns user's own submissions

4. GET /progress/:courseId:
   - Success returns progress
   - 403 without enrollment

Use supertest + real database (test DB) or mocked EnrollmentService.

**Done Criteria**:
- [ ] Test coverage for all 4 endpoints
- [ ] Happy path + 2-3 error paths per endpoint
- [ ] Verify access control (enrolled vs not enrolled)
- [ ] Verify role-based bypass (MANAGER/ADMIN)
- [ ] Tests pass with `npm test`

---

## SUMMARY TABLE

| ID | Task Name | Files | Est. Time | Dependencies | Phase |
|----|-----------|-------|-----------|--------------|-------|
| T001 | Create Learning Error Classes | errors/*.js | 1.5h | None | 1 |
| T002 | Setup Learning Validators | validators/learning.validator.js | 1.5h | None | 1 |
| T003 | Implement Cloudinary Utility | utils/cloudinary.util.js | 2h | None | 1 |
| T004 | Repository - Lesson & Course Queries | repositories/learning.repository.js | 3h | T001, T003 | 2 |
| T005 | Repository - Submissions & Progress | repositories/learning.repository.js | 2.5h | T004 | 2 |
| T006 | Service - Lesson Access + Assets | services/learning.service.js | 3.5h | T002, T003, T004 | 3 |
| T007 | Service - Submissions & Progress | services/learning.service.js | 2.5h | T006 | 3 |
| T008 | Learning Controllers | controllers/learning.controller.js | 2.5h | T006, T007 | 4 |
| T009 | Learning Routes | api/learning.routes.js | 1h | T008, T002 | 4 |
| T010 | Wire Up Express App | app.js | 1.5h | T009 | 4 |
| T011 | Unit Tests | tests/unit/*.test.js | 3h | T006, T007, T004, T005 | 5 |
| T012 | Integration Tests | tests/integration/learning.test.js | 3h | T010, T011 | 5 |

**Total**: 12 tasks, 27.5 hours estimated

---

## IMPLEMENTATION NOTES

### Critical Path
T002 → T004 → T006 → T008 → T009 → T010 → T012

### Parallel Opportunities
- T001, T002, T003 có thể làm song song
- T005 có thể làm song song với T004
- T007 phụ thuộc T006 nhưng logic tách biệt

### Risk Mitigations
- T003: Cloudinary SDK cần env vars - verify configuration early
- T006: DI injection pattern cần consistent với Member C implementation
- T012: Integration tests require EnrollmentService mock or real instance

### Integration Contract Dependencies
- **EnrollmentService**: Must be provided by Member C (DI constructor injection)
- **authMiddleware**: Must be provided by Member A
- **Member B tables**: READ ONLY - no writes to lessons/sections/courses/quizzes

---

**Status**: Ready for implementation. Bắt đầu từ T001 sau khi có EnrollmentService từ Member C.