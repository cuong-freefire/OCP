# TASKS.md — Feature: Admin Accounts & Auth Middleware

**Version:** 1.0.0 | **Owner:** Member A | **Status:** READY  
**Created:** 2026-06-20 | **Spec:** `SPEC.md` | **Plan:** `PLAN.md`

---

## Task Breakdown

| ID | Task Name | Files | Est. (h) | Dependencies | SPEC Refs | Done Criteria |
|----|-----------|-------|----------|--------------|-----------|---------------|
| **T001** | Update TokenService add roleVersion to JWT payload | `backend/src/services/token.service.js` | 1.5 | None | Section 3 (Middleware Contract) | JWT payload contains `roleVersion` field; existing tests pass |
| **T002** | Create UserRepository methods | `backend/src/repositories/user.repository.js` (NEW) | 2.0 | None | Section 5 (Data Model) | `findById()`, `updateRoleAndIncrementVersion()`, `countActiveAdmins()` implemented; unit tests pass |
| **T003** | Create Admin Zod validator | `backend/src/validators/admin.validator.js` (NEW) | 1.0 | None | Section 3 (API Đổi Quyền) | `changeRoleSchema` validates `body.role` (ENUM) và `params.userId` (UUID); test với invalid inputs |
| **T004** | Implement rate limiter middleware | `backend/src/middlewares/rateLimiter.middleware.js` (NEW or ENHANCE) | 2.5 | None | Section 4 (Non-functional: Rate Limiting) | In-memory rate limiter, 10 req/min/admin, TTL cleanup; test với 11 requests |
| **T005** | Create AdminService with role change logic | `backend/src/services/admin.service.js` (NEW) | 3.5 | T002 | Section 3 (API Đổi Quyền), Section 6 (Error Handling) | `changeUserRole()` with self-action check, last-admin check, role update, logging; unit tests cho 3 error cases |
| **T006** | Refactor authMiddleware with roleVersion validation | `backend/src/middlewares/auth.middleware.js` | 4.0 | T001 | Section 3 (Middleware Contract), Section 6 (Error Handling) | `authMiddleware(options)` verifies roleVersion match, status check, roles check; backward-compatible exports; tests pass |
| **T007** | Create AdminController | `backend/src/controllers/admin.controller.js` (NEW) | 1.5 | T005 | Section 3 (API Đổi Quyền) | `changeUserRole()` extracts params, calls service, returns standard response format; error handling test |
| **T008** | Create Admin routes and wire middleware stack | `backend/src/api/admin.routes.js` (NEW) | 2.0 | T003, T004, T006, T007 | Section 3 (API Đổi Quyền) | `PUT /admin/users/:userId/role` với full middleware stack (rate limiter, auth, validator, controller); manual test với Postman |
| **T009** | Update auth flows to use new JWT payload | `backend/src/services/auth.service.js` (or similar) | 3.0 | T001, T006 | Section 3 (Middleware Contract) | Login/refresh-token APIs issue JWT với `roleVersion`; existing auth endpoints still work; integration test |
| **T010** | Write integration tests for acceptance criteria | `backend/tests/integration/admin.test.js` (NEW) | 3.5 | T008, T009 | Section 7 (Acceptance Criteria) | All 4 acceptance criteria automated: normal change, self-action block, token revocation, last-admin protection |
| **T011** | Add database index for last-admin query | `backend/prisma/migrations/` | 1.0 | None | Section 6 (Error Handling: LAST_ADMIN_PROTECTED) | Migration creates `idx_users_role_status(role, status)`; query performance < 10ms verified |
| **T012** | Create migration guide for Member B-E | `docs/MIGRATION_AUTH_MIDDLEWARE.md` (NEW) | 1.5 | T006 | Section 3 (Middleware Contract) | Document new `authMiddleware()` API, backward-compatible aliases, migration examples; reviewed by 1 other member |

---

## Detailed Task Specifications

### T001: Update TokenService add roleVersion to JWT payload

**Objective:** Thêm `roleVersion` field vào JWT payload để middleware có thể validate.

**Files:**

- `backend/src/services/token.service.js` (EDIT)

**Changes:**

```javascript
// Current:
jwt.sign({ sub: user.id, role: user.role, status: user.status }, ...)

// After:
jwt.sign({ 
  sub: user.id, 
  role: user.role, 
  status: user.status,
  roleVersion: user.role_version  // NEW
}, ...)
```

**Acceptance:**

- JWT payload chứa field `roleVersion` (type: number)
- Existing unit tests cho `tokenService.signAccessToken()` pass
- Manual decode JWT verify field tồn tại

