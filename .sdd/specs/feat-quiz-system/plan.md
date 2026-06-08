# Implementation Plan: feat-quiz-system

**Branch**: `feat-quiz-system` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.sdd/specs/feat-quiz-system/spec.md`

## Summary

Build the OCP Quiz System MVP as a backend-authoritative assessment platform for enrolled learners to view active quizzes attached to accessible courses/lessons, start quizzes with secure pre-submission question payloads (no correct answers revealed), submit answers for automatic backend scoring (`single_choice`, `multiple_choice`, `true_false`), view post-submission results with safe per-question review, and browse personal submission history. The implementation keeps Quiz ownership limited to `quizzes`, `quiz_questions`, and `quiz_submissions`; consumes Auth identity from httpOnly-cookie sessions; consumes Course structure/lesson context through approved Course contracts; and consumes course access through the Payment/Enrollment/Access authority. No quiz authoring, question CRUD, manual grading, essay/free-text questions, partial-credit scoring, randomized question pools, anti-cheating, proctoring, retake limits, leaderboards, certificate, admin report, payment checkout, enrollment creation, learning progress, final project, or mentor review behavior is included.

## Technical Context

**Language/Version**: NodeJS with JavaScript ESM for backend; React JSX with Create React App for frontend.

**Primary Dependencies**: Express-style REST API, Prisma, MySQL, Zod, cookie-based Auth middleware, approved response/error helpers, Course module contracts for active course structure and lesson context, Enrollment/Access contract `canAccessCourse(userId, courseId)`, React, Bootstrap, `react-scripts`, and a frontend API client using credentialed requests.

**Storage**: MySQL via Prisma. Quiz-owned tables are `quizzes`, `quiz_questions`, and `quiz_submissions`. Auth/User, Course, Payment, Enrollment, Learning, Final Project, Mentor, Admin, and Reports tables remain owned by their respective modules.

**Testing**: Backend uses `node:test`, `assert`, and `supertest` for service/unit and endpoint integration tests. Frontend uses `node:test` for API client/source-rule tests where needed. No Jest, Vitest, Cypress, Vite, Next.js, TypeScript, or CommonJS conversion is planned.

**Target Platform**: Local development with backend and CRA frontend using checked-in env contracts; production-compatible cookie/CORS behavior remains controlled by Auth and platform configuration.

**Project Type**: Full-stack web application plus REST API.

**Performance Goals**: Eligible learners can start an available quiz and submit valid answers in one continuous flow without needing to refresh. Quiz listing for an accessible course should avoid N+1 queries for normal course structures. Scoring calculations stay bounded to the quiz's question set.

**Constraints**: JWT stays only in httpOnly cookies; backend reads authenticated identity from trusted session middleware; frontend uses credentialed requests and never sends Bearer tokens or browser-stored JWT; Quiz never accepts frontend-supplied `userId`, `role`, `score`, `maxScore`, `passed`, `correctAnswer`, `paymentStatus`, `enrollmentStatus`, or `courseAccess`; Quiz does not read payment status directly; services do not import Prisma; repositories own database access; important inputs are validated with Zod; errors use `{ success, message, code, details }` or approved equivalent without raw infrastructure details; pre-submission question payloads never include `correct_answer` or `explanation`; multiple-choice scoring is order-insensitive with extra selections rejected; timed quiz late submissions are rejected.

**Scale/Scope**: Quiz System MVP only. Six user stories, six primary backend behaviors (quiz listing, quiz start, answer submission with auto-grading, result review, submission history, module boundary enforcement), three Quiz-owned database entities, one course access integration, one course/lesson structure integration, and optional frontend quiz API/client support. Quiz authoring, question CRUD, manual grading, partial-credit, retake limits, and leaderboards are deferred.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The checked-in `.specify/memory/constitution.md` may contain placeholder or encoded principle text, so concrete project gates from `AGENTS.md`, `PROJECT_AGENTS.md`, `DATABASE.md`, `share_context.md`, and the generated spec are applied:

- **Stack gate**: PASS. Plan keeps NodeJS JavaScript ESM, Express-style REST, React JSX, Bootstrap, CRA, MySQL, Prisma, JWT httpOnly Cookie, Zod, npm, and the approved test setup.
- **Layering gate**: PASS. Routes/controllers delegate to services; services delegate to repositories and approved module contracts; auto-grading logic lives in service layer; only repositories import Prisma.
- **Backend authority gate**: PASS. Backend remains authoritative for quiz eligibility, timing, scoring, pass/fail, result ownership, and submission ownership.
- **Module ownership gate**: PASS. Quiz owns only quizzes, questions, and submissions. Auth/User, Course, Payment/Enrollment/Access, Learning, Final Project, Mentor, Admin, and Reports remain outside Quiz ownership.
- **Payment/access safety gate**: PASS. Quiz consumes `canAccessCourse(userId, courseId)` or equivalent access authority and never reads payment status or grants quiz access from `PENDING` payment.
- **Assessment integrity gate**: PASS. Correct answers are never exposed pre-submission. Frontend-provided score/maxScore/passed are ignored. Backend is sole scoring authority.
- **Secret and data safety gate**: PASS. Plan uses only env variable names and contracts. No real `.env` values, JWTs, cookies, correct answers pre-submission, payment internals, raw persistence errors, password data, or another learner's submission data are exposed.
- **Validation/error gate**: PASS. Important body/query/params are validated with Zod and errors use the project response shape without raw stack traces or raw Prisma/SQL errors.
- **Frontend gate**: PASS. Frontend calls go through `frontend/src/api`, use `REACT_APP_API_BASE_URL`, send cookies with credentials, and do not decide real quiz eligibility, timing, scoring, or result ownership.
- **Scope gate**: PASS. No quiz authoring UI, question CRUD, manual grading, essay/free-text, partial-credit, randomized pools, anti-cheating, retake limits, cooldowns, leaderboards, gamification, certificate, admin report, payment checkout, enrollment creation, course CRUD, learning progress, final project, or mentor review behavior is included.

## Project Structure

### Documentation (this feature)

```text
.sdd/specs/feat-quiz-system/
|-- context.md
|-- spec.md
|-- plan.md
|-- research.md              # to be generated/updated by planning workflow if needed
|-- data-model.md            # to be generated/updated by planning workflow if needed
|-- quickstart.md            # to be generated/updated by planning workflow if needed
|-- contracts/               # to be generated/updated by planning workflow if API contracts are documented
`-- tasks.md
```

