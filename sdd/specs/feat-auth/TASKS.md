# TASKS.md - Authentication Feature Implementation Tasks

**Version:** 1.0  
**Feature:** Authentication (Registration, Login, OTP)  
**Owner:** Member A  
**Created:** 2026-06-19  
**Status:** Ready for Implementation

---

## Task Overview

Total: 20 tasks across 6 phases

- Phase 1 (Foundation): 5 tasks - 10h
- Phase 2 (Data Layer): 3 tasks - 8h
- Phase 3 (Services): 2 tasks - 7h
- Phase 4 (API Layer): 4 tasks - 10h
- Phase 5 (Integration): 1 task - 2h
- Phase 6 (Testing): 5 tasks - 11h

**Total Estimated Time**: 48 hours

---

## PHASE 1: FOUNDATION (10 hours)

### T001: Create Error Classes

**Tên**: Implement custom error classes for auth module

**Files**:

- `backend/src/errors/AuthError.js` (new)
- `backend/src/errors/ValidationError.js` (new)
- `backend/src/errors/index.js` (new - export all errors)

**Est. Time**: 2h

**Dependencies**: None

**SPEC Refs**:

- SPEC Section 6 (Error Handling)
- All EARS error patterns

**Description**:
Tạo các custom error classes kế thừa từ Error với structure:

- `AuthError` (base): statusCode, message, code
- `UnauthorizedError` (401): Generic login failures
- `ForbiddenError` (403): Blocked/pending users
- `ConflictError` (409): Duplicate email
- `TooManyRequestsError` (429): OTP rate limit
- `BadRequestError` (400): Invalid OTP/expired
- `EmailServiceError` (500): SMTP failures

**Done Criteria**:

- [ ] Tất cả 7 error classes được implement
- [ ] Mỗi error có statusCode, message, code properties
- [ ] Export centralized từ index.js
- [ ] Có JSDoc comments cho mỗi class

---

### T002: Setup Auth Configuration

**Tên**: Create auth config loader with environment variables

**Files**:

- `backend/src/config/auth.config.js` (new)
- `backend/.env.example` (update - add auth vars)

**Est. Time**: 1.5h

**Dependencies**: None

**SPEC Refs**:

- SPEC Section 4 (Non-functional Requirements)
- PLAN Section 2.3 (Configuration)

**Description**:
Load và validate environment variables:

- AUTH_SECRET (required, min 32 chars)
- COOKIE_ACCESS_NAME, COOKIE_REFRESH_NAME
- COOKIE_SAME_SITE, COOKIE_SECURE
- JWT_ACCESS_EXPIRES_IN (300s), JWT_REFRESH_EXPIRES_IN (604800s)
- BCRYPT_SALT_ROUNDS (default 10)
- OTP_EXPIRY_MINUTES (10), OTP_LOCK_MINUTES (30), OTP_RESEND_COOLDOWN_SECONDS (60)

**Done Criteria**:

- [ ] Config object export tất cả auth constants
- [ ] Throw error nếu required vars missing
- [ ] .env.example documented đầy đủ
- [ ] Default values hợp lý cho optional vars

---

### T003: Implement JWT Utilities

**Tên**: Create JWT generation and verification utilities

**Files**:

- `backend/src/utils/jwt.util.js` (new)

**Est. Time**: 2.5h

**Dependencies**: T002 (auth config)

**SPEC Refs**:

- SPEC Section 3 (Login flow - JWT generation)
- SPEC Section 4 (JWT Clock Skew Leeway 30s)
- PLAN Section 1.2 (Security Patterns)

**Description**:
Implement 4 functions:

1. `generateAccessToken({ userId, role, roleVersion })`: Sign JWT, exp 5 min
2. `generateRefreshToken()`: Random 32-byte hex string (crypto.randomBytes)
3. `verifyAccessToken(token)`: Verify với clockTolerance 30s
4. `hashToken(token)`: SHA-256 hash

**Done Criteria**:

- [ ] Access JWT chứa userId, role, roleVersion
- [ ] Access JWT expires chính xác 5 phút (300s)
- [ ] Refresh token là random string, KHÔNG phải JWT
- [ ] JWT verify có clockTolerance: 30 seconds
- [ ] hashToken dùng crypto SHA-256
- [ ] Unit tests cover all functions

