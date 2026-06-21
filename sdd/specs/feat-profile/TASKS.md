# TASKS.md — Feature: User Profile (feat-profile)

**Version:** 1.0.0 | **Owner:** Member A | **Generated:** 2026-06-19  
**Total Estimate:** 20.5 hours | **Tasks:** 10

---

## Task Overview

| ID | Task Name | Files | Est (h) | Dependencies | SPEC Refs | Status |
|----|-----------|-------|---------|--------------|-----------|--------|
| T001 | Verify Prisma schema has name + avatar_url fields | `backend/prisma/schema.prisma` | 0.5 | None | Section 5 | ⬜ TODO |
| T002 | Create profile repository layer | `backend/src/repositories/profile.repository.js` | 2 | T001 | Section 3 | ⬜ TODO |
| T003 | Create profile service layer | `backend/src/services/profile.service.js` | 3 | T002 | Section 3, 4, 6 | ⬜ TODO |
| T004 | Create profile validator with Zod | `backend/src/validators/profile.validator.js` | 2 | None | Section 3, 4, 6 | ⬜ TODO |
| T005 | Create profile controller | `backend/src/controllers/profile.controller.js` | 1.5 | T003 | Section 3 | ⬜ TODO |
| T006 | Create profile routes | `backend/src/api/profile.routes.js` | 1 | T004, T005 | Section 3, 4 | ⬜ TODO |
| T007 | Wire profile routes into Express app | `backend/src/app.js` or `backend/src/index.js` | 0.5 | T006 | Section 3 | ⬜ TODO |
| T008 | Write unit tests for service layer | `backend/tests/unit/profile.service.test.js` | 3 | T003 | Section 3, 6, 7 | ⬜ TODO |
| T009 | Write integration tests for endpoints | `backend/tests/integration/profile.test.js` | 4 | T007 | Section 3, 6, 7 | ⬜ TODO |
| T010 | Write security penetration tests | `backend/tests/security/profile.security.test.js` | 3 | T009 | Section 4, 6, 7 | ⬜ TODO |

---

## Detailed Task Descriptions

### T001: Verify Prisma Schema Has Name + Avatar_url Fields

**Estimated Time:** 0.5 hours  
**Dependencies:** None  
**SPEC References:** Section 5 (Data Model)

**Files to Check/Edit:**
- `backend/prisma/schema.prisma` (read-only verification)

**Description:**
Verify users table schema includes `name` and `avatar_url` fields per DATABASE.md update 2026-06-19.

**Implementation Steps:**
1. Run `npx prisma db pull` to sync schema from MySQL database
2. Open `backend/prisma/schema.prisma`
3. Confirm users model contains:
   - `name String? @db.VarChar(255)`
   - `avatar_url String? @db.VarChar(500)`
4. If missing, check DATABASE.md assumptions section - may need migration

**Done Criteria:**
- [ ] `npx prisma db pull` executed successfully
- [ ] `schema.prisma` users model has both fields with correct types
- [ ] Fields are nullable (optional)
- [ ] No migration needed (fields already exist in DB)

**SPEC Acceptance Criteria Mapping:** Section 5 assumption verification

---

### T002: Create Profile Repository Layer

**Estimated Time:** 2 hours  
**Dependencies:** T001 (schema verified)  
**SPEC References:** Section 3 (Get Profile, Update Profile)

**Files to Create:**
- `backend/src/repositories/profile.repository.js`

**Description:**
Implement data access layer với Prisma client. Owns ALL database queries cho profile feature.

**Functions to Implement:**

1. **`findById(userId)`**
   - Input: `userId` (string UUID)
   - Query: `prisma.users.findUnique({ where: { id: userId } })`
   - Timeout: 5 seconds (Prisma client config)
   - Return: User object hoặc null
   - Error handling: Catch Prisma timeout → throw TimeoutError

