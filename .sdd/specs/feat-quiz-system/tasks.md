# Tasks: feat-quiz-system

**Input**: Design documents from `.sdd/specs/feat-quiz-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are required by the feature spec and project rules. Backend tests use `node:test`, `assert`, and `supertest`; frontend tests use `node:test` for API client and source-rule checks.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independently useful increment after shared foundations are complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the empty backend/frontend project structure and package scripts required by the Quiz System MVP.

- [ ] T001 Verify backend npm package and scripts exist in `backend/package.json`
- [ ] T002 Verify frontend CRA npm package and scripts exist in `frontend/package.json`
- [ ] T003 [P] Create backend source directories in `backend/src/api`, `backend/src/controllers`, `backend/src/services`, `backend/src/repositories`, `backend/src/middlewares`, `backend/src/validators`, `backend/src/utils`, and `backend/src/config`
- [ ] T004 [P] Create backend Prisma and test directories in `backend/prisma`, `backend/prisma/migrations`, `backend/tests/quiz`, `backend/tests/fixtures`, and `backend/tests/helpers`
- [ ] T005 [P] Create frontend source directories in `frontend/src/api`, `frontend/src/components/quiz`, `frontend/src/pages/learner`, `frontend/src/hooks`, `frontend/src/routes`, and `frontend/tests/quiz`
- [ ] T006 [P] Verify CRA entry shell exists in `frontend/public/index.html`, `frontend/src/index.js`, and `frontend/src/App.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Quiz infrastructure that must exist before user-story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 Define Quiz Prisma models for `quizzes`, `quiz_questions`, and `quiz_submissions` in `backend/prisma/schema.prisma`
- [ ] T008 Create Quiz database migration preserving existing migration history in `backend/prisma/migrations`
- [ ] T009 [P] Add seed data for sample active quizzes and questions in `backend/prisma/seed.js`
- [ ] T010 [P] Configure Prisma client access only for repositories in `backend/src/config/prisma.config.js` (consumed, not recreated)
- [ ] T011 [P] Configure Auth env parsing without logging secret values in `backend/src/config/auth.config.js` (consumed, not recreated)
- [ ] T012 [P] Configure exact-origin credentialed CORS in `backend/src/config/cors.config.js` (consumed, not recreated)
- [ ] T013 [P] Implement standard response helpers in `backend/src/utils/response.util.js` (consumed, not recreated)
- [ ] T014 [P] Implement centralized error middleware with sanitized errors in `backend/src/middlewares/error.middleware.js` (consumed, not recreated)
- [ ] T015 [P] Implement request validation middleware for Zod schemas in `backend/src/middlewares/validation.middleware.js` (consumed, not recreated)
- [ ] T016 [P] Define shared Quiz Zod schemas in `backend/src/validators/quiz.validator.js`
- [ ] T017 Verify Express-style app bootstrap and route mounting in `backend/src/app.js`
- [ ] T018 Verify backend server entry using env config in `backend/src/server.js`
- [ ] T019 [P] Implement Quiz repository base methods and safe select projections in `backend/src/repositories/quiz.repository.js`
- [ ] T020 [P] Implement Course Access adapter consuming Enrollment/Access contract in `backend/src/services/courseAccess.service.js`
- [ ] T021 [P] Implement Course Content adapter consuming Course contract in `backend/src/services/courseContent.service.js`
- [ ] T022 [P] Implement auto-grading service for `single_choice`, `multiple_choice`, and `true_false` in `backend/src/services/scoring.service.js`
- [ ] T023 [P] Implement backend test app and database helpers in `backend/tests/helpers/quizTestApp.js`
- [ ] T024 [P] Implement frontend API client base with credentials enabled in `frontend/src/api/quizApi.js`

**Checkpoint**: Foundation ready. User-story implementation can start.

---

## Phase 3: User Story 1 - View Available Quiz In An Accessible Course (Priority: P1) MVP

**Goal**: A signed-in learner can see active quizzes attached to a course or lesson only when backend rules confirm the learner has active access to that course.