---

### T004: Implement OTP Utilities

**Tên**: Create OTP generation and verification utilities

**Files**:

- `backend/src/utils/otp.util.js` (new)

**Est. Time**: 1.5h

**Dependencies**: None

**SPEC Refs**:

- SPEC Section 3 (Registration - OTP 6 digits)
- SPEC Section 4 (OTP hash SHA-256)

**Description**:
Implement 3 functions:

1. `generateOtp()`: Random 6-digit string (100000-999999)
2. `hashOtp(otp)`: SHA-256 hash
3. `verifyOtp(otp, hash)`: Compare hash(otp) === hash

**Done Criteria**:

- [ ] generateOtp() luôn trả về 6 digits
- [ ] hashOtp() dùng crypto SHA-256
- [ ] verifyOtp() so sánh chính xác
- [ ] Unit tests cover edge cases (000000, 999999)

---

### T005: Implement Response Utilities

**Tên**: Create standardized response helpers

**Files**:

- `backend/src/utils/response.util.js` (new)

**Est. Time**: 2h

**Dependencies**: T001 (error classes)

**SPEC Refs**:

- SPEC Section 6 (Error response format)

**Description**:
Implement 2 helper functions:

1. `successResponse(res, statusCode, message, data)`: Return { success: true, message, data }
2. `errorResponse(res, statusCode, message, code, details)`: Return { success: false, message, code, details }

Plus global error handler middleware:
3. `errorHandler(err, req, res, next)`: Map custom errors to responses

**Done Criteria**:

- [ ] Success response format consistent
- [ ] Error response KHÔNG leak stack traces
- [ ] Error handler map AuthError subclasses đúng HTTP codes
- [ ] Default 500 cho unexpected errors

---

## PHASE 2: DATA LAYER (8 hours)

### T006: Update Prisma Schema

**Tên**: Add/verify auth tables in Prisma schema

**Files**:

- `backend/prisma/schema.prisma` (update)

**Est. Time**: 2h

**Dependencies**: None

**SPEC Refs**:

- SPEC Section 5 (Data Model)
- DATABASE.md (Member A tables)
- PLAN Section 4.4 (Database Migration)

**Description**:
Verify hoặc add 3 models:

1. User: id, email, passwordHash, role, roleVersion, status, timestamps
2. RefreshToken: id, userId, tokenHash, expiresAt, revokedAt, createdAt
3. EmailVerification: id, userId, otpHash, expiresAt, usedAt, failedAttempts, lockedAt, lastSentAt, createdAt

**Done Criteria**:

- [ ] 3 models với đúng fields theo DATABASE.md
- [ ] Enums: Role (ADMIN, LEARNER, MENTOR, MANAGER), UserStatus (active, blocked, pending_verification)
- [ ] Foreign keys đúng (userId references User.id)
- [ ] Indexes: email UNIQUE, tokenHash UNIQUE
- [ ] Default values: roleVersion=1, failedAttempts=0

---

### T007: Generate Database Migration

**Tên**: Create and apply Prisma migration for auth tables

**Files**:

- `backend/prisma/migrations/YYYYMMDD_add_auth_tables/` (new)

**Est. Time**: 1.5h

**Dependencies**: T006 (Prisma schema)

**SPEC Refs**:

- PLAN Section 4.1 Phase 2

**Description**:
Run `prisma migrate dev --name add_auth_tables`:

- Generate migration SQL
- Apply to database
- Verify tables created

**Done Criteria**:

- [ ] Migration file generated thành công
- [ ] 3 tables created trong MySQL
- [ ] Constraints (UNIQUE, FK) applied đúng
- [ ] `prisma generate` chạy thành công (update @prisma/client)

---

### T008: Implement Auth Repository

**Tên**: Create data access layer for auth operations

**Files**:

- `backend/src/repositories/auth.repository.js` (new)

**Est. Time**: 4.5h

**Dependencies**: T006, T007 (Prisma setup)

**SPEC Refs**:

- PLAN Section 2 Component E (Repository Layer)

**Description**:
Implement 12 repository functions:

