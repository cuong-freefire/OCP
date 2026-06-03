# Feature Specification: feat-auth

**Feature Branch**: `002-feat-auth`

**Created**: 2026-06-02

**Status**: Implemented - updated with current Auth UI, context, and role-routing behavior

**Input**: User description: "Create the OCP Auth feature specification covering learner registration, email OTP verification, local login, Google OAuth login/linking, httpOnly cookie sessions, refresh-token rotation, password reset by OTP, authenticated set-password for Google-only users, current user/profile read, backend role authorization, frontend credentials support, environment contracts, design constraints, and explicit out-of-scope boundaries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register Learner And Verify Email (Priority: P1)

A guest can create a learner account using full name, email, and password. The account is created in a pending verification state, receives an email OTP, and becomes active only after the user submits the correct OTP. After successful verification, the user is signed in immediately.

**Why this priority**: This is the primary onboarding path for learners and establishes the required email ownership proof before the account can be used.

**Independent Test**: Can be fully tested by registering with `fullName`, `email`, `password`, and frontend-only `confirmPassword`, verifying that no session is granted while pending, submitting the valid OTP for the same registration email, and confirming the user becomes active and signed in.

**Acceptance Scenarios**:

1. **Given** a guest with an unused email, **When** they register with valid full name, email, and password, **Then** the system creates a pending learner account, stores the full name as the user name, assigns the learner role from backend authority, leaves avatar unset, sends a verification OTP, and does not grant a logged-in session.
2. **Given** a pending learner with the latest valid verification OTP, **When** they submit the correct OTP before expiry, **Then** the system marks the account as email verified and active, consumes the OTP, and grants the normal signed-in session cookies.
3. **Given** a registration request that includes role, user id, avatar, image, file upload, or profile picture data, **When** the request is submitted, **Then** the system ignores or rejects those fields and never lets the frontend decide role or profile image during registration.
4. **Given** the frontend registration form, **When** the user enters mismatched password and confirm-password values, **Then** the frontend blocks submission locally and never sends `confirmPassword` to the backend contract.
5. **Given** a user reaches the email verification screen from registration, **When** the OTP form is displayed, **Then** the registration email is preserved from route state and the user only enters the OTP, preventing a different email from being substituted in the UI.

---

### User Story 2 - Sign In, Stay Signed In, And Sign Out (Priority: P1)

A verified local user can sign in with email and password, continue a session through refresh-token rotation, read their current profile from the backend session, and sign out to revoke the refresh session.

**Why this priority**: Learners and future role-based users need a secure session lifecycle before protected OCP features can depend on identity.

**Independent Test**: Can be tested by logging in as an active local user, checking current user/profile data, refreshing the session, and logging out, while verifying blocked, deleted, pending, or wrong-password users cannot sign in.

**Acceptance Scenarios**:

1. **Given** an active, email-verified local user with a password, **When** they submit valid email and password, **Then** the system grants `ocp_access_token` and `ocp_refresh_token` as httpOnly cookies, exposes only safe current-user data, and the frontend routes the user to the dashboard path for their backend role.
2. **Given** a signed-in user with a valid refresh session, **When** the access session expires and the user refreshes, **Then** the system rotates the refresh token, revokes the previous refresh token, and continues the session without requiring re-login.
3. **Given** a signed-in user, **When** they log out, **Then** the system revokes the active refresh token and clears both auth cookies.
4. **Given** a pending, blocked, soft-deleted, or Google-only user without a local password, **When** they attempt local password login, **Then** the login is rejected without leaking sensitive account details.

---

### User Story 3 - Reset Local Password By Email OTP (Priority: P2)

A local account owner who forgot their password can request a password reset OTP by email, verify the OTP, and set a new password. The public forgot-password response remains generic to prevent email enumeration.

**Why this priority**: Password recovery is required for local accounts and must be safe against account discovery and token leakage.

**Independent Test**: Can be tested by requesting reset for an existing local account, an unknown email, and a Google-only account, then verifying OTP expiry, failed-attempt limit, resend behavior, and successful password change for the eligible account only.

**Acceptance Scenarios**:

