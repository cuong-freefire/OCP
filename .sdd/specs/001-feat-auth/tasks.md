# Tasks: feat-auth

**Input**: Design documents from `.sdd/specs/001-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are required by the feature spec and project rules. Backend tests use `node:test`, `assert`, and `supertest`; frontend tests use `node:test` for API client and source-rule checks.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independently useful increment after shared foundations are complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the empty backend/frontend project structure and package scripts required by the Auth MVP.

- [X] T001 Create backend npm package and scripts in `backend/package.json`
- [X] T002 Create frontend CRA npm package and scripts in `frontend/package.json`
- [X] T003 [P] Create backend source directories in `backend/src/api`, `backend/src/controllers`, `backend/src/services`, `backend/src/repositories`, `backend/src/middlewares`, `backend/src/validators`, `backend/src/utils`, and `backend/src/config`
- [X] T004 [P] Create backend Prisma and test directories in `backend/prisma`, `backend/prisma/migrations`, `backend/tests/auth`, `backend/tests/fixtures`, and `backend/tests/helpers`
- [X] T005 [P] Create frontend CRA source directories in `frontend/public`, `frontend/src/api`, `frontend/src/components/auth`, `frontend/src/pages/auth`, `frontend/src/routes`, `frontend/src/hooks`, `frontend/src/utils`, and `frontend/tests/auth`
- [X] T006 [P] Create CRA entry shell in `frontend/public/index.html`, `frontend/src/index.js`, and `frontend/src/App.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Auth infrastructure that must exist before user-story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Define Auth Prisma models for `roles`, `users`, `refresh_tokens`, `email_verifications`, `password_reset_tokens`, and `oauth_accounts` in `backend/prisma/schema.prisma`
- [X] T008 Create Auth database migration preserving existing migration history in `backend/prisma/migrations`
- [X] T009 Add seed support for the active `LEARNER` role in `backend/prisma/seed.js`
- [X] T010 [P] Configure Prisma client access only for repositories in `backend/src/config/prisma.config.js`
- [X] T011 [P] Configure Auth env parsing without logging secret values in `backend/src/config/auth.config.js`
- [X] T012 [P] Configure exact-origin credentialed CORS in `backend/src/config/cors.config.js`
- [X] T013 [P] Implement standard response helpers in `backend/src/utils/response.util.js`
- [X] T014 [P] Implement centralized error middleware with sanitized errors in `backend/src/middlewares/error.middleware.js`
- [X] T015 [P] Implement request validation middleware for Zod schemas in `backend/src/middlewares/validation.middleware.js`
- [X] T016 [P] Implement email normalization and token hashing helpers in `backend/src/utils/crypto.util.js`
- [X] T017 [P] Implement safe OTP generation and email formatting helpers in `backend/src/utils/email.util.js`
- [X] T018 [P] Define shared Auth Zod schemas in `backend/src/validators/auth.validator.js`
- [X] T019 Implement Express-style app bootstrap and route mounting in `backend/src/app.js`
- [X] T020 Implement backend server entry using env config in `backend/src/server.js`
- [X] T021 Implement Auth repository base methods and safe select projections in `backend/src/repositories/auth.repository.js`
- [X] T022 Implement access/refresh cookie and JWT helpers in `backend/src/services/token.service.js`
- [X] T023 Implement Nodemailer SMTP adapter with fail-safe missing-config behavior in `backend/src/services/email.service.js`
- [X] T024 Implement backend test app and database helpers in `backend/tests/helpers/authTestApp.js`
- [X] T025 Implement frontend API client base with credentials enabled in `frontend/src/api/authApi.js`

**Checkpoint**: Foundation ready. User-story implementation can start.

---

## Phase 3: User Story 1 - Register Learner And Verify Email (Priority: P1) MVP

**Goal**: A guest registers with `fullName`, `email`, and `password`, receives email OTP, remains pending until verification, then becomes active and signed in.

**Independent Test**: Register a learner, confirm no session while pending, submit latest valid OTP, and confirm active status plus httpOnly cookies.

### Tests for User Story 1

