# PROJECT_AGENTS.md - feat-auth
# Version: 1.0 | Updated: 2026-06-02 | Scope: .sdd/specs/001-auth

This file is the feature-local memory for the OCP Auth feature. It complements the root `PROJECT_AGENTS.md` and applies only to `feat-auth`.

Global project rules still apply. If this file conflicts with `AGENTS.md`, root `PROJECT_AGENTS.md`, `DATABASE.md`, or the generated Auth spec, stop and report the conflict before editing.

---

## TL;DR

> Feature: Auth MVP
> Backend authority: identity, role, account status, session validity
> Session: JWT access + refresh tokens in httpOnly cookies
> Local auth: bcrypt password + email OTP verification
> Password reset: email OTP for eligible local accounts only
> Google: frontend Google Identity Services credential, backend verification
> Frontend state: `AuthProvider` + `useAuth`, rehydrated through `/auth/me`
> Role placeholders: `/learner`, `/mentor`, `/admin`

Read first for Auth work:

1. `AGENTS.md`
2. root `PROJECT_AGENTS.md`
3. `DATABASE.md`
4. `.sdd/specs/001-auth/PROJECT_AGENTS.md`
5. `.sdd/specs/001-auth/context.md`
6. `.sdd/specs/001-auth/spec.md`
7. `.sdd/specs/001-auth/plan.md`
8. `.sdd/specs/001-auth/tasks.md`
9. `.sdd/specs/001-auth/contracts/auth-api.openapi.yaml`
10. `frontend/DESIGN.md`

---

## Auth Scope

In scope:

- Local learner registration.
- Email verification by six-digit OTP.
- Resend verification cooldown.
- Local login.
- Refresh-token rotation.
- Logout and cookie clearing.
- Current user/profile safe read.
- Forgot/reset password by email OTP for local accounts.
- Google login/linking through backend verification.
- Authenticated set-password for Google-only users.
- Backend role middleware and protected behavior support.
- Frontend Auth screens and API client.
- Frontend Auth Context and role-aware placeholder dashboards.

Out of scope:

- Payment checkout and VNPAY verification.
- Enrollment creation and course access unlock.
- Course CRUD/content.
- Learning progress, quizzes, final project.
- Mentor review behavior.
- Admin management and report business dashboards.
- Profile image upload/update.

Role placeholder dashboards are allowed only to validate Auth session/role routing and safe current-user display.

---

## Current Source Shape

Backend Auth source:

```text
backend/src/api/auth.routes.js
backend/src/controllers/auth.controller.js
backend/src/services/auth.service.js
backend/src/services/token.service.js
backend/src/services/email.service.js
backend/src/services/googleAuth.service.js
backend/src/repositories/auth.repository.js
backend/src/middlewares/auth.middleware.js
backend/src/middlewares/validation.middleware.js
backend/src/middlewares/error.middleware.js
backend/src/validators/auth.validator.js
backend/src/config/auth.config.js
backend/src/config/cors.config.js
backend/src/config/prisma.config.js
backend/src/utils/
```

Frontend Auth source:

```text
frontend/src/api/authApi.js
frontend/src/hooks/useAuth.js
frontend/src/routes/AuthRoutes.jsx
frontend/src/routes/ProtectedRoute.jsx
frontend/src/pages/HomePage.jsx
frontend/src/pages/RoleDashboardPage.jsx
frontend/src/pages/auth/
frontend/src/components/auth/
frontend/src/utils/
```

Prisma/Auth database:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/202606020001_auth_init/
backend/prisma/seed.js
```

---

## Backend Auth Architecture

Auth request flow:

```text
Auth route
  -> Zod validation
  -> auth middleware when protected
  -> controller
  -> auth service
  -> auth repository / email service / token service / Google auth service
  -> Prisma/MySQL
