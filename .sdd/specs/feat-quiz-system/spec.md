# Feature Specification: feat-quiz-system

**Feature Branch**: `feat-quiz-system`

**Created**: 2026-06-07

**Status**: Draft - revised with Admin Quiz CRUD management, bulk question import, pagination/search/filter, draft/publish workflow, and English UI

**Input**: User description: "Create the OCP Quiz System feature specification covering learner access to active quizzes in accessible courses or lessons, backend-controlled quiz eligibility, secure question delivery, answer submission, automatic scoring for supported question types, result display, quiz submission history, admin quiz CRUD management with bulk operations, question import, pagination/search/filter, draft/publish workflow, and explicit out-of-scope boundaries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Available Quiz In An Accessible Course (Priority: P1)

A signed-in learner can see active quizzes attached to a course or lesson only when backend rules confirm the learner has active access to that course.

**Why this priority**: Quizzes are a protected learning resource tied to course content. Making quiz visibility depend on backend-confirmed course access prevents unauthorized discovery of paid or locked assessment material.

**Independent Test**: Can be fully tested by signing in as a learner with active enrollment, viewing active quizzes for an accessible course or lesson, then confirming that a learner without access, with `PENDING` payment, or without enrollment cannot see quiz details.

**Acceptance Scenarios**:

1. **Given** a signed-in learner with active course access, **When** they request quiz information for that course or an accessible lesson, **Then** the system returns active quiz metadata including quiz title, description, question count, optional time limit, passing score threshold, and the learner's own attempt summary.
2. **Given** a signed-in learner without active course access, **When** they request quiz information for a paid course, **Then** the backend rejects access and does not return quiz questions, quiz metadata, or protected course context.
3. **Given** a quiz is in draft status, **When** a learner requests available quizzes for a course they can access, **Then** the quiz is not shown as available to take.
4. **Given** a quiz belongs to an inactive, deleted, or unavailable course or lesson, **When** a learner requests it, **Then** the system returns a safe unavailable result without exposing quiz content.

---

### User Story 2 - Start Quiz With Secure Question Delivery (Priority: P1)

A learner with active access can start an active quiz and receive questions with answer options. Correct answers and scoring internals remain hidden until after submission to preserve assessment integrity.

**Why this priority**: Secure quiz delivery is the foundation of trusted assessment. Leaking `correct_answer` or scoring rules before submission would invalidate the entire quiz system.

**Independent Test**: Can be tested by starting an active quiz as an eligible learner and verifying that returned questions include only safe fields such as question text, option labels, and type metadata, while `correct_answer`, explanation, and point values that reveal scoring are never included.

**Acceptance Scenarios**:

1. **Given** an eligible learner and an active quiz with questions, **When** the learner starts the quiz, **Then** the system returns the quiz title, description, time limit, question list with text and options only, points metadata when safe, and a quiz attempt start time.
2. **Given** a quiz question has a stored correct answer and explanation, **When** the question is returned before submission, **Then** the correct answer, explanation, and any field that reveals the correct option are not included in the payload.
3. **Given** a quiz has no active questions, **When** a learner attempts to start it, **Then** the system treats the quiz as unavailable for taking and does not create a usable submission.
4. **Given** a learner starts the same active quiz more than once without submitting, **When** the system records start information, **Then** it does not create duplicate completed submissions and keeps the learner experience consistent.

---

### User Story 3 - Submit Answers And Receive Automatic Score (Priority: P1)

A learner can submit answers for supported question types. The backend validates the answers, applies the correct scoring rule for each type, determines pass/fail, and stores the authoritative result.

**Why this priority**: Automatic backend scoring is the core value of the Quiz System and the source of truth for assessment results. The frontend must never determine score, pass status, or correctness because that would allow tampering with assessment outcomes.

**Independent Test**: Can be tested by submitting answers for single-choice, multiple-choice, and true/false questions, verifying the backend calculates score and max score correctly, determines passed status from the stored passing threshold, persists the submission, and returns the result without trusting any frontend-provided scoring value.