- [X] T026 [P] [US1] Add backend integration tests for register pending-user behavior in `backend/tests/auth/register.integration.test.js`
- [X] T027 [P] [US1] Add backend integration tests for email verification cookie behavior in `backend/tests/auth/verifyEmail.integration.test.js`
- [X] T028 [P] [US1] Add backend service tests for verification OTP expiry, failed attempts, resend cooldown, and invalidation in `backend/tests/auth/emailVerification.service.test.js`
- [X] T029 [P] [US1] Add backend validation/security tests rejecting role/avatar/image/userId input in `backend/tests/auth/registerValidation.test.js`

### Implementation for User Story 1

- [X] T030 [US1] Add repository methods for learner role lookup, user creation, pending-user lookup, and verification OTP records in `backend/src/repositories/auth.repository.js`
- [X] T031 [US1] Implement registration business logic with email normalization, bcrypt hashing, `LEARNER` assignment, no avatar upload, and no session before OTP in `backend/src/services/auth.service.js`
- [X] T032 [US1] Implement verification OTP issue, resend, attempt tracking, consumption, user activation, and cookie issuance in `backend/src/services/auth.service.js`
- [X] T033 [US1] Add register, verify-email, and resend-verification controller handlers in `backend/src/controllers/auth.controller.js`
- [X] T034 [US1] Add register, verify-email, and resend-verification routes with Zod validation in `backend/src/api/auth.routes.js`
- [X] T035 [US1] Add Auth API methods for register, verify email, and resend verification in `frontend/src/api/authApi.js`
- [X] T036 [P] [US1] Create registration page following `frontend/DESIGN.md` in `frontend/src/pages/auth/RegisterPage.jsx`
- [X] T037 [P] [US1] Create verification OTP page following `frontend/DESIGN.md` in `frontend/src/pages/auth/VerifyEmailPage.jsx`
- [X] T038 [US1] Add registration and verification routes in `frontend/src/routes/AuthRoutes.jsx`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Sign In, Stay Signed In, And Sign Out (Priority: P1)

**Goal**: A verified local user can login, read current user/profile, refresh the session through rotation, and logout.

**Independent Test**: Login as active local user, call current user, refresh session, logout, and confirm invalid/pending/blocked/deleted cases fail.

### Tests for User Story 2

- [X] T039 [P] [US2] Add backend integration tests for local login cookie behavior and safe user response in `backend/tests/auth/login.integration.test.js`
- [X] T040 [P] [US2] Add backend integration tests for refresh rotation, reuse rejection, and logout revocation in `backend/tests/auth/session.integration.test.js`
- [X] T041 [P] [US2] Add backend integration tests for current-user/profile safe projection in `backend/tests/auth/me.integration.test.js`
- [X] T042 [P] [US2] Add backend tests rejecting pending, blocked, deleted, wrong-password, and Google-only local login in `backend/tests/auth/loginRejection.test.js`

### Implementation for User Story 2

- [X] T043 [US2] Add repository methods for credential lookup, refresh token create/rotate/revoke, and current-user projection in `backend/src/repositories/auth.repository.js`
- [X] T044 [US2] Implement local login, current-user read, refresh rotation, reuse rejection, and logout logic in `backend/src/services/auth.service.js`
- [X] T045 [US2] Implement cookie-session authentication middleware attaching trusted `req.user` in `backend/src/middlewares/auth.middleware.js`
- [X] T046 [US2] Add login, refresh, logout, and me controller handlers in `backend/src/controllers/auth.controller.js`
- [X] T047 [US2] Add login, refresh, logout, and me routes with cookie auth where required in `backend/src/api/auth.routes.js`
- [X] T048 [US2] Add Auth API methods for login, refresh, logout, and me in `frontend/src/api/authApi.js`
- [X] T049 [US2] Implement frontend Auth state hook using backend current-user data in `frontend/src/hooks/useAuth.js`
- [X] T050 [P] [US2] Create login page following `frontend/DESIGN.md` in `frontend/src/pages/auth/LoginPage.jsx`
- [X] T051 [US2] Wire login, logout, refresh, and current-user UX into `frontend/src/routes/AuthRoutes.jsx`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Reset Local Password By Email OTP (Priority: P2)