2. **`update(userId, data)`**
   - Input: `userId` (string), `data` (object with name/avatar_url)
   - Query: `prisma.users.update({ where: { id: userId }, data })`
   - Timeout: 5 seconds
   - Return: Updated user object
   - Error handling: 
     - `RecordNotFound` → throw NotFoundError
     - Timeout → throw TimeoutError

**Done Criteria:**
- [ ] File created với ESM export syntax
- [ ] Both functions implemented với Prisma client
- [ ] Query timeout configured (5s per SPEC.md Section 6)
- [ ] Error classes imported (NotFoundError, TimeoutError)
- [ ] Manual test với mock Prisma returns expected data
- [ ] No business logic in repository (pure data access)

**SPEC Acceptance Criteria Mapping:** Enables Section 7 item 1 & 2

---

### T003: Create Profile Service Layer

**Estimated Time:** 3 hours  
**Dependencies:** T002 (repository exists)  
**SPEC References:** Section 3 (Functional Requirements), Section 4 (Security), Section 6 (Error Handling)

**Files to Create:**
- `backend/src/services/profile.service.js`

**Description:**
Implement business logic layer. Owns field whitelisting, ownership validation, data normalization.

**Functions to Implement:**

1. **`getProfile(userId)`**
   - Input: `userId` (from req.user.id)
   - Call: `profileRepository.findById(userId)`
   - Filter: Remove `password_hash`, `role_version` từ response
   - Return: `{ id, email, name, avatar_url, role, status }`
   - Error: If user not found → throw NotFoundError (unlikely - JWT verified)

2. **`updateProfile(userId, data)`**
   - Input: `userId`, `data` (validated object)
   - **Whitelist check:** Only allow `name`, `avatar_url` keys (hardcoded)
   - **Normalize empty avatar:** If `avatar_url === ""`, convert to `null`
   - **Ownership validation:** If `avatar_url` provided and not null:
     ```javascript
     if (!avatar_url.startsWith("https://res.cloudinary.com/")) {
       throw new ValidationError("URL ảnh đại diện không hợp lệ");
     }
     if (!avatar_url.includes(`/${userId}/`) && !avatar_url.includes(`/${userId}.`)) {
       throw new ForbiddenError("URL không thuộc quyền sở hữu của bạn");
     }
     ```
   - Call: `profileRepository.update(userId, cleanedData)`
   - Return: Call `getProfile(userId)` to fetch fresh data

**Done Criteria:**
- [ ] File created với function exports
- [ ] `getProfile` filters sensitive fields correctly
- [ ] `updateProfile` whitelist enforcement (reject extra keys)
- [ ] Empty string normalization works (`avatar_url=""` → `null`)
- [ ] Cloudinary domain validation implemented
- [ ] userId ownership check in URL path implemented
- [ ] Error classes used correctly (ValidationError, ForbiddenError)
- [ ] Repository dependency injected (import from repository file)
- [ ] Unit tests pass (T008 will verify)

**SPEC Acceptance Criteria Mapping:**
- Section 7 item 1: GET returns correct fields, no password_hash
- Section 7 item 2: PUT only updates name + avatar_url

---

### T004: Create Profile Validator with Zod

**Estimated Time:** 2 hours  
**Dependencies:** None (independent of service/repository)  
**SPEC References:** Section 3 (Update Profile), Section 4 (XSS Prevention), Section 6 (Error Handling)

**Files to Create:**
- `backend/src/validators/profile.validator.js`

**Description:**
Zod schema validation middleware cho PUT /profile/me request body. Fail-fast validation trước controller.

**Schema to Implement:**

```javascript
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name không được rỗng").max(255).regex(/^[^<>]+$/, {
    message: "Name không được chứa ký tự < hoặc >"
  }).optional(),
  avatar_url: z.string().url("Avatar URL phải là URL hợp lệ").max(500).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "Body rỗng - phải có ít nhất 1 field"
}).refine(data => {
  const allowedKeys = ["name", "avatar_url"];
  const extraKeys = Object.keys(data).filter(k => !allowedKeys.includes(k));
  return extraKeys.length === 0;
}, {
  message: "Payload chứa các trường không được phép cập nhật"
});
```