**Independent Test**: Sign in as a learner with active enrollment, view active quizzes for an accessible course/lesson, then confirm that a learner without access or with `PENDING` payment cannot see quiz details.

### Tests for User Story 1

- [ ] T025 [P] [US1] Add backend integration tests for quiz listing with active course access in `backend/tests/quiz/quizListing.integration.test.js`
- [ ] T026 [P] [US1] Add backend integration tests for quiz listing rejected when no course access in `backend/tests/quiz/quizListingAccessDenied.integration.test.js`
- [ ] T027 [P] [US1] Add backend service tests for draft/inactive quiz exclusion in `backend/tests/quiz/quizAvailability.service.test.js`
- [ ] T028 [P] [US1] Add backend validation tests for quiz belonging to inactive/deleted course/lesson in `backend/tests/quiz/quizContextValidation.test.js`

### Implementation for User Story 1

- [ ] T029 [US1] Add repository methods for active quiz lookup by course/lesson in `backend/src/repositories/quiz.repository.js`
- [ ] T030 [US1] Implement quiz listing business logic with access check, safe metadata assembly, and attempt summary in `backend/src/services/quiz.service.js`
- [ ] T031 [US1] Add quiz listing controller handler in `backend/src/controllers/quiz.controller.js`
- [ ] T032 [US1] Add quiz listing route with Zod validation and auth middleware in `backend/src/api/quiz.routes.js`
- [ ] T033 [US1] Add Quiz API method for quiz listing in `frontend/src/api/quizApi.js`
- [ ] T034 [P] [US1] Create quiz list page following `frontend/DESIGN.md` in `frontend/src/pages/learner/QuizListPage.jsx`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Start Quiz With Secure Question Delivery (Priority: P1)

**Goal**: A learner with active access can start an active quiz and receive questions with answer options. Correct answers and scoring internals remain hidden until after submission.

**Independent Test**: Start an active quiz as an eligible learner and verify returned questions include only safe fields (text, options, type) and never include `correct_answer` or `explanation`.

### Tests for User Story 2

- [ ] T035 [P] [US2] Add backend integration tests for successful quiz start with safe question payload in `backend/tests/quiz/quizStart.integration.test.js`
- [ ] T036 [P] [US2] Add backend service tests confirming `correct_answer` and `explanation` excluded pre-submission in `backend/tests/quiz/safeQuestionPayload.service.test.js`
- [ ] T037 [P] [US2] Add backend integration tests for quiz with no active questions in `backend/tests/quiz/quizStartNoQuestions.integration.test.js`
- [ ] T038 [P] [US2] Add backend integration tests for starting quiz without access in `backend/tests/quiz/quizStartAccessDenied.integration.test.js`

### Implementation for User Story 2

- [ ] T039 [US2] Add repository method for fetching active questions without protected fields in `backend/src/repositories/quiz.repository.js`
- [ ] T040 [US2] Implement quiz start logic with eligibility re-check, start time recording, and safe question shaping in `backend/src/services/quiz.service.js`
- [ ] T041 [US2] Add quiz start controller handler in `backend/src/controllers/quiz.controller.js`
- [ ] T042 [US2] Add quiz start route with Zod validation and auth middleware in `backend/src/api/quiz.routes.js`
- [ ] T043 [US2] Add Quiz API method for quiz start in `frontend/src/api/quizApi.js`
- [ ] T044 [P] [US2] Create quiz taking page following `frontend/DESIGN.md` in `frontend/src/pages/learner/QuizTakingPage.jsx`

**Checkpoint**: User Story 2 works independently after Foundations + US1.

---

## Phase 5: User Story 3 - Submit Answers And Receive Automatic Score (Priority: P1)

**Goal**: A learner can submit answers for supported question types. The backend validates the answers, applies the correct scoring rule for each type, determines pass/fail, and stores the authoritative result.

**Independent Test**: Submit answers for single-choice, multiple-choice, and true/false questions; verify backend calculates score/maxScore/passed correctly; confirm malformed submissions are rejected; confirm frontend-provided scoring values are ignored.

### Tests for User Story 3

