# PLAN.md — Feature: Admin Accounts & Auth Middleware

**Version:** 1.0.0 | **Owner:** Member A | **Status:** DRAFT  
**Created:** 2026-06-20 | **Spec Reference:** `sdd/specs/feat-admin-accounts/SPEC.md`

---

## 1. ARCHITECTURAL APPROACH

### 1.1 Overall Strategy

Áp dụng **Role Versioning Pattern** kết hợp với **Middleware Composition Pattern** để giải quyết E2.2 security hole. Kiến trúc gồm 3 tầng chính:

1. **API Layer** — Endpoint `PUT /admin/users/:userId/role` với rate limiting
2. **Middleware Layer** — Enhanced `authMiddleware` với role version validation
3. **Service Layer** — Business logic xử lý role change và last-admin protection

### 1.2 Design Patterns & Rationale

**a) Factory Pattern for Middleware:**

```javascript
export const authMiddleware = (options = {}) => {
  return async (req, res, next) => { /* ... */ }
}
```

**Lý do:** Cho phép config linh hoạt (`roles`, `skipRoleCheck`) khi Member B-E sử dụng, giữ interface đơn giản.

**b) Repository Pattern:**
Tách database access vào `userRepository` để tránh Prisma import trực tiếp trong service/controller.

**c) Atomic Update Pattern:**
Sử dụng Prisma `{ increment: 1 }` thay vì manual `SET role_version = role_version + 1` để đảm bảo atomicity.

**d) Error Code Strategy:**
Follow CLAUDE.md format `{ success, message, code, details }`. Sử dụng semantic error codes:

- `TOKEN_REVOKED` — roleVersion mismatch
- `SELF_ACTION_FORBIDDEN` — Admin tự đổi role
- `LAST_ADMIN_PROTECTED` — Cannot downgrade last admin

### 1.3 Tech Stack Alignment

- **JWT:** Existing `tokenService.signAccessToken()` — CẦN UPDATE để thêm `roleVersion` field vào payload
- **Prisma:** Existing ORM — dùng `prisma.user.update({ data: { role_version: { increment: 1 } } })`
- **Express:** Existing middleware pattern — enhance current `auth.middleware.js`
- **Rate Limiting:** Sẽ dùng `express-rate-limit` (nếu chưa có trong project) hoặc implement simple in-memory counter

---

## 2. COMPONENTS

### 2.1 Middleware (Enhanced)

**File:** `backend/src/middlewares/auth.middleware.js`

**Component:** `authMiddleware(options)`

**Responsibility:**

- Verify JWT và extract `{ userId, role, roleVersion }`
- Query DB lấy `users.status` và `users.role_version`
- Validate roleVersion match
- Validate status === 'active'
- Optional: Check `req.user.role IN options.roles` nếu có

**Interface:**

```javascript
Input: options = { roles?: string[], skipRoleCheck?: boolean }
Output: Gán req.user = { userId, role, roleVersion } hoặc throw AppError
```

**Existing Code:** Hiện tại có `requireAuth()` và `requireRole()` — sẽ REFACTOR thành unified `authMiddleware()`.

---

### 2.2 API Endpoint (New)

**File:** `backend/src/api/admin.routes.js` (NEW)

**Route:** `PUT /admin/users/:userId/role`

**Middleware Stack:**

```javascript
router.put(
  '/users/:userId/role',
  rateLimiter,                    // Rate limit 10 req/min
  authMiddleware({ roles: ['ADMIN'] }),
  validateRoleChange,              // Zod validation
  adminController.changeUserRole
)
```

---

### 2.3 Controller (New)

**File:** `backend/src/controllers/admin.controller.js` (NEW)

**Function:** `changeUserRole(req, res, next)`

**Responsibility:**

- Extract `userId` từ params và `newRole` từ body
- Call `adminService.changeUserRole(req.user.id, targetUserId, newRole)`
- Return `{ success, data: { userId, role, role_version } }`

**Interface:**

```javascript
Input: req.params.userId, req.body.role, req.user.id
Output: HTTP 200 { success: true, data: { userId, role, role_version } }
Error: HTTP 400/403 { success: false, message, code }
```

---

### 2.4 Service (New)

**File:** `backend/src/services/admin.service.js` (NEW)

**Class:** `AdminService`

**Methods:**

**a) `changeUserRole(adminId, targetUserId, newRole)`**

Logic:

1. Self-action check: `adminId === targetUserId` → throw `SELF_ACTION_FORBIDDEN`
2. Last admin check: Query `count(role='ADMIN' AND status='active')` → nếu = 1 và target là ADMIN → throw `LAST_ADMIN_PROTECTED`
3. Update user: `prisma.user.update({ where: { id: targetUserId }, data: { role: newRole, role_version: { increment: 1 } } })`
4. Log action nếu Admin-to-Admin change
5. Return updated user