1. **Given** an existing local account with a password hash, **When** the user requests password reset, **Then** the system creates and sends a reset OTP, stores only a secure OTP proof, and returns a non-enumerating public message.
2. **Given** an unknown email or a Google-only account without a password hash, **When** password reset is requested, **Then** the system does not create a reset OTP and still returns a non-enumerating public message.
3. **Given** a valid reset OTP for an eligible local account, **When** the user submits the OTP and a valid new password before expiry, **Then** the system consumes the OTP and updates the local password.
4. **Given** email delivery configuration is missing or email sending fails, **When** a reset or registration email must be sent, **Then** the system fails safely and never records or reports a false successful send.

---

### User Story 4 - Use Google OAuth Securely (Priority: P2)

A user can sign in with Google through a provider-mediated flow. The backend verifies Google identity before creating or linking an OCP account. A Google-only user can later set their first local password only after signing in.

**Why this priority**: Google sign-in reduces onboarding friction while preserving OCP ownership of identity, role, and account status.

**Independent Test**: Can be tested by signing in with verified Google identity for a new email, an existing active OCP email, a blocked or deleted user, and missing Google configuration.

**Acceptance Scenarios**:

1. **Given** a verified Google identity for an email not yet used in OCP, **When** the user completes Google login, **Then** the system creates an active, email-verified learner account and links the Google account without storing raw OAuth tokens.
2. **Given** a verified Google identity whose email matches an existing active OCP user without a Google link, **When** the user completes Google login, **Then** the system links the Google account to that user and starts a secure session.
3. **Given** a Google-only signed-in user without a local password, **When** they use the in-app set-password flow with a valid new password, **Then** the system creates the first local password for that authenticated user.
4. **Given** Google configuration is missing, **When** the frontend checks provider availability, **Then** the UI uses a safe unavailable state, may hide or disable the Google entry point, and never asks the user to type or paste raw OAuth credentials.

---

### User Story 5 - Enforce Backend Authorization And Account Status (Priority: P2)

Protected OCP features can rely on backend-authenticated identity, role, and account status. The frontend may guide navigation, but the backend remains the only authority for real access decisions.

**Why this priority**: Future Course, Payment, Enrollment, Learning, Mentor, Admin, and Report modules require trustworthy identity and role data.

**Independent Test**: Can be tested by calling protected actions with valid, missing, expired, blocked, deleted, and role-mismatched sessions and confirming the backend response is authoritative.

**Acceptance Scenarios**:

1. **Given** a protected action requiring a signed-in user, **When** the request has no valid session cookie, **Then** the backend rejects it regardless of frontend route state.
2. **Given** a protected action requiring a specific role, **When** a signed-in user has a different backend role, **Then** the backend rejects the action.
3. **Given** a user becomes blocked or soft-deleted, **When** they attempt login or use protected session-dependent behavior, **Then** the backend rejects access based on authoritative account status.

---

### User Story 6 - Use Auth Frontend With Safe Credentials And Approved Design (Priority: P3)

The frontend Auth screens provide registration, verification, login, Google sign-in, forgot/reset password, current session awareness, Google-only set-password experiences, role-aware placeholder dashboards, and global session state using the approved OCP design system and credentialed requests.

**Why this priority**: Auth UI is required for learners to complete flows, but it must not become the security authority or drift from the design contract.

**Independent Test**: Can be tested by using the Auth screens on desktop and mobile, confirming requests include credentials, no JWT is stored in browser storage, no Bearer token is manually attached, and the visual treatment follows `frontend/DESIGN.md`.

**Acceptance Scenarios**:

1. **Given** the frontend calls Auth backend behavior, **When** it sends requests, **Then** it uses the configured API base URL and sends cookies with credentials enabled.
2. **Given** a user navigates Auth screens, **When** forms, buttons, messages, and responsive states appear, **Then** they follow the design constraints in `frontend/DESIGN.md` rather than a newly invented style.
3. **Given** any frontend Auth state, **When** session or role information is displayed, **Then** it reflects backend-provided current-user data and is not treated as authority for protected access.
4. **Given** a signed-in user, **When** the frontend loads or refreshes, **Then** `AuthProvider` rehydrates global user state through `/auth/me` using cookies and `useAuth()` exposes only safe user data to screens.
5. **Given** a signed-in user has role `LEARNER`, `MENTOR`, or `ADMIN`, **When** authentication succeeds, **Then** the frontend navigates to `/learner`, `/mentor`, or `/admin` respectively and shows an Auth-only placeholder dashboard with safe current-user details.
6. **Given** a user submits any Auth form with incomplete or invalid input, **When** the frontend handles the form submission, **Then** it validates through frontend Zod schemas, bypasses browser-native validation copy, and shows concise Vietnamese feedback through toast notifications.
7. **Given** the backend returns an Auth validation, OTP, credential, or account-state error, **When** the frontend displays the result, **Then** it maps stable backend error codes to concise Vietnamese toast copy without exposing raw infrastructure details.

