# Feature Specification: feat-learning-flow

**Feature Branch**: `feat-learning-flow`

**Created**: 2026-05-27

**Status**: Draft - revised to match current Spec Kit style and OCP domain contracts

**Input**: User description: "Revise the Learning Flow feature specification using 001-feat-auth as the example style while preserving the Learning Flow scope: enrolled learner course access, learning dashboard, lesson viewing, lesson progress, course progress, continue learning, backend-controlled access, and optional sequential lesson locking."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Enrolled Course Learning View (Priority: P1)

A signed-in learner can open an enrolled course and see the course learning structure with sections, lessons, personal progress, lesson states, and a clear continue-learning target.

**Why this priority**: This is the core learning entry point after enrollment. Without it, a learner can own or enroll in a course but cannot navigate the learning experience.

**Independent Test**: Can be fully tested by signing in as a learner with an active enrollment, opening a course learning view, and confirming that the returned structure reflects the course sections, lesson order, learner progress, and continue-learning target.

**Acceptance Scenarios**:

1. **Given** a signed-in learner with active access to a course, **When** they open that course's learning view, **Then** the system shows the course title, sections, ordered lessons, progress percentage, lesson states, and the next lesson the learner should continue.
2. **Given** a signed-in learner with no active access to a paid course, **When** they attempt to open that course's learning view, **Then** the backend rejects access and does not return paid lesson content.
3. **Given** a course with completed and unfinished lessons, **When** the learner opens the learning view, **Then** completed lessons are shown as completed and the continue-learning target is the latest unfinished lesson that is available to the learner.
4. **Given** a course has no active lessons, **When** an enrolled learner opens the learning view, **Then** the system shows zero progress and an empty lesson list without failing the user flow.

---

### User Story 2 - View Lesson Content Securely (Priority: P1)

A signed-in learner can open a lesson only when backend rules confirm the learner has course access and the lesson is available under the course learning rules.

**Why this priority**: Lesson content protection is high risk because paid content must never be exposed through frontend-only checks or direct URL access.

**Independent Test**: Can be tested by requesting the same lesson as an enrolled learner, a learner without access, and a learner attempting to skip a locked lesson, then confirming that only the authorized learner receives full lesson content.

**Acceptance Scenarios**:

1. **Given** a signed-in learner with active course access and an unlocked active lesson, **When** they open the lesson, **Then** the system returns the lesson content and safe progress state for that learner.
2. **Given** a signed-in learner without active course access, **When** they request a paid lesson, **Then** the backend rejects the request and does not return full lesson content, video URL, or protected body content.
3. **Given** a signed-in learner with course access but the requested lesson is locked by sequential learning rules, **When** they request that lesson directly, **Then** the backend rejects full content access and returns only safe locked-state information.
4. **Given** a lesson is inactive, deleted, or no longer belongs to an active course structure, **When** a learner requests that lesson, **Then** the system does not expose content and returns a clear not-found or unavailable result.

---

### User Story 3 - Mark Lesson Progress And Update Course Progress (Priority: P1)

A learner can mark their own lesson progress, and the system updates both lesson-level and course-level progress for that learner only.

**Why this priority**: Progress tracking powers learner continuity, future reporting, course completion, quiz eligibility, final project eligibility, and possible certificate workflows.

**Independent Test**: Can be tested by marking an unlocked lesson as completed, verifying the lesson progress record is updated for the current learner, and confirming course progress recalculates from completed lessons versus required active lessons.

**Acceptance Scenarios**:

1. **Given** a signed-in learner with active access to a course and an unlocked lesson, **When** they mark the lesson as completed, **Then** the system records the lesson as completed for that learner and recalculates the learner's course progress.
2. **Given** a signed-in learner marks the same lesson completed more than once, **When** the repeated update is submitted, **Then** the system updates the existing progress state without creating duplicate progress records.
3. **Given** a learner attempts to update progress for another learner, **When** the request is processed, **Then** the backend uses the authenticated learner identity and never accepts a frontend-supplied user id.
4. **Given** a learner attempts to mark a lesson from a course they cannot access, **When** the progress update is submitted, **Then** the backend rejects the update and does not create or modify progress for that lesson.

---

### User Story 4 - Continue Learning From The Right Lesson (Priority: P2)

A learner can resume a course from the most relevant unfinished lesson rather than manually searching through the course structure.

**Why this priority**: Continue learning reduces friction and makes the enrolled course dashboard useful beyond a static lesson list.