**Estimated Time:** 1.5 hours

---

### T002: Create UserRepository methods

**Objective:** Tạo repository layer để tách Prisma access ra khỏi service.

**Files:**

- `backend/src/repositories/user.repository.js` (NEW)

**Methods:**

**a) `findById(userId)`**

```javascript
async findById(userId) {
  return prisma.user.findUnique({ where: { id: userId } })
}
```

**b) `updateRoleAndIncrementVersion(userId, newRole)`**

```javascript
async updateRoleAndIncrementVersion(userId, newRole) {
  return prisma.user.update({
    where: { id: userId },
    data: { 
      role: newRole, 
      role_version: { increment: 1 } 
    }
  })
}
```

**c) `countActiveAdmins()`**

```javascript
async countActiveAdmins() {
  return prisma.user.count({
    where: { role: 'ADMIN', status: 'active' }
  })
}
```

**Acceptance:**

- 3 methods implemented with correct Prisma queries
- Unit tests verify each method returns expected data
- Error handling cho user not found

**Estimated Time:** 2.0 hours

---

### T003: Create Admin Zod validator

**Objective:** Validate request body và params cho role change API.

**Files:**

- `backend/src/validators/admin.validator.js` (NEW)

**Schema:**

```javascript
import { z } from 'zod';

export const changeRoleSchema = z.object({
  body: z.object({
    role: z.enum(['ADMIN', 'LEARNER', 'MENTOR', 'MANAGER'], {
      errorMap: () => ({ message: 'Invalid role' })
    })
  }),
  params: z.object({
    userId: z.string().uuid({ message: 'Invalid user ID format' })
  })
})

export function validateChangeRole(req, res, next) {
  try {
    changeRoleSchema.parse({ body: req.body, params: req.params });
    next();
  } catch (error) {
    // Format error theo CLAUDE.md
    next(new AppError('Validation failed', 'VALIDATION_ERROR', 400, error.errors));
  }
}
```

**Acceptance:**

- Schema validates `role` (chỉ accept 4 values)
- Schema validates `userId` (UUID format)
- Middleware function `validateChangeRole` export
- Test với invalid inputs (wrong role, invalid UUID) throw correct errors

**Estimated Time:** 1.0 hour

---

### T004: Implement rate limiter middleware

**Objective:** Prevent DOS bằng rate limiting 10 requests/phút per admin.

**Files:**

- `backend/src/middlewares/rateLimiter.middleware.js` (NEW or ENHANCE)

**Implementation:**

```javascript
const rateLimitMap = new Map(); // { userId: { count, resetTime } }

export function adminRoleChangeRateLimiter(req, res, next) {
  const userId = req.user?.id;
  if (!userId) return next();

  const limit = parseInt(process.env.ADMIN_ROLE_CHANGE_RATE_LIMIT || '10');
  const windowMs = 60 * 1000; // 1 phút
  
  const now = Date.now();
  const userRecord = rateLimitMap.get(userId);

  if (!userRecord || now > userRecord.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (userRecord.count >= limit) {
    return next(new AppError(
      'Too many requests', 
      'TOO_MANY_REQUESTS', 
      429, 
      { retryAfter: Math.ceil((userRecord.resetTime - now) / 1000) }
    ));
  }

  userRecord.count++;
  next();
}

// Cleanup expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(userId);
  }
}, 60000);
```

**Acceptance:**

- Rate limiter blocks 11th request trong 60s window
- Env var `ADMIN_ROLE_CHANGE_RATE_LIMIT` configurable
- Cleanup function prevents memory leak
- Test: 10 requests pass, 11th fails với 429

**Estimated Time:** 2.5 hours

---

### T005: Create AdminService with role change logic

**Objective:** Business logic xử lý role change với 3 guards: self-action, last-admin, update.

**Files:**

- `backend/src/services/admin.service.js` (NEW)

**Implementation:**

```javascript
export class AdminService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async changeUserRole(adminId, targetUserId, newRole) {
    // Guard 1: Self-action prevention
    if (adminId === targetUserId) {
      throw new AppError(
        'Cannot change your own role',
        'SELF_ACTION_FORBIDDEN',
        403
      );
    }

    // Guard 2: Last admin protection
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new AppError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (targetUser.role === 'ADMIN') {
      const adminCount = await this.userRepository.countActiveAdmins();
      if (adminCount === 1) {
        throw new AppError(
          'Cannot modify the last active admin',
          'LAST_ADMIN_PROTECTED',
          400
        );
      }
    }

    // Action: Update role + increment version
    const updatedUser = await this.userRepository.updateRoleAndIncrementVersion(
      targetUserId,
      newRole
    );

    // Logging: Admin-to-Admin changes
    if (targetUser.role === 'ADMIN' || newRole === 'ADMIN') {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'ADMIN_ROLE_CHANGE',
        adminId,
        targetUserId,
        oldRole: targetUser.role,
        newRole
      }));
    }

    return {
      userId: updatedUser.id,
      role: updatedUser.role,
      role_version: updatedUser.role_version,
      updated_at: updatedUser.updated_at
    };
  }
}
```

