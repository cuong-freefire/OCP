# Implementation Plan: feat-auth

**Branch**: `002-feat-auth` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.sdd/specs/001-auth/spec.md`

## Summary

Build the OCP Auth MVP as a cookie-based, backend-authoritative identity system for learner registration, email OTP verification, local login, refresh/logout, current-user/profile read, password reset by OTP, Google OAuth login/linking, in-app set-password for Google-only users, role-aware authorization, CRA Auth screens, global frontend Auth Context, and Auth-only role placeholder dashboards. The implementation uses the required layered backend architecture and a frontend API client that sends cookies with credentials. No payment, enrollment, course, learning, mentor review, admin management, report, or profile-image upload behavior is included.

## Technical Context

**Language/Version**: NodeJS with JavaScript ESM for backend; React JSX with Create React App for frontend.

**Primary Dependencies**: Express-style REST API, Prisma, MySQL, Zod, bcrypt, JWT cookie/session utilities, cookie parser, CORS middleware, Nodemailer SMTP, Google OAuth verification support, React, Bootstrap, `react-scripts`, and a frontend API client using credentialed requests.

**Storage**: MySQL via Prisma. Auth-owned tables are `roles`, `users`, `refresh_tokens`, `email_verifications`, `password_reset_tokens`, and `oauth_accounts`.

**Testing**: Backend uses `node:test`, `assert`, and `supertest`. Frontend uses `node:test` for API client and source-rule tests. No Jest, Vitest, Cypress, Vite, Next.js, TypeScript, or CommonJS conversion is planned.

**Target Platform**: Local development with backend on `PORT=5050` and CRA frontend on `PORT=3000`; production-compatible cookie secure flag and exact-origin CORS controlled by env.

**Project Type**: Full-stack web application plus REST API.

**Performance Goals**: Normal registration, email verification, and automatic sign-in should be completable in under 3 minutes when email delivery is available. Auth API operations should avoid extra cross-module database queries and keep token/OTP checks scoped to indexed Auth tables.

**Constraints**: JWT is stored only in httpOnly cookies named by `COOKIE_ACCESS_NAME` and `COOKIE_REFRESH_NAME`; backend reads tokens from `req.cookies`; frontend uses `withCredentials: true`; no Bearer auth; no browser JWT storage; no raw password, OTP, JWT, refresh token, Google token, SMTP credential, or secret logging; requests are validated with Zod; errors use `{ success, message, code, details }`; services do not import Prisma; repositories own database access.

**Scale/Scope**: Auth MVP only. Six user stories, eleven primary Auth API behaviors, six Auth-owned database entities, and Auth frontend screens for register, verify, login, forgot/reset password, Google availability/login state, set-password, current session awareness, Auth Context rehydration, and role-specific placeholder dashboards.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The checked-in `.specify/memory/constitution.md` still contains placeholder principle text, so there are no concrete constitution-specific gates to evaluate. Binding project gates from `AGENTS.md`, `PROJECT_AGENTS.md`, `DATABASE.md`, and the generated spec are applied instead:

- **Stack gate**: PASS. Plan keeps NodeJS JavaScript ESM, Express-style REST, React JSX, Bootstrap, CRA, MySQL, Prisma, JWT httpOnly Cookie, bcrypt, Zod, VNPAY separation, and npm.
- **Layering gate**: PASS. Routes/controllers delegate to services; services delegate to repositories; only repositories import Prisma.
- **Auth authority gate**: PASS. Backend owns identity, role, account status, session validity, Google verification, OTP state, refresh rotation, and authorization.
- **Secret safety gate**: PASS. Plan uses only env variable names and `.env.example` contracts. Real `.env` values are not read or emitted.
- **Validation/error gate**: PASS. Important body/query/params are validated with Zod and errors use the project response shape without raw infrastructure details.
- **Frontend gate**: PASS. Frontend calls go through `frontend/src/api`, use `REACT_APP_API_BASE_URL`, send credentials, avoid Bearer/localStorage/sessionStorage JWT, and follow `frontend/DESIGN.md`.
- **Scope gate**: PASS. No payment, enrollment, course, learning, mentor review, admin management, report, or profile-image upload implementation is included. Role dashboard pages are Auth-only placeholders that display backend-provided safe user fields.

## Project Structure

### Documentation (this feature)

```text
.sdd/specs/001-auth/
├── context.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── api/
│   │   └── auth.routes.js
│   ├── config/
│   │   ├── auth.config.js
│   │   ├── cors.config.js
│   │   └── prisma.config.js
│   ├── controllers/
│   │   └── auth.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validation.middleware.js
│   ├── repositories/
│   │   └── auth.repository.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── email.service.js
│   │   ├── googleAuth.service.js
│   │   └── token.service.js
│   ├── utils/
│   │   ├── crypto.util.js
│   │   ├── email.util.js
│   │   └── response.util.js
│   ├── validators/
│   │   └── auth.validator.js
│   ├── app.js
│   └── server.js
└── tests/
    ├── auth/
    ├── fixtures/
    └── helpers/

frontend/
├── package.json
├── public/
│   └── index.html
├── src/
│   ├── api/
│   │   └── authApi.js
│   ├── components/
│   │   └── auth/
│   ├── hooks/
│   │   └── useAuth.js
│   ├── pages/
│   │   ├── auth/
│   │   ├── HomePage.jsx
│   │   └── RoleDashboardPage.jsx
│   ├── routes/
│   │   ├── AuthRoutes.jsx
│   │   └── ProtectedRoute.jsx
│   ├── utils/
│   │   └── authStorageRules.js
│   ├── App.jsx
│   └── index.js
└── tests/
    └── auth/
```

**Structure Decision**: Use the required two-application OCP structure: `backend` for the REST API and Prisma access, `frontend` for CRA Auth screens and credentialed API calls. The current source directories are not scaffolded yet, so setup tasks will create them before user-story implementation.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md). No `NEEDS CLARIFICATION` items remain for planning.

## Phase 1: Design And Contracts

Design artifacts generated for implementation:

- [data-model.md](./data-model.md)
- [contracts/auth-api.openapi.yaml](./contracts/auth-api.openapi.yaml)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Stack gate**: PASS after design. Contracts and data model stay within NodeJS, CRA, Prisma, MySQL, npm, and approved test setup.
- **Layering gate**: PASS after design. API contracts map to route/controller/service/repository responsibilities.
- **Auth authority gate**: PASS after design. No frontend-controlled role/userId/status/access/payment fields are accepted as authority.
- **Secret safety gate**: PASS after design. Data model stores only hashed/proof values for password, OTP, refresh tokens, and no raw Google OAuth tokens.
- **Frontend gate**: PASS after design. Frontend contract uses cookie credentials, global `AuthProvider`/`useAuth` state sourced from `/auth/me`, role-aware placeholder navigation, and design constraints from `frontend/DESIGN.md`.

## Complexity Tracking

No constitution or project-rule violations require justification.
