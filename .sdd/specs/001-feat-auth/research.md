# Research: feat-auth

## Decision: Use httpOnly access and refresh cookies

**Rationale**: OCP requires JWT only in httpOnly cookies and backend token reads through `req.cookies`. This keeps frontend code from handling raw JWT values and prevents Bearer-token drift.

**Alternatives considered**: Bearer tokens and browser storage were rejected because the project explicitly forbids `Authorization: Bearer <token>`, `localStorage`, and `sessionStorage` JWT storage.

## Decision: Store only hashed refresh-token proofs

**Rationale**: The refresh flow is in scope and must support rotation and revocation. Storing only token hashes in `refresh_tokens` limits blast radius if database data is exposed.

**Alternatives considered**: Storing raw refresh tokens was rejected due to secret leakage risk. Omitting refresh sessions was rejected because the spec requires 7-day refresh sessions with rotation/revoke.

## Decision: Model email verification and reset as six-digit OTP proof records

**Rationale**: The spec and database design require six-digit OTPs, 10-minute expiry, 5 failed-attempt maximum, 60-second resend cooldown, single-use consumption, and invalidation of older unused OTPs. The database should store only secure proofs or hashes, never raw OTP values.

**Alternatives considered**: Email links and raw reset tokens were rejected because the feature requires OTP email flows and forbids user-facing reset links/tokens.

## Decision: Normalize email before all Auth lookups

**Rationale**: `users.email` is unique and the spec requires case-insensitive matching after trimming whitespace. Normalization must happen before register, login, forgot/reset, Google email matching, and uniqueness checks.

**Alternatives considered**: Relying only on database uniqueness was rejected because case/whitespace handling can vary by collation and would not cover all service checks consistently.

## Decision: Treat SMTP as optional at startup but mandatory at send time

**Rationale**: Local development may not have SMTP configured, but registration and reset flows must fail safely when email cannot be sent. This prevents false success and avoids orphaned OTP state that users cannot receive.

**Alternatives considered**: Failing application startup when SMTP is absent was rejected for local-dev ergonomics. Silently reporting email success was rejected by project rules.

## Decision: Verify Google identity through backend authority

**Rationale**: Google OAuth must not trust frontend-submitted email, name, avatar, provider user id, or role. Backend verification maps `provider = GOOGLE` plus Google subject id to `oauth_accounts`, then creates or links an OCP user according to the spec.

**Alternatives considered**: Trusting frontend profile payloads or storing raw Google OAuth tokens was rejected. Creating duplicate users by email was rejected because verified Google email matching an existing active user must link to that user.

## Decision: Keep frontend Google UX safe when backend config is missing

**Rationale**: The frontend calls the backend Google configuration endpoint before rendering the Google entry point. If backend Google config is missing, the UI uses a safe unavailable state and may hide or disable the Google button. It never asks users to type or paste raw OAuth credentials.

**Alternatives considered**: Asking the user for tokens or credentials was rejected by security rules. Always rendering an active Google-looking button was rejected because it creates a broken affordance when the backend provider is not configured.

## Decision: Use Google Identity Services on the frontend and backend verification for authority

**Rationale**: The frontend may use Google Identity Services to obtain a provider-issued `credential`, but backend verification remains authoritative. The frontend sends only that credential to `/auth/google`; the backend verifies audience and claims before creating/linking the OCP user and issuing httpOnly cookies.

**Alternatives considered**: Backend redirect/callback-only OAuth was deferred because the current CRA Auth screen can use Google Identity Services directly. Trusting frontend profile fields was rejected because backend must verify Google identity and must not trust frontend email, name, avatar, provider id, user id, or role.

## Decision: Store frontend Auth state through `AuthProvider` and `useAuth`

**Rationale**: The frontend needs user data available across login, verification, role dashboards, and logout without reading JWTs. `AuthProvider` stores only the safe current-user object returned by backend Auth responses. On page refresh, it rehydrates the state by calling `/auth/me` with cookie credentials.

**Alternatives considered**: Passing user data only through route state was rejected because page refresh loses it. Browser storage was rejected because the project forbids JWT storage and keeping identity in storage would create stale authority risk.

## Decision: Add Auth-only role placeholder dashboards

**Rationale**: After authentication, the frontend should make role-aware navigation visible without implementing out-of-scope business modules. `/learner`, `/mentor`, and `/admin` display safe backend-provided user fields for smoke testing, while backend APIs remain the real authorization authority.

**Alternatives considered**: Redirecting all roles to a blank page was rejected because it made it hard to confirm session and role data. Implementing real Learner, Mentor, or Admin dashboards was rejected as out of scope for Auth.

## Decision: Use approved test setup only

**Rationale**: Backend tests use `node:test`, `assert`, and `supertest`; frontend tests use `node:test` for API client/source-rule checks. This matches `PROJECT_AGENTS.md` and avoids introducing unapproved frameworks.

**Alternatives considered**: Jest, Vitest, Cypress, Playwright, and TypeScript test stacks were rejected unless later approved by a human.

## Decision: Apply `frontend/DESIGN.md` to Auth screens

**Rationale**: Auth screens must follow the project design system: OCP book-logo brand lockup, deep green Auth hero, warm white form canvas, gold/sky accents, warm ink text, rounded-rectangle controls, 6px inputs, 8px buttons, responsive behavior below 768px, and 44px minimum touch targets.

**Alternatives considered**: A generic Bootstrap-only layout, marketing landing page, or unrelated visual system was rejected because the spec makes `frontend/DESIGN.md` binding.
