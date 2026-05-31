# PROJECT_AGENTS.md — Bách khoa toàn thư dự án OCP

# Phiên bản: 1.0 | Trạng thái: ACTIVE | Công cụ: OpenAI Codex | Updated: 2026-05-27

## 1. TL;DR

Dự án OCP (Online Course Platform) là nền tảng khóa học trực tuyến.

Backend dùng NodeJS API, MySQL, Prisma. Frontend dùng React và Bootstrap. Auth dùng JWT trong `httpOnly Cookie`. Validation dùng Zod. Payment gateway là VNPAY.

Ba mục tiêu kỹ thuật chính:

1. **Toàn vẹn quyền học**: paid course chỉ mở khi backend xác nhận enrollment hợp lệ.
2. **Mentor chấm đúng phạm vi**: Mentor chỉ xem/chấm submission thuộc Course được Admin phân công.
3. **Admin report ổn định**: Reports read-only, tổng hợp dữ liệu nhiều module và chịu lỗi dependency bằng partial response.

Ba feature spec đang active:

- `feat-admin-management`: quản lý user, Mentor và assignment.
- `feat-mentor-review`: Mentor queue và chấm Final Project.
- `feat-reports`: Dashboard và Reports cho Admin.

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Service chính

| Service | Trách nhiệm | Port dự kiến | Repo/Path |
| --- | --- | --- | --- |
| `ocp-web` | Frontend React | 3000 | `/frontend` |
| `ocp-api` | Backend NodeJS API monolith | 4000 | `/backend` |
| MySQL | Database chính | 3306 | managed/local |

### 2.2 Flow tổng quát

```text
Guest -> Register/Login -> Browse Course -> View Course Detail
Learner -> Buy/Enroll Course -> Learn Lesson -> Quiz -> Submit Final Project
Mentor -> Review Queue -> Review PASS/FAIL + Feedback
Admin -> User/Mentor Management -> Reports Dashboard
```

### 2.3 Payment và Enrollment Flow

```text
Learner
  -> ocp-web gửi ý định mua course
  -> ocp-api kiểm tra JWT + Course contract
  -> ocp-api tạo payment/VNPAY URL
  -> VNPAY xử lý thanh toán
  -> ocp-api verify callback/return
  -> MySQL cập nhật payment SUCCESS
  -> tạo enrollment
  -> Learner được quyền học
```

Rule: payment `PENDING` không unlock paid course.

### 2.4 Mentor Review Flow

```text
Admin tạo Mentor assignment
  -> Mentor mở Review Queue
  -> Backend kiểm tra JWT + role MENTOR
  -> Backend kiểm tra isMentorAssignedToCourse
  -> Mentor submit PASS/FAIL + feedback
  -> Backend lưu review + feedback + update submission status atomically
```

Rule: Mentor role chưa đủ; phải có assignment theo Course.

### 2.5 Reports Flow

```text
Admin
  -> GET /admin/dashboard
  -> Backend kiểm tra JWT + role ADMIN
  -> DashboardService gọi report adapters song song
  -> Adapter success đưa vào DTO
  -> Adapter fail/timeout đưa vào warnings[]
  -> Response HTTP 200 với partial data nếu có lỗi từng phần
```

Rule: Reports read-only, không mutate dữ liệu nguồn.

## 3. QUYẾT ĐỊNH KIẾN TRÚC QUAN TRỌNG (ADR)

### ADR-001: Dùng backend monolith `ocp-api`

Quyết định: Backend NodeJS xử lý auth, course, payment, enrollment, learning, mentor, admin và report trong một API monolith.

Lý do: MVP/team nhỏ cần dễ debug, dễ triển khai, ít overhead vận hành.

Trade-off: Khi hệ thống lớn, monolith có thể phình to. Cần chia code rõ theo module ngay từ đầu.

### ADR-002: Backend là nguồn quyết định phân quyền

Quyết định: Frontend chỉ hỗ trợ UX; backend quyết định quyền thật.

Rule:

- Admin APIs phải check role Admin.
- Mentor APIs phải check role Mentor và assignment.
- Learner APIs phải check enrollment/access.

### ADR-003: Auth dùng JWT trong httpOnly Cookie

Quyết định: JWT được lưu trong `httpOnly Cookie`, không lưu trong browser storage.