**Goal**: A local account owner can request a reset OTP, verify it, and set a new password without email enumeration.

**Independent Test**: Request reset for eligible, unknown, and Google-only emails; verify OTP policy; reset password for eligible local account only.

### Tests for User Story 3

- [X] T052 [P] [US3] Add backend integration tests for non-enumerating forgot-password responses in `backend/tests/auth/forgotPassword.integration.test.js`
- [X] T053 [P] [US3] Add backend service tests for reset OTP expiry, failed attempts, resend cooldown, and invalidation in `backend/tests/auth/resetOtp.service.test.js`
- [X] T054 [P] [US3] Add backend integration tests rejecting unknown, blocked, deleted, and Google-only reset OTP creation in `backend/tests/auth/resetEligibility.test.js`
- [X] T055 [P] [US3] Add backend integration tests for successful reset password consumption and bcrypt update in `backend/tests/auth/resetPassword.integration.test.js`

### Implementation for User Story 3

- [X] T056 [US3] Add repository methods for reset OTP create/resend/consume and password hash update in `backend/src/repositories/auth.repository.js`
- [X] T057 [US3] Implement forgot-password eligibility, generic public response, SMTP fail-safe behavior, and reset OTP issue/resend in `backend/src/services/auth.service.js`
- [X] T058 [US3] Implement reset-password OTP verification, failed-attempt handling, OTP consumption, and password update in `backend/src/services/auth.service.js`
- [X] T059 [US3] Add forgot-password and reset-password controller handlers in `backend/src/controllers/auth.controller.js`
- [X] T060 [US3] Add forgot-password and reset-password routes with Zod validation in `backend/src/api/auth.routes.js`
- [X] T061 [US3] Add Auth API methods for forgot password and reset password in `frontend/src/api/authApi.js`
- [X] T062 [P] [US3] Create forgot-password page following `frontend/DESIGN.md` in `frontend/src/pages/auth/ForgotPasswordPage.jsx`
- [X] T063 [P] [US3] Create reset-password OTP page following `frontend/DESIGN.md` in `frontend/src/pages/auth/ResetPasswordPage.jsx`
- [X] T064 [US3] Add forgot/reset password routes in `frontend/src/routes/AuthRoutes.jsx`

**Checkpoint**: User Story 3 works independently after foundational Auth and session support.

---

## Phase 6: User Story 4 - Use Google OAuth Securely (Priority: P2)

**Goal**: Users can sign in or link with backend-verified Google identity, and Google-only users can set their first local password only while authenticated.

**Independent Test**: Verify new Google account creation, existing active email linking, missing config state, blocked/deleted rejection, no raw OAuth token storage, and authenticated set-password.

### Tests for User Story 4

- [X] T065 [P] [US4] Add backend tests for Google not-configured response in `backend/tests/auth/googleConfig.test.js`
- [X] T066 [P] [US4] Add backend integration tests for Google verified new-user creation and cookies in `backend/tests/auth/googleLogin.integration.test.js`
- [X] T067 [P] [US4] Add backend integration tests for linking existing active verified email without duplicate user in `backend/tests/auth/googleLinking.integration.test.js`
- [X] T068 [P] [US4] Add backend tests rejecting blocked/deleted Google users and raw OAuth token persistence in `backend/tests/auth/googleSecurity.test.js`
- [X] T069 [P] [US4] Add backend integration tests for authenticated Google-only set-password in `backend/tests/auth/setPassword.integration.test.js`

### Implementation for User Story 4

