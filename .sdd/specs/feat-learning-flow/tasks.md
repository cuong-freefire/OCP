# Tasks: feat-learning-flow

**Input**: Design documents from `.sdd/specs/feat-learning-flow/`

**Prerequisites**: plan.md, spec.md, context.md

**Tests**: Tests are required by the project rules for new service/business logic and changed endpoints. Backend tests use `node:test`, `assert`, and `supertest`; frontend source-rule tests use `node:test` if frontend Learning API code is implemented.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independently useful increment after shared foundations are complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare Learning Flow docs, directories, and shared file locations without implementing behavior.

- [ ] T001 Create or update Learning design artifact placeholders in `.sdd/specs/feat-learning-flow/research.md`, `.sdd/specs/feat-learning-flow/data-model.md`, `.sdd/specs/feat-learning-flow/quickstart.md`, and `.sdd/specs/feat-learning-flow/contracts/learning-api.openapi.yaml`
- [ ] T002 [P] Create backend Learning source directories in `backend/src/api`, `backend/src/controllers`, `backend/src/services`, `backend/src/repositories`, and `backend/src/validators`
- [ ] T003 [P] Create backend Learning test directories in `backend/tests/learning`, `backend/tests/fixtures`, and `backend/tests/helpers`
- [ ] T004 [P] Create frontend Learning directories in `frontend/src/api`, `frontend/src/pages/learner`, `frontend/src/components/learning`, `frontend/src/hooks`, and `frontend/tests/learning`
- [ ] T005 [P] Review existing Auth middleware and response helper exports in `backend/src/middlewares/auth.middleware.js` and `backend/src/utils/response.util.js` for reuse by Learning routes
- [ ] T006 [P] Review existing Course and Enrollment/Access service contracts with manual `rg` search and record accepted integration names in `.sdd/specs/feat-learning-flow/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared Learning persistence, contracts, validators, and test helpers that must exist before user-story implementation.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T007 Define or align Prisma models for `lesson_progress` and `course_progress` in `backend/prisma/schema.prisma`
- [ ] T008 Create Learning progress database migration without editing generated migration history in `backend/prisma/migrations`
- [ ] T009 [P] Define Learning data model details and state transitions in `.sdd/specs/feat-learning-flow/data-model.md`
- [ ] T010 [P] Define protected Learning API contract in `.sdd/specs/feat-learning-flow/contracts/learning-api.openapi.yaml`
- [ ] T011 [P] Define Learning quickstart smoke steps in `.sdd/specs/feat-learning-flow/quickstart.md`
- [ ] T012 [P] Implement Learning route and progress request schemas in `backend/src/validators/learning.validator.js`
- [ ] T013 [P] Implement Progress route and body schemas in `backend/src/validators/progress.validator.js`
- [ ] T014 Implement Learning progress repository methods for `lesson_progress` in `backend/src/repositories/learning.repository.js`
- [ ] T015 Implement course progress repository methods for `course_progress` in `backend/src/repositories/progress.repository.js`
- [ ] T016 Implement Course access adapter around the approved Enrollment/Access contract in `backend/src/services/courseAccess.service.js`
- [ ] T017 Implement Course content adapter around approved Course module contracts in `backend/src/services/courseContent.service.js`
- [ ] T018 Implement Learning route registration shells in `backend/src/api/learning.routes.js` and `backend/src/api/progress.routes.js`
- [ ] T019 Register Learning routes in the backend app bootstrap in `backend/src/app.js`
- [ ] T020 [P] Implement Learning test app helper with authenticated learner fixtures in `backend/tests/helpers/learningTestApp.js`
- [ ] T021 [P] Implement shared course/access/progress fixtures in `backend/tests/fixtures/learningFixtures.js`

**Checkpoint**: Foundation ready. User-story implementation can start.

---

## Phase 3: User Story 1 - Open Enrolled Course Learning View (Priority: P1) MVP

**Goal**: A signed-in learner with active course access can open one course learning view with ordered sections, lesson states, progress summary, and continue-learning target.

**Independent Test**: Sign in as a learner with active access, open a course learning view, and verify structure, states, progress, continue-learning target, and safe rejection for no access.

### Tests for User Story 1

- [ ] T022 [P] [US1] Add backend integration tests for enrolled course learning view in `backend/tests/learning/courseView.integration.test.js`
- [ ] T023 [P] [US1] Add backend integration tests rejecting no-access paid course learning view in `backend/tests/learning/courseViewAccess.integration.test.js`
- [ ] T024 [P] [US1] Add backend service tests for empty active lesson course progress in `backend/tests/learning/courseView.service.test.js`
- [ ] T025 [P] [US1] Add backend service tests for continue-learning target in course view in `backend/tests/learning/continueLearning.service.test.js`

### Implementation for User Story 1

- [ ] T026 [US1] Implement course learning view orchestration in `backend/src/services/learning.service.js`
- [ ] T027 [US1] Implement lesson state calculation for `COMPLETED`, `IN_PROGRESS`, `LOCKED`, and `NOT_STARTED` in `backend/src/services/learning.service.js`
- [ ] T028 [US1] Implement course progress summary read for course view in `backend/src/services/progress.service.js`
- [ ] T029 [US1] Implement continue-learning target selection for course view in `backend/src/services/learning.service.js`
- [ ] T030 [US1] Add course learning view controller handler in `backend/src/controllers/learning.controller.js`
- [ ] T031 [US1] Add protected course learning view route with validation in `backend/src/api/learning.routes.js`
- [ ] T032 [US1] Add Learning API method for course learning view with credentials in `frontend/src/api/learningApi.js`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - View Lesson Content Securely (Priority: P1)

**Goal**: A learner receives full lesson content only when authenticated, authorized for the course, and allowed by lesson availability and lock rules.

**Independent Test**: Request the same lesson as an authorized learner, a learner without access, and a learner requesting an inactive or locked lesson; only the authorized unlocked request returns protected content.

### Tests for User Story 2

- [ ] T033 [P] [US2] Add backend integration tests for authorized lesson content read in `backend/tests/learning/lessonRead.integration.test.js`
- [ ] T034 [P] [US2] Add backend integration tests for no-access paid lesson rejection in `backend/tests/learning/lessonAccess.integration.test.js`
- [ ] T035 [P] [US2] Add backend integration tests for inactive or deleted lesson rejection in `backend/tests/learning/lessonUnavailable.integration.test.js`
- [ ] T036 [P] [US2] Add backend security tests that locked or unauthorized lessons omit protected content and video URL in `backend/tests/learning/lessonContentSecurity.test.js`

### Implementation for User Story 2

- [ ] T037 [US2] Implement lesson content access flow in `backend/src/services/learning.service.js`
- [ ] T038 [US2] Implement safe locked or unavailable lesson response shaping in `backend/src/services/learning.service.js`
- [ ] T039 [US2] Add lesson read controller handler in `backend/src/controllers/learning.controller.js`
- [ ] T040 [US2] Add protected lesson read route with validation in `backend/src/api/learning.routes.js`
- [ ] T041 [US2] Add Learning API method for lesson read with credentials in `frontend/src/api/learningApi.js`

**Checkpoint**: User Stories 1 and 2 both work independently for protected learning access.

---

## Phase 5: User Story 3 - Mark Lesson Progress And Update Course Progress (Priority: P1)

**Goal**: A learner can mark their own available lesson in progress or completed, and the backend updates lesson progress plus course progress for that learner only.

**Independent Test**: Mark an available lesson completed, repeat the request, attempt cross-user and no-access updates, and verify idempotent lesson progress plus correct course progress.

### Tests for User Story 3

- [ ] T042 [P] [US3] Add backend integration tests for lesson progress update in `backend/tests/learning/lessonProgress.integration.test.js`
- [ ] T043 [P] [US3] Add backend service tests for idempotent repeated completion in `backend/tests/learning/progressIdempotency.service.test.js`
- [ ] T044 [P] [US3] Add backend integration tests rejecting cross-user or frontend-supplied user id progress updates in `backend/tests/learning/progressOwnership.integration.test.js`
- [ ] T045 [P] [US3] Add backend service tests for course progress calculation bounds in `backend/tests/learning/courseProgress.service.test.js`

### Implementation for User Story 3

- [ ] T046 [US3] Implement lesson progress state transitions in `backend/src/services/progress.service.js`
- [ ] T047 [US3] Implement idempotent completion and first completion timestamp handling in `backend/src/services/progress.service.js`
- [ ] T048 [US3] Implement course progress recalculation and synchronization in `backend/src/services/progress.service.js`
- [ ] T049 [US3] Add lesson progress update controller handler in `backend/src/controllers/progress.controller.js`
- [ ] T050 [US3] Add protected lesson progress update route with validation in `backend/src/api/progress.routes.js`
- [ ] T051 [US3] Add Learning API method for lesson progress update with credentials in `frontend/src/api/learningApi.js`

**Checkpoint**: User Story 3 works independently after protected access foundations.

---

## Phase 6: User Story 4 - Continue Learning From The Right Lesson (Priority: P2)

**Goal**: Learners can resume from the first available unfinished lesson, or see completed-course state when all required active lessons are complete.

**Independent Test**: Prepare learner progress for no completed lessons, partial completion, locked next lesson, and all completed lessons; verify continue-learning target or completed state.

### Tests for User Story 4

- [ ] T052 [P] [US4] Add backend service tests for no-progress continue-learning target in `backend/tests/learning/continueLearningNoProgress.service.test.js`
- [ ] T053 [P] [US4] Add backend service tests for partial-progress continue-learning target in `backend/tests/learning/continueLearningPartial.service.test.js`
- [ ] T054 [P] [US4] Add backend service tests for completed-course target absence in `backend/tests/learning/continueLearningComplete.service.test.js`

### Implementation for User Story 4

- [ ] T055 [US4] Refine continue-learning selector for no-progress, partial, locked, and completed states in `backend/src/services/learning.service.js`
- [ ] T056 [US4] Include continue-learning data in course progress read responses in `backend/src/services/progress.service.js`
- [ ] T057 [US4] Add course progress read controller handler in `backend/src/controllers/progress.controller.js`
- [ ] T058 [US4] Add protected course progress read route with validation in `backend/src/api/progress.routes.js`
- [ ] T059 [US4] Add Learning API method for course progress read with credentials in `frontend/src/api/learningApi.js`

**Checkpoint**: Continue Learning works independently for the current learner-course.

---

## Phase 7: User Story 5 - Enforce Sequential Lesson Locking When Enabled (Priority: P2)

**Goal**: Course-level sequential learning rules prevent learners from opening or updating later lessons before completing previous required active lessons.

**Independent Test**: Enable sequential policy, request lesson two before lesson one completion, complete lesson one, then verify lesson two becomes available.

### Tests for User Story 5

- [ ] T060 [P] [US5] Add backend service tests for first lesson unlocked by default in `backend/tests/learning/sequentialFirstLesson.service.test.js`
- [ ] T061 [P] [US5] Add backend integration tests for locked next lesson content rejection in `backend/tests/learning/sequentialLessonAccess.integration.test.js`
- [ ] T062 [P] [US5] Add backend integration tests for locked lesson progress update rejection in `backend/tests/learning/sequentialProgress.integration.test.js`
- [ ] T063 [P] [US5] Add backend service tests ignoring inactive lessons in sequential previous/next calculation in `backend/tests/learning/sequentialInactiveLessons.service.test.js`

### Implementation for User Story 5

- [ ] T064 [US5] Implement course-level sequential policy read through Course adapter in `backend/src/services/courseContent.service.js`
- [ ] T065 [US5] Implement previous required active lesson lookup in `backend/src/services/learning.service.js`
- [ ] T066 [US5] Enforce sequential lock checks for lesson content reads in `backend/src/services/learning.service.js`
- [ ] T067 [US5] Enforce sequential lock checks for progress updates in `backend/src/services/progress.service.js`
- [ ] T068 [US5] Surface safe locked lesson metadata in course view responses in `backend/src/services/learning.service.js`

**Checkpoint**: Sequential locking is enforced server-side for reads and updates.

---

## Phase 8: User Story 6 - Preserve Module Boundaries For Learning (Priority: P3)

**Goal**: Learning uses Auth identity, Course structure/content, and Enrollment/Access decisions through approved contracts without owning or directly querying other modules' data.

**Independent Test**: Review service imports and source-rule tests to confirm Learning repositories only persist Learning progress and cross-module decisions go through adapters/contracts.

### Tests for User Story 6

- [ ] T069 [P] [US6] Add backend source-rule test preventing Prisma imports in Learning services/controllers in `backend/tests/learning/layeringRules.test.js`
- [ ] T070 [P] [US6] Add backend source-rule test preventing direct Payment/Enrollment repository imports in Learning services in `backend/tests/learning/moduleBoundaryRules.test.js`
- [ ] T071 [P] [US6] Add frontend source-rule test for credentialed Learning API calls and no Bearer/browser JWT storage in `frontend/tests/learning/learningApiSecurity.test.js`

### Implementation for User Story 6

- [ ] T072 [US6] Document Learning module contract boundaries in `.sdd/specs/feat-learning-flow/quickstart.md`
- [ ] T073 [US6] Ensure Learning services consume only adapter exports for Course and Enrollment/Access in `backend/src/services/learning.service.js`
- [ ] T074 [US6] Ensure Learning repositories contain only progress persistence methods in `backend/src/repositories/learning.repository.js` and `backend/src/repositories/progress.repository.js`
- [ ] T075 [US6] Ensure frontend Learning UI treats backend lesson states as display state only in `frontend/src/pages/learner/LearningCoursePage.jsx`

**Checkpoint**: Learning module boundaries are enforced and documented.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final contract alignment, docs, test execution, and security hardening across all selected user stories.

- [ ] T076 [P] Update Learning OpenAPI contract examples after implementation in `.sdd/specs/feat-learning-flow/contracts/learning-api.openapi.yaml`
- [ ] T077 [P] Update Learning data model notes after implementation in `.sdd/specs/feat-learning-flow/data-model.md`
- [ ] T078 [P] Update Learning quickstart smoke commands after implementation in `.sdd/specs/feat-learning-flow/quickstart.md`
- [ ] T079 [P] Add final secret/content leakage regression tests in `backend/tests/learning/contentLeakage.test.js`
- [ ] T080 Run backend Learning tests and fix failures using `npm --prefix backend run test`
- [ ] T081 Run frontend Learning source-rule tests and fix failures using `npm --prefix frontend run test`
- [ ] T082 Run full project test command and fix in-scope failures using `npm test`
- [ ] T083 Run build command and fix in-scope failures using `npm run build`
- [ ] T084 Review implementation against `.sdd/specs/feat-learning-flow/spec.md` acceptance scenarios and update only in-scope generated docs if contracts changed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Stories 1, 2, and 3 (P1)**: Start after Foundational. US2 and US3 use shared access/progress foundations.
- **User Stories 4 and 5 (P2)**: Start after Foundational. US4 depends on course view/progress semantics from US1 and US3. US5 affects US1, US2, and US3 behavior.
- **User Story 6 (P3)**: Can start after Foundational but final validation depends on selected backend/frontend implementation files.
- **Polish**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other stories after Foundational. MVP.
- **US2**: Depends on Foundational and can be tested with access fixtures independent of US1 UI.
- **US3**: Depends on Foundational access and progress repository support.
- **US4**: Depends on US1 course view and US3 progress semantics.
- **US5**: Depends on Course adapter and affects US1, US2, and US3 behavior.
- **US6**: Depends on concrete implementation files to validate module boundaries.

### Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel.
- Foundational docs, validators, adapters, and test helpers marked `[P]` can run in parallel.
- Tests within each user story marked `[P]` can run in parallel before implementation.
- Frontend API/client tasks can run in parallel with backend implementation once contracts are stable.
- US2 and US3 can proceed in parallel after Foundational if their shared service contracts are stable.

## Parallel Example: User Story 1

```text
Task: T022 Add backend integration tests for enrolled course learning view
Task: T023 Add backend integration tests rejecting no-access paid course learning view
Task: T024 Add backend service tests for empty active lesson course progress
Task: T025 Add backend service tests for continue-learning target in course view
```

## Parallel Example: User Story 5

```text
Task: T060 Add backend service tests for first lesson unlocked by default
Task: T061 Add backend integration tests for locked next lesson content rejection
Task: T062 Add backend integration tests for locked lesson progress update rejection
Task: T063 Add backend service tests ignoring inactive lessons in sequential previous/next calculation
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational Learning infrastructure.
3. Complete Phase 3 User Story 1.
4. Stop and validate authenticated course learning view, no-access rejection, progress summary, and continue-learning target.

### Incremental Delivery

1. Add US2 for secure lesson content read.
2. Add US3 for lesson progress updates and course progress synchronization.
3. Add US4 for complete continue-learning edge cases.
4. Add US5 for sequential locking.
5. Add US6 for module-boundary source rules and frontend safety checks.

### Guardrails

- Write story tests first and confirm they fail before implementation.
- Do not import Prisma outside repositories.
- Do not query Payment/Enrollment/Course tables directly from Learning services.
- Do not add Bearer auth or browser JWT storage.
- Do not accept frontend `userId`, `role`, `paymentStatus`, `enrollmentStatus`, or `courseAccess` as authority.
- Do not return protected content for unauthorized, locked, inactive, or deleted lessons.
- Do not implement payment, enrollment creation, course CRUD/content management, quiz, final project, mentor review, certificate, reports, notes, bookmarks, comments, realtime sync, or video playback tracking in this feature.
