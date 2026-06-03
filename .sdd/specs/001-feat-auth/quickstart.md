# Quickstart: feat-auth

This quickstart describes how to validate the Auth MVP once implementation tasks are completed. It does not require reading real `.env` values.

## 1. Prepare Environment Files

1. Copy `backend/.env.example` to `backend/.env`.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Fill real values locally. Do not commit or print `.env`.
4. Keep the required local defaults unless intentionally changed:
   - Backend `PORT=5050`
   - Backend `API_PREFIX=/api`
   - Backend `FRONTEND_ORIGIN=http://localhost:3000`
   - Frontend `PORT=3000`
   - Frontend `REACT_APP_API_BASE_URL=http://localhost:5050/api`

## 2. Install Dependencies

```powershell
npm install
npm run install:all
```

## 3. Prepare Database

From `backend/`, run:

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

The database must contain the Auth tables and an active `LEARNER` role before public registration is available.

## 4. Run Tests

```powershell
npm test
```

Expected coverage includes:

- Registration requires `fullName`, `email`, `password`.
- Registration UI validates `confirmPassword` locally and never sends it to backend.
- Registration maps `fullName` to `users.name`.
- Registration assigns backend `LEARNER` role and ignores/rejects role/avatar/image input.
- Pending users do not receive auth cookies before OTP verification.
- Verification OTP enforces expiry, failed-attempt lock, resend cooldown, invalidation of older OTPs, single-use consumption, activation, and auth cookies.
- Local login sets httpOnly cookies and rejects pending, blocked, deleted, unknown, wrong-password, and Google-only users without local password.
- Refresh rotates hashed refresh tokens and logout revokes refresh state.
- Forgot/reset password uses non-enumerating public responses and never creates reset OTPs for unknown, blocked, deleted, or Google-only users.
- Google OAuth is backend verified, links matching active verified email, rejects blocked/deleted users, and never stores raw OAuth tokens.
- Frontend Auth API uses `REACT_APP_API_BASE_URL`, sends credentials, never uses Bearer auth, and never stores JWT in browser storage.
- Frontend Auth Context rehydrates user state through `/auth/me` and routes successful sign-in flows by backend role.

## 5. Run The App

```powershell
npm run dev
```

Expected local URLs:

- Backend API: `http://localhost:5050/api`
- Frontend CRA: `http://localhost:3000`

## 6. Manual Smoke Flow

1. Open the frontend Auth register screen.
2. Register with `fullName`, `email`, `password`, and matching `confirmPassword`.
3. Confirm no logged-in session is granted before OTP verification.
4. Confirm the verification screen shows only the OTP field and does not allow editing a different email.
5. Verify email with the latest six-digit OTP.
6. Confirm the user is active, signed in with httpOnly cookies, and redirected by backend role:
   - `LEARNER` -> `http://localhost:3000/learner`
   - `MENTOR` -> `http://localhost:3000/mentor`
   - `ADMIN` -> `http://localhost:3000/admin`
7. Confirm the role dashboard shows only safe user fields: name, email, role, status, email verified, and local password status.
8. Refresh the browser and confirm `AuthProvider` restores user state by calling `/auth/me` with cookies.
9. Try a mismatched role route, for example open `/admin` while signed in as `LEARNER`, and confirm the frontend redirects back to the user's role dashboard.
10. Logout and confirm cookies are cleared and refresh state is revoked.
11. Request password reset for a local account and confirm the public response is non-enumerating.
12. Use Google sign-in:
   - If backend Google config is missing, confirm the Google entry point is safely hidden or unavailable and no raw credential form appears.
   - If configured, confirm Google Identity Services returns a provider credential, backend verification creates or links the account, cookies are set, and the frontend redirects by backend role.

## 7. Security Checks

- No response contains raw JWT, cookie value, password hash, raw OTP, raw Google token, SMTP credential, SQL error, Prisma raw error, or stack trace.
- No frontend source stores JWT in `localStorage` or `sessionStorage`.
- No frontend source attaches `Authorization: Bearer`.
- Frontend Auth Context stores only the safe user object from backend responses, not JWTs, refresh tokens, cookie values, OTPs, password hashes, or Google tokens.
- CORS uses exact `FRONTEND_ORIGIN` with credentials and never wildcard origin for cookies.
- Cookie settings use `sameSite=lax`, local `secure=false`, and production `secure=true`.

## 8. Auth/User Contract Boundary

- Other modules must consume identity through backend Auth middleware or Auth/User service helpers.
- Controllers and services outside Auth must not parse JWT, read cookies directly, or query Auth-owned tables to decide identity.
- Frontend route state is UX only. Protected backend behavior must use `req.user` from Auth middleware and role checks from backend authority.
- Frontend role dashboards are Auth-only placeholders for validating session and role routing. Real Learner, Mentor, Admin, Course, Payment, Enrollment, Learning, and Report behavior remains separate feature scope.
