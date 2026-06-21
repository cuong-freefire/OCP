# Implementation Plan: User Profile (feat-profile)

**Version:** 1.0.0 | **Owner:** Member A | **Status:** APPROVED  
**Generated:** 2026-06-19 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy

- **Security-First:** Anti-IDOR pattern - userId ONLY from JWT payload (`req.user.id`), NEVER from request body/params
- **Strict Validation:** Reject forbidden fields explicitly (400 Bad Request) với generic message để không leak field names
- **Layered Architecture:** Route → Middleware → Controller → Service → Repository (tuân thủ CLAUDE.md)
- **Stateless Operations:** Không cache profile data; mọi request query fresh từ DB

### Key Patterns

1. **Whitelist Field Pattern:** Service layer chỉ cho phép update `name` và `avatar_url`, hardcoded allowed list
2. **Empty String Normalization:** `avatar_url=""` → NULL (xóa avatar), `name=""` → reject
3. **Ownership Validation:** Simple regex check userId xuất hiện trong Cloudinary URL path
4. **Regex-Based XSS Prevention:** Reject `<>` characters trong name field (không sanitize)
5. **Partial Update Support:** Cho phép update chỉ name hoặc chỉ avatar_url (flexible)

### Why These Choices

- **Whitelist > Blacklist:** An toàn hơn khi có new fields added vào users table trong tương lai
- **Generic Error Messages:** Không leak internal field names cho attacker
- **Simple Regex Validation:** Đủ an toàn cho MVP, tránh over-engineering
- **503 on Timeout:** Báo hiệu temporary issue, client có thể retry
- **Zod Fail-Fast:** Validate ngay tại middleware layer, không waste controller/service cycles

---

## 2. COMPONENTS

### Backend Module Structure

#### A. Route Layer (`backend/src/api/profile.routes.js`)

**Responsibility:** Define endpoints và mount middleware chain

**Endpoints:**
- `GET /profile/me` → authMiddleware → profileController.getProfile
- `PUT /profile/me` → authMiddleware → validateProfileUpdate → profileController.updateProfile

**Input:** HTTP Request  
**Output:** Delegate to controller

---

#### B. Validator Layer (`backend/src/validators/profile.validator.js`)

**Responsibility:** Zod schema validation cho request body

**Schema:**
```javascript
updateProfileSchema = z.object({
  name: z.string().max(255).regex(/^[^<>]+$/).optional(),
  avatar_url: z.string().url().max(500).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "Body rỗng - phải có ít nhất 1 field"
}).refine(data => {
  const allowedKeys = ["name", "avatar_url"];
  const extraKeys = Object.keys(data).filter(k => !allowedKeys.includes(k));
  return extraKeys.length === 0;
}, {
  message: "Payload chứa các trường không được phép cập nhật"
})
```

**Behavior:**
- REJECT nếu body rỗng `{}`
- REJECT nếu có forbidden fields (email, role, status, etc.) - generic message
- REJECT nếu `name` chứa `<` hoặc `>`
- REJECT nếu `name=""` (empty string)
- PASS nếu chỉ có name hoặc chỉ có avatar_url hoặc cả 2

---

#### C. Controller Layer (`backend/src/controllers/profile.controller.js`)

**Responsibility:** Parse request, gọi service, return response (NO business logic)

**Functions:**

1. **`getProfile(req, res, next)`**
   - Input: `req.user.id` (from authMiddleware)
   - Call: `profileService.getProfile(userId)`
   - Output: HTTP 200 với profile data hoặc next(err)

2. **`updateProfile(req, res, next)`**
   - Input: `req.user.id`, `req.body` (validated)
   - Call: `profileService.updateProfile(userId, data)`
   - Output: HTTP 200 với updated profile hoặc next(err)

---

#### D. Service Layer (`backend/src/services/profile.service.js`)

**Responsibility:** Business logic, field whitelist, ownership validation

**Functions:**

1. **`getProfile(userId)`**
   - Call: `profileRepository.findById(userId)`
   - Filter: Remove `password_hash`, `role_version`
   - Return: `{ id, email, name, avatar_url, role, status }`

2. **`updateProfile(userId, data)`**
   - **Normalize:** `avatar_url === ""` → convert to `null`
   - **Ownership Check:** If `avatar_url` provided and not null:
     ```javascript
     if (!avatar_url.startsWith("https://res.cloudinary.com/")) {
       throw new ValidationError("URL ảnh đại diện không hợp lệ");
     }
     if (!avatar_url.includes(`/${userId}/`) && !avatar_url.includes(`/${userId}.`)) {
       throw new ForbiddenError("URL không thuộc quyền sở hữu của bạn");
     }
     ```
   - Call: `profileRepository.update(userId, data)`
   - Return: Call getProfile(userId) để fetch fresh data