**Independent Test**: Can be tested by preparing a course with several lessons and progress states, then verifying the continue-learning target before any completion, after partial completion, and after all lessons are completed.

**Acceptance Scenarios**:

1. **Given** a learner has not completed any lesson in an accessible course, **When** the continue-learning target is requested, **Then** the target is the first available lesson in course order.
2. **Given** a learner has completed some lessons, **When** the continue-learning target is requested, **Then** the target is the first unfinished lesson that is not locked.
3. **Given** sequential learning is enabled and the next unfinished lesson is locked, **When** the continue-learning target is selected, **Then** the target remains the next lesson that is currently available under backend rules.
4. **Given** all required active lessons are completed, **When** the continue-learning target is requested, **Then** the course is treated as completed and no unfinished lesson target is required.

---

### User Story 5 - Enforce Sequential Lesson Locking When Enabled (Priority: P2)

When a course requires sequential learning, learners must complete earlier lessons before accessing later lessons. The backend enforces this rule for both lesson content and progress updates.

**Why this priority**: Some courses depend on ordered learning. The rule must be protected server-side because frontend locks can be bypassed.

**Independent Test**: Can be tested with a sequential course by attempting to open lesson two before lesson one is completed, then completing lesson one and confirming lesson two becomes available.

**Acceptance Scenarios**:

1. **Given** sequential learning is enabled for a course, **When** a learner has not completed the previous active lesson, **Then** the next lesson remains locked and full content is not returned.
2. **Given** sequential learning is enabled and the learner completes the previous active lesson, **When** they request the next lesson, **Then** the backend allows access if all other access rules are satisfied.
3. **Given** sequential learning is enabled, **When** the learner requests the first active lesson in the course, **Then** the lesson is available by default if the learner has course access.
4. **Given** sequential learning is not enabled for a course, **When** an enrolled learner opens any active lesson, **Then** the system does not apply previous-lesson completion as an additional lock.

---

### User Story 6 - Preserve Module Boundaries For Learning (Priority: P3)

Learning Flow uses trusted Auth identity, Course structure, and Enrollment/Access decisions without taking ownership of those modules' data or duplicating their business rules.

**Why this priority**: Learning touches high-risk access behavior and cross-module data. Clear boundaries prevent payment, enrollment, course, and auth logic from leaking into the Learning module.

**Independent Test**: Can be tested by reviewing behavior and contracts: Learning decisions use the authenticated backend user, course structure from the Course module, and course access from the Enrollment/Access contract.

**Acceptance Scenarios**:

1. **Given** Learning Flow needs learner identity, **When** protected learning behavior runs, **Then** it uses backend-authenticated session identity and never trusts frontend-supplied user id or role.
2. **Given** Learning Flow needs course sections and lesson ordering, **When** it builds the learning view, **Then** it uses the Course module's active course structure and does not redefine course ownership.
3. **Given** Learning Flow needs to know whether a learner can access a course, **When** access is checked, **Then** it uses the Enrollment/Access authority and does not read or decide payment status directly.
4. **Given** access, course, or auth dependencies are unavailable, **When** a learning request is processed, **Then** the system fails with a safe error and does not expose protected lesson content.

### Edge Cases