- [ ] T045 [P] [US3] Add backend integration tests for valid answer submission with auto-scoring in `backend/tests/quiz/submitScoring.integration.test.js`
- [ ] T046 [P] [US3] Add backend service tests for single-choice, multiple-choice, and true/false scoring correctness in `backend/tests/quiz/scoring.service.test.js`
- [ ] T047 [P] [US3] Add backend integration tests rejecting unknown/duplicate question ids, malformed values in `backend/tests/quiz/submitValidation.integration.test.js`
- [ ] T048 [P] [US3] Add backend integration tests confirming frontend-provided score/maxScore/passed are ignored in `backend/tests/quiz/submitFrontendAuthority.test.js`
- [ ] T049 [P] [US3] Add backend integration tests for timed quiz late submission rejection in `backend/tests/quiz/timedQuizLateSubmission.integration.test.js`
- [ ] T050 [P] [US3] Add backend service tests for multiple-choice order-insensitive matching and extra selection rejection in `backend/tests/quiz/multipleChoiceScoring.service.test.js`

### Implementation for User Story 3

- [ ] T051 [US3] Add repository methods for submission create and quiz question lookup with correct answers in `backend/src/repositories/quiz.repository.js`
- [ ] T052 [US3] Implement auto-grading logic for single_choice, multiple_choice, true_false in `backend/src/services/scoring.service.js`
- [ ] T053 [US3] Implement submission business logic with answer validation, scoring invocation, timed check, and persistence in `backend/src/services/quiz.service.js`
- [ ] T054 [US3] Add quiz submit controller handler in `backend/src/controllers/quiz.controller.js`
- [ ] T055 [US3] Add quiz submit route with Zod validation and auth middleware in `backend/src/api/quiz.routes.js`
- [ ] T056 [US3] Add Quiz API method for answer submission in `frontend/src/api/quizApi.js`

**Checkpoint**: User Story 3 works independently after Foundations + US2.

---

## Phase 6: User Story 4 - Review Quiz Result Safely (Priority: P2)

**Goal**: After submitting, a learner can review their own quiz result, including score, passed status, and post-submission review data that is safe to reveal only to the submitting learner.

**Independent Test**: Submit a quiz, read the result as the same learner, attempt to read it as a different learner, and confirm only the owning learner receives their score and post-submission review data.

### Tests for User Story 4

- [ ] T057 [P] [US4] Add backend integration tests for result view score/maxScore/passed/per-question review in `backend/tests/quiz/resultView.integration.test.js`
- [ ] T058 [P] [US4] Add backend service tests for pre-submission result request returning no scoring data in `backend/tests/quiz/resultPreSubmission.service.test.js`
- [ ] T059 [P] [US4] Add backend integration tests rejecting cross-learner result access in `backend/tests/quiz/resultOwnership.integration.test.js`
- [ ] T060 [P] [US4] Add backend service tests for explanation reveal only after submission and only for owning learner in `backend/tests/quiz/explanationVisibility.service.test.js`

### Implementation for User Story 4

- [ ] T061 [US4] Add repository method for submission lookup with ownership check in `backend/src/repositories/quiz.repository.js`
- [ ] T062 [US4] Implement result assembly logic with ownership enforcement and safe post-submission data in `backend/src/services/quiz.service.js`
- [ ] T063 [US4] Add quiz result controller handler in `backend/src/controllers/quiz.controller.js`
- [ ] T064 [US4] Add quiz result route with auth middleware in `backend/src/api/quiz.routes.js`
- [ ] T065 [US4] Add Quiz API method for result view in `frontend/src/api/quizApi.js`
- [ ] T066 [P] [US4] Create quiz result page following `frontend/DESIGN.md` in `frontend/src/pages/learner/QuizResultPage.jsx`

**Checkpoint**: User Story 4 works independently after Foundations + US3.

---

## Phase 7: User Story 5 - View Personal Quiz Submission History (Priority: P2)

**Goal**: A learner can view their own past quiz attempts for a course or specific quiz so they can track performance over time.

**Independent Test**: Create multiple submissions for the same learner and quiz, then confirm only that learner's sanitized attempt history is returned in chronological order.

### Tests for User Story 5