**Acceptance Scenarios**:

1. **Given** an eligible learner has started an active quiz, **When** they submit valid answers before the time limit expires, **Then** the backend calculates score and max score from stored correct answers and question points, determines passed status from the quiz `passing_score` threshold, stores the submission, and returns the result.
2. **Given** a learner submits answers with unsupported question ids, duplicate question ids, malformed option values, or a question type that does not match the stored question type, **When** the submission is processed, **Then** the backend rejects the request without creating an invalid successful submission.
3. **Given** a quiz contains `single_choice`, `multiple_choice`, and `true_false` questions, **When** answers are scored, **Then** the backend applies the correct scoring rule for each supported type and never trusts a frontend-provided score, max score, pass status, or correct answer.
4. **Given** a quiz has a configured time limit, **When** the learner submits after the allowed time window, **Then** the system rejects the late submission or records it as failed according to the approved quiz policy without exposing correct answers prematurely.

---

### User Story 4 - Review Quiz Result Safely (Priority: P2)

After submitting, a learner can review their own quiz result. The system shows score, passed status, and post-submission review data that is safe to reveal only to the submitting learner.

**Why this priority**: Learners need immediate feedback on assessment performance. However, result visibility must be strictly scoped to the authenticated learner and to post-submission state only, preventing unauthorized access to another learner's results or pre-submission answer leaks.

**Independent Test**: Can be tested by submitting a quiz, reading the result as the same learner, attempting to read it as a different learner, and confirming that only the owning learner receives their score and post-submission review data.

**Acceptance Scenarios**:

1. **Given** a learner has submitted a quiz, **When** they view the result, **Then** the system shows score, max score, passed status, submitted time, and safe per-question review data such as which questions were answered correctly or incorrectly.
2. **Given** a learner has not submitted a quiz, **When** they request result details, **Then** the system does not reveal correct answers, explanations, or any scoring data as result information.
3. **Given** another learner attempts to view someone else's submission, **When** the result is requested, **Then** the backend rejects access and does not reveal the submission data.
4. **Given** a quiz question has a stored explanation, **When** the owning learner views a completed submission, **Then** the explanation may be shown only after submission and only for that learner's own result.

---

### User Story 5 - View Personal Quiz Submission History (Priority: P2)

A learner can view their own past quiz attempts for a course or specific quiz so they can track performance over time.

**Why this priority**: Submission history helps learners monitor their own progress and provides reliable data for future reporting, course completion rules, and learning analytics.

**Independent Test**: Can be tested by creating multiple submissions for the same learner and quiz, then confirming that only that learner's sanitized attempt history is returned in chronological order, and that another learner's submissions are never included.

**Acceptance Scenarios**:

1. **Given** a learner has multiple quiz submissions, **When** they request their quiz history, **Then** the system returns only that learner's submissions with quiz title, score, max score, passed status, and submitted time in chronological order.
2. **Given** a learner has no submissions for a quiz, **When** they request history, **Then** the system returns an empty history without error.
3. **Given** a learner requests history for a course they cannot access, **When** the request is processed, **Then** the backend rejects access and does not reveal quiz metadata or submission data.
4. **Given** another learner has submissions for the same quiz, **When** the current learner views history, **Then** the other learner's submissions are never included.

---

### User Story 6 - Admin Manages Quiz Catalog With Pagination, Search, And Filter (Priority: P1)

An authenticated admin user can view a paginated list of all quizzes, search by title, filter by status or course, and navigate large datasets efficiently.

**Why this priority**: Admin needs a scalable data grid for managing potentially thousands of quizzes. Without pagination, search, and filtering, the management interface becomes unusable as the platform grows.

**Independent Test**: Can be tested by creating 25+ quizzes, verifying the list shows the first page of 20 results, searching by a keyword returns filtered results, and filtering by `draft` status shows only drafts.

**Acceptance Scenarios**:

1. **Given** an authenticated admin user, **When** they request the quiz list, **Then** the system returns a paginated response with page number, page size, total count, and total pages.
2. **Given** an admin provides a search query, **When** they request the quiz list, **Then** only quizzes whose title partially matches the query are returned.
3. **Given** an admin provides a status filter, **When** they request the quiz list, **Then** only quizzes matching that status are returned.
4. **Given** an admin provides a `courseId` filter, **When** they request the quiz list, **Then** only quizzes belonging to that course are returned.
5. **Given** an admin provides a `page` and `pageSize` parameter, **When** they request the quiz list, **Then** the corresponding slice of results is returned with the correct pagination metadata.

---

### User Story 7 - Admin Creates And Edits Quizzes With Draft/Published Workflow (Priority: P1)

An admin can create new quizzes and edit existing ones. Quizzes have a `draft` or `published` status. Only published quizzes are visible to learners.

**Why this priority**: Content managers must prepare quizzes before releasing them to learners. The draft/publish workflow allows preparation without exposing incomplete assessments.

**Independent Test**: Can be tested by creating a draft quiz, verifying it is not visible to learners, publishing it, and verifying learners can see it.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they create a new quiz with required fields (title, course, passing score), **Then** the quiz is saved with `draft` status and a valid ID.
2. **Given** an admin creates a quiz with optional fields (description, time limit, lesson), **When** the quiz is saved, **Then** those optional fields are persisted.
3. **Given** an existing quiz, **When** an admin updates its fields, **Then** the changes are persisted and the quiz version is updated.
4. **Given** a draft quiz, **When** an admin changes its status to `published`, **Then** the quiz becomes available to eligible learners.
5. **Given** a published quiz, **When** an admin changes its status back to `draft`, **Then** the quiz becomes hidden from learners.
6. **Given** a quiz with existing submissions, **When** an admin edits non-scoring fields (title, description), **Then** existing submissions remain unaffected.

---

### User Story 8 - Admin Manages Questions Within Quiz With Bulk Operations (Priority: P1)

An admin can create, read, update, delete, and reorder questions within a quiz. The interface supports bulk creation with "Save and create new" flow and direct correct-answer selection next to option inputs.

**Why this priority**: Question management is the most frequent admin task. Efficient UX with inline correct-answer selection, save-and-continue flow, and support for all three question types reduces admin effort dramatically.

**Independent Test**: Can be tested by creating questions of all three types, confirming correct answer selection is intuitive, using "Save and create new" to rapidly add questions, editing a question, and deleting a question.

**Acceptance Scenarios**:

1. **Given** an admin creating a question, **When** they select `single_choice` type, **Then** the UI shows radio buttons next to each option for selecting the correct answer.
2. **Given** an admin creating a question, **When** they select `multiple_choice` type, **Then** the UI shows checkboxes next to each option for selecting correct answers.
3. **Given** an admin creating a question, **When** they select `true_false` type, **Then** the UI shows two fixed options (True/False) with a radio selector.
4. **Given** an admin fills in question details, **When** they click "Save and create new", **Then** the current question is saved and a fresh empty form is presented.
5. **Given** an admin wants to delete a question, **When** they click the delete button, **Then** a red confirmation dialog appears warning about the irreversible action.
6. **Given** an admin edits a question, **When** they change fields and save, **Then** the changes are persisted.

---

### User Story 9 - Admin Can Bulk Import Questions From JSON (Priority: P2)

An admin can import multiple questions at once by uploading a JSON file or pasting structured content, reducing repetitive data entry.

**Why this priority**: Creating many questions individually is time-consuming. Bulk import allows admins to prepare question banks offline and upload them efficiently.

**Independent Test**: Can be tested by uploading a JSON file with 10 valid questions and verifying all are created with correct fields.

**Acceptance Scenarios**:

1. **Given** an admin with a JSON file of questions, **When** they upload it for a specific quiz, **Then** all valid questions are created and assigned to that quiz.
2. **Given** a JSON import contains malformed question entries, **When** the import is processed, **Then** the system reports which entries failed validation and does not create partial data.
3. **Given** a JSON import contains entries with unsupported question types, **When** processed, **Then** those entries are rejected with clear error messages.
4. **Given** an admin pastes a JSON string instead of uploading a file, **When** submitted, **Then** the same import logic applies.