Rule:

- Backend đọc token từ `req.cookies`.
- Frontend dùng `withCredentials: true`.
- Không tự gắn Bearer token.

### ADR-004: Dùng RBAC cho actor chính

Actor chính:

- Guest.
- Learner.
- Mentor.
- Admin.

Rule: Mỗi API quan trọng phải khai báo rõ role nào được gọi.

### ADR-005: Course access dựa trên Enrollment/Entitlement

Quyết định: Learner chỉ học paid course khi có enrollment hợp lệ.

Rule:

- Free course có thể enroll miễn phí.
- Paid course chỉ unlock sau khi backend verify payment và tạo enrollment.
- Không dùng payment `PENDING` để cấp quyền học.

### ADR-006: Tích hợp VNPAY qua backend

Quyết định: Chỉ backend tạo VNPAY URL, ký request và verify callback/return.

Rule:

- Frontend không gọi VNPAY trực tiếp.
- Frontend không quyết định payment success.
- Backend không nhận amount/price từ frontend.

### ADR-007: Payment phải idempotent

Quyết định: `paymentRef` hoặc `transactionId` chỉ được xử lý thành công một lần.

Rule:

- Callback gọi lại không tạo enrollment trùng.
- Payment đã `SUCCESS` không xử lý side effect lặp.

### ADR-008: Dùng MySQL làm database chính

Quyết định: MySQL lưu dữ liệu quan hệ chính.

Trade-off: Cần index tốt cho bảng lớn như payment, enrollment, submission, review và report queries.

### ADR-009: Dùng Prisma cho data access thông thường

Quyết định: Repository dùng Prisma cho CRUD. Raw SQL chỉ dùng khi cần tối ưu report/lock và phải parameterized.

Rule:

- Service không import Prisma.
- Repository là tầng data access.
- Không sửa/xóa migration cũ.

### ADR-010: Mentor được gán theo từng Course

Quyết định: Mentor không có quyền mặc định trên mọi Course.

Rule:

- `isMentorAssignedToCourse(mentorId, courseId)` phải được check trước khi Mentor xem/chấm.
- Admin là người quản lý assignment.

### ADR-011: Final Project dùng Hybrid Grading

Quyết định: Quiz/bài nhỏ có thể auto-grade; Final Project do Mentor chấm `PASS/FAIL`.

Rule:

- Review phải có feedback.
- Kết quả chấm phải lưu database.
- Submission status phải đồng bộ với review result.

### ADR-012: Admin quản lý Mentor và Reports

Quyết định: Admin module quản lý user status, Mentor assignment và Reports.

Rule:

- Chỉ Admin được gọi `/admin/*`.
- Reports phải read-only.
- Admin mutation phải audit log.

### ADR-013: Reports nằm trong `ocp-api` ở MVP

Quyết định: Reports được xử lý trong backend hiện tại.

Rule:

- Query report nằm trong report service/repository.
- Adapter failure phải tạo warning, không crash dashboard.
- Không trả raw PII/payment rows trong report response.

## 4. PATTERNS ĐƯỢC SỬ DỤNG

### 4.1 Request Validation Pattern

Mọi body/query/params quan trọng phải validate bằng Zod.

Rule:

- Dữ liệu sai format trả `VALIDATION_ERROR`.
- Unknown fields nên bị reject bằng strict schema.
- Dữ liệu chưa validate không đi vào Prisma query hoặc business logic.

### 4.2 Layered Architecture

```text
Route
  -> Middleware
  -> Controller
  -> Service
  -> Repository/Adapter
  -> Prisma/MySQL hoặc external contract
```

Rule:

- Controller không chứa business logic.
- Service không gọi Prisma trực tiếp.
- Repository không chứa business rule lớn.

### 4.3 Repository Pattern

Repository chịu trách nhiệm database query.

Examples:

- `userRepository`
- `courseRepository`
- `paymentRepository`
- `enrollmentRepository`
- `mentorAssignmentRepository`
- `projectReviewRepository`
- `reportRepository`

### 4.4 Service Pattern

Service chứa nghiệp vụ.

Examples:

- `adminUserService`: block/unblock/hard delete policy.
- `adminMentorService`: assign/revoke Mentor.
- `reviewService`: queue/detail/submit review.
- `dashboardService`: aggregate reports.
- `paymentService`: checkout, verify, enrollment unlock.