1. `findUserByEmail(email)`: Query users by email
2. `findUserById(userId)`: Select id, email, status, role, roleVersion
3. `createUser({ email, passwordHash, role, roleVersion, status })`: Insert user
4. `updateUserStatus(userId, status)`: Update users.status
5. `createEmailVerification({ userId, otpHash, expiresAt, lastSentAt })`: Insert OTP
6. `findEmailVerificationByUser(userId, withLock)`: Query with optional FOR UPDATE
7. `updateEmailVerification(id, data)`: Update failed_attempts, locked_at, used_at
8. `resetEmailVerificationAttempts(userId)`: Reset failed_attempts=0, locked_at=NULL
9. `createRefreshToken({ userId, tokenHash, expiresAt })`: Insert refresh token
10. `findRefreshTokenByHash(tokenHash)`: Query + join users
11. `revokeRefreshToken(id)`: Set revoked_at=NOW()
12. `revokeAllUserRefreshTokens(userId)`: Set revoked_at=NOW() for all user tokens

**Done Criteria**:

- [ ] Tất cả 12 functions implemented
- [ ] Dùng Prisma client, KHÔNG raw SQL
- [ ] `findEmailVerificationByUser` support SELECT FOR UPDATE khi withLock=true
- [ ] `findRefreshTokenByHash` join với users table
- [ ] Repository không chứa business logic
- [ ] Có JSDoc cho mỗi function

---

## PHASE 3: SERVICES (7 hours)

### T009: Implement Email Service

**Tên**: Create email sending service with Nodemailer

**Files**:

- `backend/src/services/email.service.js` (new)
- `backend/.env.example` (update - add SMTP vars)

**Est. Time**: 2.5h

**Dependencies**: T002 (config for SMTP settings)

**SPEC Refs**:

- SPEC Section 3 (Registration - gửi OTP email)
- SPEC Section 6 (Email failure rollback)
- PLAN Section 2 Component H (Email Service)

**Description**:
Implement `sendOtpEmail({ email, otp })`:

- Configure Nodemailer transporter với SMTP settings
- Template: "Your OTP is: {otp}. Valid for 10 minutes."
- Subject: "OCP - Email Verification Code"
- Throw EmailServiceError nếu send fails

**Done Criteria**:

- [ ] Nodemailer transporter configured từ env
- [ ] Email template professional
- [ ] Throw EmailServiceError với original error message
- [ ] Test với real SMTP hoặc Ethereal Email (test account)
- [ ] Log email sent events (không log OTP value)

---

### T010: Implement Auth Service (Part 1: Register & Verify)

**Tên**: Create auth service - register and verify OTP functions

**Files**:

- `backend/src/services/auth.service.js` (new - part 1)

**Est. Time**: 4.5h

**Dependencies**: T003 (OTP utils), T008 (repository), T009 (email service)

**SPEC Refs**:

- SPEC Section 3 (Registration & OTP flow)
- SPEC Section 6 (Error handling - OTP lock, resend, concurrent)
- PLAN Section 2 Component D (Service Layer) functions 1-2

**Description**:
Implement 2 functions:

1. `register({ email, password })`:
   - Check duplicate email status='active' → ConflictError
   - Check duplicate status='pending' → reuse user, reset OTP attempts
   - Hash password (bcrypt)
   - Create user (status='pending_verification', role='LEARNER', roleVersion=1)
   - Generate OTP, hash SHA-256
   - Save email_verification
   - Send email (rollback if fail)
   - Return { userId, email }

2. `verifyOtp({ email, otp })`:
   - Start transaction timeout 5s
   - Load user + email_verification với SELECT FOR UPDATE
   - Check user.status==='active' → BadRequestError "Tài khoản đã được xác thực"
   - Check locked_at < 30 min → TooManyRequestsError
   - Check expires_at → BadRequestError "OTP đã hết hạn"
   - Check failed_attempts >= 5 → set locked_at → TooManyRequestsError
   - Verify OTP: wrong → increment failed_attempts → UnauthorizedError
   - Correct → update status='active', used_at=NOW()
   - Return { userId, email, status: 'active' }

**Done Criteria**:

- [ ] Duplicate email logic đúng (active vs pending)
- [ ] Password hashed với bcrypt
- [ ] OTP hash với SHA-256
- [ ] Email failure rollback transaction
- [ ] Transaction timeout 5s
- [ ] SELECT FOR UPDATE prevent race condition
- [ ] OTP lock 30 minutes after 5 failed attempts
- [ ] Reset failed_attempts khi resend OTP (pending user)

