# Implementation Plan: Authentication (feat-auth)

**Version:** 1.0.0 | **Owner:** Member A | **Status:** DRAFT  
**Generated:** 2026-06-18 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy

- **Security-first**: JWT in httpOnly cookies (MANDATORY per CLAUDE.md), NO Bearer tokens for users
- **Backend as Source of Truth**: All auth state (userId, role, roleVersion, status) validated on every protected request
- **Token Rotation Strategy**: Refresh token rotation (revoke old, issue new) on every refresh to prevent reuse attacks
- **Layered Architecture**: Route → Middleware → Controller → Service → Repository (no business logic leakage)

### Key Patterns

1. **httpOnly Cookie Storage**: Prevents XSS token theft; cookies sent automatically by browser with `credentials: include`
2. **Role Versioning (E2.2 Fix)**: JWT includes `roleVersion` from DB; admin role change increments `role_version`, invalidating all existing tokens
3. **Concurrent Safety**: OTP verification uses MySQL `SELECT FOR UPDATE` transaction lock to prevent duplicate `failed_attempts` increments
4. **SHA-256 OTP Hashing**: Fast, sufficient for 10-minute TTL; bcrypt avoided (too slow for high-volume OTP verification)
5. **Stateless Access Token**: No DB lookup on every request (tokens are self-contained); refresh token lookup only during `/auth/refresh-token`

### Why These Choices

- httpOnly cookies: Industry standard for web apps (better XSS protection than localStorage)
- Role versioning: Instant role-based access revocation without waiting for token TTL
- Token rotation: Defends against refresh token replay/reuse attacks
- Transaction locks: Prevents race conditions in concurrent OTP verification scenarios
- Layered architecture: Clear separation of concerns; easier to test and maintain

---

## 2. COMPONENTS

### Backend Module Structure

#### A. Controllers (`auth.controller.js`)

- **POST `/auth/register`**: Accept email + password → delegate to service
- **POST `/auth/verify-otp`**: Accept email + OTP → delegate to service
- **POST `/auth/login`**: Accept email + password → set httpOnly cookies + return user
- **POST `/auth/refresh-token`**: Read refresh token cookie → validate + issue new JWT pair
- **POST `/auth/logout`**: Accept refresh token cookie → revoke from DB + clear cookies

**Responsibility**: Parse request, call service, set response headers/cookies, return response. No business logic.

---

#### B. Services (`auth.service.js`)

- **registerUser(email, password)**: Validate email uniqueness → hash password (bcrypt) → create user (pending_verification) → generate OTP → delegate email send
- **verifyOTP(email, otp)**: Find user + OTP record → check not locked → validate OTP hash → update user status → mark OTP used
- **loginUser(email, password)**: Validate user exists + status active → verify password → generate JWT + refresh token → return tokens + user data
- **refreshToken(oldRefreshTokenHash)**: Validate token exists + not revoked + not expired → read user + roleVersion → generate new JWT + new refresh token → revoke old token
- **logoutUser(refreshTokenHash)**: Mark refresh token revoked in DB

**Responsibility**: Business logic, validation rules, orchestration. Does NOT import Prisma directly.

---

#### C. Repositories (`auth.repository.js`)

- **createUser(userData)**: INSERT user with role=LEARNER, status=pending_verification, role_version=1
- **getUserByEmail(email)**: SELECT user with UNIQUE constraint check
- **createOTPRecord(userId, otpHash, expiresAt)**: INSERT email_verifications
- **getOTPRecord(userId)**: SELECT email_verifications with lock check (SELECT FOR UPDATE in transaction)
- **updateOTPRecord(id, { usedAt, failedAttempts, lockedAt })**: UPDATE based on verification flow
- **createRefreshToken(userId, tokenHash, expiresAt)**: INSERT refresh_tokens
- **getRefreshToken(tokenHash)**: SELECT refresh_tokens by hash
- **revokeRefreshToken(tokenHash)**: UPDATE refresh_tokens SET revoked_at = now()
- **updateUserStatus(userId, status)**: UPDATE users.status
- **getUserById(userId)**: SELECT with role, roleVersion, status