### 4.5 Middleware Pattern

Middleware chính:

- `authMiddleware`: kiểm tra JWT cookie.
- `roleMiddleware`: kiểm tra Admin/Mentor/Learner.
- `validateMiddleware`: validate Zod schema.
- `errorMiddleware`: map lỗi về response chuẩn.

### 4.6 Transaction Pattern

Áp dụng khi thay đổi nhiều bảng hoặc nhiều state phụ thuộc nhau:

- Payment success -> payment status -> enrollment.
- Mentor submit review -> review -> feedback -> submission status.
- Admin mutation -> user/assignment update -> audit log nếu cùng DB.

Rule: Nếu không thể cùng DB transaction, phải dùng outbox/saga hoặc document rõ consistency model.

### 4.7 Idempotency Pattern

Áp dụng cho:

- Payment callback/return.
- Checkout trùng.
- Mentor assignment duplicate.

Rule: Request lặp không được tạo side effect sai hoặc record trùng.

### 4.8 Graceful Degradation Pattern

Áp dụng cho Reports.

Rule:

- Một adapter fail không làm fail toàn dashboard.
- Response có nullable data section và `warnings[]`.
- Lỗi ngoài adapter boundary vẫn có thể là 500 nếu là lỗi hệ thống.

## 5. ERROR HANDLING

Backend trả lỗi theo format đã duyệt, ví dụ:

```json
{
  "success": false,
  "message": "Course not found",
  "code": "COURSE_NOT_FOUND"
}
```

Các nhóm lỗi chính:

| Code | Ý nghĩa |
| --- | --- |
| `UNAUTHENTICATED` | Chưa đăng nhập hoặc JWT không hợp lệ |
| `FORBIDDEN` | Không có quyền |
| `VALIDATION_ERROR` | Request sai format |
| `NOT_FOUND` | Không tìm thấy tài nguyên |
| `USER_HAS_TRANSACTION` | User có payment/enrollment nên không được hard delete |
| `DUPLICATE_ASSIGNMENT` | Mentor đã được gán Course |
| `MENTOR_NOT_ASSIGNED` | Mentor không được phân công vào Course |
| `SUBMISSION_NOT_FOUND` | Không tìm thấy submission |
| `ALREADY_REVIEWED` | Submission đã có final review |
| `DEPENDENCY_UNAVAILABLE` | Contract/module ngoài timeout hoặc unavailable |
| `PARTIAL_DATA` | Report trả partial data kèm warnings |
| `INTERNAL_ERROR` | Lỗi hệ thống không mong muốn |

Rule:

- Không trả stack trace cho frontend.
- Không trả lỗi SQL/Prisma thô.
- Không leak secret, cookie, JWT, VNPAY secret.
- Log backend phải redact dữ liệu nhạy cảm.

## 6. NHỮNG GÌ KHÔNG NÊN LÀM

### Không để frontend quyết định quyền truy cập

Sai:

- Ẩn nút học ở frontend rồi cho rằng user không thể học.
- Cho frontend gửi `role`, `userId`, `isPaid`, `status`.

Đúng:

- Backend kiểm tra JWT, role, enrollment/access và Mentor assignment.

### Không unlock course chỉ vì frontend báo payment success

Sai:

- Frontend nhận redirect từ VNPAY rồi gọi API unlock course.

Đúng:

- Backend verify VNPAY, cập nhật payment, tạo enrollment.

### Không cho Mentor thao tác ngoài Course được gán

Sai:

- Role `MENTOR` là được chấm mọi Final Project.

Đúng:

- Role `MENTOR` + active assignment theo Course.

### Không hard-delete dữ liệu quan trọng tùy tiện

Dữ liệu không nên hard-delete nếu có lịch sử nghiệp vụ:

- User.
- Course.
- Payment.
- Enrollment.
- Submission.
- Review result.

Nên dùng:

- `status`.
- `isDeleted`.
- `deletedAt`.

### Không viết report query tùy tiện trong controller

Rule:

- Report query nằm trong service/repository/adapter.
- Raw SQL phải parameterized.
- Report response chỉ trả aggregate cần thiết.

## 7. FILE STRUCTURE QUAN TRỌNG

