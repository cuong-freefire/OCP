# Shared Context — Ngữ cảnh chia sẻ & hợp đồng giao tiếp

Dự án Online Course Platform (OCP) được chia thành nhiều phân hệ độc lập nhưng có liên kết nghiệp vụ chặt chẽ. Tài liệu này mô tả flow tổng thể, ownership dữ liệu và các contract giao tiếp giữa module để mỗi feature spec có cùng nền ngữ cảnh.

## 1. System Flow

1. `Guest` đăng ký, xác thực email và đăng nhập.
2. `Guest` hoặc `Learner` browse Course và xem Course Detail.
3. `Learner` mua Paid Course qua VNPAY.
4. Payment/Enrollment xác nhận thanh toán thành công và tạo enrollment.
5. `Learner` học lesson, làm quiz và đánh giá khóa học.
6. `Mentor` tạo khóa học, tạo draft content, submit revision for review.
7. `Manager` phê duyệt hoặc reject course revision trước khi publish.
8. `Admin` quản lý user, course status, reports và vận hành hệ thống.

## 2. Module Ownership

| Member | Module | Trọng tâm | Owner Database Tables |
| --- | --- | --- | --- |
| A | Auth, Email, Profile | Đăng nhập, JWT, xác thực email, hồ sơ người dùng | `users`, `refresh_tokens`, `email_verifications`, `password_reset_tokens` |
| B | Mentor Course Studio, Revision | Tạo khóa học, chỉnh sửa draft, nộp revision, snapshot | `courses`, `course_revisions`, `course_sections`, `lessons`, `lesson_assets`, `quizzes`, `quiz_questions` |
| C | Payment, Enrollment, Catalog | Thanh toán VNPAY, ghi danh, quyền truy cập khóa học, danh mục | `orders`, `payments`, `enrollments` |
| D | Learning, Quiz, Rating | Học bài, quiz tự chấm, đánh giá khóa học | `quiz_submissions`, `ratings`, `feedbacks` |
| E | Manager Approval, Admin | Phê duyệt/reject course revision, admin quản lý user, reports | `course_reviews`, `review_comments` |

## 3. Cross-Module Contracts

Các module không được truy cập tùy tiện vào dữ liệu nội bộ của nhau. Khi cần dữ liệu ngoài ownership, module phải dùng contract/adapter đã thống nhất.

### 3.1 Course Access & Rating Contracts (Member C ↔ Member D)

**Provider**: Payment/Enrollment module (Member C)
**Consumers**: Learning module (Member D)
**Integration**: Dependency Injection (NOT HTTP - modular monolith pattern per E4.4)

**Exported Services:**

```javascript
class EnrollmentService {
  // Check course access before serving lesson/quiz/rating
  async canAccessCourse(userId, courseId, role): Promise<boolean>
  
  // Check enrollment active status before accepting rating (E2.4)
  async canSubmitRating(userId, courseId): Promise<boolean>
}
```

**Usage in Member D:**

- Member D receives EnrollmentService via constructor DI (NOT HTTP fetch)
- Before POST /quizzes/submit: check `canAccessCourse(userId, courseId, req.user.role)` (dynamic role - support MANAGER/ADMIN bypass)
- Before POST /ratings: check `canSubmitRating(userId, courseId)`
- Enrollment.status MUST be 'active' to unlock all learning features
- MANAGER/ADMIN bypass enrollment check (canAccessCourse returns true regardless of enrollment)
- MENTOR access via ownership check (canAccessCourse returns true if mentor owns course)

**Purpose**: Prevent direct table access from Member D → enforce backend authorization with role-based bypass for course access.

---

### 3.2 Course Edit Permission Contract (Member B → Member E)

**Provider**: Mentor Course Studio (Member B)
**Consumers**: Manager Approval (Member E)

**Exported Function:**

```javascript
function canEditCourse(userId: string, courseId: string): boolean {
  // Mentor can edit ONLY if course.mentor_id === userId 
  // AND course.status in ['draft', 'rejected']
  // Published/Archived courses are LOCKED for edit
  // Archived course: learners already enrolled, edits would break experience
  return course.mentor_id === userId && 
         ['draft', 'rejected'].includes(course.status) &&
         course.status !== 'archived';
}
```

**Business Constraints (BẮT BUỘC):**
- Chỉ trả về true nếu `course.mentor_id === userId`.
- Khóa học PHẢI đang ở trạng thái `draft` hoặc `rejected`.
- TUYỆT ĐỐI CẤM edit khóa học ở trạng thái `archived` (để không làm hỏng dữ liệu của học viên cũ).

**Usage in Member E (Approval Flow - T081):**

- Member E gọi hàm này khi Manager bấm duyệt khóa học (Publish).
- Mục đích: Prevent Mentor self-approval (Fix E2.3).
- **Self-approval check**: Nếu `canEditCourse(req.user.id, courseId) === true` → Manager hiện tại chính là Mentor → REJECT duyệt (throw ForbiddenError 'SELF_APPROVAL_FORBIDDEN').
- Chỉ cho phép Manager khác (không phải Mentor) mới được duyệt.

**Purpose**: Enforce course status rules, prevent unauthorized edits, và ngăn chặn Mentor duyệt khóa học của chính mình.

---

### 3.3 Enrollment Success Event Contract (Member C → Member A, D, E)

**Provider**: Payment/Enrollment module (Member C)
**Consumers**: Auth/Email (A), Learning (D), Reports (E)

