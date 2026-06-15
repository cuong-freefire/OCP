# Feature Specification: feat-project-submission

**Feature Branch**: `feat-project-submission`

**Created**: 2026-06-12

**Status**: Draft

**Input**: Final Project Submission feature for OCP learners — submit repository URLs, track submission history with attempt versioning, deadline checking, status lifecycle (PENDING → GRADED/REJECTED), and resubmission support.

## User Scenarios & Testing

### User Story 1 - Learner Submits Final Project (Priority: P1)

A signed-in learner with course access can submit their final project by providing a repository URL and an optional demo URL. The system validates URLs, trims whitespace, checks against deadline, and creates a submission record with PENDING status.

**Why this priority**: Final project submission is the core assessment checkpoint for course completion. Without it, mentors cannot evaluate learner work.

**Independent Test**: Register as a learner with active enrollment, fill in repositoryUrl and demoUrl, submit, and confirm the submission is created with PENDING status.

**Acceptance Scenarios**:

1. **Given** a signed-in learner with active course access, **When** they submit a valid `repositoryUrl` and `demoUrl`, **Then** the system creates a submission with status `PENDING`, links it to the learner, course, and final project, and returns the submission record.
2. **Given** a learner submits with an empty `repositoryUrl`, **When** validation runs, **Then** the system rejects with "Repository URL is required."
3. **Given** a learner submits with an invalid URL format (not starting with `http://` or `https://`), **When** validation runs, **Then** the system rejects with a URL format error.
4. **Given** a learner submits after the project `endDate`, **When** the submission is created, **Then** the system marks it with `SUBMITTED_LATE` flag while still creating the record.
5. **Given** a learner submits a project, **When** the form data is processed, **Then** whitespace at the beginning and end of URLs is automatically trimmed.

---

### User Story 2 - Learner Views Submission Status Dashboard (Priority: P1)

A learner can view their submission history, current attempt status, and all past submissions in chronological order.

**Why this priority**: Learners need visibility into their submission status and history to track progress and know when mentor feedback is available.

**Independent Test**: Submit a project, navigate to the submission dashboard, and verify the current attempt is displayed with correct status.

**Acceptance Scenarios**:

1. **Given** a learner has submitted a project, **When** they view their submission dashboard, **Then** the current (latest) attempt is shown with status, timestamps, and links.
2. **Given** a learner has multiple submission attempts, **When** they view the dashboard, **Then** all past attempts are listed chronologically with `Archived` status, and the latest is marked as current.
3. **Given** a learner has no submissions, **When** they view the dashboard, **Then** the system shows an empty state with a prompt to submit.

---

### User Story 3 - Learner Resubmits After Rejection (Priority: P2)

A learner whose project was marked `REJECTED` can resubmit. Each resubmission creates a new attempt record, preserving history. The latest attempt is marked as current.

**Why this priority**: Learners must be able to improve and resubmit rejected work without losing previous submission history.

**Independent Test**: Submit a project, have a mentor reject it, resubmit with new URLs, and verify a new attempt is created with PENDING status while the old one is Archived.

**Acceptance Scenarios**:

1. **Given** a learner has a `REJECTED` submission, **When** they submit a new project, **Then** a new `PENDING` attempt is created and the previous attempt is set to `Archived`.
2. **Given** a learner has a `PENDING` submission, **When** they attempt to submit again, **Then** the system rejects the duplicate submission until the current one is processed by a mentor.
3. **Given** a learner has a `GRADED` submission, **When** they attempt to submit again, **Then** the system rejects because the project is already graded.

---

### User Story 4 - Confirmation Dialog Prevents Accidental Submission (Priority: P3)

Before submitting, learners see a confirmation modal summarizing their input and warning that they cannot edit until mentor feedback is received.

**Why this priority**: Prevents accidental submissions when the project is not ready, reducing frustration and mentor workload.

**Independent Test**: Click Submit, verify the modal appears with the correct warning, confirm, and verify the submission is created.

**Acceptance Scenarios**:

1. **Given** a learner has filled the submission form, **When** they click Submit, **Then** a confirmation modal appears with the submitted URLs and a warning text.
2. **Given** the confirmation modal is displayed, **When** the learner clicks "Cancel", **Then** the modal closes and no submission is created.
3. **Given** the confirmation modal is displayed, **When** the learner clicks "Confirm Submit", **Then** the submission is created and the modal closes.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST require a valid backend-authenticated learner session for project submission and history access.
- **FR-002**: The system MUST validate `repositoryUrl` as a required non-empty URL starting with `http://` or `https://`.
- **FR-003**: The system MUST validate `demoUrl` as an optional URL starting with `http://` or `https://`.
- **FR-004**: The system MUST trim whitespace from both ends of submitted URLs.
- **FR-005**: The system MUST link each submission to `userId`, `courseId`, and `finalProjectId`.
- **FR-006**: New submissions MUST have status `PENDING`.
- **FR-007**: If the submission time exceeds the final project's `endDate`, the system MUST set `submittedLate` flag to `true`.
- **FR-008**: Each resubmission MUST create a new record (attempt) and set the previous active attempt to `Archived`.
- **FR-009**: Learners with `PENDING` or `GRADED` current submissions MUST NOT be allowed to submit again until the current one is `REJECTED`.
- **FR-010**: The learner dashboard MUST show the current attempt and a chronological history of all past attempts.
- **FR-011**: Status colors: `PENDING` = yellow, `GRADED` = green, `REJECTED` = red, `SUBMITTED_LATE` flag = red tint.
- **FR-012**: A confirmation modal MUST appear before final submission, showing the entered URLs and a warning about inability to edit until mentor feedback.
- **FR-013**: Error responses MUST follow `{ success, message, code, details }` format.
- **FR-014**: All UI text for this feature MUST be in English.
- **FR-015**: Backend MUST require the `LEARNER` role for submission endpoints.

### Configuration And Environment Contract

Backend variables: standard `PORT`, `API_PREFIX`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `AUTH_SECRET`, `COOKIE_ACCESS_NAME`, `COOKIE_REFRESH_NAME`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`

Frontend variables: standard `PORT`, `REACT_APP_API_BASE_URL`

### Key Entities

- **FinalProject**: A project assignment for a course with `title`, `description`, `startDate`, `endDate`, and `status`.
- **ProjectSubmission**: A learner's project attempt linked to `userId`, `courseId`, and `finalProjectId`. Contains `repositoryUrl`, `demoUrl`, `status` (PENDING/GRADED/REJECTED/ARCHIVED), `submittedLate` flag, `attemptNumber`, `isCurrent` flag, and timestamps.

### Out Of Scope

- Mentor review/grading UI (separate feat-mentor-review spec)
- Final project CRUD for mentors (separate spec)
- Certificate generation
- Automated project testing or CI integration

## Success Criteria

- **SC-001**: 100% of valid submissions create a PENDING record with proper relationships.
- **SC-002**: 100% of invalid URL submissions are rejected.
- **SC-003**: 100% of whitespace-trimmed URLs are stored correctly.
- **SC-004**: 100% of late submissions have `submittedLate=true`.
- **SC-005**: 100% of resubmissions create a new attempt and archive the previous one.
- **SC-006**: Learners with PENDING/GRADED submissions cannot submit again.
- **SC-007**: The submission confirmation modal appears on every submit attempt.