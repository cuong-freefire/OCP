# PLAN.md — Enrollment Management Implementation Plan

**Version:** 1.0.0  
**Owner:** TienTD (Member 3)  
**Based on:** SPEC.md v1.1.0  
**Date:** 2026-06-20  
**Status:** Ready for Implementation

---

## 1. ARCHITECTURAL APPROACH

### 1.1 Overall Strategy

**Layered Architecture với Dependency Injection Pattern**

Enrollment module được thiết kế theo kiến trúc phân lớp chuẩn:
```
Route Layer → Middleware → Controller → Service → Repository → Database
```

**Key Design Decisions:**

1. **Repository Pattern**: Tách biệt data access logic để dễ test và maintain
2. **Service Layer as Contract Provider**: EnrollmentService export `canAccessCourse()` cho Member D inject vào
3. **Event-Driven Architecture**: Lắng nghe payment success event để tạo/update enrollment tự động
4. **Pessimistic Locking**: Dùng `SELECT FOR UPDATE` để handle concurrent access

---

### 1.2 Design Patterns Applied

**1.2.1 Repository Pattern**
- **Lý do chọn**: Tuân thủ project constraint "Service không import Prisma trực tiếp"
- **Implementation**: EnrollmentRepository encapsulate tất cả Prisma queries
- **Benefit**: Dễ mock trong unit tests, dễ switch database layer nếu cần

**1.2.2 Dependency Injection (Constructor DI)**
- **Lý do chọn**: Member D (Learning) cần gọi `canAccessCourse()` mà không tạo HTTP overhead
- **Implementation**: EnrollmentService được inject vào LearningService qua constructor
- **Benefit**: Loose coupling, testable, theo SOLID principles

**1.2.3 Event Listener Pattern**
- **Lý do chọn**: Enrollment creation phải trigger sau payment SUCCESS (loose coupling giữa modules)
- **Implementation**: PaymentService emit event → EnrollmentService listen → process event
- **Benefit**: Decoupled, async processing, extensible

**1.2.4 Idempotent Consumer Pattern**
- **Lý do chọn**: Network retry có thể gửi duplicate payment events
- **Implementation**: Check enrollment state trước khi process, return success nếu đã active
- **Benefit**: Prevent duplicate enrollment, safe retry mechanism

---

## 2. COMPONENTS

### 2.1 EnrollmentRepository

**File:** `backend/src/repositories/enrollment.repository.js`

**Responsibilities:**
- Encapsulate tất cả database operations cho enrollments table
- Implement pessimistic locking với `SELECT FOR UPDATE`
- Handle UNIQUE constraint violations

**Interface:**

```javascript
class EnrollmentRepository {
  constructor(prisma)
  
  // Create new enrollment
  async createEnrollment(data: { 
    userId: string, 
    courseId: string, 
    status: 'active' | 'cancelled' 
  }): Promise<Enrollment>
  
  // Find enrollment with optional lock
  async findEnrollment(
    userId: string, 
    courseId: string, 
    options?: { lock: boolean }
  ): Promise<Enrollment | null>
  
  // Update enrollment status
  async updateEnrollmentStatus(
    enrollmentId: string, 
    status: 'active' | 'cancelled'
  ): Promise<Enrollment>
  
  // Get user enrollments with course details (for API #39)
  async getUserEnrollmentsWithCourses(
    userId: string
  ): Promise<Array<{ 
    enrollmentId, courseId, courseTitle, courseThumbnail, status, enrolledAt 
  }>>
  
  // Get enrollment by ID (for Admin API #44)
  async findEnrollmentById(enrollmentId: string): Promise<Enrollment | null>
  
  // Execute within transaction
  async withTransaction<T>(callback: (tx) => Promise<T>): Promise<T>
}
```

**Key Implementation Details:**
- `findEnrollment({ lock: true })` → sử dụng `prisma.$queryRaw` với `SELECT ... FOR UPDATE`
- `createEnrollment()` → wrap trong transaction, catch UNIQUE constraint error
- `getUserEnrollmentsWithCourses()` → LEFT JOIN với courses table, filter courses.deleted_at IS NULL

---

### 2.2 EnrollmentService

**File:** `backend/src/services/enrollment.service.js`

**Responsibilities:**
- Business logic layer cho enrollment operations
- Export `canAccessCourse()` contract cho Member D
- Handle payment success event
- Implement idempotency logic