### Source Code (repository root)

```text
backend/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
|-- src/
|   |-- api/
|   |   `-- quiz.routes.js
|   |-- controllers/
|   |   `-- quiz.controller.js
|   |-- middlewares/
|   |   |-- auth.middleware.js          # consumed, owned by Auth
|   |   `-- validation.middleware.js
|   |-- repositories/
|   |   `-- quiz.repository.js          # Quiz-owned persistence
|   |-- services/
|   |   |-- quiz.service.js
|   |   |-- scoring.service.js          # auto-grading logic
|   |   |-- courseAccess.service.js     # adapter around Enrollment/Access contract
|   |   `-- courseContent.service.js    # adapter around Course contract if needed
|   |-- validators/
|   |   `-- quiz.validator.js
|   `-- utils/
|       `-- response.util.js
`-- tests/
    |-- quiz/
    |-- fixtures/
    `-- helpers/

frontend/
|-- src/
|   |-- api/
|   |   `-- quizApi.js
|   |-- pages/
|   |   `-- learner/
|   |       |-- QuizListPage.jsx
|   |       |-- QuizTakingPage.jsx
|   |       |-- QuizResultPage.jsx
|   |       `-- QuizHistoryPage.jsx
|   |-- components/
|   |   `-- quiz/
|   |-- hooks/
|   |   `-- useQuiz.js
|   `-- routes/
`-- tests/
    `-- quiz/
```