---

### User Story 10 - Admin Deletes Quiz With Safety Confirmation (Priority: P2)

An admin can delete a quiz, which removes the quiz and all associated questions and submissions. The action requires a destructive confirmation dialog.

**Why this priority**: Deleting a quiz is irreversible and affects learner submission history. A clear warning prevents accidental data loss.

**Independent Test**: Can be tested by deleting a quiz and verifying all its questions and submissions are removed, and the confirmation dialog shows appropriate warnings.

**Acceptance Scenarios**:

1. **Given** an admin attempts to delete a quiz, **When** they click delete, **Then** a red confirmation dialog appears with a warning that all questions and submission history will be permanently removed.
2. **Given** an admin confirms deletion, **When** the delete request is processed, **Then** the quiz and all associated questions and submissions are hard-deleted.
3. **Given** an admin cancels the deletion dialog, **When** they click cancel, **Then** the quiz and all data remain unchanged.

---

### User Story 11 - Preserve Quiz Module Boundaries And Assessment Integrity (Priority: P3)

Quiz System uses trusted Auth identity, Course structure, and Enrollment/Access decisions while owning only quiz, question, and submission behavior in its approved scope.

**Why this priority**: Quiz touches protected course access and sensitive assessment data. Strong module boundaries prevent frontend scoring, access bypass, and direct payment or enrollment coupling. The backend must remain the sole authority for quiz eligibility, timing, scoring, and result ownership.

**Independent Test**: Can be tested by reviewing behavior and contracts: Quiz decisions use authenticated backend user identity, Course-owned course and lesson context, and Enrollment/Access authority for course access. No module boundary violation should occur.

**Acceptance Scenarios**:

1. **Given** Quiz System needs learner identity, **When** quiz behavior runs, **Then** it uses backend-authenticated session identity and never trusts frontend-supplied user id or role.
2. **Given** Quiz System needs to know whether a learner can access a course, **When** quiz eligibility is checked, **Then** it uses the Enrollment/Access authority and does not read or decide payment status directly.
3. **Given** Quiz System needs course or lesson context, **When** quiz availability is resolved, **Then** it uses approved Course contracts and does not redefine course content ownership.
4. **Given** the frontend submits answers, **When** scoring occurs, **Then** the backend ignores any frontend-provided score, pass status, max score, correct answer, or trusted timing value.
5. **Given** an admin manages quiz content, **When** CRUD operations run, **Then** only users with the `ADMIN` role can create, update, or delete quizzes and questions.

### Edge Cases