- Missing, expired, revoked, or invalid session cookies must prevent access to protected learning behavior.
- Pending, blocked, or soft-deleted users must not access protected learning behavior through stale frontend state.
- Paid course content must remain hidden unless active course access is confirmed by the Enrollment/Access authority.
- Payment `PENDING`, failed payment, cancelled enrollment, refunded enrollment, or inactive enrollment must never unlock learning content.
- Learners must not be able to create, update, or view another learner's progress.
- Repeated completion of the same lesson must be idempotent and must not create duplicate lesson progress.
- A course with no active lessons must return zero progress rather than dividing by zero or marking the course complete by accident.
- Inactive or deleted lessons must not count as required active lessons for new progress calculation, while historical progress may remain for audit and continuity.
- If lesson order changes after a learner has progress, the next learning target and progress percentage must be recalculated from the current active course structure.
- Sequential locking must ignore inactive or deleted lessons when determining previous and next active lessons.
- Locked lessons may appear as metadata for navigation, but their protected content must not be returned.
- Frontend route guards, visible buttons, hidden links, or cached browser state must never grant real learning access.
- Preview/public course browsing is handled by the Course module; this Learning Flow spec does not make protected Learning APIs public.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require a valid backend-authenticated learner session for protected learning dashboard, lesson viewing, progress update, and course progress behavior.
- **FR-002**: The system MUST use backend-authenticated identity as the only source for learner user id and MUST NOT accept frontend-supplied user id, role, enrollment state, payment state, or course access state for learning decisions.
- **FR-003**: The system MUST verify course access through the Enrollment/Access authority before returning protected course learning structure or paid lesson content.
- **FR-004**: The system MUST NOT read or decide payment status directly in Learning Flow; paid-course unlock decisions belong to the Payment/Enrollment/Access module.
- **FR-005**: The system MUST return the enrolled learner's course learning view with course summary, ordered sections, ordered active lessons, lesson states, progress summary, and continue-learning target.
- **FR-006**: Lesson states MUST distinguish at least `COMPLETED`, `IN_PROGRESS`, `LOCKED`, and `NOT_STARTED` for the current learner.
- **FR-007**: The system MUST calculate course progress from completed required active lessons divided by total required active lessons for the current active course structure.
- **FR-008**: The system MUST return progress as 0 percent when a course has no required active lessons.
- **FR-009**: The system MUST identify the continue-learning target as the first unfinished lesson that is available to the learner under current access and lock rules.
- **FR-010**: When all required active lessons are completed, the system MUST mark the learner's course progress as completed and MUST NOT require an unfinished continue-learning target.
- **FR-011**: The system MUST validate that a lesson exists, is active, belongs to an active course structure, and is available to the current learner before returning full lesson content.
- **FR-012**: The system MUST NOT return protected lesson content, protected video URL, or protected body content when the learner lacks course access or the lesson is locked.
- **FR-013**: The system MAY return safe lesson metadata for locked lessons when needed for navigation, but MUST clearly indicate locked state.
- **FR-014**: The system MUST allow a learner to mark an available lesson as in progress or completed for that learner.
- **FR-015**: The system MUST create or update one lesson progress record per learner and lesson, and MUST prevent duplicate progress records for the same learner and lesson.
- **FR-016**: Marking a lesson completed MUST record completion time for that learner when the lesson first becomes completed.
- **FR-017**: Repeating a completed update for the same learner and lesson MUST be idempotent and MUST NOT reset historical completion in a way that corrupts progress.
- **FR-018**: Updating lesson progress MUST recalculate or synchronize course progress for the same learner and course.
- **FR-019**: The system MUST prevent progress updates for lessons the current learner cannot access.
- **FR-020**: The system MUST prevent progress updates for lessons locked by sequential learning rules.
- **FR-021**: When sequential learning is enabled for a course, the first active lesson MUST be available by default after course access is confirmed.
- **FR-022**: When sequential learning is enabled for a course, each later active lesson MUST remain locked until the previous required active lesson is completed by the same learner.
- **FR-023**: When sequential learning is not enabled for a course, previous-lesson completion MUST NOT be required as an additional condition for opening active lessons.
- **FR-024**: The backend MUST enforce lesson locking and content access even when the learner directly requests a lesson rather than navigating through the frontend.
- **FR-025**: The frontend MAY display learning locks, progress, and continue-learning navigation for user experience, but MUST NOT be treated as the authority for real access or completion.
- **FR-026**: The system MUST keep Learning module data ownership limited to learner progress and MUST use approved cross-module contracts for Auth/User identity, Course structure, and Enrollment/Access.
- **FR-027**: Learning responses MUST include only data needed for the learning experience and MUST NOT expose password hashes, JWT values, cookie values, payment internals, raw SQL errors, raw persistence errors, secrets, or another learner's progress.
- **FR-028**: Important learning request bodies and route parameters MUST be validated before business behavior runs.
- **FR-029**: Error responses MUST follow the project response shape `{ success, message, code, details }` or an approved equivalent and MUST avoid raw stack traces or raw infrastructure details.
- **FR-030**: The system MUST fail safely when required Auth, Course, or Enrollment/Access dependencies cannot confirm identity, course structure, or access.
- **FR-031**: Learning progress records MUST be retained for audit and continuity unless a later approved spec explicitly defines deletion or archival behavior.
- **FR-032**: The system MUST support future quiz, final project, report, and certificate features by exposing reliable progress state without implementing those workflows in this feature.

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