### 7.1 Backend `/backend`

```text
/backend
  /src
    /api            # Entry points, map endpoint tới controller
    /controllers    # Nhận request, gọi service, trả response
    /services       # Business logic
    /repositories   # Data access, nơi import Prisma
    /middlewares    # Auth, role, validation, error handling
    /utils          # Helper thuần
    /config         # Env và third-party config
  /prisma
    schema.prisma
    /migrations
```

Rules:

- Database access đi qua repository.
- Business logic nằm trong service.
- Controller chỉ nhận request/trả response.
- Middleware xử lý auth, role, validation và error chung.

### 7.2 Frontend `/frontend`

```text
/frontend
  /src
    /api
    /components
    /pages
    /routes
    /layouts
    /hooks
    /utils
```

Rules:

- API call đi qua `/src/api`.
- Components không gọi endpoint trực tiếp nếu logic dùng lại nhiều nơi.
- Role-based UI chỉ phục vụ UX.
- `withCredentials: true` bắt buộc cho cookie auth.

### 7.3 Specs Workspace

```text
/Specs
  /agent
    AGENTS.md
    PROJECT_AGENTS.md
  /feat-admin-management
    context.md
    spec.md
    plan.md
    tasks.md
  /feat-mentor-review
    context.md
    spec.md
    plan.md
    tasks.md
  /feat-reports
    context.md
    spec.md
    plan.md
    tasks.md
  constitution.md
  share_context.md
```

## 8. TESTING ƯU TIÊN

Ưu tiên test các luồng có rủi ro cao:

### 8.1 Auth và Authorization

- Cookie auth hợp lệ.
- Bearer-only bị từ chối nếu spec yêu cầu cookie.
- Non-admin bị chặn khỏi `/admin/*`.
- Non-mentor bị chặn khỏi `/mentor/*`.

### 8.2 Payment và Enrollment

- Payment success tạo enrollment.
- Callback lặp không tạo enrollment trùng.
- Payment verify fail không unlock course.
- Payment `PENDING` không cấp quyền học.

### 8.3 Course Access

- Learner chưa mua không xem được paid lesson.
- Learner đã enroll xem được lesson.
- Guest không truy cập API cần login.

### 8.4 Mentor Permission

- Mentor được gán Course thì thấy queue/chấm bài được.
- Mentor không được gán Course thì bị 403.
- Submission đã reviewed bị chặn review lại nếu MVP chốt one-final-review.

### 8.5 Admin

- Admin block/unblock user.
- Admin hard delete user có payment/enrollment bị 409.
- Admin gán Mentor trùng bị chặn.
- Revoke assignment khi còn pending submissions xử lý đúng spec.

### 8.6 Reports

- Admin dashboard trả full data khi adapters success.
- Payment adapter timeout vẫn HTTP 200 partial data.
- Non-admin không gọi được report.
- Report không mutate dữ liệu nguồn.
- Date range invalid trả validation error.

## 9. LESSONS LEARNED

- Spec phải khóa trước khi AI implement.
- Nếu AI phải đoán contract, spec chưa đủ rõ.
- Backend quyết định quyền thật; frontend chỉ hỗ trợ UX.
- Payment unlock phải verify từ VNPAY ở backend.
- Mentor role chưa đủ; cần Course assignment.
- Reports phải read-only và chịu lỗi từng phần.
- Cross-module ownership phải được tôn trọng để tránh coupling.

## 10. CURRENT SPRINT NOTES

Focus:

- Chuẩn hóa tài liệu agent context.
- Chuẩn hóa SDD docs cho Admin Management, Mentor Review và Reports.
- Resolve Open Questions trước khi implement.

Blocked:

- Auth cookie name và request user context chưa chốt.
- User status schema chưa chốt.
- Payment/Enrollment reader contracts chưa chốt.
- Learning `SubmissionReader`/`SubmissionUpdater` contracts chưa chốt.
- Reports default range/cache/export/refund policy chưa chốt.

Next:

1. Team Lead/Product Owner review `SPEC.md` của từng feature.
2. Resolve open questions trong từng `context.md` và `plan.md`.
3. Update status từ `DRAFT` sang `APPROVED` khi đủ điều kiện.
4. Implement theo thứ tự: Admin Management -> Mentor Review -> Reports.