- Missing, expired, revoked, or invalid session cookies must prevent protected quiz listing, starting, submission, result review, and history behavior.
- Pending, blocked, or soft-deleted users must not take or review quizzes through stale frontend state.
- Paid course quizzes must remain hidden unless active course access is confirmed by the Enrollment/Access authority.
- Payment `PENDING`, failed payment, cancelled enrollment, refunded enrollment, or inactive enrollment must never unlock quiz access.
- Draft quizzes must not be available to learners regardless of course access.
- Questions must not expose `correct_answer`, explanation, or point values that reveal scoring before the learner submits.
- A quiz with no active questions must not produce a successful scored submission.
- Submissions must belong only to the authenticated learner; one learner cannot view, modify, or delete another learner's submission.
- Frontend-provided `userId`, `score`, `maxScore`, `passed`, `correctAnswer`, `courseAccess`, or `paymentStatus` must be ignored or rejected.
- Multiple-choice answer comparison must be order-insensitive and must not grant credit for partial or extra selections unless a later spec explicitly defines partial scoring.
- Unsupported question types must not be silently scored as correct.
- Late submissions for timed quizzes must not receive normal successful scoring without an approved late-submission policy.
- Quiz result review may show explanations only after submission and only to the learner who owns the submission.
- Attempting to submit answers for a quiz that has not been started must not create a valid submission.
- If the quiz `passing_score` is zero or unset, the backend must still compute a score and pass status consistently.
- Admin quiz CRUD operations must require the `ADMIN` role and reject non-admin users.
- Deleting a quiz must cascade to all associated questions and submissions.
- Admin import of questions must validate each question independently and report per-item errors.
- Pagination must return safe defaults when page or pageSize parameters are missing or invalid.
- Search queries must be sanitized to prevent injection attacks and must support partial matching.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require a valid backend-authenticated learner session for protected quiz listing, quiz start, answer submission, result review, and history behavior.
- **FR-002**: The system MUST use backend-authenticated identity as the only source for learner user id and MUST NOT accept frontend-supplied user id, role, enrollment state, payment state, access state, score, max score, or passed state for quiz decisions.
- **FR-003**: The system MUST verify course access through the Enrollment/Access authority before returning active quiz details, quiz questions, accepting submissions, or returning quiz history for a protected course.
- **FR-004**: The system MUST NOT read or decide payment status directly in Quiz System; paid-course quiz unlock decisions belong to the Payment/Enrollment/Access module.
- **FR-005**: The system MUST return only active (published) quizzes as available for learner-facing quiz listing and MUST exclude draft quizzes.
- **FR-006**: The system MUST support quizzes associated with a course and MAY support quizzes associated with a specific lesson when `lesson_id` is present.
- **FR-007**: The system MUST validate that a quiz belongs to an active accessible course and, when lesson-bound, an available active lesson before allowing a learner to start or submit answers.
- **FR-008**: The system MUST provide safe quiz metadata including title, description, question count, optional time limit, passing score threshold, and the learner's own attempt summary without revealing correct answers.
- **FR-009**: The system MUST return quiz questions before submission without `correct_answer`, explanation, raw scoring internals, or any field that reveals the correct answer.
- **FR-010**: The system MUST support `single_choice`, `multiple_choice`, and `true_false` question types for automatic scoring.
- **FR-011**: The system MUST validate submitted answers against the active questions for the quiz, expected question type, and available options before scoring.
- **FR-012**: The system MUST reject answer submissions that contain unknown question ids, duplicate question ids, malformed answer values, unsupported question types, or answers for questions outside the quiz.
- **FR-013**: The system MUST calculate score and max score on the backend from stored question points and stored correct answers.
- **FR-014**: The system MUST determine passed status on the backend using quiz `passing_score` and the calculated score percentage.
- **FR-015**: The system MUST NOT trust frontend-provided score, max score, passed status, correct answer, explanation, started time, submitted time, or elapsed time as authority for any assessment decision.
- **FR-016**: The system MUST store each valid quiz submission with learner identity, quiz identity, submitted answers, backend-calculated score, max score, passed status, started time when available, submitted time, and creation time.
- **FR-017**: The system MUST enforce timed quiz rules when `time_limit_minutes` is configured and MUST prevent normal successful scoring for late submissions unless a later approved policy defines otherwise.
- **FR-018**: A quiz with no active questions MUST be unavailable for successful learner submission.
- **FR-019**: The system MUST allow a learner to view their own submitted quiz result with score, max score, passed status, submitted time, and safe per-question review data.
- **FR-020**: The system MAY reveal correct answer and explanation after submission, but only to the learner who owns the submission.
- **FR-021**: The system MUST prevent a learner from viewing, modifying, or deleting another learner's quiz submission.
- **FR-022**: The system MUST allow a learner to view their own quiz submission history for an accessible course or quiz.
- **FR-023**: Submission history MUST return sanitized attempt data and MUST NOT include raw correct answer data unless it is part of an allowed post-submission result view for the current learner.
- **FR-024**: Multiple-choice scoring MUST compare selected options without depending on option order and MUST reject extra selected options as incorrect for that question.
- **FR-025**: The system MUST preserve Quiz module ownership for `quizzes`, `quiz_questions`, and `quiz_submissions`, while using approved Auth/User, Course, and Enrollment/Access contracts for external data.
- **FR-026**: Frontend route guards, visible quiz buttons, cached quiz state, or timer displays MAY improve user experience but MUST NOT be treated as real quiz eligibility, timing, scoring, or result ownership.
- **FR-027**: Important quiz request bodies and route parameters MUST be validated before business behavior runs.
- **FR-028**: Error responses MUST follow the project response shape `{ success, message, code, details }` or an approved equivalent and MUST avoid raw stack traces or raw infrastructure details.
- **FR-029**: Quiz responses MUST NOT expose password hashes, JWT values, cookie values, payment internals, raw SQL errors, raw persistence errors, secrets, or another learner's submission data.
- **FR-030**: The system MUST fail safely when required Auth, Course, or Enrollment/Access dependencies cannot confirm identity, quiz context, course structure, or access.
- **FR-031**: The system MUST require the `ADMIN` role for quiz and question CRUD operations.
- **FR-032**: The system MUST support quiz status values `draft` and `published` and MUST include only `published` quizzes in learner-facing availability.
- **FR-033**: The system MUST support paginated quiz listing with `page`, `pageSize`, `search`, `status`, and `courseId` query parameters.
- **FR-034**: Paginated quiz listing MUST return `{ quizzes: [], pagination: { page, pageSize, total, totalPages } }`.
- **FR-035**: The system MUST support bulk question import via JSON, validating each question independently and reporting per-item errors.
- **FR-036**: Deleting a quiz MUST cascade to delete all associated questions and submissions.
- **FR-037**: The system MUST support question reordering within a quiz via an `order` field.
- **FR-038**: Admin question creation MUST support a `saveAndCreateNew` flag for rapid bulk entry.
- **FR-039**: Error messages and UI text for the quiz feature MUST be in English.