### Edge Cases

- Duplicate registration with an existing active email must not create another user and must not create duplicate roles, OAuth links, verification records, or profile images.
- Re-registering or resending verification for a pending local user must not create a duplicate user; only the latest unused verification OTP remains valid.
- Verification and reset OTPs expire after 10 minutes, become unusable after 5 failed attempts, and can only be resent after a 60-second cooldown.
- Resending a verification or reset OTP invalidates any previous unused OTP for the same purpose and user.
- OTP values must never be stored, logged, returned, or displayed after initial email delivery.
- Public forgot-password behavior must not reveal whether an email is registered, unknown, blocked, deleted, or Google-only.
- Missing SMTP configuration must allow application startup but must make email-dependent actions fail safely without silently reporting success.
- Missing Google configuration must produce only a safe unavailable Google UX. The frontend may hide or disable the Google button, but it must never ask for raw OAuth credentials.
- A verified Google email that matches a pending local user is not automatically activated by this spec unless a later clarification changes that policy.
- Blocked or soft-deleted users must be rejected across local login, Google login, refresh, and protected-session behavior.
- Frontend route guards, browser state, or submitted role/user id/status fields must never grant real authorization.
- Frontend role dashboards are Auth-only placeholders for navigation and smoke testing; they must not implement course, payment, mentor review, admin management, or report business behavior.
- If deployment requires cross-site cookies or `SameSite=None`, state-changing Auth behavior must not ship until CSRF protection is added.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow public learner registration with only `fullName`, `email`, and `password` as the business inputs.
- **FR-002**: The system MUST store registration `fullName` as the user name so learner identity remains synchronized with the user profile model.
- **FR-003**: The system MUST assign public registration users the learner role from backend-controlled role data where the role code is `LEARNER`.
- **FR-004**: The system MUST NOT accept frontend-supplied role, user id, account status, payment state, enrollment state, access state, image, avatar, avatar URL, or profile picture upload during registration.
- **FR-005**: The system MUST create local registration users in `pending_verification` state with email not yet verified.
- **FR-006**: The system MUST NOT grant access or refresh session cookies to a pending local user before successful email OTP verification.
- **FR-007**: The system MUST leave `avatar_url` unset for public registration; upload or update of profile image files through `public/images` is outside this feature.
- **FR-008**: The system MUST hash local passwords before storage and MUST never return or log plaintext passwords or password hashes.
- **FR-009**: The system MUST send a six-digit email verification OTP for local registration and store only a secure OTP proof or hash.
- **FR-010**: Verification OTPs MUST expire after 10 minutes, allow no more than 5 failed attempts, enforce a 60-second resend cooldown, and invalidate earlier unused verification OTPs when resent.
- **FR-011**: Successful email OTP verification MUST mark the user as email verified, activate the account, consume the OTP, and grant `ocp_access_token` plus `ocp_refresh_token` httpOnly cookies.
- **FR-012**: Local login MUST require an existing active, non-deleted user with a local password and valid credentials.
- **FR-013**: Local login MUST reject pending, blocked, soft-deleted, unknown, Google-only without password, and wrong-password cases without exposing sensitive internals.
- **FR-014**: Session tokens MUST be stored only in httpOnly cookies named `ocp_access_token` and `ocp_refresh_token`; JWT MUST NOT be stored in browser `localStorage` or `sessionStorage`.
- **FR-015**: The backend MUST read Auth session tokens from cookies and MUST NOT require or support `Authorization: Bearer <token>` for OCP Auth.
- **FR-016**: Access sessions MUST expire after 15 minutes and refresh sessions MUST expire after 7 days according to the environment contract.
- **FR-017**: Refresh behavior MUST store only hashed refresh-token proofs, rotate refresh tokens on refresh, revoke the previous refresh token after rotation, and reject reused or revoked refresh tokens.
- **FR-018**: Logout MUST revoke the active refresh token and clear both Auth cookies.
- **FR-019**: The system MUST provide a current-user and basic profile read from the backend session, including only safe identity, role, account status, email verification, and profile fields.
- **FR-020**: Current-user and profile responses MUST NOT include password hashes, raw OTPs, raw refresh tokens, JWT values, cookie values, OAuth tokens, secrets, raw SQL errors, or raw persistence errors.
- **FR-021**: Backend authorization MUST use backend-verified identity, role, account status, and session validity as the source of truth.
- **FR-022**: Middleware or equivalent backend session handling MUST attach trusted identity to `req.user` for protected behavior.
- **FR-023**: Frontend route guards MAY improve user experience but MUST NOT be treated as real authorization.
- **FR-024**: Public forgot-password MUST use email OTP, not reset links or user-facing reset tokens.
- **FR-025**: Before creating or sending a reset OTP, the backend MUST confirm the email belongs to an existing local account with a password hash.
- **FR-026**: The system MUST NOT create reset OTPs for unknown emails, blocked or deleted users, or Google-only users whose password hash is unset.
- **FR-027**: Public forgot-password responses MUST be generic enough to avoid revealing whether the email exists or is eligible.
- **FR-028**: Reset OTPs MUST be six digits, expire after 10 minutes, allow no more than 5 failed attempts, enforce a 60-second resend cooldown, invalidate earlier unused reset OTPs when resent, and be stored only as secure proofs or hashes.
- **FR-029**: Successful reset OTP verification with a valid new password MUST update the local password and consume the reset OTP.
- **FR-030**: A Google-only user MUST NOT be allowed to create their first local password through public forgot-password or reset-password.
- **FR-031**: A Google-only user MAY create their first local password only through an authenticated in-app set-password flow after successful Google sign-in.
- **FR-032**: Google OAuth login or linking MUST be verified by the backend before creating a new user, linking an account, or issuing a session.
- **FR-033**: The system MUST map Google accounts by provider `GOOGLE` and Google's stable subject identifier, not by frontend-submitted profile fields.
- **FR-034**: The system MUST NOT ask users to type or paste raw Google OAuth credentials into OCP screens.
- **FR-035**: The system MUST NOT store or log raw Google `id_token`, `access_token`, or `refresh_token`.
- **FR-036**: A verified Google email for a new OCP user MUST create an active, email-verified learner account.
- **FR-037**: A verified Google email matching an existing active OCP user without a Google link MUST link to that existing user rather than creating a duplicate user.
- **FR-038**: Google login MUST reject blocked or soft-deleted OCP users.
- **FR-039**: If Google OAuth configuration is missing, the frontend MUST present a safe unavailable provider state, MAY hide or disable the Google sign-in entry point, and MUST NOT ask the user to type or paste raw OAuth credentials.
- **FR-040**: The frontend MUST send Auth requests using credentials so browser cookies are included.
- **FR-041**: The frontend MUST use the configured API base URL and MUST NOT use `VITE_*`, `REACT_API_URL`, manual Bearer token attachment, or browser storage for JWT.
- **FR-042**: Auth frontend screens MUST follow `frontend/DESIGN.md` as a binding design and UX constraint, including the approved color system, typography direction, spacing, rounded-rectangle controls, responsive behavior, and safe UI states.
- **FR-043**: Auth frontend implementation MUST NOT choose an unrelated visual style, alternate design system, or marketing page pattern that conflicts with `frontend/DESIGN.md`.
- **FR-044**: CORS and cookie behavior MUST allow only the exact configured frontend origin when credentials are used and MUST NOT use wildcard origin for cookie-based Auth.
- **FR-045**: Cookie behavior MUST use `sameSite = "lax"`, `secure = false` for local development, and `secure = true` for production.
- **FR-046**: MVP same-site Auth MAY omit CSRF tokens; if deployment requires `SameSite=None` or cross-site cookies, CSRF protection MUST be added before state-changing Auth behavior is implemented.
- **FR-047**: Email delivery for registration verification and password reset MUST use the configured SMTP email sender. Application startup MAY continue when SMTP is missing, but email send actions MUST fail safely and MUST NOT silently succeed.
- **FR-048**: Backend code MAY load `backend/.env` and read environment values through process environment access, but MUST NOT log, return, persist, or expose secret environment values. Logs, errors, and documentation may mention variable names only.
- **FR-049**: Error responses MUST follow the project response shape `{ success, message, code, details }` or an approved equivalent and MUST avoid raw stack traces or raw infrastructure errors.
- **FR-050**: Important request bodies, query parameters, and route parameters MUST be validated before business behavior runs.
- **FR-051**: Auth/User module boundaries MUST be preserved: other modules consume Auth/User identity and role through approved contracts and do not own or directly decide Auth state.
- **FR-052**: The system MUST normalize email input for lookup and uniqueness by trimming surrounding spaces and using case-insensitive matching.
- **FR-053**: The frontend registration form MUST include `confirmPassword` for local UX validation, but the backend registration contract MUST remain limited to `fullName`, `email`, and `password`.
- **FR-054**: The frontend email verification screen MUST keep the registration email from route state and MUST NOT render an editable email field in the OTP form.
- **FR-055**: The frontend MUST maintain current safe user data in an Auth Context exposed through `AuthProvider` and `useAuth`, and MUST rehydrate that state by calling `/auth/me` with cookie credentials after page refresh.
- **FR-056**: After successful local login, email verification, or Google login, the frontend MUST route users by backend-provided role: `LEARNER` to `/learner`, `MENTOR` to `/mentor`, and `ADMIN` to `/admin`.
- **FR-057**: Role-specific frontend dashboard pages MAY exist only as Auth placeholders that display backend-provided safe user fields and MUST NOT grant or implement real protected business authorization.
- **FR-058**: Auth frontend forms MUST validate user input with frontend Zod schemas before calling Auth APIs and MUST disable browser-native validation copy so validation behavior and messages are controlled by the application.
- **FR-059**: Auth frontend validation, success, and recoverable API error messages MUST be shown through React Toastify using concise professional Vietnamese copy.
- **FR-060**: Auth frontend OTP resend and reset-code resend actions MUST show a visible countdown while the 60-second cooldown is active and MUST disable the resend action until the countdown completes.