```

Rules:

- Controller delegates to service and returns standard response.
- Service owns business rules and does not import Prisma.
- Repository is the database access layer and may import Prisma.
- Token service sets and clears httpOnly cookies.
- Email service uses Nodemailer SMTP and fails safely when unavailable.
- Google auth service verifies Google credentials and does not store raw tokens.

---

## Auth API Endpoints

Current Auth route style:

```text
POST /api/auth/register
POST /api/auth/verify-email
POST /api/auth/resend-verification
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/google/config
POST /api/auth/google
POST /api/auth/set-password
```

All responses must use the standard shape or approved response helper. No response may include raw JWT, cookie value, password hash, raw OTP, Google token, SMTP secret, SQL error, Prisma raw error, or stack trace.

---

## Session And Cookie Rules

1. Access and refresh tokens are stored only in httpOnly cookies.
2. Backend reads tokens from `req.cookies`.
3. Frontend sends requests with `credentials: 'include'`.
4. Frontend never stores JWT in browser storage.
5. Frontend never attaches Bearer tokens.
6. Access token default expiry is 15 minutes.
7. Refresh token default expiry is 7 days.
8. Refresh token records store only hashed token proofs.
9. Refresh rotates token and revokes the previous refresh token.
10. Logout revokes active refresh token and clears cookies.

Cookie defaults:

```text
access cookie: ocp_access_token
refresh cookie: ocp_refresh_token
sameSite: lax
local secure: false
production secure: true
```

If deployment requires `SameSite=None` or cross-site cookies, add CSRF protection before state-changing Auth behavior ships.

---

## Local Registration Rules

Backend registration contract:

```json
{
  "fullName": "Learner Name",
  "email": "learner@example.com",
  "password": "secret-password"
}
```

Frontend registration UI:

- Has `confirmPassword`.
- Validates password match locally.
- Never sends `confirmPassword` to backend.

Rules:

1. `fullName` maps to `users.name`.
2. Backend assigns active `LEARNER` role from `roles.code = "LEARNER"`.
3. Frontend must not send or decide role.
4. Registration must reject/ignore role, user id, avatar, image, avatar URL, and profile picture upload.
5. New local user starts as `pending_verification`.
6. Pending local user receives no auth cookies until email OTP verification succeeds.
7. Public registration may leave user avatar unset.

---

## Email Verification Rules

1. Verification uses six-digit OTP.
2. OTP expires after 10 minutes.
3. OTP allows at most 5 failed attempts.
4. Resend cooldown is 60 seconds.
5. Resend invalidates previous unused OTPs.
6. Store only OTP proof/hash.
7. Successful verification activates the user, marks email verified, consumes OTP, and sets auth cookies.
8. Frontend verify page must preserve the registration email from route state and render only the OTP input.
9. If verify page is opened without registration email state, redirect the user back to register.

---

## Login And Current User Rules

Local login requires:

- Existing user.
- Active status.
- Not soft-deleted.
- Email verified.
- Local password hash exists.
- Password matches bcrypt hash.

Login rejects pending, blocked, deleted, unknown, wrong-password, and Google-only-without-password users without leaking sensitive account details.

`/auth/me` returns safe user data only:

```text
id
name
email
avatarUrl
role
status
emailVerified
hasLocalPassword
```

---

## Password Reset Rules

1. Public forgot/reset password is only for local accounts with `password_hash`.
2. Backend must not create reset OTP for unknown email.
3. Backend must not create reset OTP for blocked/deleted users.
4. Backend must not create reset OTP for Google-only users with `password_hash = NULL`.
5. Public forgot-password response must be non-enumerating.
6. Reset OTP is six digits.
7. Reset OTP expires after 10 minutes.
8. Reset OTP allows at most 5 failed attempts.
9. Reset resend cooldown is 60 seconds.
10. Resend invalidates previous unused reset OTPs.
11. Successful reset consumes OTP and updates bcrypt password hash.
12. Google-only users create first local password only through authenticated in-app set-password.

---

## Google OAuth Rules

1. Frontend uses Google Identity Services when backend config is available.
2. Frontend obtains provider `credential` and sends it to `/api/auth/google`.
3. Backend verifies the credential before creating/linking user or issuing cookies.
4. Frontend must not ask users to type or paste raw OAuth credentials.
5. Missing Google config uses safe unavailable UX and may hide or disable the Google entry point.
6. Backend must not trust frontend email, name, avatar, provider user id, role, user id, or account status.
7. Link by `oauth_accounts.provider = GOOGLE` and Google `sub`.
8. Verified Google email matching an existing active OCP user links to that user.
9. New verified Google user creates active email-verified learner.
10. Blocked or soft-deleted users are rejected.
11. Do not store raw Google `id_token`, `access_token`, or `refresh_token`.

---

## Frontend Auth State And Routing

Global Auth state:

```text
AuthProvider
  -> calls /auth/me on app load
  -> stores safe user object in React state
  -> exposes useAuth()