### Configuration And Environment Contract

The feature depends on the following environment variable names from the checked-in example files. Specifications, plans, tests, and implementation must refer to these names only, never to real secret values.

Backend variables:

- Runtime and routing: `PORT`, `API_PREFIX`
- CORS origin: `FRONTEND_ORIGIN`
- Database connection: `DATABASE_URL`
- Auth session and cookies: `AUTH_SECRET`, `COOKIE_ACCESS_NAME`, `COOKIE_REFRESH_NAME`
- Token lifetime: `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`

Frontend variables:

- CRA development port: `PORT`
- Backend API base URL: `REACT_APP_API_BASE_URL`

### Key Entities *(include if feature involves data)*

- **Quiz**: An assessment attached to a course and optionally to a lesson. It includes title, description, optional time limit in minutes, passing score threshold, status (`draft` or `published`), and timestamps. Admin users can create, read, update, and delete quizzes.
- **Quiz Question**: A scored question belonging to a quiz. It includes question text, question type (`single_choice`, `multiple_choice`, `true_false`), answer options, correct answer for scoring, optional explanation, point value, display order, and timestamps. Correct answer and explanation are protected before submission. Admin users can create, read, update, delete, and reorder questions.
- **Quiz Submission**: A learner-owned quiz attempt. It contains learner identity, quiz identity, snapshot of submitted answers, backend-calculated score, max score, passed status, started time, submitted time, and creation time. It is the authoritative record of one assessment attempt.
- **Quiz Availability View**: The learner-facing safe representation of published quizzes available for an accessible course or lesson, including quiz metadata and the learner's own attempt summary without revealing correct answers.
- **Quiz Question Payload**: The safe pre-submission question representation that includes question text, type, options, and display order without correct answer, explanation, or point values that reveal scoring.
- **Quiz Result View**: The post-submission safe result representation for the owning learner, including score, max score, passed status, submitted time, and optional per-question review data including correct answer or explanation that is safe to reveal after submission.
- **Course Access Decision**: A trusted result from the Enrollment/Access authority indicating whether the learner can access the course that owns the quiz. It is consumed by Quiz System and is not owned by Quiz System.
- **Paginated Quiz List**: A pageable data structure containing quiz summaries and pagination metadata (page, pageSize, total, totalPages).

### Out Of Scope