- **Course Learning View**: The learner-facing representation of one course's learning structure, including safe course summary, ordered sections, ordered lessons, per-lesson state, course progress, and continue-learning target.
- **Lesson Progress**: The learner-specific progress state for a single lesson. It includes learner identity, lesson identity, status such as not started, in progress, or completed, optional position/progress metadata when supported, completion time, and update time.
- **Course Progress**: The learner-specific summary for one course. It includes learner identity, course identity, completed lesson count, total required active lesson count, progress percentage, status, last lesson when available, completion time, and update time.
- **Lesson State**: A computed state for the current learner and lesson, derived from course access, lesson activity, sequential lock rules, and learner progress. It must not be decided by frontend state alone.
- **Continue-Learning Target**: The next lesson the learner should open, derived from current course structure, current learner progress, and backend access or lock rules.
- **Course Access Decision**: A trusted result from the Enrollment/Access authority indicating whether the learner can access the course. It is consumed by Learning Flow and is not owned by Learning Flow.

### Out Of Scope

- Public course browsing, course catalog search, category display, and public preview content behavior owned by the Course module.
- Course, section, lesson, category, content, thumbnail, or lesson order management.
- Enrollment creation, free course enrollment, payment checkout, VNPAY processing, payment verification, order status updates, and payment-driven access unlock.
- Auth registration, email verification, login, logout, refresh-token rotation, password reset, Google OAuth, and profile management.
- Quiz authoring, quiz taking, quiz scoring, quiz submissions, and quiz-based lesson gating.
- Final project submission, mentor review, mentor feedback, and final project pass/fail decisions.
- Certificate generation, certificate eligibility, certificate storage, and certificate download.
- Video playback-duration tracking, automatic completion from watch percentage, realtime progress sync, notes, bookmarks, comments, discussion, Q&A, AI recommendations, gamification, and reminders.
- Admin report dashboards, analytics snapshots, and cross-course reporting beyond making learner progress state reliable for future readers.
- Letting the frontend decide payment state, enrollment state, course access, lesson unlock, learner identity, role, or another learner's progress.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected learning requests require backend-authenticated learner identity and reject missing or invalid sessions.
- **SC-002**: 100% of paid lesson content requests are denied unless the Enrollment/Access authority confirms active course access.
- **SC-003**: 100% of direct locked-lesson access attempts fail to return protected lesson content when sequential learning locks apply.
- **SC-004**: 100% of successful learning course views show ordered sections, ordered lessons, per-lesson states, course progress, and a continue-learning target or completed-course state.
- **SC-005**: 100% of lesson progress updates apply only to the authenticated learner and never to a frontend-supplied user id.
- **SC-006**: 100% of repeated completion updates for the same learner and lesson remain idempotent and do not create duplicate progress records.
- **SC-007**: 100% of course progress calculations return 0 percent for courses with no required active lessons and stay within the 0 to 100 percent range.
- **SC-008**: 100% of courses with all required active lessons completed are marked completed for that learner.
- **SC-009**: For sequential courses, learners can access the next active lesson only after completing the previous required active lesson in 100% of tested paths.
- **SC-010**: Learners can resume an enrolled course from the continue-learning target in under 2 user actions from the learning dashboard.
- **SC-011**: Learning responses never expose JWT values, cookie values, password hashes, raw payment details, raw persistence errors, secrets, or another learner's progress.
- **SC-012**: Learning Flow remains functionally independent from quiz, final project, mentor review, certificate, and report workflows while still providing reliable progress state for those future features.

## Assumptions

- Learners must be signed in before using protected Learning Flow behavior.
- Active course access is determined by the Payment/Enrollment/Access module, including free enrollment and paid enrollment after verified successful payment.
- Course structure, section order, lesson order, lesson activity, and lesson preview/public metadata are owned by the Course module.
- Sequential learning is controlled by a course-level rule or equivalent Course-module-provided policy. If that policy is absent or disabled, lessons are not locked by previous-lesson completion.
- Required active lessons exclude inactive, deleted, archived, or otherwise unavailable lessons from new progress calculation.
- Lesson completion is explicit in this MVP; video watch duration and automatic completion by playback percentage are deferred.
- Existing progress may remain even if a lesson later becomes inactive or deleted, but new course progress calculations use the current active course structure.
- Learning Flow may expose stable progress information for future quiz, final project, certificate, or report features, but those features define their own eligibility and business rules in separate specs.
- Frontend learning screens may improve navigation and feedback, but all real access, lock, identity, and ownership decisions remain backend-controlled.