**Structure Decision**: Use the required OCP two-application structure. Backend route/controller/service/repository layers enforce quiz access validation, safe question delivery, auto-grading, submission persistence, and result ownership. A dedicated `scoring.service.js` encapsulates auto-grading logic for `single_choice`, `multiple_choice`, and `true_false` question types, keeping business rules isolated from quiz lifecycle management. Frontend quiz code is limited to API calls and learner UX; it never becomes the authority for quiz eligibility, timing, scoring, pass/fail, or result ownership.

## Phase 0: Research

Planning decisions resolve the current Quiz System open questions as follows:

- **Quiz access validation source**
  - Decision: Quiz service consumes approved Enrollment/Access contract `canAccessCourse(userId, courseId)` and never reads payment/enrollment tables directly.
  - Rationale: The spec clearly states Quiz System does not own payment or enrollment decisions.
  - Alternatives considered: direct repository reads of `enrollments`/`payments` tables. Rejected because it violates module ownership.

- **Quiz course/lesson context source**
  - Decision: Quiz service consumes approved Course contracts for course status, lesson status, and quiz ownership validation.
  - Rationale: Course module owns course and lesson data; Quiz only needs to confirm the quiz belongs to an active accessible course/lesson.
  - Alternatives considered: storing denormalized course/lesson status on `quizzes` table. Rejected because it duplicates Course module's authority.

- **Question type scoring strategy**
  - Decision: `single_choice` matches exactly one correct answer value; `multiple_choice` requires exact set matching (order-insensitive, extra selections = incorrect); `true_false` matches a boolean or string value.
  - Rationale: This is the simplest correct implementation for the supported types. Partial credit would require a later spec.
  - Alternatives considered: partial scoring for multiple-choice. Deferred because spec says no partial credit for MVP.

- **Time limit enforcement**
  - Decision: Backend records `started_at` when learner starts the quiz and compares `submitted_at - started_at` with `time_limit_minutes`. Late submissions are rejected with a clear error.
  - Rationale: Backend-controlled timing prevents frontend timer tampering.
  - Alternatives considered: auto-submit on timeout. Deferred because the spec says late submissions are rejected; auto-submit would require a later approved policy.

- **Submission ownership**
  - Decision: Submission ownership is enforced by backend using authenticated `userId`. All submission queries filter by the authenticated learner. Cross-learner access is rejected.
  - Rationale: This is the authoritative backend ownership pattern used across OCP.
  - Alternatives considered: including `userId` in request body and relying on frontend to supply it. Rejected because frontend-supplied `userId` is forbidden by spec.

- **Multiple submissions policy**
  - Decision: Learners may have multiple submissions for the same quiz in MVP. No retake limits or cooldowns are enforced.
  - Rationale: The spec assumes multiple submissions allowed unless a later spec defines limits.
  - Alternatives considered: restrict to one submission. Rejected because spec says learners may have multiple submissions.

- **Pre-submission vs post-submission data**
  - Decision: `quiz_questions.correct_answer` and `quiz_questions.explanation` are never included in pre-submission question payloads. After submission, they may be included only in the owning learner's result view.
  - Rationale: Assessment integrity requires correct answers hidden until submission. Post-submission review requires selective reveal.
  - Alternatives considered: always hide explanations. Rejected because learner feedback is a stated requirement.

## Phase 1: Design And Contracts

Design artifacts expected from this plan:

- `data-model.md`: Define `Quiz`, `QuizQuestion`, `QuizSubmission`, computed `QuizAvailabilityView`, `QuizQuestionPayload`, `QuizResultView`, and `QuizAttemptSummary`, including scoring rules, uniqueness constraints, and protected field semantics.
- `contracts/quiz-api.openapi.yaml`: Document protected quiz listing, quiz start, answer submission, result review, and submission history contracts if API documentation is generated for this feature.
- `quickstart.md`: Document local verification steps for authenticated quiz access, unauthorized access rejection, secure question delivery, auto-grading correctness, result ownership, and submission history scoping.

