# Implementation Plan: feat-learning-flow

**Branch**: `feat-learning-flow` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.sdd/specs/feat-learning-flow/spec.md`

## Summary

Build the OCP Learning Flow MVP as a backend-authoritative learner experience for protected course learning view, secure lesson access, lesson progress updates, course progress calculation, continue-learning target selection, and optional sequential lesson locking. The implementation keeps Learning ownership limited to `lesson_progress` and `course_progress`, consumes Auth identity from httpOnly-cookie sessions, consumes Course structure/content through approved Course contracts, and consumes course access through the Payment/Enrollment/Access authority. No public course browsing, enrollment creation, payment/VNPAY, quiz, final project, mentor review, certificate, report dashboard, note, bookmark, comment, or video playback tracking behavior is included.

## Technical Context

**Language/Version**: NodeJS with JavaScript ESM for backend; React JSX with Create React App for frontend.

**Primary Dependencies**: Express-style REST API, Prisma, MySQL, Zod, cookie-based Auth middleware, approved response/error helpers, Course module contracts for active course structure and lesson content, Enrollment/Access contract `canAccessCourse(userId, courseId)`, React, Bootstrap, `react-scripts`, and a frontend API client using credentialed requests.

**Storage**: MySQL via Prisma. Learning-owned tables are `lesson_progress` and `course_progress`. Auth/User, Course, Payment, Enrollment, Quiz, Final Project, Mentor, Admin, and Reports tables remain owned by their respective modules.

**Testing**: Backend uses `node:test`, `assert`, and `supertest` for service/unit and endpoint integration tests. Frontend uses `node:test` for API client/source-rule tests where needed. No Jest, Vitest, Cypress, Vite, Next.js, TypeScript, or CommonJS conversion is planned.

**Target Platform**: Local development with backend and CRA frontend using checked-in env contracts; production-compatible cookie/CORS behavior remains controlled by Auth and platform configuration.

**Project Type**: Full-stack web application plus REST API.

**Performance Goals**: Enrolled learners can open a course learning view and resume from the continue-learning target in under 2 user actions. Course progress calculations stay bounded to the current learner-course and avoid full-table scans. Learning view queries should avoid N+1 behavior for normal course structures.

**Constraints**: JWT stays only in httpOnly cookies; backend reads authenticated identity from trusted session middleware; frontend uses credentialed requests and never sends Bearer tokens or browser-stored JWT; Learning never accepts frontend-supplied `userId`, `role`, `paymentStatus`, `enrollmentStatus`, or `courseAccess`; Learning does not read payment status directly; services do not import Prisma; repositories own database access; important inputs are validated with Zod; errors use `{ success, message, code, details }` or approved equivalent without raw infrastructure details; locked or unauthorized lessons never return protected content.

**Scale/Scope**: Learning Flow MVP only. Six user stories, four primary backend behaviors, two Learning-owned progress entities, one course access integration, one course structure/content integration, and optional frontend learning API/client support. Quiz, final project, certificates, reports, video playback tracking, notes, bookmarks, and comments are deferred.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The checked-in `.specify/memory/constitution.md` may contain placeholder or encoded principle text, so concrete project gates from `AGENTS.md`, `PROJECT_AGENTS.md`, `DATABASE.md`, `share_context.md`, and the generated spec are applied:

- **Stack gate**: PASS. Plan keeps NodeJS JavaScript ESM, Express-style REST, React JSX, Bootstrap, CRA, MySQL, Prisma, JWT httpOnly Cookie, Zod, npm, and the approved test setup.
- **Layering gate**: PASS. Routes/controllers delegate to services; services delegate to repositories and approved module contracts; only repositories import Prisma.
- **Backend authority gate**: PASS. Backend remains authoritative for identity, course access, lesson unlock, progress ownership, and progress state.
- **Module ownership gate**: PASS. Learning owns only learner progress. Auth/User, Course, Payment/Enrollment/Access, Quiz, Final Project, Mentor, Admin, and Reports remain outside Learning ownership.
- **Payment/access safety gate**: PASS. Learning consumes `canAccessCourse(userId, courseId)` or equivalent access authority and never reads payment status or grants access from `PENDING` payment.
- **Secret and data safety gate**: PASS. Plan uses only env variable names and contracts. No real `.env` values, JWTs, cookies, payment internals, raw persistence errors, password data, or another learner's progress are exposed.
- **Validation/error gate**: PASS. Important body/query/params are validated with Zod and errors use the project response shape without raw stack traces or raw Prisma/SQL errors.
- **Frontend gate**: PASS. Frontend calls go through `frontend/src/api`, use `REACT_APP_API_BASE_URL`, send cookies with credentials, and do not decide real authorization or progress ownership.
- **Scope gate**: PASS. No auth onboarding, payment, enrollment creation, course CRUD/content management, quiz, final project, mentor review, certificate, report, note, bookmark, comment, realtime sync, or video playback-duration behavior is included.

## Project Structure

### Documentation (this feature)

```text
.sdd/specs/feat-learning-flow/
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
|   |   |-- learning.routes.js
|   |   `-- progress.routes.js
|   |-- controllers/
|   |   |-- learning.controller.js
|   |   `-- progress.controller.js
|   |-- middlewares/
|   |   |-- auth.middleware.js          # consumed, owned by Auth
|   |   `-- validation.middleware.js
|   |-- repositories/
|   |   |-- learning.repository.js      # Learning-owned progress persistence
|   |   `-- progress.repository.js
|   |-- services/
|   |   |-- learning.service.js
|   |   |-- progress.service.js
|   |   |-- courseAccess.service.js     # adapter around Enrollment/Access contract
|   |   `-- courseContent.service.js    # adapter around Course contract if needed
|   |-- validators/
|   |   |-- learning.validator.js
|   |   `-- progress.validator.js
|   `-- utils/
|       `-- response.util.js
`-- tests/
    |-- learning/
    |-- fixtures/
    `-- helpers/