---

### T011: Implement Auth Service (Part 2: Login, Refresh, Logout)

**Tên**: Complete auth service with login, refresh token, and logout

**Files**:

- `backend/src/services/auth.service.js` (update - part 2)

**Est. Time**: 4h (split from T010 to keep under 4h)

**Dependencies**: T003 (JWT utils), T008 (repository), T010 (auth service part 1)

**SPEC Refs**:

- SPEC Section 3 (Login, Refresh, Logout flows)
- SPEC Section 6 (Error handling - blocked user, replay attack)
- PLAN Section 2 Component D (Service Layer) functions 3-5

**Description**:
Implement 3 functions:

1. `login({ email, password })`:
   - Load user by email
   - Check exists + password correct (generic error if either fails)
   - Check status: pending → 403, blocked → 403, active → continue
   - Generate Access JWT (userId, role, roleVersion), exp 5 min
   - Generate Refresh Token (32-byte hex)
   - Hash refresh token, save với exp 7 days
   - Return { accessToken, refreshToken, user }

2. `refreshToken({ refreshToken })`:
   - Hash incoming token
   - Load refresh_tokens + join users
   - Check expires_at, revoked_at (replay → revoke ALL)
   - Check users.status (blocked → revoke ALL)
   - Generate NEW Access JWT (roleVersion mới nhất)
   - Generate NEW Refresh Token
   - Revoke old token
   - Save new token
   - Return { accessToken, refreshToken, user }

3. `logout({ refreshToken })`:
   - Hash token
   - Load refresh_tokens record
   - Update revoked_at=NOW()
   - Return { success: true }

**Done Criteria**:

- [ ] Login generic error message "Email hoặc mật khẩu không chính xác"
- [ ] Refresh token rotation (old revoked, new created)
- [ ] Replay attack detection revoke ALL user tokens
- [ ] Blocked user revoke ALL tokens on refresh
- [ ] Logout chỉ revoke token hiện tại (không revoke all)
- [ ] JWT roleVersion lấy từ DB mới nhất

---

## PHASE 4: API LAYER (10 hours)

### T012: Implement Request Validators

**Tên**: Create Zod schemas for request validation

**Files**:

- `backend/src/validators/auth.validator.js` (new)

**Est. Time**: 2.5h

**Dependencies**: None (Zod independent)

**SPEC Refs**:

- SPEC Section 3 (All endpoint requirements)
- PLAN Section 2 Component B (Validation Layer)

**Description**:
Implement 3 Zod schemas + middleware wrappers:

1. `registerSchema`:
   - email: valid format (z.string().email())
   - password: min 8 chars, chữ hoa, chữ thường, số (regex)

2. `verifyOtpSchema`:
   - email: valid format
   - otp: string exactly 6 digits (regex /^\d{6}$/)

3. `loginSchema`:
   - email: valid format
   - password: string min 1 char

Plus: `validate(schema)` middleware wrapper

**Done Criteria**:

- [ ] 3 schemas đúng requirements
- [ ] Password regex: at least 1 uppercase, 1 lowercase, 1 digit
- [ ] OTP regex: exactly 6 digits
- [ ] validate() middleware throw ValidationError với chi tiết
- [ ] Unit tests cho mỗi schema

---

### T013: Implement Auth Middleware

**Tên**: Create JWT verification and authorization middleware

**Files**:

- `backend/src/middlewares/auth.middleware.js` (new)

**Est. Time**: 3h

**Dependencies**: T003 (JWT utils), T008 (repository for DB checks)

**SPEC Refs**:

- SPEC Section 3 (Logout requires auth)
- SPEC Section 4 (JWT verify với clockTolerance)
- PLAN Section 2 Component F (Middleware Layer)

**Description**:
Implement 2 middleware functions:

1. `authMiddleware(req, res, next)`:
   - Extract Access JWT từ cookie (COOKIE_ACCESS_NAME)
   - Missing → UnauthorizedError "Token không hợp lệ"
   - Verify JWT (clockTolerance 30s)
   - Extract payload: userId, role, roleVersion
   - Load users.status + users.role_version từ DB
   - Check status==='active' → if not → ForbiddenError
   - Check role_version match → if not → UnauthorizedError "Session hết hiệu lực"
   - Attach req.user = { userId, email, role, roleVersion }
   - Call next()