**Interface:**

```javascript
Input: (adminId: string, targetUserId: string, newRole: ENUM)
Output: { userId, role, role_version, updated_at }
Errors: AppError với codes: SELF_ACTION_FORBIDDEN, LAST_ADMIN_PROTECTED, USER_NOT_FOUND
```

**Dependencies:** `userRepository`

---

### 2.5 Repository (Enhanced)

**File:** `backend/src/repositories/user.repository.js` (ENHANCE nếu đã tồn tại)

**Methods cần thêm:**

**a) `findById(userId)` — lấy user detail**

**b) `updateRoleAndIncrementVersion(userId, newRole)`**

```javascript
return prisma.user.update({
  where: { id: userId },
  data: { 
    role: newRole, 
    role_version: { increment: 1 } 
  }
})
```

**c) `countActiveAdmins()`**

```javascript
return prisma.user.count({
  where: { 
    role: 'ADMIN', 
    status: 'active' 
  }
})
```

---

### 2.6 Validator (New)

**File:** `backend/src/validators/admin.validator.js` (NEW)

**Schema:** `changeRoleSchema`

```javascript
import { z } from 'zod';

export const changeRoleSchema = z.object({
  body: z.object({
    role: z.enum(['ADMIN', 'LEARNER', 'MENTOR', 'MANAGER'])
  }),
  params: z.object({
    userId: z.string().uuid()
  })
})
```

---

### 2.7 Rate Limiter (New)

**File:** `backend/src/middlewares/rateLimiter.middleware.js` (NEW hoặc ENHANCE)

**Function:** `adminRoleChangeRateLimiter`

**Strategy:** In-memory Map lưu `{ userId: { count, resetTime } }`

**Logic:**

- Check `req.user.id` (adminId)
- Nếu > 10 requests trong 60s → throw `TOO_MANY_REQUESTS`
- Env config: `ADMIN_ROLE_CHANGE_RATE_LIMIT` (default 10)

---

### 2.8 Token Service (Enhanced)

**File:** `backend/src/services/token.service.js` (ENHANCE)

**Method:** `signAccessToken(user)` — CẦN THÊM `roleVersion` vào payload

**Before:**

```javascript
jwt.sign({ sub: user.id, role: user.role, status: user.status }, ...)
```

**After:**

```javascript
jwt.sign({ 
  sub: user.id, 
  role: user.role, 
  status: user.status,
  roleVersion: user.role_version  // NEW
}, ...)
```

---

## 3. DATA FLOW

### 3.1 Admin Change Role Flow

```
Admin Request
  ↓
[Rate Limiter] — Check 10 req/min limit
  ↓
[authMiddleware] — Verify JWT, check role='ADMIN'
  ↓
[Zod Validator] — Validate body.role và params.userId
  ↓
[admin.controller.changeUserRole]
  ↓
[admin.service.changeUserRole]
  |
  ├─→ Self-action check (adminId === targetUserId?)
  ├─→ Last admin check (count active admins)
  ├─→ userRepository.updateRoleAndIncrementVersion()
  └─→ Log if Admin-to-Admin change
  ↓
Response: { success: true, data: { userId, role, role_version } }
```

### 3.2 Middleware Role Version Validation Flow

```
Protected API Request (any Member B-E endpoint)
  ↓
[authMiddleware]
  |
  ├─→ Extract JWT từ cookie
  ├─→ jwt.verify() → { sub, role, roleVersion }
  ├─→ Query DB: users.findById(sub) → { role_version, status }
  ├─→ Check: roleVersion === user.role_version?
  |     ├─ NO → throw UnauthorizedError('TOKEN_REVOKED')
  |     └─ YES → continue
  ├─→ Check: status === 'active'?
  |     ├─ NO → throw ForbiddenError('ACCOUNT_BLOCKED')
  |     └─ YES → continue
  ├─→ Optional: Check req.user.role IN options.roles?
  └─→ Gán req.user = { userId, role, roleVersion }
  ↓
next() → Controller logic
```

### 3.3 JWT Lifecycle After Role Change

```
T0: User login → JWT issued với roleVersion=1
T1: Admin change role → DB: role_version=2
T2: User request với old JWT (roleVersion=1)
  ↓
[authMiddleware]
  ├─→ JWT valid (chưa expire)
  ├─→ Query DB: user.role_version = 2
  ├─→ Mismatch: 1 !== 2
  └─→ throw TOKEN_REVOKED
  ↓
User bị kick, phải login lại
  ↓
Login → New JWT issued với roleVersion=2
```

---

## 4. DEPENDENCIES

### 4.1 Implementation Order

**Phase 1: Foundation (Prerequisites)**