**Middleware Function:**

```javascript
export const validateProfileUpdate = (req, res, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    req.body = validated; // Replace with validated data
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.errors[0].message,
      code: "VALIDATION_ERROR"
    });
  }
};
```

**Done Criteria:**
- [ ] File created với Zod schema export
- [ ] `updateProfileSchema` validates:
  - [ ] Empty body `{}` → reject (400)
  - [ ] Forbidden fields (email, role, status, etc.) → reject (400, generic message)
  - [ ] `name=""` empty string → reject (400)
  - [ ] `name` với `<` hoặc `>` → reject (400)
  - [ ] `name` > 255 chars → reject (400)
  - [ ] `avatar_url` invalid URL → reject (400)
  - [ ] Partial update (chỉ name hoặc chỉ avatar_url) → pass
- [ ] `validateProfileUpdate` middleware exported
- [ ] Manual test với các test payloads returns correct 400 responses

**SPEC Acceptance Criteria Mapping:**
- Section 6: Empty body rejection
- Section 6: Forbidden field rejection với generic message
- Section 4: XSS prevention (reject `<>`)

---

### T005: Create Profile Controller

**Estimated Time:** 1.5 hours  
**Dependencies:** T003 (service exists)  
**SPEC References:** Section 3 (Get Profile, Update Profile)

**Files to Create:**
- `backend/src/controllers/profile.controller.js`

**Description:**
Thin controller layer. NO business logic. Chỉ parse request, call service, format response.

**Functions to Implement:**

1. **`getProfile`**
```javascript
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id; // from authMiddleware
    const profile = await profileService.getProfile(userId);
    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error); // Delegate to error middleware
  }
};
```

2. **`updateProfile`**
```javascript
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = req.body; // Already validated by middleware
    const updatedProfile = await profileService.updateProfile(userId, data);
    return res.status(200).json({
      success: true,
      data: updatedProfile
    });
  } catch (error) {
    next(error);
  }
};
```

**Done Criteria:**
- [ ] File created với function exports
- [ ] `getProfile` implemented (< 10 lines)
- [ ] `updateProfile` implemented (< 10 lines)
- [ ] No business logic (all delegated to service)
- [ ] Success response format: `{ success: true, data: {...} }`
- [ ] Error handling delegated to `next(error)`
- [ ] Import profileService correctly

**SPEC Acceptance Criteria Mapping:** Enables Section 7 all items

---

### T006: Create Profile Routes

**Estimated Time:** 1 hour  
**Dependencies:** T004 (validator), T005 (controller)  
**SPEC References:** Section 3 (Functional Requirements), Section 4 (Anti-IDOR Security)

**Files to Create:**
- `backend/src/api/profile.routes.js`

**Description:**
Define Express router với endpoints và middleware chain. Mount authMiddleware để enforce authentication.

**Routes to Implement:**

```javascript
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateProfileUpdate } from "../validators/profile.validator.js";
import { getProfile, updateProfile } from "../controllers/profile.controller.js";

const router = express.Router();

// GET /profile/me - View own profile
router.get("/me", authMiddleware, getProfile);

// PUT /profile/me - Update own profile
router.put("/me", authMiddleware, validateProfileUpdate, updateProfile);

export default router;
```

**Done Criteria:**
- [ ] File created với Express router
- [ ] GET /me route defined với middleware chain: authMiddleware → getProfile
- [ ] PUT /me route defined với middleware chain: authMiddleware → validateProfileUpdate → updateProfile
- [ ] Router exported as default
- [ ] Imports correct (authMiddleware from feat-auth, validator, controller)
- [ ] No other routes defined (out of scope)