- [X] T070 [US4] Add OAuth account lookup/link/create repository methods in `backend/src/repositories/auth.repository.js`
- [X] T071 [US4] Implement Google config status and backend verification adapter without token persistence in `backend/src/services/googleAuth.service.js`
- [X] T072 [US4] Implement Google login/linking business rules and cookie issuance in `backend/src/services/auth.service.js`
- [X] T073 [US4] Implement authenticated set-password logic for Google-only users in `backend/src/services/auth.service.js`
- [X] T074 [US4] Add Google config, Google login, and set-password controller handlers in `backend/src/controllers/auth.controller.js`
- [X] T075 [US4] Add Google config, Google login, and set-password routes with validation/auth middleware in `backend/src/api/auth.routes.js`
- [X] T076 [US4] Add Auth API methods for Google config, Google login, and set-password in `frontend/src/api/authApi.js`
- [X] T077 [P] [US4] Create Google sign-in button component with safe unavailable provider state in `frontend/src/components/auth/GoogleSignInButton.jsx`
- [X] T078 [P] [US4] Create in-app set-password page following `frontend/DESIGN.md` in `frontend/src/pages/auth/SetPasswordPage.jsx`
- [X] T079 [US4] Wire Google sign-in and set-password UX into `frontend/src/routes/AuthRoutes.jsx`

**Checkpoint**: User Story 4 works independently after foundational Auth and session support.

---

## Phase 7: User Story 5 - Enforce Backend Authorization And Account Status (Priority: P2)

**Goal**: Protected behavior uses backend-verified identity, role, status, and session validity, never frontend route state.

**Independent Test**: Protected requests with missing, expired, blocked, deleted, and role-mismatched sessions are rejected by backend authority.

### Tests for User Story 5

- [X] T080 [P] [US5] Add backend middleware tests for missing, expired, revoked, blocked, and deleted sessions in `backend/tests/auth/authMiddleware.test.js`
- [X] T081 [P] [US5] Add backend role authorization tests for role mismatch and allowed role in `backend/tests/auth/roleAuthorization.test.js`
- [X] T082 [P] [US5] Add backend contract tests for sanitized auth errors in `backend/tests/auth/authErrorContract.test.js`

### Implementation for User Story 5

- [X] T083 [US5] Add require-auth and require-role middleware exports in `backend/src/middlewares/auth.middleware.js`
- [X] T084 [US5] Add account-status recheck behavior for protected sessions in `backend/src/services/auth.service.js`
- [X] T085 [US5] Define Auth/User service contract helpers for future modules in `backend/src/services/auth.service.js`
- [X] T086 [US5] Add sanitized authorization response codes in `backend/src/utils/response.util.js`
- [X] T087 [US5] Document Auth/User contract usage and non-Auth module boundaries in `.sdd/specs/001-auth/quickstart.md`

**Checkpoint**: Backend authorization is reliable for future module integration.

---

## Phase 8: User Story 6 - Use Auth Frontend With Safe Credentials And Approved Design (Priority: P3)

**Goal**: Frontend Auth screens complete the user flows, send credentialed requests, avoid JWT storage/Bearer auth, and follow `frontend/DESIGN.md`.

**Independent Test**: Exercise Auth screens on desktop and mobile widths, confirm request credentials, safe storage rules, Google unavailable/configured UX, role dashboard navigation, Auth Context rehydration, and design token usage.

### Tests for User Story 6

- [X] T088 [P] [US6] Add frontend source-rule test for `withCredentials` or credentialed fetch behavior in `frontend/tests/auth/authApiCredentials.test.js`
- [X] T089 [P] [US6] Add frontend source-rule test forbidding JWT `localStorage`, `sessionStorage`, and Bearer auth in `frontend/tests/auth/noTokenStorage.test.js`
- [X] T090 [P] [US6] Add frontend source-rule test for `REACT_APP_API_BASE_URL` and no `VITE_*` usage in `frontend/tests/auth/envContract.test.js`
- [X] T091 [P] [US6] Add frontend source-rule test for Google missing-config UX text and no raw credential prompt in `frontend/tests/auth/googleUxRules.test.js`

### Implementation for User Story 6

- [X] T092 [US6] Add shared Auth layout following `frontend/DESIGN.md` colors, typography, spacing, and touch targets in `frontend/src/components/auth/AuthLayout.jsx`
- [X] T093 [US6] Add reusable Auth form controls with 6px input radius and 8px rounded-rectangle buttons in `frontend/src/components/auth/AuthFormControls.jsx`
- [X] T094 [US6] Add safe Auth message and error-state component in `frontend/src/components/auth/AuthStatusMessage.jsx`
- [X] T095 [US6] Apply responsive Auth page styles and design tokens in `frontend/src/components/auth/authStyles.css`
- [X] T096 [US6] Update all Auth pages to use shared layout and controls in `frontend/src/pages/auth`
- [X] T097 [US6] Add frontend utility guarding against Auth token browser storage patterns in `frontend/src/utils/authStorageRules.js`
- [X] T098 [US6] Wire Auth routes into the CRA app shell in `frontend/src/App.jsx`