1. ✅ Database schema có `users.role_version INT DEFAULT 1` (đã có theo DATABASE.md)
2. ⚠️ **CRITICAL:** Update `tokenService.signAccessToken()` để thêm `roleVersion` vào JWT payload
3. ⚠️ **CRITICAL:** Update existing login/refresh-token flows để JWT mới có `roleVersion` field

**Phase 2: Middleware Enhancement**
4. Refactor `auth.middleware.js` → unified `authMiddleware(options)`
5. Implement roleVersion validation logic trong middleware
6. Implement status check trong middleware

**Phase 3: Admin API**
7. Create `admin.service.js` với `changeUserRole()` logic
8. Create `user.repository.js` methods (nếu chưa có)
9. Create `admin.controller.js`
10. Create `admin.routes.js` + attach rate limiter
11. Create Zod validator `admin.validator.js`

**Phase 4: Rate Limiting**
12. Implement `adminRoleChangeRateLimiter` middleware

**Phase 5: Integration & Testing**
13. Update `/auth/refresh-token` API để check roleVersion mismatch
14. Integration test toàn bộ flow
15. Update existing Member B-E route files để dùng enhanced `authMiddleware()`

### 4.2 External Dependencies

**Existing (OK):**

- `jsonwebtoken` — đã có trong `tokenService`
- `zod` — validation library (đã dùng trong project)
- `prisma` — ORM (đã có)
- `express` — web framework

**Possibly Missing (CẦN CONFIRM):**

- `express-rate-limit` — rate limiting middleware
  - **Alternative:** Implement simple in-memory rate limiter (Map-based)
  - **Recommendation:** Nếu chưa có, dùng in-memory implementation cho MVP, sau này scale lên Redis

---

## 5. RISKS & MITIGATIONS

### Risk 1: JWT Payload Size Bloat

**Xác suất:** Low  
**Impact:** Low  
**Mô tả:** Thêm `roleVersion` vào JWT tăng payload size → cookie size tăng → potential browser cookie limit (4KB).

**Mitigation:**

- `roleVersion` chỉ là INT, thêm ~10 bytes vào payload → negligible
- Monitor JWT size sau khi deploy
- Nếu cần optimize: compress JWT hoặc dùng short field name `rv` thay vì `roleVersion`

---

### Risk 2: Race Condition trên role_version Increment

**Xác suất:** Medium  
**Impact:** Medium  
**Mô tả:** Nếu 2 Admin cùng lúc đổi role của 1 user, Prisma `increment` có atomic không?

**Mitigation:**

- ✅ Prisma `{ increment: 1 }` compile thành SQL `SET role_version = role_version + 1` → atomic at DB level
- ✅ MySQL `READ COMMITTED` isolation đủ cho single-row update
- ⚠️ **CONFIRM:** Test concurrent updates thực tế để verify
- **Fallback:** Nếu vẫn có issue, thêm optimistic locking (check `role_version` trong WHERE clause)

---

### Risk 3: Performance Degradation vì DB Query mỗi Request

**Xác suất:** High  
**Impact:** Medium  
**Mô tả:** `authMiddleware` query DB mỗi request để check `role_version` + `status` → latency tăng, DB load cao.

**Mitigation:**

- ✅ Index hiện có trên `users.id` (PRIMARY KEY) → query nhanh (< 5ms với proper index)
- ⚠️ **MONITOR:** Measure actual latency sau deploy (target < 50ms theo spec)
- **Optimization Options:**
  1. Redis cache `{ userId: { roleVersion, status } }` với TTL 30s
  2. Connection pooling (Prisma default)
  3. Read replica cho auth queries nếu production load cao
- **MVP Decision:** Start WITHOUT cache, monitor, optimize nếu cần

---

### Risk 4: Rate Limiter Memory Leak

**Xác suất:** Medium  
**Impact:** Medium  
**Mô tả:** In-memory rate limiter Map không cleanup expired entries → memory leak.

**Mitigation:**

- Implement TTL cleanup: `setInterval(() => cleanupExpiredEntries(), 60000)`
- Limit Map size (max 10,000 entries, evict oldest)
- **Alternative:** Dùng `express-rate-limit` library (battle-tested, có cleanup logic)
- **Recommendation:** Dùng library nếu đã có trong project, nếu không thì implement simple với cleanup

---

### Risk 5: Existing Code Integration Breaking Changes

**Xác suất:** High  
**Impact:** High  
**Mô tả:** Refactor `authMiddleware` có thể break existing Member B-E code đang dùng `requireAuth()` và `requireRole()`.

**Mitigation:**

- **Strategy:** Backward compatibility — giữ `requireAuth()` và `requireRole()` như alias:

  ```javascript
  export const requireAuth = authMiddleware();
  export const requireRole = (...roles) => authMiddleware({ roles });
  ```