2. `requireRole(...allowedRoles)`:
   - Return middleware checking req.user.role in allowedRoles
   - If not → ForbiddenError "Không có quyền truy cập"

**Done Criteria**:

- [ ] Extract JWT từ cookie, KHÔNG từ Authorization header
- [ ] JWT verify có clockTolerance: 30 seconds
- [ ] Check users.status và role_version từ DB
- [ ] req.user attached khi auth success
- [ ] requireRole chainable với authMiddleware

---

### T014: Implement Auth Controllers

**Tên**: Create controller layer for auth endpoints

**Files**:

- `backend/src/controllers/auth.controller.js` (new)

**Est. Time**: 3.5h

**Dependencies**: T010, T011 (auth service), T005 (response utils)

**SPEC Refs**:

- SPEC Section 3 (All endpoint behaviors)
- PLAN Section 2 Component C (Controller Layer)

**Description**:
Implement 5 controller functions:

1. `register(req, res, next)`:
   - Extract { email, password } từ req.body
   - Call authService.register()
   - Return 201 với successResponse

2. `verifyOtp(req, res, next)`:
   - Extract { email, otp } từ req.body
   - Call authService.verifyOtp()
   - Return 200 với successResponse

3. `login(req, res, next)`:
   - Extract { email, password } từ req.body
   - Call authService.login()
   - Set cookies: access_token, refresh_token (httpOnly, secure, sameSite)
   - Return 200 với user info

4. `refreshToken(req, res, next)`:
   - Extract refresh token từ req.cookies[COOKIE_REFRESH_NAME]
   - Call authService.refreshToken()
   - Set NEW cookies
   - Return 200 với user info

5. `logout(req, res, next)`:
   - Extract refresh token từ req.cookies
   - Call authService.logout()
   - Clear cookies (set maxAge=0)
   - Return 200

**Done Criteria**:

- [ ] Controllers thin, KHÔNG chứa business logic
- [ ] Cookies set với httpOnly=true, secure=true, sameSite='Strict'
- [ ] Clear cookies on logout
- [ ] Error handling delegate to error middleware (try-catch → next(err))
- [ ] Response format consistent (successResponse helper)

---

### T015: Create Auth Routes

**Tên**: Define and mount auth API routes

**Files**:

- `backend/src/api/auth.routes.js` (new)

**Est. Time**: 1h

**Dependencies**: T012 (validators), T013 (middleware), T014 (controllers)

**SPEC Refs**:

- SPEC Section 3 (5 endpoints)
- PLAN Section 2 Component A (Route Layer)

**Description**:
Define 5 routes:

1. `POST /auth/register` → validateRegister → authController.register
2. `POST /auth/verify-otp` → validateVerifyOtp → authController.verifyOtp
3. `POST /auth/login` → validateLogin → authController.login
4. `POST /auth/refresh-token` → authController.refreshToken (no auth needed)
5. `POST /auth/logout` → authMiddleware → authController.logout

Export router for mounting.

**Done Criteria**:

- [ ] 5 routes defined đúng methods và paths
- [ ] Validators attached đúng endpoints
- [ ] authMiddleware chỉ dùng cho /logout
- [ ] Router exported để mount vào Express app
- [ ] Có comments mô tả mỗi route

---

## PHASE 5: INTEGRATION (2 hours)

### T016: Wire Up Express App

**Tên**: Mount auth routes and error handler into Express app

**Files**:

- `backend/src/app.js` hoặc `backend/src/index.js` (update - main app file)
- `backend/package.json` (update - verify dependencies)

**Est. Time**: 2h

**Dependencies**: T005 (error handler), T015 (auth routes)

**SPEC Refs**:

- PLAN Section 4.1 Phase 5

**Description**:

- Import cookie-parser middleware
- Mount auth routes: `app.use('/auth', authRoutes)`
- Mount error handler CUỐI CÙNG: `app.use(errorHandler)`
- Verify NPM dependencies installed (bcrypt, jsonwebtoken, zod, cookie-parser, nodemailer)
- Test server starts without errors

**Done Criteria**:

- [ ] cookie-parser middleware added
- [ ] Auth routes mounted tại `/auth`
- [ ] Error handler cuối cùng (sau all routes)
- [ ] NPM dependencies complete (run `npm install`)
- [ ] Server start successfully (`npm start`)
- [ ] 404 handler cho unknown routes

---

## PHASE 6: TESTING & VERIFICATION (11 hours)

### T017: Unit Tests - Utilities & Services

**Tên**: Write unit tests for utils and service layer

**Files**:

- `backend/tests/unit/utils/jwt.util.test.js` (new)
- `backend/tests/unit/utils/otp.util.test.js` (new)
- `backend/tests/unit/services/auth.service.test.js` (new)

**Est. Time**: 4h

**Dependencies**: T003, T004 (utils), T010, T011 (services)

**SPEC Refs**:

- PLAN Section 4.1 Phase 6

**Description**:
Unit tests cho:

1. JWT utils: generateAccessToken, verifyAccessToken, hashToken
2. OTP utils: generateOtp, hashOtp, verifyOtp
3. Auth service: register, verifyOtp, login, refreshToken, logout (mock repository)

**Done Criteria**:

- [ ] JWT utils: test payload structure, expiry, clockTolerance
- [ ] OTP utils: test 6 digits, hash consistency
- [ ] Auth service: test happy paths + error paths
- [ ] Mock repository để isolate service logic
- [ ] Code coverage > 80% cho utils và services
- [ ] Tests pass với `npm test`

---

### T018: Integration Tests - Auth Endpoints

**Tên**: Write integration tests for all auth API endpoints

**Files**:

- `backend/tests/integration/auth.test.js` (new)

**Est. Time**: 4h

**Dependencies**: T016 (full app setup), T017 (test patterns)

**SPEC Refs**:

- SPEC Section 7 (Acceptance Criteria)
- PLAN Section 4.1 Phase 6

**Description**:
Integration tests cho 5 endpoints:

1. POST /auth/register: success, duplicate email, invalid password
2. POST /auth/verify-otp: success, wrong OTP, expired, locked (5 attempts)
3. POST /auth/login: success, wrong password, pending user, blocked user
4. POST /auth/refresh-token: success, expired token, revoked token (replay attack)
5. POST /auth/logout: success

Dùng supertest + real database (test DB).

**Done Criteria**:

- [ ] Test coverage cho tất cả 5 endpoints
- [ ] Test happy path + 2-3 error paths mỗi endpoint
- [ ] Verify cookies set/cleared correctly
- [ ] Verify database state (user status, OTP, tokens)
- [ ] Test concurrent OTP verification (race condition)
- [ ] Tests pass với `npm test`

---

### T019: Security Audit

**Tên**: Verify security requirements and anti-patterns

**Files**:

- `backend/SECURITY_AUDIT.md` (new - audit report)

**Est. Time**: 2h

**Dependencies**: T016 (full implementation)

**SPEC Refs**:

- SPEC Section 4 (Non-functional Requirements)
- SPEC Section 6 (Error Handling anti-patterns)
- PLAN Section 1.2, 1.3, 1.4 (Security Patterns)

**Description**:
Manual checklist audit:

1. ✅ Passwords hashed với bcrypt
2. ✅ OTP hashed với SHA-256
3. ✅ JWT trong httpOnly cookies (KHÔNG localStorage)
4. ✅ Cookie flags: httpOnly=true, secure=true, sameSite='Strict'
5. ✅ JWT clockTolerance 30 seconds
6. ✅ Generic error "Email hoặc mật khẩu không chính xác"
7. ✅ KHÔNG log sensitive data (JWT, OTP, password)
8. ✅ KHÔNG return raw OTP/password/JWT trong response
9. ✅ Refresh token rotation (old revoked)
10. ✅ Replay attack detection (revoke ALL tokens)
11. ✅ OTP lock 30 minutes after 5 fails
12. ✅ Transaction với SELECT FOR UPDATE (race condition)

**Done Criteria**:

- [ ] Tất cả 12 security checks pass
- [ ] SECURITY_AUDIT.md documented đầy đủ
- [ ] Không có anti-patterns từ AGENTS.md
- [ ] Code review checklist completed

---

### T020: Performance & Load Testing