**SPEC Acceptance Criteria Mapping:**
- Section 3: Both GET và PUT functional requirements
- Section 4: Anti-IDOR security (authMiddleware enforces req.user.id)

---

### T007: Wire Profile Routes Into Express App

**Estimated Time:** 0.5 hours  
**Dependencies:** T006 (routes exist)  
**SPEC References:** Section 3 (Enable API access)

**Files to Edit:**
- `backend/src/app.js` (hoặc `backend/src/index.js` hoặc main Express setup file)

**Description:**
Mount profile routes vào Express app tại `/profile` path prefix.

**Implementation:**

```javascript
import profileRoutes from "./api/profile.routes.js";

// After existing route mounts (auth, courses, etc.)
app.use("/profile", profileRoutes);
```

**Done Criteria:**
- [ ] Import profileRoutes added
- [ ] `app.use("/profile", profileRoutes)` added
- [ ] Placement after existing routes (không override auth routes)
- [ ] Server starts successfully: `npm start` (no errors)
- [ ] Manual smoke test:
  - [ ] `curl http://localhost:PORT/profile/me` without token → 401 Unauthorized
  - [ ] `curl http://localhost:PORT/profile/me` với invalid token → 401
  - [ ] Routes accessible (expected auth failure, not 404)

**SPEC Acceptance Criteria Mapping:** Enables Section 7 integration testing

---

### T008: Write Unit Tests for Service Layer

**Estimated Time:** 3 hours  
**Dependencies:** T003 (service exists)  
**SPEC References:** Section 3 (Business Logic), Section 6 (Error Handling), Section 7 (Acceptance Criteria)

**Files to Create:**
- `backend/tests/unit/profile.service.test.js`

**Description:**
Unit tests cho profileService functions với mocked repository. Verify business logic correctness.

**Test Framework:** `node:test` + `assert` (per CLAUDE.md testing baseline)

**Test Cases:**

1. **getProfile Success**
   - Mock repository.findById returns user object
   - Assert: password_hash filtered out
   - Assert: role_version filtered out
   - Assert: Returns correct fields (id, email, name, avatar_url, role, status)

2. **getProfile User Not Found**
   - Mock repository returns null
   - Assert: Throws NotFoundError

3. **updateProfile Whitelist Enforcement**
   - Input: `{ name: "New", email: "hack@example.com" }`
   - Assert: Only name passed to repository, email ignored

4. **updateProfile Empty Avatar Normalization**
   - Input: `{ avatar_url: "" }`
   - Assert: Repository receives `{ avatar_url: null }`

5. **updateProfile Invalid Cloudinary Domain**
   - Input: `{ avatar_url: "https://evil.com/fake.jpg" }`
   - Assert: Throws ValidationError before repository call

6. **updateProfile Missing userId in URL**
   - Input: `{ avatar_url: "https://res.cloudinary.com/cloud/image/upload/v123/other-user-id.jpg" }`
   - userId: `"user-123"`
   - Assert: Throws ForbiddenError (URL không chứa userId)

7. **updateProfile Valid Ownership**
   - Input: `{ avatar_url: "https://res.cloudinary.com/cloud/image/upload/v123/user-123.jpg" }`
   - userId: `"user-123"`
   - Assert: Repository update called, success

8. **updateProfile Partial Update (Name Only)**
   - Input: `{ name: "New Name" }`
   - Assert: Repository receives only name, no avatar_url

**Done Criteria:**
- [ ] Test file created
- [ ] All 8 test cases implemented
- [ ] Repository mocked (no real DB queries)
- [ ] All tests pass: `npm test -- profile.service.test.js`
- [ ] Code coverage > 80% cho profile.service.js
- [ ] Test output shows clear assertions

**SPEC Acceptance Criteria Mapping:**
- Section 7 item 1: Password filtering
- Section 7 item 2: Whitelist enforcement
- Section 6: Error handling paths