- Update từng module (B-E) dần dần thay vì big-bang refactor
- **Rollout Plan:**
  1. Deploy enhanced `authMiddleware` với backward-compatible exports
  2. Test Member A endpoints trước
  3. Notify Member B-E về new API
  4. Migrate từng module khi có thời gian

---

## 6. QUESTIONS FOR HUMAN

### Q1: Token Service Scope

**Issue:** Hiện tại `tokenService.signAccessToken()` không có `roleVersion` field. Updating this affects ALL login/register/refresh flows.

**Question:** Có cần tôi update TẤT CẢ auth flows (login, register, Google OAuth, refresh-token) trong scope này không, hay chỉ update `tokenService` và để Member A tự test/integrate sau?

**Impact:** Nếu không update auth flows, JWT mới vẫn thiếu `roleVersion` → middleware sẽ fail.

**Recommendation:** Include minimal auth flow updates (login + refresh-token) trong scope này để feature hoạt động end-to-end.

---

### Q2: Rate Limiting Library

**Issue:** Project có library `express-rate-limit` chưa? Nếu chưa, có cho phép install không?

**Options:**

- A: Install `express-rate-limit` (standard, battle-tested)
- B: Implement simple in-memory rate limiter (no external dep)

**Recommendation:** Option B cho MVP (follow "no new dependencies without approval" rule), upgrade sau nếu cần.

---

### Q3: Existing Auth Middleware Refactor Scope

**Issue:** File `auth.middleware.js` hiện có `requireAuth()` và `requireRole()`. Refactor thành `authMiddleware(options)` có thể break code đang dùng.

**Question:** Có approve strategy backward-compatible (giữ old exports như alias) không?

**Alternative:** Tạo file mới `authMiddleware.enhanced.js`, giữ nguyên file cũ → ít rủi ro nhưng duplicate code.

**Recommendation:** Backward-compatible refactor (Option 1) để giữ codebase clean.

---

### Q4: Refresh Token Flow Update

**Issue:** SPEC.md Section 8 nói "refresh token tự động từ chối dựa vào roleVersion mismatch" nhưng không nêu rõ AI phải implement logic này.

**Question:** Có cần tôi update `/auth/refresh-token` endpoint để check roleVersion mismatch không, hay đó là responsibility của existing auth module và out-of-scope?

**Current Code:** `tokenService.verifyAccessToken()` chỉ check JWT signature, KHÔNG check roleVersion.

**Recommendation:** Include minimal update trong `authMiddleware` để check roleVersion, nhưng `/auth/refresh-token` endpoint CẦN update riêng (có thể delegate cho Member A nếu out-of-scope).

---

### Q5: System Logging Format

**Issue:** SPEC Section 3 yêu cầu "ghi log vào system logs" cho Admin-to-Admin change nhưng không define format.

**Question:**

- Có logger service/utility trong project không? (winston, pino, hoặc console.log?)
- Log level nào? (INFO, WARN, AUDIT?)
- Có cần structured JSON logs không?

**Recommendation:** Dùng `console.log()` với structured format nếu chưa có logger:

```javascript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  event: 'ADMIN_ROLE_CHANGE',
  adminId,
  targetUserId,
  oldRole,
  newRole
}))
```

---

### Q6: Last Admin Count Query Performance

**Issue:** Query `count(role='ADMIN' AND status='active')` mỗi lần đổi role có thể chậm nếu bảng `users` lớn.

**Question:** Có index trên `(role, status)` chưa? Nếu chưa, có cho phép thêm index không?

**Current:** DATABASE.md không mention index này.

**Recommendation:**

- Check existing indexes trước khi implement
- Nếu chưa có, add migration tạo index `idx_users_role_status(role, status)`
- Alternative: Cache count trong Redis (over-engineering cho MVP)

---

## 7. IMPLEMENTATION CHECKLIST (Reference for TASKS.md)

- [ ] **T1:** Update `tokenService.signAccessToken()` thêm `roleVersion` field
- [ ] **T2:** Refactor `authMiddleware` với roleVersion validation
- [ ] **T3:** Create `adminService.changeUserRole()` với self-action + last-admin checks
- [ ] **T4:** Create `userRepository` methods (findById, updateRole, countAdmins)
- [ ] **T5:** Create `adminController.changeUserRole()`
- [ ] **T6:** Create `admin.routes.js` + wire up middleware stack
- [ ] **T7:** Create Zod validator `changeRoleSchema`
- [ ] **T8:** Implement rate limiter middleware
- [ ] **T9:** Update existing login/refresh flows để JWT có roleVersion
- [ ] **T10:** Integration tests cho acceptance criteria
- [ ] **T11:** Update Member B-E route files (optional migration guide)

---

**END OF PLAN**