- Course CRUD, lesson management, category management, or course content editing.
- Enrollment creation, free course enrollment, payment checkout, VNPAY processing, payment verification, order status updates, and payment-driven access unlock.
- Auth registration, email verification, login, logout, refresh-token rotation, password reset, Google OAuth, and profile management.
- Learning progress completion, lesson progress tracking, course progress recalculation, and continue-learning behavior outside quiz attempt history.
- Final project submission, mentor review, mentor feedback, and final project pass or fail decisions.
- Certificate generation, certificate eligibility, certificate storage, and certificate download.
- Manual grading, essay or free-text questions, partial-credit scoring, randomized question pools, anti-cheating measures, proctoring, browser lockdown, retake limits, retake cooldowns, leaderboards, and gamification features.
- Admin report dashboards and analytics snapshots beyond preserving sanitized quiz submission data for future reporting.
- Letting frontend decide user identity, course access, quiz eligibility, timer validity, score, max score, pass status, correct answer, or another learner's result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected quiz requests require backend-authenticated learner identity and reject missing or invalid sessions.
- **SC-002**: 100% of quiz availability, quiz start, submission, result, and history behavior for protected courses is denied unless the Enrollment/Access authority confirms active course access.
- **SC-003**: 100% of pre-submission question payloads omit correct answers and explanations.
- **SC-004**: 100% of submitted quiz scores, max scores, and passed statuses are calculated by the backend and not accepted from frontend input.
- **SC-005**: 100% of valid submissions for supported question types persist learner identity, quiz identity, answers, backend-calculated score, max score, passed status, and submitted time.
- **SC-006**: 100% of malformed submissions with unknown question ids, duplicate question ids, unsupported question types, or answers outside allowed options are rejected.
- **SC-007**: 100% of learner result and history reads return only the authenticated learner's own submissions.
- **SC-008**: 100% of timed quiz late submissions are prevented from receiving normal successful scoring unless a later approved policy defines otherwise.
- **SC-009**: Learners can start an available quiz and submit valid answers in one continuous flow without needing to refresh or leave the learning context.
- **SC-010**: Quiz System responses never expose JWT values, cookie values, password hashes, raw payment details, raw persistence errors, secrets, or another learner's submission data.
- **SC-011**: Quiz System remains functionally independent from payment processing, enrollment creation, course authoring, learning progress, final project, mentor review, certificate, and report workflows while preserving reliable submission data for future use.
- **SC-012**: 100% of admin quiz CRUD operations require the `ADMIN` role.
- **SC-013**: 100% of paginated quiz list requests return valid pagination metadata.
- **SC-014**: 100% of quiz import validation rejects individual malformed questions without affecting valid ones.
- **SC-015**: 100% of draft quizzes are excluded from learner-facing availability.

## Assumptions

- Learners must be signed in before using protected Quiz System behavior.
- Active course access is determined by the Payment/Enrollment/Access module, including free enrollment and paid enrollment after verified successful payment.
- Course and lesson status, structure, and availability are owned by the Course module and consumed by Quiz through approved contracts.
- Quiz `passing_score` is interpreted as a percentage threshold from 0 to 100.
- Multiple-choice questions require exact set matching for full credit. Partial-credit scoring is deferred to a later feature.
- A quiz with `time_limit_minutes = null` has no timer enforcement.
- Timed quiz windows begin when the backend records the learner's quiz start time.
- Learners may have multiple submissions unless a later spec defines retake limits, cooldowns, or best-score behavior.
- Explanations may be shown after submission only when they are safe for the learner who owns the submission.
- Frontend quiz screens may improve navigation and feedback, but all real access, timing, scoring, pass or fail, and result ownership decisions remain backend-controlled.
- Quiz System may expose stable submission data for future course progress, certificate, report, or learning analytics features, but those features define their own eligibility and business rules in separate specs.
- Admin quiz management requires the `ADMIN` role which must exist in the system.
- Admin UI text is in English; learner-facing UI text is also in English.
- Bulk question import supports JSON format; Excel/Markdown import is deferred to a later feature.