**Acceptance:**

- Self-action throws `SELF_ACTION_FORBIDDEN` (403)
- Last admin protection throws `LAST_ADMIN_PROTECTED` (400)
- Successful update returns `{ userId, role, role_version, updated_at }`
- Admin-to-Admin change logs to console (structured JSON)
- Unit tests cover all 3 guards + happy path

**Dependencies:** T002 (UserRepository)

**Estimated Time:** 3.5 hours

---

### T006: Refactor authMiddleware with roleVersion validation

**Objective:** Enhanced middleware check roleVersion match + status + roles.

**Files:**

- `backend/src/middlewares/auth.middleware.js` (REFACTOR)

**Implementation:**

```javascript
import { AppError, authCodes } from '../utils/response.util.js';

export function authMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      const config = req.app.locals.authConfig;
      const tokenService = req.app.locals.tokenService;
      const userRepository = req.app.locals.userRepository;

      // 1. Extract JWT
      const token = req.cookies?.[config.cookieAccessName];
      if (!token) {
        throw new AppError('Authentication required', authCodes.AUTH_REQUIRED, 401);
      }

      // 2. Verify JWT
      const payload = tokenService.verifyAccessToken(token);
      const { sub: userId, role, roleVersion } = payload;

      // 3. Query DB for current user state
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new AppError('User not found', authCodes.AUTH_REQUIRED, 401);
      }

      // 4. Check status
      if (user.status !== 'active') {
        throw new AppError('Account blocked or inactive', 'ACCOUNT_BLOCKED', 403);
      }

      // 5. Check roleVersion match
      if (roleVersion !== user.role_version) {
        throw new AppError(
          'Token revoked due to role change',
          'TOKEN_REVOKED',
          401
        );
      }

      // 6. Optional: Check roles
      if (options.roles && !options.roles.includes(user.role)) {
        throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
      }

      // 7. Attach user to request
      req.user = { userId, role: user.role, roleVersion: user.role_version };
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Backward-compatible exports
export const requireAuth = () => authMiddleware();
export const requireRole = (...roles) => authMiddleware({ roles });
```

**Acceptance:**

- Middleware verifies roleVersion match (throw `TOKEN_REVOKED` if mismatch)
- Middleware checks status === 'active' (throw `ACCOUNT_BLOCKED` if not)
- Optional roles check works (throw `FORBIDDEN` if not in list)
- Backward-compatible: `requireAuth()` và `requireRole()` still work
- Existing auth tests pass
- Integration test: user với old JWT (roleVersion=1) blocked after role change (roleVersion=2)

**Dependencies:** T001 (JWT có roleVersion field)

**Estimated Time:** 4.0 hours

---

### T007: Create AdminController

**Objective:** Controller layer xử lý HTTP request/response cho role change API.

**Files:**

- `backend/src/controllers/admin.controller.js` (NEW)

**Implementation:**

```javascript
export class AdminController {
  constructor(adminService) {
    this.adminService = adminService;
  }

  changeUserRole = async (req, res, next) => {
    try {
      const adminId = req.user.userId;
      const targetUserId = req.params.userId;
      const { role: newRole } = req.body;

      const result = await this.adminService.changeUserRole(
        adminId,
        targetUserId,
        newRole
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };
}
```

**Acceptance:**

- Controller extracts `adminId` từ `req.user.userId`
- Controller extracts `targetUserId` từ `req.params.userId`
- Controller extracts `newRole` từ `req.body.role`
- Success response: `{ success: true, data: { userId, role, role_version, updated_at } }`
- Error handling delegates to global error middleware via `next(error)`
- Manual test với Postman returns correct response

**Dependencies:** T005 (AdminService)

**Estimated Time:** 1.5 hours

---

### T008: Create Admin routes and wire middleware stack

**Objective:** Setup Express route với full middleware stack.

**Files:**

- `backend/src/api/admin.routes.js` (NEW)

**Implementation:**