---

### T009: Write Integration Tests for Endpoints

**Estimated Time:** 4 hours  
**Dependencies:** T007 (routes wired, server runnable)  
**SPEC References:** Section 3 (Functional Requirements), Section 6 (Error Handling), Section 7 (Acceptance Criteria)

**Files to Create:**
- `backend/tests/integration/profile.test.js`

**Description:**
End-to-end tests cho 2 endpoints với real HTTP requests. Verify API contracts và error handling.

**Test Framework:** `node:test` + `supertest` (per CLAUDE.md)

**Setup:**
- Seed test user vào database
- Generate valid JWT token cho test user
- Clean up database sau tests

**Test Cases:**

1. **GET /profile/me - Success**
   - Request: GET /profile/me với valid JWT
   - Assert: 200 OK
   - Assert: Response body contains `{ success: true, data: { id, email, name, avatar_url, role, status } }`
   - Assert: NO password_hash in response

2. **GET /profile/me - Unauthorized (No Token)**
   - Request: GET /profile/me without Authorization header
   - Assert: 401 Unauthorized
   - Assert: Error message from authMiddleware

3. **GET /profile/me - Forbidden (Blocked User)**
   - Seed: User với status=blocked
   - Request: GET /profile/me với valid JWT for blocked user
   - Assert: 403 Forbidden (from authMiddleware)

4. **PUT /profile/me - Update Name Success**
   - Request: PUT /profile/me với `{ name: "Updated Name" }`
   - Assert: 200 OK
   - Assert: Database updated (verify với fresh GET)

5. **PUT /profile/me - Update Avatar Success**
   - Request: PUT /profile/me với `{ avatar_url: "https://res.cloudinary.com/cloud/v123/test-user-id.jpg" }`
   - Assert: 200 OK
   - Assert: Database updated

6. **PUT /profile/me - Partial Update (Name Only)**
   - Request: PUT /profile/me với `{ name: "Only Name" }`
   - Assert: 200 OK
   - Assert: Avatar unchanged

7. **PUT /profile/me - Empty Body Rejection**
   - Request: PUT /profile/me với `{}`
   - Assert: 400 Bad Request
   - Assert: Error message "Body rỗng"

8. **PUT /profile/me - Forbidden Field Rejection**
   - Request: PUT /profile/me với `{ email: "hacker@evil.com", name: "Hack" }`
   - Assert: 400 Bad Request
   - Assert: Generic error message (không leak "email" field name)

9. **PUT /profile/me - Name XSS Attempt**
   - Request: PUT /profile/me với `{ name: "<script>alert(1)</script>" }`
   - Assert: 400 Bad Request
   - Assert: Validator rejects

10. **PUT /profile/me - IDOR Attempt (userId in Body)**
    - Request: PUT /profile/me với `{ userId: "other-user-id", name: "Hack" }`
    - Assert: 400 Bad Request hoặc userId ignored
    - Assert: Own profile updated (not other user)

**Done Criteria:**
- [ ] Test file created với supertest setup
- [ ] All 10 test cases implemented
- [ ] Database seeding/cleanup automated
- [ ] JWT token generation helper implemented
- [ ] All tests pass: `npm test -- profile.test.js`
- [ ] Tests run against real MySQL database (test DB)
- [ ] No test pollution (each test isolated)

**SPEC Acceptance Criteria Mapping:**
- Section 7 item 1: GET returns correct data
- Section 7 item 2: PUT updates only name/avatar
- Section 7 item 3: Security test (forbidden field rejection)

---

### T010: Write Security Penetration Tests

**Estimated Time:** 3 hours  
**Dependencies:** T009 (integration tests pass)  
**SPEC References:** Section 4 (Security), Section 6 (Error Handling), Section 7 (Acceptance Criteria)

**Files to Create:**
- `backend/tests/security/profile.security.test.js`