### Configuration And Environment Contract

The feature depends on the following environment variable names from the checked-in example files. Specifications, plans, tests, and implementation must refer to these names only, never to real secret values.

Backend variables:

- Runtime and routing: `PORT`, `API_PREFIX`
- CORS origin: `FRONTEND_ORIGIN`
- Database connection: `DATABASE_URL`
- Auth secret and cookies: `AUTH_SECRET`, `COOKIE_ACCESS_NAME`, `COOKIE_REFRESH_NAME`, `COOKIE_SAME_SITE`, `COOKIE_SECURE`
- Token lifetime: `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- Password hashing: `BCRYPT_SALT_ROUNDS`
- Email verification OTP: `EMAIL_OTP_EXPIRES_MINUTES`, `EMAIL_OTP_MAX_FAILED_ATTEMPTS`, `EMAIL_OTP_RESEND_COOLDOWN_SECONDS`
- Reset password OTP: `RESET_OTP_EXPIRES_MINUTES`, `RESET_OTP_MAX_FAILED_ATTEMPTS`, `RESET_OTP_RESEND_COOLDOWN_SECONDS`
- SMTP email delivery: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
- Google OAuth backend configuration: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- Existing email-provider placeholder: `RESEND_API_KEY`, which is not used by this Auth MVP unless a later email-provider specification explicitly chooses it

Frontend variables:

- CRA development port: `PORT`
- Backend API base URL: `REACT_APP_API_BASE_URL`

### Key Entities *(include if feature involves data)*

- **Role**: Backend-controlled role record. Public learner registration uses the active role whose code is `LEARNER`.
- **User**: OCP identity record containing name, email, optional avatar URL, password hash if local login exists, email verification flag, account status, role, and soft-delete marker. Password hash and sensitive state are never exposed to the frontend.
- **Email Verification OTP**: Secure proof of a six-digit email verification code associated with a pending local user, including expiry, usage, failed attempts, lock state, resend timestamp, and creation timestamp.
- **Refresh Token Session**: Secure proof of a refresh session associated with a user, including expiry and revocation state. Only hashed token proofs are stored.
- **Password Reset OTP**: Secure proof of a six-digit reset code for an eligible local account. It includes `otp_hash`, `expires_at`, `used_at`, `failed_attempts`, `locked_at`, `last_sent_at`, and `created_at`; if a later plan uses a different table name, it must document equivalent field mapping and still never store raw OTP.
- **OAuth Account**: Link between an OCP user and a Google identity using provider `GOOGLE`, provider subject id, verified provider email, display metadata, and sanitized provider profile data without OAuth tokens.
- **Current User/Profile View**: Safe session-derived representation of the signed-in user for frontend display and future module authorization decisions.

### Out Of Scope

- Payment checkout, payment verification, VNPAY callback/IPN, order creation, and payment status updates.
- Enrollment creation, course access unlock, my-courses behavior, and learning entitlement decisions.
- Course CRUD, course content management, lesson management, and category management.
- Learning progress, quizzes, final project submission, final project grading, and mentor review workflows.
- Admin user/course/mentor/report CRUD, business dashboards, report snapshots, and audit reporting beyond Auth-safe events required by this feature. Auth-only role placeholder dashboards for smoke testing are in scope.
- Uploading, replacing, cropping, storing, or updating profile image files through `public/images`.
- Letting frontend decide amount, payment state, enrollment state, course access, role, user id, or account status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful public registrations create a learner account with the submitted full name as the user name and no frontend-supplied role or avatar data applied.
- **SC-002**: 100% of pending local users are unable to obtain a logged-in session until successful email OTP verification.
- **SC-003**: 100% of successful email OTP verifications activate the account and sign the user in during the same user flow.
- **SC-004**: 100% of session-bearing Auth flows use httpOnly cookies and never require users or frontend code to handle raw JWT values.
- **SC-005**: 100% of refresh attempts with a valid refresh session rotate the refresh token, and 100% of logout attempts revoke the active refresh session.
- **SC-006**: 100% of reset OTPs are created only for eligible local accounts, while public forgot-password responses remain non-enumerating.
- **SC-007**: 100% of OTP verification and reset flows enforce 10-minute expiry, 5 failed-attempt maximum, 60-second resend cooldown, single-use consumption, and invalidation of older unused OTPs after resend.
- **SC-008**: 100% of Google sign-in attempts are verified by backend authority before account creation, account linking, or session creation.
- **SC-009**: 100% of blocked or soft-deleted users are rejected for local login, Google login, refresh, and protected-session access.
- **SC-010**: 100% of frontend Auth requests that need session cookies include credentials and never store JWT in browser storage or manually attach Bearer tokens.
- **SC-011**: Auth users can complete the normal register, email verification, and automatic sign-in path in under 3 minutes when email delivery is available.
- **SC-012**: On supported desktop and mobile widths, Auth screens meet the visual and interaction constraints of `frontend/DESIGN.md`, including responsive layout and minimum 44px touch targets for primary controls.
- **SC-013**: 100% of successful frontend Auth sign-in flows route users to the dashboard path that matches the backend-provided role, while unknown roles fall back to current-session display.
- **SC-014**: 100% of page refreshes with valid auth cookies can restore frontend user context through `/auth/me` without browser JWT storage.
- **SC-015**: 100% of Auth form validation feedback and Auth success/error notifications are controlled by Zod plus React Toastify and use concise Vietnamese UX copy rather than browser-native validation messages.

## Assumptions

- The `LEARNER` role exists and is active before public registration is available.
- Email addresses are treated case-insensitively after trimming whitespace for registration, login, reset, OAuth matching, and uniqueness checks.
- The latest unused OTP for a user and purpose is the only valid OTP; older unused OTPs are invalid after resend.
- A locked OTP record means that code can no longer be used; requesting a new OTP remains subject to the resend cooldown and account eligibility rules.
- Google OAuth creates or links accounts only from verified Google identity claims. A verified Google email matching a pending local OCP user is not auto-linked or auto-activated in this spec.
- Google provider avatar data, if retained, belongs to the OAuth account metadata or provider avatar field. The main user avatar remains unset until a later profile update feature.
- The current-user/profile read is limited to safe profile data needed for Auth and shell navigation; profile edits and image uploads are deferred.
- SMTP and Google OAuth may be unconfigured in local development. The user experience must remain safe and explicit without leaking secrets or accepting raw credentials.
- Frontend role dashboards are placeholders for Auth validation only; real Learner, Mentor, and Admin business pages remain separate feature scopes.
- The Auth feature may define stable Auth/User contracts for future modules, but it does not implement payment, enrollment, course, learning, mentor, admin, or report behavior.