- [ ] T067 [P] [US5] Add backend integration tests for submission history with chronological ordering in `backend/tests/quiz/historyListing.integration.test.js`
- [ ] T068 [P] [US5] Add backend integration tests for empty history when no submissions exist in `backend/tests/quiz/historyEmpty.test.js`
- [ ] T069 [P] [US5] Add backend integration tests for history request rejected when no course access in `backend/tests/quiz/historyAccessDenied.integration.test.js`
- [ ] T070 [P] [US5] Add backend integration tests confirming cross-learner submissions excluded in `backend/tests/quiz/historyCrossLearner.test.js`

### Implementation for User Story 5

- [ ] T071 [US5] Add repository method for submission history query by learner and course/quiz in `backend/src/repositories/quiz.repository.js`
- [ ] T072 [US5] Implement history assembly with sanitized attempt data (no raw correct answers) in `backend/src/services/quiz.service.js`
- [ ] T073 [US5] Add quiz history controller handler in `backend/src/controllers/quiz.controller.js`
- [ ] T074 [US5] Add quiz history route with auth middleware in `backend/src/api/quiz.routes.js`
- [ ] T075 [US5] Add Quiz API method for submission history in `frontend/src/api/quizApi.js`
- [ ] T076 [P] [US5] Create quiz history page following `frontend/DESIGN.md` in `frontend/src/pages/learner/QuizHistoryPage.jsx`

**Checkpoint**: User Story 5 works independently after Foundations + US3.

---

## Phase 8: User Story 6 - Preserve Quiz Module Boundaries And Assessment Integrity (Priority: P3)

**Goal**: Quiz System uses trusted Auth identity, Course structure, and Enrollment/Access decisions while owning only quiz, question, and submission behavior in its approved scope.

**Independent Test**: Review behavior and contracts: Quiz decisions use authenticated backend user, Course-owned course/lesson context, and Enrollment/Access authority for course access. No module boundary violation should occur.

### Tests for User Story 6

- [ ] T077 [P] [US6] Add backend service tests for module boundary enforcement (no direct payment/enrollment reads) in `backend/tests/quiz/moduleBoundaries.service.test.js`
- [ ] T078 [P] [US6] Add backend integration tests for Auth session requirement on all quiz endpoints in `backend/tests/quiz/authRequired.integration.test.js`
- [ ] T079 [P] [US6] Add backend integration tests for sanitized error responses (no raw stack/SQL/secrets) in `backend/tests/quiz/errorContract.integration.test.js`
- [ ] T080 [P] [US6] Add backend integration tests for fail-safe behavior when dependencies unavailable in `backend/tests/quiz/dependencyFailure.integration.test.js`

### Implementation for User Story 6

- [ ] T081 [US6] Add auth middleware to all quiz routes in `backend/src/api/quiz.routes.js`
- [ ] T082 [US6] Add module boundary checks: Quiz never queries `enrollments`, `payments`, `users`, `courses`, `lessons` directly in `backend/src/services/quiz.service.js`
- [ ] T083 [US6] Add dependency failure handling with safe errors in `backend/src/services/quiz.service.js`
- [ ] T084 [US6] Add frontend source-rule test for credentialed requests in `frontend/tests/quiz/quizApiCredentials.test.js`
- [ ] T085 [US6] Add frontend source-rule test forbidding frontend-calculated score/passed in `frontend/tests/quiz/noFrontendScoring.test.js`

**Checkpoint**: Module boundaries are enforced and cross-module contracts are satisfied.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation alignment, and hardening across all stories.