### Backend Design

- `quiz.routes.js` attaches auth middleware, validation middleware, and thin controllers.
- `quiz.controller.js` handles quiz listing, start, submit, result, and history responses by delegating to `quiz.service.js`.
- `quiz.service.js` orchestrates Auth identity, Course context, Enrollment/Access, quiz eligibility, safe question payload shaping, timed quiz enforcement, submission validation, result assembly, and history queries.
- `scoring.service.js` encapsulates auto-grading logic for `single_choice`, `multiple_choice`, and `true_false` question types; calculates score, max score, and passed status; is invoked by `quiz.service.js` during submission processing.
- `quiz.repository.js` owns Prisma access for `quizzes`, `quiz_questions`, and `quiz_submissions` only.
- Course and Enrollment/Access data must be reached through approved services/contracts/adapters, not direct repository imports from another module.

### Frontend Design

- `quizApi.js` centralizes Quiz API calls and always sends credentials.
- Learner pages/components display backend-provided quiz metadata, questions (without correct answers), results, and history as UX only.
- Quiz taking page never displays correct answers before submission, never sends frontend-calculated score, and never exposes another learner's data.
- Frontend route guards can improve navigation but cannot grant real quiz access or determine scoring.
- Frontend source-rule tests should verify no Bearer auth, no browser JWT storage, and credentialed API calls for Quiz requests.

### Data Design

- `quizzes` table: one row per quiz with `course_id` (required), `lesson_id` (optional), `title`, `description`, `time_limit_minutes`, `passing_score`, `status`, and timestamps. Only active quizzes are available to learners.
- `quiz_questions` table: one row per question with `quiz_id`, `question_text`, `question_type` (enum: single_choice, multiple_choice, true_false), `options` (JSON array), `correct_answer` (protected pre-submission), `explanation` (protected pre-submission), `points`, `order`, and timestamps.
- `quiz_submissions` table: one row per submission with `user_id`, `quiz_id`, `answers` (JSON snapshot of submitted answers), `score`, `max_score`, `passed`, `started_at`, `submitted_at`, and `created_at`. Each submission is owned by exactly one learner.
- Multiple-choice `correct_answer` is stored as a JSON array for set comparison. Scoring compares submitted selections order-insensitively and rejects extra selections.
- Timed quiz enforcement: backend compares `submitted_at - started_at` with `time_limit_minutes * 60` seconds. Late submissions are rejected.
- Repeated submission for the same learner and quiz is allowed (no uniqueness constraint on `user_id + quiz_id`), creating separate attempt records.

## Post-Design Constitution Check

- **Stack gate**: PASS after design. Planned source files stay within NodeJS ESM, Express-style REST, CRA React JSX, Prisma, MySQL, npm, and approved tests.
- **Layering gate**: PASS after design. Controllers are thin, services contain Quiz rules, repositories own Quiz persistence, and cross-module data goes through contracts/adapters.
- **Backend authority gate**: PASS after design. Quiz eligibility, safe question delivery, auto-grading, timed enforcement, and result ownership are enforced server-side.
- **Module ownership gate**: PASS after design. Quiz owns only quizzes, questions, and submissions. Consumes Auth, Course, and Enrollment/Access contracts.
- **Assessment integrity gate**: PASS after design. Correct answers are never exposed pre-submission. Scoring is backend-only. Multiple-choice matching is order-insensitive.
- **Frontend gate**: PASS after design. Frontend remains UX only and sends credentialed requests through `frontend/src/api`.
- **Scope gate**: PASS after design. Deferred quiz authoring, manual grading, partial-credit, retake limits, leaderboards, certificate, and admin reports remain outside this plan.

## Complexity Tracking

No constitution or project-rule violations require justification.