frontend/
|-- src/
|   |-- api/
|   |   `-- learningApi.js
|   |-- pages/
|   |   `-- learner/
|   |       |-- LearningCoursePage.jsx
|   |       `-- LessonPage.jsx
|   |-- components/
|   |   `-- learning/
|   |-- hooks/
|   |   `-- useLearningCourse.js
|   `-- routes/
`-- tests/
    `-- learning/
```

**Structure Decision**: Use the required OCP two-application structure. Backend route/controller/service/repository layers enforce access, sequential locking, and progress ownership. Frontend learning code is limited to API calls and learner UX; it never becomes the authority for access, lock, user id, payment/enrollment state, or progress ownership.

## Phase 0: Research

Planning decisions resolve the current Learning Flow open questions as follows:

- **Sequential policy source**
  - Decision: Use a course-level sequential learning policy supplied by the Course module or an approved Course contract.
  - Rationale: The spec describes sequential locking as optional for a course, and Course owns course configuration.
  - Alternatives considered: section-level or lesson dependency graph. These are more flexible but out of scope for the MVP.

- **Lesson content source**
  - Decision: Learning service consumes approved Course contracts/adapters for lesson metadata/content and does not claim Course ownership.
  - Rationale: Course module owns lessons and content; Learning decides only whether the current learner may receive protected content.
  - Alternatives considered: direct cross-module repository reads. Rejected because it violates module ownership.

- **`IN_PROGRESS` behavior**
  - Decision: A lesson may become `IN_PROGRESS` when the learner successfully opens the lesson or submits an explicit progress update, but only after backend access and lock checks pass.
  - Rationale: This supports continue-learning without needing playback tracking.
  - Alternatives considered: only explicit progress events. Rejected because opening a lesson is a meaningful learning activity for resume behavior.

- **Completion reversibility**
  - Decision: Lesson `COMPLETED` is not downgraded by normal learner actions in the MVP.
  - Rationale: This keeps idempotency and course completion stable. Reopen/retry policies can be specified later.
  - Alternatives considered: allow learner reset to `IN_PROGRESS` or `NOT_STARTED`. Rejected because it complicates reports and completion semantics.

- **Course structure changes after progress**
  - Decision: Course progress is calculated from the current active required lesson structure, while historical lesson progress remains stored.
  - Rationale: Learners should not be blocked by inactive/deleted lessons, and progress must reflect the current learning surface.
  - Alternatives considered: freeze progress at enrollment time. Rejected because course structure snapshotting is not in the current data model.

- **Locked lesson metadata**
  - Decision: Locked lesson metadata may include safe navigation fields such as lesson id, title, order, section id, state, estimated duration, and preview/public flags if provided by Course; it must not include protected content or protected video URL.
  - Rationale: Frontend needs enough data to show course structure without content leakage.
  - Alternatives considered: hide locked lessons entirely. Rejected because learners need course navigation context.

- **Learning dashboard scope**
  - Decision: MVP focuses on one course learning view by `courseId`; a broader "all enrolled courses" dashboard belongs to My Courses/Enrollment UX unless a later spec expands Learning.
  - Rationale: The revised spec centers on opening an enrolled course and keeping Learning ownership narrow.
  - Alternatives considered: implement all enrolled course listing in Learning. Rejected because Enrollment/My Courses owns that broader list.

## Phase 1: Design And Contracts

Design artifacts expected from this plan:

- `data-model.md`: Define `LessonProgress`, `CourseProgress`, computed `LessonState`, `CourseLearningView`, and `ContinueLearningTarget`, including state transitions and uniqueness rules.
- `contracts/learning-api.openapi.yaml`: Document protected learning course view, protected lesson read, lesson progress update, and course progress read contracts if API documentation is generated for this feature.
- `quickstart.md`: Document local verification steps for authenticated learner access, unauthorized access rejection, progress update, sequential locking, and continue-learning behavior.

### Backend Design

- `learning.routes.js` and `progress.routes.js` attach auth middleware, validation middleware, and thin controllers.
- `learning.controller.js` returns course learning view and lesson content responses by delegating to `learning.service.js`.
- `progress.controller.js` handles lesson progress updates and course progress reads by delegating to `progress.service.js`.
- `learning.service.js` orchestrates Auth identity, Course structure/content, Enrollment/Access, lesson state calculation, sequential lock checks, and safe response shaping.
- `progress.service.js` owns progress state transitions, idempotent completion behavior, course progress synchronization, and continue-learning target support.
- `learning.repository.js` and `progress.repository.js` own Prisma access for `lesson_progress` and `course_progress` only.
- Course and Enrollment/Access data must be reached through approved services/contracts/adapters, not direct repository imports from another module.

### Frontend Design

- `learningApi.js` centralizes Learning API calls and always sends credentials.
- Learner pages/components render backend-provided lesson states, progress, and continue-learning target as UX only.
- Frontend route guards can improve navigation but cannot grant real access, unlock lessons, or update another learner's progress.
- Frontend source-rule tests should verify no Bearer auth, no browser JWT storage, and credentialed API calls for Learning requests if frontend scope is implemented.

### Data Design

- `lesson_progress` uses one row per `user_id + lesson_id`, with status values compatible with `not_started`, `in_progress`, and `completed` semantics.
- `course_progress` uses one row per `user_id + course_id`, with completed count, total required active lesson count, progress percent, status, last lesson, and completion timestamp.
- Repeated completion updates are idempotent.
- Completed lesson status is stable in MVP and not downgraded by normal learner requests.
- Inactive/deleted lessons are ignored for new progress denominator and sequential previous/next calculations, while historical progress remains.

## Post-Design Constitution Check

- **Stack gate**: PASS after design. Planned source files stay within NodeJS ESM, Express-style REST, CRA React JSX, Prisma, MySQL, npm, and approved tests.
- **Layering gate**: PASS after design. Controllers are thin, services contain Learning rules, repositories own Learning persistence, and cross-module data goes through contracts/adapters.
- **Backend authority gate**: PASS after design. Lesson content access, lock checks, and progress ownership are enforced server-side.
- **Module ownership gate**: PASS after design. Learning owns progress only and consumes Auth, Course, and Enrollment/Access contracts.
- **Frontend gate**: PASS after design. Frontend remains UX only and sends credentialed requests through `frontend/src/api`.
- **Scope gate**: PASS after design. Deferred quiz, final project, certificate, report, notes, comments, bookmarks, and video tracking remain outside this plan.

## Complexity Tracking

No constitution or project-rule violations require justification.