**Interface:**

```javascript
class EnrollmentService {
  constructor(enrollmentRepository, courseRepository, userRepository)
  
  // CONTRACT FOR MEMBER D (Learning Module)
  async canAccessCourse(
    userId: string, 
    courseId: string, 
    userRole: string
  ): Promise<boolean>
  
  // EVENT HANDLER (called by Payment Module)
  async handlePaymentSuccess(event: { 
    userId: string, 
    courseId: string,
    paymentId: string 
  }): Promise<void>
  
  // API #39 - Get my courses
  async getMyEnrollments(userId: string): Promise<EnrollmentListResponse>
  
  // API #44 - Admin cancel enrollment
  async cancelEnrollment(
    enrollmentId: string, 
    adminUserId: string
  ): Promise<void>
}
```

**Key Business Rules:**

**`canAccessCourse()` Logic:**
```
1. IF userRole === 'ADMIN' OR 'MANAGER' → return true (bypass)
2. Check user.status via userRepository
   IF user.status === 'blocked' → return false (Security Layer 1)
3. IF userRole === 'MENTOR':
   - Get course.mentor_id via courseRepository
   - IF course.mentor_id === userId → return true (ownership bypass)
4. IF userRole === 'LEARNER':
   - Find enrollment via enrollmentRepository
   - IF enrollment exists AND status === 'active' → return true
5. ELSE → return false
```

**`handlePaymentSuccess()` Logic:**
```
1. Start transaction
2. Find enrollment với SELECT FOR UPDATE
3. IF enrollment NOT exists → createEnrollment(status='active')
4. ELSE IF enrollment.status === 'cancelled' → updateEnrollmentStatus('active')
5. ELSE IF enrollment.status === 'active' → return success (idempotent)
6. Commit transaction
7. IF UNIQUE constraint error → log and return success (idempotent fallback)
```

---

### 2.3 EnrollmentController

**File:** `backend/src/controllers/enrollment.controller.js`

**Responsibilities:**
- HTTP request/response handling
- Extract userId from JWT (req.user)
- Call service methods
- Format responses theo project convention

**Interface:**

```javascript
class EnrollmentController {
  constructor(enrollmentService)
  
  // API #39 - GET /enrollments/my-courses
  async getMyEnrollments(req, res, next)
  
  // API #44 - DELETE /admin/enrollments/:id
  async cancelEnrollment(req, res, next)
}
```

**Response Formats:**

```javascript
// API #39 Success
{
  success: true,
  data: {
    enrollments: [
      {
        enrollmentId: "uuid",
        courseId: "uuid",
        courseTitle: "Course Name",
        courseThumbnail: "https://...",
        status: "active",
        enrolledAt: "2026-06-20T10:00:00.000Z"
      }
    ]
  }
}

// API #44 Success
{
  success: true,
  message: "Enrollment cancelled"
}

// API #44 Error (404)
{
  success: false,
  message: "Enrollment not found",
  code: "ENROLLMENT_NOT_FOUND"
}
```

---

### 2.4 Middleware Components

**2.4.1 authMiddleware** (Existing - từ Member A)
- Verify JWT httpOnly cookie
- Extract user info → req.user = { userId, role, status }
- Reject nếu JWT invalid hoặc expired