**Description:**
Security-focused tests để verify không có vulnerability. Attempt to bypass validation và ownership checks.

**Test Framework:** `node:test` + `supertest`

**Test Cases:**

1. **XSS Payload Injection**
   - Payload: `{ name: "<img src=x onerror=alert(1)>" }`
   - Assert: 400 Bad Request (validator rejects)
   - Payload: `{ name: "<script>alert(document.cookie)</script>" }`
   - Assert: 400 Bad Request

2. **Forbidden Field Bypass Attempts**
   - Attempt 1: `{ role: "ADMIN" }`
   - Attempt 2: `{ status: "active" }` (from blocked user)
   - Attempt 3: `{ role_version: 999 }`
   - Attempt 4: `{ password_hash: "fake-hash" }`
   - Assert: ALL rejected với 400 Bad Request, generic message

3. **Avatar URL Ownership Bypass**
   - Seed: userA với id `user-a-id`, userB với id `user-b-id`
   - Login: userA
   - Attempt: PUT /profile/me với `{ avatar_url: "https://res.cloudinary.com/.../user-b-id.jpg" }`
   - Assert: 400 Forbidden "không thuộc quyền sở hữu"

4. **Avatar URL Domain Bypass**
   - Attempt 1: `{ avatar_url: "https://evil.com/fake.jpg" }`
   - Attempt 2: `{ avatar_url: "http://res.cloudinary.com/..." }` (http not https)
   - Assert: Both rejected với 400 Bad Request

5. **JWT Role Version Mismatch**
   - Seed: User với role_version=2
   - Token: JWT chứa roleVersion=1 (stale token)
   - Request: GET /profile/me
   - Assert: 401 Unauthorized (authMiddleware blocks)

6. **Blocked User Access After Token Issued**
   - Flow:
     1. User login → get valid JWT
     2. Admin blocks user (status=blocked)
     3. User attempts GET /profile/me với token cũ
   - Assert: 403 Forbidden (authMiddleware checks status)

7. **SQL Injection Attempt in Name Field**
   - Payload: `{ name: "'; DROP TABLE users; --" }`
   - Assert: Prisma parameterized queries prevent injection
   - Assert: Name stored as literal string

8. **Large Payload DoS Attempt**
   - Payload: `{ name: "A".repeat(10000) }` (10KB name)
   - Assert: 400 Bad Request (max 255 chars validation)

**Done Criteria:**
- [ ] Test file created
- [ ] All 8 security test cases implemented
- [ ] Tests simulate real attack scenarios
- [ ] All tests pass (no vulnerabilities found)
- [ ] JWT role version check verified
- [ ] Status check (blocked user) verified
- [ ] Ownership enforcement verified
- [ ] No SQL injection possible

**SPEC Acceptance Criteria Mapping:**
- Section 4: Anti-IDOR + XSS prevention verified
- Section 6: Blocked user rejection verified
- Section 7 item 3: Security test (forbidden field) verified

---

## Testing Strategy Summary

- **Unit Tests (T008):** Isolated service logic, mocked dependencies
- **Integration Tests (T009):** End-to-end API contracts, real DB
- **Security Tests (T010):** Attack scenarios, vulnerability verification

**Total Test Coverage Target:** > 85% for profile feature code

---

## Implementation Notes

1. **authMiddleware Dependency:** Assumes feat-auth already implemented và exports authMiddleware. Verify before T006.

2. **Error Classes:** Assumes project has centralized error classes (NotFoundError, ValidationError, ForbiddenError, TimeoutError). If missing, create in T002.

3. **Prisma Timeout Config:** Set in Prisma client instantiation: `timeout: 5000` (5 seconds).

4. **Test Database:** Use separate test database, seeded before tests, cleaned after. Don't pollute development DB.

5. **JWT Token Generation:** Reuse utility from feat-auth for generating test tokens. Don't duplicate logic.

---

**End of TASKS.md**