**Tên**: Verify performance requirements and load handling

**Files**:

- `backend/tests/performance/auth.perf.test.js` (new - optional)
- `backend/PERFORMANCE_REPORT.md` (new)

**Est. Time**: 1h (basic performance check)

**Dependencies**: T016 (full implementation)

**SPEC Refs**:

- SPEC Section 4 (Performance < 300ms P95)

**Description**:
Performance validation:

1. Measure /auth/login P95 latency (exclude bcrypt time)
2. Test concurrent OTP verification (10 parallel requests)
3. Test refresh token rotation under load (100 requests)
4. Verify transaction timeout works (5s)

Manual testing hoặc dùng Apache Bench / Artillery.

**Done Criteria**:

- [ ] /auth/login P95 < 300ms (minus bcrypt)
- [ ] Concurrent OTP test không bypass failed_attempts
- [ ] Refresh rotation handle 100 concurrent requests
- [ ] Transaction timeout tested (mock slow DB query)
- [ ] Performance report documented

---

## SUMMARY TABLE

| ID | Task Name | Files | Est. Time | Dependencies | Phase |
|----|-----------|-------|-----------|--------------|-------|
| T001 | Create Error Classes | errors/*.js | 2h | None | 1 |
| T002 | Setup Auth Configuration | config/auth.config.js | 1.5h | None | 1 |
| T003 | Implement JWT Utilities | utils/jwt.util.js | 2.5h | T002 | 1 |
| T004 | Implement OTP Utilities | utils/otp.util.js | 1.5h | None | 1 |
| T005 | Implement Response Utilities | utils/response.util.js | 2h | T001 | 1 |
| T006 | Update Prisma Schema | prisma/schema.prisma | 2h | None | 2 |
| T007 | Generate Database Migration | prisma/migrations/ | 1.5h | T006 | 2 |
| T008 | Implement Auth Repository | repositories/auth.repository.js | 4.5h | T006, T007 | 2 |
| T009 | Implement Email Service | services/email.service.js | 2.5h | T002 | 3 |
| T010 | Auth Service Part 1 (Register, Verify) | services/auth.service.js | 4.5h | T003, T008, T009 | 3 |
| T011 | Auth Service Part 2 (Login, Refresh, Logout) | services/auth.service.js | 4h | T003, T008, T010 | 3 (split) |
| T012 | Implement Request Validators | validators/auth.validator.js | 2.5h | None | 4 |
| T013 | Implement Auth Middleware | middlewares/auth.middleware.js | 3h | T003, T008 | 4 |
| T014 | Implement Auth Controllers | controllers/auth.controller.js | 3.5h | T010, T011, T005 | 4 |
| T015 | Create Auth Routes | api/auth.routes.js | 1h | T012, T013, T014 | 4 |
| T016 | Wire Up Express App | app.js, package.json | 2h | T005, T015 | 5 |
| T017 | Unit Tests - Utils & Services | tests/unit/*.test.js | 4h | T003, T004, T010, T011 | 6 |
| T018 | Integration Tests - Endpoints | tests/integration/auth.test.js | 4h | T016, T017 | 6 |
| T019 | Security Audit | SECURITY_AUDIT.md | 2h | T016 | 6 |
| T020 | Performance Testing | PERFORMANCE_REPORT.md | 1h | T016 | 6 |

**Total**: 20 tasks, 48 hours estimated

---

## IMPLEMENTATION NOTES

### Critical Path

T002 → T003 → T006 → T007 → T008 → T009 → T010 → T011 → T014 → T015 → T016 → T018

### Parallel Opportunities

- T001, T002, T004 có thể làm song song
- T012 có thể làm sớm (independent)
- T017 có thể bắt đầu ngay sau T010, T011

### Risk Mitigations

- T010: Transaction timeout cần test kỹ (Prisma version compatibility)
- T011: Replay attack detection logic phức tạp, cần careful testing
- T018: Concurrent OTP test cần real database, không mock
- T019: Security audit phải 100% pass trước deploy

### Dependencies External

- bcrypt, jsonwebtoken, zod, cookie-parser, nodemailer, @prisma/client
- MySQL database running
- SMTP credentials for email testing (hoặc Ethereal Email)

---

**Status**: Ready for implementation. Bắt đầu từ T001.