**Event**: `Payment SUCCESS → Enrollment CREATED`

**Payload:**

```javascript
{
  userId,
  courseId,
  enrollmentId,
  enrolledAt,
  paymentAmount,
  status: 'active'
}
```

**Consumer Actions:**

- **Member A**: Send enrollment email confirmation
- **Member D**: Unlock course dashboard, serve lessons

**Purpose**: Trigger downstream effects after successful payment without tight coupling. (Analytics queried via Section 3.4 Internal APIs, not event-driven)

---

### 3.4 Internal Analytics APIs (Member C, D → Member B, E)

**Authorization Rules:**
- `/internal/*` endpoints accept ONLY service-to-service Bearer tokens (NOT user JWT)
- OR: Check `req.user.role in ['MANAGER', 'ADMIN']` if using user JWT
- Response NEVER exposes: payment details, learner PII, sensitive metadata
- Only aggregate data (counts, sums, averages) returned

**Provider 1 - Member C** (Payment/Enrollment):

```
GET /internal/courses/:courseId/stats
Authorization: Bearer SERVICE_TOKEN or User JWT (MANAGER/ADMIN only)

Response:
{
  courseId: "uuid",
  totalEnrollments: 150,
  activeEnrollments: 145,
  revenue: 37500000,
  lastUpdated: "2026-06-18T15:00:00Z"
}

Error Codes:
- 403 Forbidden: User role not MANAGER/ADMIN or invalid service token
- 401 Unauthorized: Missing/invalid token
```

**Purpose**: Member B analyzes course performance, Member E shows dashboard metrics. Learners/Mentors CANNOT access.

---

**Provider 2 - Member D** (Learning/Quiz/Rating):

```
GET /internal/courses/:courseId/rating-stats
Authorization: Bearer SERVICE_TOKEN or User JWT (MANAGER/ADMIN only)

Response:
{
  courseId: "uuid",
  avgRating: 4.2,
  totalRatings: 142,
  feedbackCount: 89,
  recentFeedbacks: [
    { userId: "uuid", text: "...", createdAt: "..." }  // NO learner PII
  ]
}

Error Codes:
- 403 Forbidden: User role not MANAGER/ADMIN or invalid service token
- 401 Unauthorized: Missing/invalid token
```

**Purpose**: Member B analyzes course quality, Member E shows admin dashboard. Learners/Mentors CANNOT access.

---

### 3.5 Manager Approval Contracts (Member E ← Member B snapshot)

**Provider**: Mentor Course Studio (Member B) - via course_revisions.snapshot_data
**Consumer**: Manager Approval (Member E)

**Workflow:**

1. Mentor submits revision with FULL CURRICULUM snapshot (E1.1):

   ```javascript
   {
     // Metadata
     title, description, thumbnail, price, category, level,
     // Full curriculum
     sections: [...], lessons: [...], quizzes: [...], quiz_questions: [...]
   }
   ```

2. Manager reviews snapshot_data (NOT live course table) and decides:
   - `PUBLISH`: Restore full curriculum from snapshot in single transaction (E1.1)
     - Transaction timeout: 30s (configurable per large course size)
     - IF timeout → rollback all, revision.status = 'failed_publish'
     - Manager must retry manually via UI
     - Log full error for debugging (NOT expose to frontend)
   - `REJECT`: Revert to draft, save reject comment

**Error Handling:**
```javascript
try {
  await db.$transaction(async (tx) => {
    // Restore full curriculum from snapshot
    // ... (sections, lessons, quizzes, assets restoration logic)
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  
  revision.status = 'published';
} catch (error) {
  if (error.code === 'P2028') { // Prisma timeout
    revision.status = 'failed_publish';
    logger.error(`Publish timeout for revision ${revisionId}: ${error.message}`);
  } else {
    revision.status = 'failed_publish';
    logger.error(`Publish failed for revision ${revisionId}: ${error.message}`);
  }
  throw new PublishError('Course restore failed. Try again.');
}
```

**Purpose**: Prevent Mentor from modifying course AFTER Manager starts review (immutable snapshot pattern). Robust error handling prevents orphaned/corrupted curriculum state.

---

### 3.6 Cross-Module Authorization Matrix

| Operation | Member A | Member B | Member C | Member D | Member E |
|-----------|----------|----------|----------|----------|----------|
| Create user | ✅ | - | - | - | - |
| Auth/JWT | ✅ | - | - | - | - |
| Create course | - | ✅ | - | - | - |
| Submit revision | - | ✅ | - | - | - |
| Create payment | - | - | ✅ | - | - |
| Create enrollment | - | - | ✅ | - | - |
| Access course | - | ✅ Check ownership via B | Check via C | ✅ D only | ✅ Always |
| Submit quiz | - | - | - | ✅ enrolled | - |
| Rate course | - | - | - | ✅ enrolled | - |
| Approve course | - | - | - | - | ✅ |

**Rule**: Each row = what a role can do. Each column = what they can access. Cross-column = use exported contract, NEVER direct table query.

## 4. Global Data Safety Rules

- Dữ liệu phát sinh payment/enrollment không được hard delete tùy tiện.
- Module nào sở hữu dữ liệu thì module đó quyết định schema và business meaning.
- Module ngoài chỉ được đọc qua contract đã thống nhất.
- Cross-module failure phải được map thành lỗi rõ ràng hoặc warning, không để crash dây chuyền.