```

`useAuth()` exposes:

```text
user
loading
authenticated
reload
login
verifyEmail
loginWithGoogleCredential
logout
```

State rules:

- Context stores safe user data only.
- Context does not store JWT, refresh token, cookie values, OTPs, password hashes, or Google tokens.
- On page refresh, context rehydrates from `/auth/me`; browser sends httpOnly cookies automatically.
- Context is UX state, not real authorization authority.

Role routing after successful login, email verification, or Google login:

```text
LEARNER -> /learner
MENTOR  -> /mentor
ADMIN   -> /admin
unknown -> /auth/me
```

Role dashboards:

- `/learner`
- `/mentor`
- `/admin`

They are Auth-only placeholders that display safe current-user fields. They must not implement business dashboards, course access, mentor review, admin management, or reports.

---

## Frontend Auth UX Rules

Auth layout:

- Left hero uses OCP logo/brand lockup and learning-focused copy.
- Right panel is form-first.
- Follow `frontend/DESIGN.md` current Auth UI contract.

Login page:

- Email field.
- Password field.
- `Quen mat khau?` / localized equivalent below password.
- Primary login button.
- Google button when configured.
- Footer link to register.

Register page:

- Full name.
- Email.
- Password.
- Confirm password.
- Footer link to login.

Verify page:

- OTP input only.
- No editable email field.
- Resend verification action.

Validation and messages:

- Auth forms validate with frontend Zod schemas before API calls.
- Auth forms use `noValidate` and do not rely on browser-native `required` validation copy.
- Validation, success, and recoverable API error feedback is shown through React Toastify.
- Toast copy is concise, professional Vietnamese.
- Frontend may map backend `code` values to Vietnamese UX copy without changing backend response contracts.
- Verification resend and password-reset resend actions show a 60-second countdown and disable the resend action while cooldown is active.

After successful Auth:

- Route by backend role.
- Show safe current-user fields on placeholder dashboard.

---

## Environment Contract

Backend Auth variables:

```text
PORT
API_PREFIX
FRONTEND_ORIGIN
DATABASE_URL
AUTH_SECRET
COOKIE_ACCESS_NAME
COOKIE_REFRESH_NAME
COOKIE_SAME_SITE
COOKIE_SECURE
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN
BCRYPT_SALT_ROUNDS
EMAIL_OTP_EXPIRES_MINUTES
EMAIL_OTP_MAX_FAILED_ATTEMPTS
EMAIL_OTP_RESEND_COOLDOWN_SECONDS
RESET_OTP_EXPIRES_MINUTES
RESET_OTP_MAX_FAILED_ATTEMPTS
RESET_OTP_RESEND_COOLDOWN_SECONDS
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM_NAME
SMTP_FROM_EMAIL
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
```

Frontend Auth variables:

```text
PORT
REACT_APP_API_BASE_URL
```

Do not read, print, or commit real `.env` values.

---

## Auth-Owned Tables

| Table | Purpose |
| --- | --- |
| `roles` | Backend-controlled role lookup |
| `users` | Identity, email, password hash, role, status, verification state |
| `refresh_tokens` | Hashed refresh token proofs and revocation state |
| `email_verifications` | Email verification OTP proofs |
| `password_reset_tokens` | Password reset OTP proofs |
| `oauth_accounts` | Google account mapping |

No module outside Auth should directly decide identity by querying these tables. Use Auth/User contracts or middleware.

---

## Tests To Preserve

Backend Auth tests should cover:

- Registration pending state and learner role.
- Registration rejection of frontend role/avatar authority fields.
- OTP verification activation, lockout, resend invalidation, expiry, and cookies.
- Login cookies and safe user projection.
- Login rejection for wrong password, pending, blocked, deleted, Google-only.
- Refresh rotation and logout revocation.
- Forgot/reset non-enumerating response and OTP rules.
- Google config, login, linking, blocked rejection, and no raw token persistence.
- Role authorization and auth middleware behavior.
- Secret leakage protections.

Frontend Auth tests should cover:

- API client uses `credentials: 'include'`.
- CRA env contract uses `REACT_APP_API_BASE_URL`.
- No JWT browser storage.
- No Bearer auth.
- Register confirm password is frontend-only.
- Verify email has no editable email input.
- Auth Context and role dashboard routing.
- Google Identity Services credential flow and no raw credential prompt.
- Full-width Google button layout.
- OCP Auth hero/logo/design contract.
- Frontend Zod form validation with browser-native validation disabled.
- React Toastify messages with concise Vietnamese Auth UX copy.
- Verification and reset-code resend countdown display during cooldown.

---

## Commands

Install:

```powershell
npm install
npm run install:all
```

Prepare backend database:

```powershell
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Run apps separately:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Verify:

```powershell
npm test
npm run build
```

---

## Non-Negotiable Auth Rules

```text
No Bearer auth.
No JWT browser storage.
No raw OTP storage.
No raw refresh token storage.
No raw Google token storage.
No Prisma imports in service/controller.
No frontend-decided role/userId/account status.
No registration avatar upload.
No false email success when SMTP is missing.
No real Learner/Mentor/Admin business feature implementation inside Auth placeholders.
```