- [ ] T086 [P] Verify OpenAPI contract alignment with implemented routes in `.sdd/specs/feat-quiz-system/contracts/quiz-api.openapi.yaml`
- [ ] T087 [P] Update Quiz quickstart with final implemented scripts and smoke steps in `.sdd/specs/feat-quiz-system/quickstart.md`
- [ ] T088 [P] Add final secret-leak regression tests for responses/log-safe paths in `backend/tests/quiz/secretLeakage.test.js`
- [ ] T089 [P] Add final pre-submission correct-answer leak regression tests in `backend/tests/quiz/correctAnswerLeak.test.js`
- [ ] T090 Run backend Quiz test suite and fix failures using `npm --prefix backend run test`
- [ ] T091 Run frontend Quiz source-rule tests and fix failures using `npm --prefix frontend run test`
- [ ] T092 Run full root test command and fix failures using `npm test`
- [ ] T093 Run production build command and fix build failures using `npm run build`
- [ ] T094 Review implementation against `.sdd/specs/feat-quiz-system/spec.md` acceptance scenarios and update only generated docs if contracts changed in scope

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies (verify existing project structure).
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 and 2 (P1)**: Start after Foundational. US2 depends on quiz listing foundations from US1.
- **User Story 3 (P1)**: Start after Foundational + US2 (submission requires quiz start flow).
- **User Stories 4, 5 (P2)**: Start after Foundational + US3. Result review and history depend on submission existence.
- **User Story 6 (P3)**: Can start after Foundational, but final validation depends on all endpoints being implemented.
- **Polish (Phase 9)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other stories after Foundational. MVP.
- **US2**: Depends on US1 (quiz listing provides quiz context for start).
- **US3**: Depends on US2 (submission requires quiz start to record `started_at`).
- **US4**: Depends on US3 (result view requires submission existence).
- **US5**: Depends on US3 (history requires submission existence).
- **US6**: Depends on all stories for complete module boundary enforcement.

### Parallel Opportunities

- Setup directory/package tasks marked `[P]` can run in parallel.
- Foundational config, utility, middleware, validator, and test-helper tasks marked `[P]` can run in parallel.
- Tests within each user story marked `[P]` can run in parallel before implementation.
- Frontend pages/components marked `[P]` can be built in parallel with backend service/controller work when contracts are stable.
- US4 and US5 can proceed in parallel after US3 foundations are stable.

## Parallel Example: User Story 1

```text
Task: T025 Add backend integration tests for quiz listing with active course access
Task: T026 Add backend integration tests for quiz listing rejected when no course access
Task: T027 Add backend service tests for draft/inactive quiz exclusion
Task: T028 Add backend validation tests for quiz context validation
Task: T034 Create quiz list page
```

## Parallel Example: User Story 3

```text
Task: T045 Add backend integration tests for valid answer submission with auto-scoring
Task: T046 Add backend service tests for scoring correctness
Task: T047 Add backend integration tests rejecting unknown/duplicate question ids
Task: T048 Add backend integration tests confirming frontend-provided scoring values ignored
Task: T049 Add backend integration tests for timed quiz late submission rejection
Task: T050 Add backend service tests for multiple-choice order-insensitive matching
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup verification.
2. Complete Phase 2 foundational Quiz infrastructure (models, migration, seed, repository, access adapters, scoring service).
3. Complete Phase 3 User Story 1.
4. Stop and validate quiz listing, access enforcement, and safe metadata display.

### Incremental Delivery

1. Add US2 for secure quiz start with safe question payload.
2. Add US3 for answer submission, auto-grading, and submission persistence.
3. Add US4 for result review with post-submission data.
4. Add US5 for submission history.
5. Add US6 for module boundary enforcement and cross-cutting security.
6. Add Phase 9 polish (OpenAPI alignment, quickstart, regression tests).

### Guardrails

- Write story tests first and confirm they fail before implementation.
- Do not import Prisma outside repositories.
- Do not include `correct_answer` or `explanation` in pre-submission payloads.
- Do not accept frontend-provided `userId`, `score`, `maxScore`, `passed`, `correctAnswer`, `paymentStatus`, `courseAccess`.
- Do not read payment or enrollment tables directly in Quiz module.
- Do not allow cross-learner submission access.
- Do not add Bearer auth or browser JWT storage.
- Do not read, print, or commit real `.env` values.
- Do not implement quiz authoring, question CRUD, manual grading, essay/free-text, partial-credit, randomized pools, anti-cheating, retake limits, cooldowns, leaderboards, gamification, certificate, admin report, payment checkout, enrollment creation, course CRUD, learning progress, final project, or mentor review behavior in this feature.