```javascript
import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminRoleChangeRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { validateChangeRole } from '../validators/admin.validator.js';

export function createAdminRoutes(adminController) {
  const router = express.Router();

  router.put(
    '/users/:userId/role',
    adminRoleChangeRateLimiter,
    authMiddleware({ roles: ['ADMIN'] }),
    validateChangeRole,
    adminController.changeUserRole
  );

  return router;
}
```

**Integration in main app:**

```javascript
// backend/src/app.js (hoặc main server file)
import { createAdminRoutes } from './api/admin.routes.js';

const adminController = new AdminController(adminService);
app.use('/api/admin', createAdminRoutes(adminController));
```

**Acceptance:**

- Route `PUT /api/admin/users/:userId/role` accessible
- Middleware stack runs in order: rate limiter → auth → validator → controller
- Manual test với Postman:
  - Without auth → 401
  - Non-admin → 403
  - Invalid role → 400
  - Valid request → 200
- Integration test confirms full flow

**Dependencies:** T003, T004, T006, T007

**Estimated Time:** 2.0 hours

---

### T009: Update auth flows to use new JWT payload

**Objective:** Ensure login/refresh-token APIs issue JWT với `roleVersion` field.

**Files:**

- `backend/src/services/auth.service.js` (EDIT, hoặc tương tự)
- Các auth endpoints liên quan (login, refresh-token, Google OAuth callback)

**Changes:**

- Khi call `tokenService.signAccessToken(user)`, ensure `user` object có `role_version` field
- Update `/auth/login` endpoint
- Update `/auth/refresh-token` endpoint
- Update `/auth/google/callback` endpoint (nếu có)

**Example:**

```javascript
// Before:
const user = await userRepository.findByEmail(email);
const accessToken = tokenService.signAccessToken(user);

// After: Ensure user object includes role_version
const user = await userRepository.findByEmail(email); // Query phải SELECT role_version
const accessToken = tokenService.signAccessToken(user);
```

**Acceptance:**

- Login API returns JWT có `roleVersion` field
- Refresh-token API returns new JWT có `roleVersion` field
- Existing auth integration tests pass
- Manual test: decode JWT từ login response verify `roleVersion` present

**Dependencies:** T001, T006

**Estimated Time:** 3.0 hours

---

### T010: Write integration tests for acceptance criteria

**Objective:** Automated tests cho 4 acceptance criteria trong SPEC Section 7.

**Files:**

- `backend/tests/integration/admin.test.js` (NEW)

**Test Cases:**

**AC1: Normal role change**

```javascript
test('Admin changes Mentor to Learner successfully', async () => {
  const admin = await createTestUser({ role: 'ADMIN' });
  const mentor = await createTestUser({ role: 'MENTOR' });
  const adminToken = await loginAs(admin);

  const res = await request(app)
    .put(`/api/admin/users/${mentor.id}/role`)
    .set('Cookie', adminToken)
    .send({ role: 'LEARNER' });

  expect(res.status).toBe(200);
  expect(res.body.data.role).toBe('LEARNER');
  expect(res.body.data.role_version).toBe(mentor.role_version + 1);
});
```

**AC2: Self-action prevention**

```javascript
test('Admin cannot change own role', async () => {
  const admin = await createTestUser({ role: 'ADMIN' });
  const adminToken = await loginAs(admin);

  const res = await request(app)
    .put(`/api/admin/users/${admin.id}/role`)
    .set('Cookie', adminToken)
    .send({ role: 'LEARNER' });

  expect(res.status).toBe(403);
  expect(res.body.code).toBe('SELF_ACTION_FORBIDDEN');
});
```

**AC3: Token revocation after role change**

```javascript
test('Old JWT blocked after role change', async () => {
  const admin = await createTestUser({ role: 'ADMIN' });
  const mentor = await createTestUser({ role: 'MENTOR' });
  const mentorToken = await loginAs(mentor);
  const adminToken = await loginAs(admin);

  // Mentor có JWT hợp lệ
  let res = await request(app)
    .get('/api/mentor/courses')
    .set('Cookie', mentorToken);
  expect(res.status).toBe(200);

  // Admin đổi role Mentor → Learner
  await request(app)
    .put(`/api/admin/users/${mentor.id}/role`)
    .set('Cookie', adminToken)
    .send({ role: 'LEARNER' });

  // Mentor dùng old JWT → bị block
  res = await request(app)
    .get('/api/mentor/courses')
    .set('Cookie', mentorToken);
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('TOKEN_REVOKED');
});
```

**AC4: Last admin protection**

```javascript
test('Cannot downgrade last active admin', async () => {
  const admin = await createTestUser({ role: 'ADMIN' });
  const adminToken = await loginAs(admin);
  
  // Ensure chỉ có 1 admin trong DB
  await deleteAllAdminsExcept(admin.id);

  const res = await request(app)
    .put(`/api/admin/users/${admin.id}/role`)
    .set('Cookie', adminToken)
    .send({ role: 'LEARNER' });

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
});
```