**2.4.2 roleMiddleware** (Existing - từ Member A)
- Check req.user.role
- Enforce role-based access (API #44 chỉ cho ADMIN)

**Note:** Enrollment module KHÔNG tạo middleware mới, reuse existing từ Auth module.

---

### 2.5 Route Definitions

**File:** `backend/src/routes/enrollment.routes.js`

```javascript
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/auth.middleware');

// API #39 - Learner gets their enrollments
router.get(
  '/my-courses',
  authMiddleware,  // JWT required
  enrollmentController.getMyEnrollments
);

// API #44 - Admin cancels enrollment
router.delete(
  '/:id',
  authMiddleware,   // JWT required
  roleMiddleware(['ADMIN']),  // Admin only
  enrollmentController.cancelEnrollment
);

module.exports = router;
```

**Mount Point:** `/api/enrollments` (trong `backend/src/app.js`)

---

### 2.6 Event Listener Setup

**File:** `backend/src/events/enrollment.listener.js`

```javascript
// Payment Module emits event
eventEmitter.on('payment.success', async (event) => {
  try {
    await enrollmentService.handlePaymentSuccess(event);
  } catch (error) {
    logger.error('Failed to process payment success event', { 
      event, 
      error: error.message 
    });
    // Note: Không throw error để không crash event loop
    // Có thể implement retry queue (future enhancement)
  }
});
```

**Event Payload từ Payment Module:**
```javascript
{
  userId: "uuid",
  courseId: "uuid",
  paymentId: "uuid",  // for tracing
  timestamp: "ISO 8601"
}
```

---

## 3. DATA FLOW

### 3.1 Flow 1: Create Enrollment (Auto - từ Payment Success)

```
┌─────────────────┐
│ Payment Module  │
│ (Member 3)      │
└────────┬────────┘
         │ emit('payment.success', { userId, courseId })
         ↓
┌─────────────────────────────────┐
│ EnrollmentListener              │
│ (enrollment.listener.js)        │
└────────┬────────────────────────┘
         │ call handlePaymentSuccess()
         ↓
┌─────────────────────────────────┐
│ EnrollmentService               │
│ - Start transaction             │
│ - SELECT FOR UPDATE             │
│ - Check enrollment state        │
│ - CREATE or UPDATE              │
│ - Commit                        │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentRepository            │
│ - Prisma.$transaction()         │
│ - Prisma.$queryRaw (lock)       │
│ - Prisma.enrollment.create()    │
│ - Prisma.enrollment.update()    │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ MySQL Database                  │
│ Table: enrollments              │
│ - Insert or Update row          │
│ - Release lock                  │
└─────────────────────────────────┘
```

**Idempotency Handling:**
- Nếu enrollment đã `active` → no-op, return success
- Nếu UNIQUE constraint error → catch, log, return success (already exists)

---

### 3.2 Flow 2: Check Course Access (canAccessCourse)

```
┌─────────────────┐
│ Learning Module │
│ (Member D)      │
│ - LessonService │
│ - QuizService   │
└────────┬────────┘
         │ DI inject EnrollmentService
         │ call canAccessCourse(userId, courseId, role)
         ↓
┌─────────────────────────────────┐
│ EnrollmentService               │
│ 1. Check role bypass            │
│    (ADMIN/MANAGER → true)       │
│ 2. Check user.status            │
│    (blocked → false)            │
│ 3. Check mentor ownership       │
│    (course.mentor_id === userId)│
│ 4. Check enrollment.status      │
│    (active → true)              │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentRepository            │
│ + UserRepository (for status)   │
│ + CourseRepository (for owner)  │
│ - Single JOIN query:            │
│   SELECT e.*, u.status, c.mentor_id
│   FROM enrollments e            │
│   JOIN users u ON e.user_id=u.id│
│   JOIN courses c ON e.course_id=c.id
│   WHERE e.user_id=? AND e.course_id=?
│ - Use composite index           │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ MySQL Database                  │
│ - Index: (user_id, course_id)   │
│ - Response time: < 50ms         │
└─────────────────────────────────┘
```

**Performance Optimization:**
- Single query với JOINs (không multiple queries)
- Composite index `(user_id, course_id)` trên enrollments
- Cache result trong 60s (optional, nếu cần)

---

### 3.3 Flow 3: Get My Enrollments (API #39)

```
┌─────────────────┐
│ Frontend (React)│
└────────┬────────┘
         │ GET /api/enrollments/my-courses
         │ Cookie: jwt=...
         ↓
┌─────────────────────────────────┐
│ authMiddleware                  │
│ - Verify JWT                    │
│ - Set req.user = { userId, role }
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentController            │
│ - Extract userId từ req.user    │
│ - Call service.getMyEnrollments()
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentService               │
│ - Call repository method        │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentRepository            │
│ SELECT e.id, e.course_id, e.status,
│        e.enrolled_at, c.title, c.thumbnail
│ FROM enrollments e              │
│ LEFT JOIN courses c ON e.course_id=c.id
│ WHERE e.user_id = ?             │
│ ORDER BY e.enrolled_at DESC     │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Response                        │
│ {                               │
│   success: true,                │
│   data: { enrollments: [...] }  │
│ }                               │
└─────────────────────────────────┘
```

---

### 3.4 Flow 4: Admin Cancel Enrollment (API #44)

```
┌─────────────────┐
│ Admin Frontend  │
└────────┬────────┘
         │ DELETE /api/enrollments/:id
         │ Cookie: jwt=... (Admin role)
         ↓
┌─────────────────────────────────┐
│ authMiddleware                  │
│ + roleMiddleware(['ADMIN'])     │
│ - Verify JWT + role             │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentController            │
│ - Extract enrollmentId từ params│
│ - Call service.cancelEnrollment()
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentService               │
│ 1. Find enrollment by ID        │
│ 2. IF not found → throw 404     │
│ 3. Update status = 'cancelled'  │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ EnrollmentRepository            │
│ UPDATE enrollments              │
│ SET status = 'cancelled'        │
│ WHERE id = ?                    │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Response                        │
│ {                               │
│   success: true,                │
│   message: "Enrollment cancelled"
│ }                               │
│                                 │
│ Note: KHÔNG gửi email notification
│ (Silent cancel)                 │
└─────────────────────────────────┘
```

---

## 4. DEPENDENCIES

### 4.1 Implementation Order

**Phase 1: Foundation (Database & Repository)**
1. ✅ Prisma schema already defined (from DATABASE.md)
2. Create migration: `npx prisma migrate dev --name add_enrollments_table`
3. Create `EnrollmentRepository` với all methods
4. Unit test `EnrollmentRepository` (mock Prisma)

**Phase 2: Service Layer**
5. Create `EnrollmentService` với business logic
6. Implement `canAccessCourse()` method (contract cho Member D)
7. Implement `handlePaymentSuccess()` event handler
8. Unit test `EnrollmentService` (mock repositories)

**Phase 3: API Layer**
9. Create `EnrollmentController`
10. Create `enrollment.routes.js`
11. Register routes trong `app.js`
12. Unit test `EnrollmentController` (mock service)

**Phase 4: Event Integration**
13. Create `enrollment.listener.js`
14. Register event listener trong `app.js` hoặc `server.js`
15. Integration test: emit fake payment event, verify enrollment created

**Phase 5: Integration Testing**
16. API integration tests với supertest (API #39, #44)
17. Contract test: verify `canAccessCourse()` với Member D
18. Performance test: verify < 50ms response time với 1000 concurrent calls

---

### 4.2 External Dependencies

**NPM Packages (Already in project):**
- `@prisma/client` - Database ORM
- `express` - HTTP server
- `jsonwebtoken` - JWT parsing (via authMiddleware)
- `zod` - Input validation (nếu cần validate request body)

**Internal Module Dependencies:**
- **Member A (Auth)**: `authMiddleware`, `roleMiddleware`, `userRepository`
- **Member B (Course)**: `courseRepository` (để check mentor_id trong canAccessCourse)
- **Member C (Payment)**: Event emitter setup (để listen payment.success)

**Database Dependencies:**
- MySQL 8.0+
- Composite index `(user_id, course_id)` trên enrollments table
- Foreign keys với ON DELETE RESTRICT

---

### 4.3 Cross-Module Contracts

**Contract Provided BY Enrollment Module:**
```javascript
// Member D (Learning) inject này vào constructor
class EnrollmentService {
  async canAccessCourse(userId, courseId, userRole): Promise<boolean>
}
```

**Contract Consumed FROM other modules:**
```javascript
// From Member A (Auth)
class UserRepository {
  async findUserById(userId): Promise<User>  // để check status
}

// From Member B (Course)
class CourseRepository {
  async findCourseById(courseId): Promise<Course>  // để check mentor_id
}
```

---

## 5. RISKS & MITIGATIONS

### Risk 1: Race Condition giữa Payment Event và Admin Cancel

**Probability:** Medium  
**Impact:** High (data inconsistency - enrollment vừa bị cancel lại được tạo lại)

**Scenario:**
1. Admin cancel enrollment (status → 'cancelled') tại T1
2. Payment success event arrive늦게(delayed) tại T2
3. Event handler tìm thấy enrollment với status='cancelled'
4. Update lại thành status='active' (unexpected behavior)

**Mitigation:**
- ✅ Sử dụng `SELECT FOR UPDATE` trong cả Admin cancel và Payment event handler
- ✅ Admin cancel phải lock row trước khi update
- ✅ Payment event handler check `updated_at` timestamp:
  ```javascript
  // Nếu enrollment.updated_at > payment.timestamp
  // → skip update (enrollment đã bị thay đổi sau payment)
  if (enrollment.updatedAt > paymentTimestamp) {
    logger.warn('Enrollment modified after payment, skipping update');
    return;
  }
  ```
- ✅ Add `payment_id` reference vào enrollments table (future enhancement) để track nguồn gốc

---

### Risk 2: Performance Bottleneck của canAccessCourse()

**Probability:** High (nếu không optimize)  
**Impact:** High (violate < 50ms requirement, block Member D operations)

**Scenario:**
- Member D gọi `canAccessCourse()` cho mỗi lesson/quiz request
- Nếu 1000 concurrent learners access lessons → 1000 queries/second
- Nếu query không có index → full table scan → timeout

**Mitigation:**
- ✅ **Composite Index**: `CREATE INDEX idx_user_course ON enrollments (user_id, course_id)`
- ✅ **Single JOIN Query**: Fetch enrollment + user.status + course.mentor_id trong 1 query
- ✅ **Caching Layer** (optional):
  ```javascript
  // Redis cache với TTL 60s
  const cacheKey = `access:${userId}:${courseId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const result = await checkDatabase();
  await redis.setex(cacheKey, 60, JSON.stringify(result));
  return result;
  ```
- ✅ **Query Optimization**: EXPLAIN ANALYZE query để verify index usage
- ✅ **Load Testing**: Verify p95 < 50ms với `wrk` hoặc `k6` tool

---

### Risk 3: Event Loss khi Payment Module emit event

**Probability:** Low (với EventEmitter trong cùng process)  
**Impact:** Critical (enrollment không được tạo → user mất quyền học sau khi trả tiền)

**Scenario:**
1. Payment module emit `payment.success` event
2. EnrollmentListener throw error (DB connection lost, validation failed)
3. Event bị mất, không retry
4. User đã trả tiền nhưng không có enrollment

**Mitigation:**
- ✅ **Idempotency**: Payment module có thể safely retry emit event
- ✅ **Error Logging**: Log chi tiết error với paymentId, userId, courseId
- ✅ **Manual Reconciliation Script**: Admin tool để sync enrollments từ payments table
  ```sql
  -- Find payments without enrollments
  SELECT p.user_id, p.course_id
  FROM payments p
  WHERE p.status = 'SUCCESS'
  AND NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.user_id = p.user_id AND e.course_id = p.course_id
  );
  ```
- ✅ **Future Enhancement**: Migrate to Message Queue (RabbitMQ, Redis Streams) với retry và dead-letter queue

---

### Risk 4: UNIQUE Constraint Violation khi Concurrent Events

**Probability:** Low  
**Impact:** Medium (log error nhưng không ảnh hưởng user experience nếu handle đúng)

**Scenario:**
1. 2 payment success events cho cùng (userId, courseId) arrive cùng lúc
2. Cả 2 check "enrollment not exists" → cả 2 cố INSERT
3. MySQL throw UNIQUE constraint error cho request thứ 2

**Mitigation:**
- ✅ **Transaction + Lock**: `SELECT FOR UPDATE` prevent concurrent check
- ✅ **Catch UNIQUE Error**: Wrap INSERT trong try-catch, treat as success (idempotent)
  ```javascript
  try {
    await repository.createEnrollment({ userId, courseId, status: 'active' });
  } catch (error) {
    if (error.code === 'P2002') {  // Prisma unique constraint error
      logger.info('Enrollment already exists, treating as success', { userId, courseId });
      return;  // Idempotent
    }
    throw error;  // Other errors
  }
  ```
- ✅ **Database-level Safety**: UNIQUE constraint là last line of defense

---

### Risk 5: Blocked User Bypass Check Failure

**Probability:** Low  
**Impact:** Critical (security breach - blocked user vẫn học được)

**Scenario:**
- User bị block (users.status = 'blocked') nhưng enrollment.status vẫn 'active'
- `canAccessCourse()` chỉ check enrollment, skip check user.status
- Blocked user vẫn access được lesson content

**Mitigation:**
- ✅ **Security Layer 1**: ALWAYS check user.status TRƯỚC enrollment.status
- ✅ **Unit Test Coverage**: Test case "blocked user với active enrollment → return false"
- ✅ **Integration Test**: E2E test blocked user scenario
- ✅ **Code Review Checklist**: Review canAccessCourse() logic với security focus

---

## 6. QUESTIONS FOR HUMAN

### Q1. Payment Success Event Structure

**Context:** SPEC line 24 nói "nhận được sự kiện thanh toán thành công" nhưng không define event payload.

**Question:** Event từ Payment Module (Member 3) có structure chính xác là gì?
```javascript
// Option A: Minimal
{ userId, courseId }

// Option B: With metadata
{ userId, courseId, paymentId, orderId, amount, timestamp }
```

**Why it matters:** Nếu có `paymentId`, có thể track enrollment nguồn gốc. Nếu có `timestamp`, có thể detect stale events.

**Recommendation:** Option B (with metadata) để dễ debug và implement stale event detection.

---

### Q2. Mentor Ownership Check Performance

**Context:** SPEC line 41 nói "Mentor sở hữu khóa học đó (kiểm tra qua courseOwnerId)".

**Question:** `canAccessCourse()` có nhận `courseOwnerId` như parameter không?
```javascript
// Option A: Query inside
async canAccessCourse(userId, courseId, userRole) {
  // Query courses.mentor_id từ database
}

// Option B: Pass as parameter
async canAccessCourse(userId, courseId, userRole, courseOwnerId) {
  // So sánh trực tiếp userId === courseOwnerId
}
```

**Why it matters:** Option A accurate nhưng thêm 1 JOIN query (có thể > 50ms với courses table lớn). Option B fast nhưng Member D phải query trước.

**Recommendation:** Option B (pass courseOwnerId) để đảm bảo < 50ms. Document rõ trong contract.

---

### Q3. Cache Strategy for canAccessCourse()

**Context:** SPEC line 46 yêu cầu < 50ms nhưng không đề cập caching.

**Question:** Có implement Redis cache cho `canAccessCourse()` result không?
- **TTL bao nhiêu?** (suggest 60s)
- **Cache invalidation trigger?** (khi enrollment status change? khi user blocked?)

**Why it matters:** Cache giảm DB load drastically nhưng cần strategy clear để avoid stale data.

**Recommendation:** 
- MVP: NO cache, rely on index optimization
- Phase 2: Add Redis cache với TTL 60s + invalidation khi enrollment/user status change

---

### Q4. Enrollment History / Audit Log

**Context:** SPEC không đề cập audit trail cho enrollment state changes.

**Question:** Có cần bảng `enrollment_history` để track:
- Enrollment created by payment vs manual
- Admin cancel actions với timestamp + admin_user_id
- Status transitions (active → cancelled → active)

**Why it matters:** Compliance, dispute resolution, debugging payment issues.

**Recommendation:** Add `enrollment_history` table trong same migration, log mọi state change.

---

### Q5. Concurrent Admin Cancel vs Payment Event

**Context:** Risk 1 trong section 5 về race condition.

**Question:** Khi Admin cancel enrollment ĐỒNG THỜI với payment event arrive:
- **Priority rule?** Admin action win hay Payment event win?
- **Notification?** Admin có nhận warning "Enrollment vừa bị thanh toán thành công, bạn vẫn muốn cancel không?"

**Why it matters:** Business decision về conflict resolution.

**Recommendation:**
- Admin action có priority (manual override)
- Payment event check `updated_at`, skip nếu enrollment modified after payment timestamp
- Admin UI show warning nếu detect recent payment

---

### Q6. Error Response Format Consistency

**Context:** SPEC line 59 define `code: "ENROLLMENT_NOT_FOUND"` nhưng project có global error code convention không?

**Question:** Error codes có format chuẩn không?
```javascript
// Option A: Module prefix
"ENROLLMENT_NOT_FOUND"
"ENROLLMENT_ALREADY_CANCELLED"

// Option B: HTTP-aligned
"NOT_FOUND"
"CONFLICT"

// Option C: Numeric
"E3001"  // E = Enrollment, 3 = Member, 001 = specific error
```

**Why it matters:** Frontend cần parse error codes để show user-friendly messages.

**Recommendation:** Follow existing convention trong `CLAUDE.md` hoặc `constitution.md`. Nếu chưa có, suggest Option A (descriptive codes).

---

**End of PLAN.md**