**Checkpoint**: Frontend Auth UX is complete and security-source rules pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation alignment, and hardening across all stories.

- [X] T099 [P] Verify OpenAPI contract alignment with implemented routes in `.sdd/specs/001-auth/contracts/auth-api.openapi.yaml`
- [X] T100 [P] Update Auth quickstart with final implemented scripts and smoke steps in `.sdd/specs/001-auth/quickstart.md`
- [X] T101 [P] Add final secret-leak regression tests for responses/log-safe paths in `backend/tests/auth/secretLeakage.test.js`
- [X] T102 Run backend Auth test suite and fix failures using `npm --prefix backend run test`
- [X] T103 Run frontend Auth source-rule tests and fix failures using `npm --prefix frontend run test`
- [X] T104 Run full root test command and fix failures using `npm test`
- [X] T105 Run production build command and fix build failures using `npm run build`
- [X] T106 Review implementation against `.sdd/specs/001-auth/spec.md` acceptance scenarios and update only generated docs if contracts changed in scope

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 and 2 (P1)**: Start after Foundational. US2 depends on shared session foundations and may reuse US1 user fixtures.
- **User Stories 3, 4, 5 (P2)**: Start after Foundational and can run after P1 foundations are stable. US4 set-password requires session support from US2.
- **User Story 6 (P3)**: Can start after frontend setup, but final UX integration depends on API methods from US1 to US4.
- **Polish**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other stories after Foundational. MVP.
- **US2**: No dependency on US1 implementation, but needs local active user fixtures.
- **US3**: Depends on password hashing, email service, OTP helpers, and user repository foundations.
- **US4**: Depends on session cookie issuance and authenticated middleware for set-password.
- **US5**: Depends on session middleware from US2.
- **US6**: Depends on API client methods and page flows from US1 to US4.

### Parallel Opportunities

- Setup directory/package tasks marked `[P]` can run in parallel.
- Foundational config, utility, middleware, validator, and test-helper tasks marked `[P]` can run in parallel.
- Tests within each user story marked `[P]` can run in parallel before implementation.
- Frontend pages/components marked `[P]` can be built in parallel with backend service/controller work when contracts are stable.
- US3 and US4 can proceed in parallel after session foundations are stable.

## Parallel Example: User Story 1

```text
Task: T026 Add backend integration tests for register pending-user behavior
Task: T027 Add backend integration tests for email verification cookie behavior
Task: T028 Add backend service tests for verification OTP policy
Task: T029 Add backend validation/security tests for rejected frontend authority fields
```

## Parallel Example: User Story 4

```text
Task: T065 Add backend tests for Google not-configured response
Task: T066 Add backend integration tests for Google verified new-user creation
Task: T067 Add backend integration tests for linking existing active verified email
Task: T077 Create Google sign-in button component with safe unavailable provider state
Task: T078 Create in-app set-password page
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational Auth infrastructure.
3. Complete Phase 3 User Story 1.
4. Stop and validate registration, OTP verification, activation, and auth cookies.

### Incremental Delivery

1. Add US2 for login, refresh, logout, and current-user/profile.
2. Add US3 for password reset OTP.
3. Add US4 for Google OAuth and set-password.
4. Add US5 for reusable backend authorization contracts.
5. Add US6 for complete frontend UX and source-rule checks.

### Guardrails

- Write story tests first and confirm they fail before implementation.
- Do not import Prisma outside repositories.
- Do not add Bearer auth or browser JWT storage.
- Do not read, print, or commit real `.env` values.
- Do not implement payment, enrollment, course, learning, mentor, admin, report, or profile-image upload behavior in this feature.