**Acceptance:**

- All 4 test cases pass
- Tests run in isolation (setup/teardown DB)
- Code coverage > 80% cho admin module

**Dependencies:** T008, T009

**Estimated Time:** 3.5 hours

---

### T011: Add database index for last-admin query

**Objective:** Optimize `count(role='ADMIN' AND status='active')` query.

**Files:**

- `backend/prisma/migrations/YYYYMMDDHHMMSS_add_users_role_status_index/migration.sql` (NEW)

**Migration SQL:**

```sql
-- Add index for last-admin count query
CREATE INDEX idx_users_role_status ON users(role, status);
```

**Prisma Schema Update (optional):**

```prisma
model User {
  // ... existing fields
  
  @@index([role, status], name: "idx_users_role_status")
}
```

**Acceptance:**

- Migration file created và applied
- Index exists trong DB: `SHOW INDEX FROM users WHERE Key_name = 'idx_users_role_status';`
- Query performance measured: `EXPLAIN SELECT COUNT(*) FROM users WHERE role='ADMIN' AND status='active';` shows index usage
- Query execution time < 10ms (measure với `BENCHMARK()` hoặc slow query log)

**Dependencies:** None (có thể run parallel)

**Estimated Time:** 1.0 hour

---

### T012: Create migration guide for Member B-E

**Objective:** Document new `authMiddleware()` API để Member B-E migrate dần.

**Files:**

- `docs/MIGRATION_AUTH_MIDDLEWARE.md` (NEW)

**Content:**

```markdown
# Auth Middleware Migration Guide

## Overview
`authMiddleware` đã được enhanced với role version validation. Existing code vẫn hoạt động nhờ backward-compatible exports.

## New API

### Basic Usage (No Change)
\\\`\\\`\\\`javascript
import { requireAuth } from '../middlewares/auth.middleware.js';
router.get('/protected', requireAuth(), handler);
\\\`\\\`\\\`

### Role-based (No Change)
\\\`\\\`\\\`javascript
import { requireRole } from '../middlewares/auth.middleware.js';
router.post('/admin-only', requireRole('ADMIN'), handler);
\\\`\\\`\\\`

### New Flexible API
\\\`\\\`\\\`javascript
import { authMiddleware } from '../middlewares/auth.middleware.js';

// Check multiple roles
router.get('/staff', authMiddleware({ roles: ['ADMIN', 'MANAGER'] }), handler);

// Skip role check (only auth + status)
router.get('/any-user', authMiddleware(), handler);
\\\`\\\`\\\`

## What Changed
1. Middleware now validates `roleVersion` match → auto-revoke old JWTs after role change
2. Middleware checks `status === 'active'` → auto-block inactive accounts
3. Optional `roles` parameter for fine-grained access control

## Migration Checklist
- [ ] Verify endpoints using `requireAuth()` still work (no code change needed)
- [ ] Verify endpoints using `requireRole()` still work (no code change needed)
- [ ] Optional: Migrate to new `authMiddleware()` API for multi-role checks
- [ ] Test role change flow: user bị kick sau khi admin đổi role

## Breaking Changes
None. Backward compatibility maintained.

## Questions?
Contact Member A (CuongLH) or check SPEC.md Section 3.
\\\`\\\`\\\`
```

**Acceptance:**

- Document covers new API, backward compatibility, migration checklist
- Examples clear và runnable
- Reviewed by at least 1 other team member (Member B hoặc E)
- Shared in team channel (Slack/Discord/Email)

**Dependencies:** T006 (authMiddleware completed)

**Estimated Time:** 1.5 hours

---

## Summary Statistics

**Total Tasks:** 12  
**Total Estimated Time:** 27.0 hours (~3.4 days for 1 developer, 8h/day)

**Critical Path:**

1. T001 (JWT payload) → T006 (authMiddleware) → T009 (auth flows) → T010 (integration tests)
2. T002 (repository) → T005 (service) → T007 (controller) → T008 (routes) → T010 (tests)

**Parallel Work Opportunities:**

- T003 (validator), T004 (rate limiter), T011 (index) có thể làm song song với critical path
- T012 (migration guide) làm sau khi T006 xong

**Risk Mitigation Tasks:**

- T011 addresses "last-admin query performance" risk
- T004 addresses "rate limiter memory leak" risk
- T006 addresses "breaking changes" risk via backward compatibility

---

**END OF TASKS**