---

#### E. Repository Layer (`backend/src/repositories/profile.repository.js`)

**Responsibility:** ALL Prisma database access

**Functions:**

1. **`findById(userId)`**
   - Prisma: `prisma.users.findUnique({ where: { id: userId } })`
   - Timeout: 5s
   - Return: User object hoặc null

2. **`update(userId, data)`**
   - Prisma: `prisma.users.update({ where: { id: userId }, data })`
   - Timeout: 5s
   - On timeout: throw TimeoutError → 503 Service Unavailable
   - Return: Updated user object

---

## 3. DATA FLOW

### GET /profile/me

```
User → GET /profile/me
  ↓
authMiddleware: Extract userId from JWT → req.user.id
  ↓
Controller: profileController.getProfile(req.user.id)
  ↓
Service: profileService.getProfile(userId)
  ↓
Repository: prisma.users.findUnique({ where: { id } })
  ↓
MySQL: SELECT * FROM users WHERE id = ? (< 10ms)
  ↓
Service: Filter password_hash, role_version
  ↓
Response: HTTP 200 { success: true, data: {...} }
```

### PUT /profile/me

```
User → PUT /profile/me { name: "New", avatar_url: "https://..." }
  ↓
authMiddleware: Extract userId → req.user.id
  ↓
validateProfileUpdate middleware:
  - Zod check body not empty → pass
  - Zod check no forbidden fields → pass
  - Zod check name no <> → pass
  ↓
Controller: profileController.updateProfile(req.user.id, req.body)
  ↓
Service: profileService.updateProfile(userId, data)
  - Normalize avatar_url="" → null
  - Check avatar_url starts with cloudinary domain → pass
  - Check avatar_url contains userId → pass
  ↓
Repository: prisma.users.update({ where: { id }, data })
  ↓
MySQL: UPDATE users SET name=?, avatar_url=? WHERE id=? (< 10ms)
  ↓
Service: getProfile(userId) to fetch fresh data
  ↓
Response: HTTP 200 { success: true, data: {...} }
```

---

## 4. DEPENDENCIES

### Implementation Order

1. Error classes + response utils (no deps)
2. profile.repository.js (depends on Prisma schema verified)
3. profile.service.js (depends on repository)
4. profile.validator.js (Zod schemas)
5. profile.controller.js (depends on service)
6. profile.routes.js (depends on controller + validator + authMiddleware)
7. Wire routes into Express app
8. Unit tests (service whitelist, ownership)
9. Integration tests (2 endpoints + security tests)

### External Dependencies

- `zod` ^3.22.0 (already installed)
- `@prisma/client` ^5.0.0 (already installed)
- `express` ^4.18.0 (already installed)

**No new dependencies.**

### Internal Dependencies

- `authMiddleware` from feat-auth (Member A)
- `users` table schema (already exists per DATABASE.md)

---

## 5. RISKS & MITIGATIONS

### Risk 1: Cloudinary URL Ownership Bypass (MEDIUM)

**Probability:** Low | **Impact:** Medium

**Scenario:** User crafts URL với userId xuất hiện ở unexpected position.

**Mitigation:** Simple regex check `/${userId}/` OR `/${userId}.` sufficient cho MVP vì frontend tuân thủ signed URL pattern từ backend.

---

### Risk 2: Concurrent Profile Update Race (LOW)

**Probability:** Low | **Impact:** Low

**Scenario:** User mở 2 tabs, đồng thời update. Last-write-wins.

**Mitigation:** Accept race condition cho MVP - low impact, user có thể retry.

---

### Risk 3: Performance Degradation Under Load (MEDIUM)

**Probability:** Low | **Impact:** Medium

**Scenario:** MySQL connection pool đầy hoặc slow query.

**Mitigation:**
- PRIMARY KEY index trên users.id (đã có)
- Query timeout 5s → 503 Service Unavailable
- Connection pool size = 20 (increase from default 10)
- Monitor slow queries

---

## 6. RESOLVED QUESTIONS

**Q1: URL Validation →** Simple regex check userId in path  
**Q2: Forbidden Field Error →** Generic message (không leak field names)  
**Q3: DB Timeout Status →** 503 Service Unavailable  
**Q4: Empty Body Validation →** Zod validator middleware (fail fast)  
**Q5: Partial Update →** Allowed (ít nhất 1 trong 2 fields)

---

**Ready for implementation approval.**