**Responsibility**: ALL Prisma calls. No business logic.

---

#### D. Middleware (`auth.middleware.js`)

- **authMiddleware**: Extract JWT from cookie → verify signature + TTL + roleVersion match → attach user context to request
- **validateRequestBody**: Zod schema validation for email, password, OTP
- **errorHandler**: Catch errors → standardize response format `{ success, message, code, details }`

**Responsibility**: Authentication, validation, error handling. Routes attach these.

---

#### E. Utilities

- **jwtUtils.js**: Sign access token (5 min), sign refresh token (7 days), verify signature
- **passwordUtils.js**: Hash password (bcrypt), verify password (bcrypt compare)
- **otpUtils.js**: Generate 6-digit OTP, hash OTP (SHA-256), verify OTP
- **cookieUtils.js**: Build httpOnly, secure, SameSite='Strict' cookie options
- **errorUtils.js**: Standardize error responses per spec

---

#### F. Validators (`auth.validator.js`)

```javascript
registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
})

verifyOTPSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6).regex(/^\d+$/)
})

loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})
```

---

#### G. Services (Email)

- **emailService.js**: Send OTP via Nodemailer; template for verification email
- **Failure Mode**: If SMTP config missing → send operation fails safely (don't silently succeed)

---

### Frontend Integration

- **API Client** (`frontend/src/api/authApi.js`):
  - `register(email, password)` → POST /auth/register
  - `verifyOTP(email, otp)` → POST /auth/verify-otp
  - `login(email, password)` → POST /auth/login (fetch with `credentials: 'include'`)
  - `refreshAccessToken()` → POST /auth/refresh-token
  - `logout()` → POST /auth/logout
- **Request Headers**: `credentials: 'include'` to send/receive cookies
- **No localStorage**: JWT stored in httpOnly cookie only

---

## 3. DATA FLOW

### 3.1 Registration Flow

```
User Input (email, password)
  ↓
Frontend: POST /auth/register with credentials
  ↓
Middleware: Zod validate email + password format
  ↓
Controller: Extract email, password
  ↓
Service.registerUser():
  - Check email not in `users` table
  - Hash password (bcrypt) → password_hash
  - INSERT users: {email, password_hash, role='LEARNER', status='pending_verification', role_version=1}
  - Generate OTP 6 digits
  - Hash OTP (SHA-256) → otp_hash
  - INSERT email_verifications: {user_id, otp_hash, expires_at=now+10min, last_sent_at=now}
  - Call emailService.sendOTP(email, otp)
    - If SMTP error → throw (fail safely, no silent success)
  ↓
Controller: Return HTTP 201 Created
  - Response: { success: true, message: 'OTP sent to email', code: 'REGISTER_SUCCESS' }
  - NO password_hash, NO raw OTP in response
```

### 3.2 OTP Verification Flow

```
User Input (email, otp)
  ↓
Frontend: POST /auth/verify-otp
  ↓
Middleware: Zod validate email + otp format (6 digits)
  ↓
Service.verifyOTP(email, otp):
  - Get user by email
  - Get OTP record with SELECT FOR UPDATE (transaction lock)
  
  IF OTP locked (locked_at + 30min > now):
    → Return HTTP 429 Too Many Requests
  
  IF OTP expired (expires_at < now):
    → Return HTTP 400 Bad Request
  
  IF OTP already used (used_at NOT NULL):
    → Return HTTP 400 "Account already verified"
  
  Verify OTP hash (compare SHA-256(input_otp) == stored_otp_hash):
    IF mismatch:
      - failed_attempts++
      - IF failed_attempts >= 5:
        - locked_at = now
        - Return HTTP 429
      - ELSE:
        - Return HTTP 401 "OTP incorrect"
    
    IF match:
      - UPDATE users.status = 'active'
      - UPDATE email_verifications.used_at = now
      - Return HTTP 200 OK
  ↓
Controller: Return HTTP 200 with success message
```

### 3.3 Login Flow

```
User Input (email, password)
  ↓
Frontend: POST /auth/login with credentials: 'include'
  ↓
Middleware: Zod validate email + password
  ↓
Service.loginUser(email, password):
  - Get user by email
  
  IF user not found OR password_hash NULL (Google-only user):
    → Return generic error: "Email or password incorrect" (prevent user enumeration)
  
  IF user.status == 'blocked':
    → Return HTTP 403 Forbidden
  
  IF user.status == 'pending_verification':
    → Return HTTP 403 "Please verify email"
  
  Verify password (bcrypt.compare(input_password, user.password_hash)):
    IF mismatch:
      → Return HTTP 401 "Email or password incorrect"
    
    IF match:
      - Generate Access JWT (5 min, contains userId, role, roleVersion)
      - Generate Refresh Token (random string)
      - Hash refresh token (SHA-256) → token_hash
      - INSERT refresh_tokens: {user_id, token_hash, expires_at=now+7days}
      - Return tokens (via Set-Cookie headers)
  ↓
Controller: Set httpOnly cookies (Access + Refresh)
  - Cookie options: HttpOnly=true, Secure=true, SameSite='Strict'
  - Return HTTP 200 with user data (NO password, NO tokens in response body)
```

### 3.4 Refresh Token Flow

```
User Action: Token expiring, auto-refresh
  ↓
Frontend: POST /auth/refresh-token with credentials: 'include' (cookie auto-sent)
  ↓
Middleware: Extract refresh token from cookie
  ↓
Service.refreshToken(oldRefreshTokenHash):
  - Get refresh token record
  
  IF token not found OR revoked_at NOT NULL:
    → Return HTTP 401 Unauthorized
  
  IF expires_at < now:
    → Return HTTP 401 Unauthorized
  
  Get user + current roleVersion
  - Generate NEW Access JWT (roleVersion from DB)
  - Generate NEW Refresh Token
  - Hash new token → new_token_hash
  - INSERT new refresh_tokens record
  - UPDATE old refresh_tokens SET revoked_at = now (revoke old)
  ↓
Controller: Set NEW httpOnly cookies (both tokens)
  - Return HTTP 200 with user data
```

### 3.5 Logout Flow

```
User Action: Logout button clicked
  ↓
Frontend: POST /auth/logout with credentials: 'include'
  ↓
Service.logoutUser(refreshTokenHash):
  - UPDATE refresh_tokens SET revoked_at = now (only this token, not all)
  ↓
Controller: Clear auth cookies (Set-Cookie with Max-Age=0)
  - Return HTTP 200 with success message
```

---

## 4. DEPENDENCIES

### External Libraries

| Package | Purpose | Version | Why |
|---------|---------|---------|-----|
| `jsonwebtoken` | JWT sign/verify | ^9.0.0 | Standard JWT library |
| `bcrypt` | Password hashing | ^5.1.0 | Industry standard, secure |
| `crypto` (Node built-in) | SHA-256 OTP hash | - | Fast, sufficient for OTP |
| `zod` | Request validation | ^3.22.0 | Type-safe schema validation |
| `nodemailer` | Email send | ^6.9.0 | Simple, flexible SMTP |
| `express` | HTTP framework | ^4.18.0 | Already in project |
| `prisma` | ORM | ^5.0.0 | Already in project |

### Internal Dependencies (Module Ownership)

- **Auth Service** (this module): Owns JWT generation, OTP handling, password hashing
- **Email Service**: Called by Auth Service to send OTP emails
- **User DB access**: Only via AuthRepository (no other module queries users table directly)

### Deployment/Runtime

- MySQL 8.0+ with support for `SELECT FOR UPDATE`
- Nodemailer SMTP config (from `.env`)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - If config incomplete: send operation fails (don't silently succeed)
- JWT secrets (from `.env`)
  - `JWT_SECRET` (sign access tokens)
  - `JWT_REFRESH_SECRET` (sign refresh tokens)

---

### Implementation Order (Dependency Graph)

```
1. Validators (auth.validator.js)
   ↓
2. Utils (passwordUtils, jwtUtils, otpUtils, cookieUtils)
   ↓
3. Repository (auth.repository.js)
   ↓
4. Email Service (emailService.js)
   ↓
5. Service (auth.service.js) — imports Repository + Email Service
   ↓
6. Middleware (auth.middleware.js) — imports JWT utils
   ↓
7. Controller (auth.controller.js) — imports Service + Middleware
   ↓
8. Routes (auth.routes.js) — mounts endpoints
   ↓
9. Frontend API Client (authApi.js)
```

---

## 5. RISKS & MITIGATIONS

### Risk 1: Concurrent OTP Verification (HIGH)

**Probability:** High | **Impact:** Prevents brute-force blocking mechanism from working correctly

**Scenario:** 2 requests verify OTP simultaneously → both read `failed_attempts=4` → both increment to 5 → both succeed? Or both fail? Race condition.

**Mitigation:**

- Use MySQL transaction with `SELECT FOR UPDATE` lock on `email_verifications` row
- Only one request can read + update `failed_attempts` at a time
- Implemented in `auth.repository.js` with explicit transaction wrapper

**Code Pattern:**

```javascript
async verifyOTPTransaction(userEmail, inputOTP) {
  return await prisma.$transaction(async (tx) => {
    const otpRecord = await tx.emailVerifications.findUnique({
      where: { userId },
      select: { /* lock row */ }
    })
    // Lock acquired, safe to modify
    // Update failed_attempts, locked_at, etc.
  })
}
```

---

### Risk 2: Refresh Token Reuse Attack (HIGH)

**Probability:** Medium | **Impact:** Attacker gains long-term access if refresh token leaked

**Scenario:** Attacker obtains refresh token from XSS or network intercept → uses it before legitimate user → continues issuing new tokens indefinitely

**Mitigation:**

- Implement token rotation: every `/auth/refresh-token` revokes old token and issues new one
- Old token becomes invalid immediately after new one issued
- If attacker uses old token after rotation, system detects `revoked_at NOT NULL` → 401 Unauthorized
- Legitimate user's token already rotated → no interference

**Business Benefit:** Even if token stolen mid-flight, window of abuse is <5 minutes (access token TTL)

---

### Risk 3: Performance: P95 Response < 300ms (MEDIUM)

**Probability:** Medium | **Impact:** User experience degrades; feels slow

**Scenario:**

- Bcrypt password verification: ~100ms (intentional, slow for security)
- Database queries + Prisma overhead: ~50ms
- JWT signing/verify: ~1ms
- Email send (if attempted sync): ~5000ms ❌ TOO SLOW

**Mitigation:**

- Make email send **async** (fire-and-forget, don't await in happy path)
- Password hashing already optimized (bcrypt default 10 rounds)
- Ensure database has indexes on `email` (UNIQUE), `(user_id, email)` for queries
- Use connection pooling in Prisma

**Measurements Needed:**

- Benchmark `/auth/login` with profiling in development
- Monitor P95 in staging before production

---

### Risk 4: OTP Email Delivery Failure (MEDIUM)

**Probability:** Medium | **Impact:** User can't verify account; blocks registration

**Scenario:**

- Nodemailer SMTP config missing or invalid
- Email service throws error during `emailService.sendOTP()`
- Should we:
  - (a) Fail registration? (SPEC says: fail safely)
  - (b) Generate OTP but skip email? (Silent failure - BAD)
  - (c) Retry with fallback? (Not in MVP scope)

**Mitigation:**

- SPEC requirement: "fail safely, no silent succeed"
- If email send throws → propagate error to controller
- Return HTTP 500 with message "Unable to send OTP. Please try again."
- User can retry `/auth/register` again later
- Log error for ops/monitoring

**Code:**

```javascript
try {
  await emailService.sendOTP(email, otp)
} catch (err) {
  logger.error('OTP send failed', { email, err })
  throw new AppError('Unable to send OTP', 500)
}
```

---

### Risk 5: Role Version Sync (LOW)

**Probability:** Low | **Impact:** User sees outdated role in JWT if admin changes role mid-request

**Scenario:**

- User logged in, has valid JWT with `roleVersion=1, role=LEARNER`
- Admin changes user role → `role=MENTOR, role_version=2`
- User's old JWT still has `roleVersion=1`
- Middleware checks `JWT.roleVersion (1) == DB.role_version (2)` → MISMATCH → 401 Unauthorized
- User forced to logout and login (get new JWT with roleVersion=2)

**Mitigation:**

- Already mitigated by spec (middleware validates roleVersion on every request)
- User experience: transparent (1-2 second delay as token expires and auto-refreshes)
- No data corruption risk

---

## 6. QUESTIONS FOR HUMAN

### Q1: Nodemailer SMTP Configuration

**Question:** What is the Nodemailer SMTP configuration in `.env`?

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`?
- Is this configured for development (fake/console output) or production SMTP server?
- If missing → should OTP registration fail or return mock OTP for testing?

**Why:** OTP email is critical path; need to know if it's available before implementation.

**Spec Reference:** Section 8, Out of Scope: "Không gửi SMS OTP (chỉ qua Email mô phỏng/Nodemailer)"

---

### Q2: JWT Secret Management

**Question:** Where are `JWT_SECRET` and `JWT_REFRESH_SECRET` stored?

- In `.env` file (development)?
- In AWS Secrets Manager / HashiCorp Vault (production)?
- How are they rotated?
- Are they different for access vs. refresh tokens?

**Why:** Security-critical; need to ensure secrets are not committed to git.

---

### Q3: Cookie Secure Attribute in Development

**Question:** In development (localhost), should cookies have `Secure=true`?

- If yes → HTTP requests will ignore cookies (must use HTTPS even locally)
- If no → cookies work over HTTP but less secure
- How is this configured per environment?

**Why:** Development experience (local testing) vs. production security trade-off.

---

### Q4: OTP Resend Rate Limit

**Question:** Is 60-second resend cooldown (`last_sent_at < 60s`) enforced per user or per OTP record?

- Per user (one email address can't request new OTP within 60s)?
- Per session (only this OTP record)?

**Spec** mentions it but doesn't clarify scope.

**Why:** Affects spam prevention strategy.

---

### Q5: Refresh Token TTL Exactness

**Question:** Spec says "7 ngày" for refresh token TTL. Is this exact?

- 7 *24* 60 * 60 = 604800 seconds?
- Or "approximately 7 days" (could be 7-8 days)?
- Does user get a 7-day countdown from login, or from last refresh?

**Why:** Affects user session expiration UX and token rotation strategy.

---

### Q6: Email Already Verified + Register Again

**Question:** Spec Section 6 says:
"WHERE Guest đăng ký (`/auth/register`) với email đã tồn tại NHƯNG `status = 'pending_verification'`, **THE hệ thống SHALL** tạo OTP mới..."

What if user registers with email already `status='active'` (already verified)?

- (a) Reject with "Email already in use"?
- (b) Create new user (duplicate)?
- (c) Return success but don't create user?

**Why:** Edge case for UX and data integrity.

---

**These questions should be answered before implementation begins to avoid rework.**

---

## Sign-Off

**Plan Owner:** Member A (Auth Module)  
**Reviewed By:** [PENDING HUMAN REVIEW]  
**Approved On:** [PENDING]  
**Next Step:** Human approval → implement tasks.md
