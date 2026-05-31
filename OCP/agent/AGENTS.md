# AGENTS.md

# Project Context for AI Agents

# Version: 1.0 | Updated: 2026-05-27 | Project: OCP

File này là tài liệu bắt buộc cho mọi AI agent trước khi sửa `CONTEXT.md`, `SPEC.md`, `PLAN.md`, `TASKS.md` hoặc mã nguồn liên quan đến dự án OCP. Mục tiêu là giảm giả định ngầm, giữ đúng ranh giới module, và tránh AI agent tự ý triển khai ngoài phạm vi đã được duyệt.

## 1. PROJECT OVERVIEW

Name: OCP (Online Course Platform)

Type: Ứng dụng web full-stack, gồm frontend React và backend API NodeJS.

Domain: Giáo dục, nền tảng khóa học trực tuyến.

Stage: Đang phát triển theo quy trình Spec-Driven Development và Agent-Driven Development.

Main goals:

- Guest và Learner có thể xem danh sách, chi tiết khóa học.
- Learner có thể mua khóa học trả phí qua VNPAY hoặc ghi danh khóa học miễn phí.
- Backend là nguồn quyết định quyền học thật sự.
- Khóa học trả phí chỉ mở khóa khi có `enrollment` hợp lệ sau khi backend xác minh thanh toán thành công.
- Mentor chỉ chấm Final Project trong Course được Admin phân công.
- Admin quản lý user, Mentor assignment và reports.
- Reports tổng hợp dữ liệu read-only, không mutate dữ liệu nguồn.

Current active Specs:

| Feature | Folder | Status |
| --- | --- | --- |
| Admin Management | `feat-admin-management/` | `DRAFT - Awaiting human approval` |
| Mentor Review System | `feat-mentor-review/` | `DRAFT - Awaiting human approval` |
| Reports & Analytics | `feat-reports/` | `DRAFT - Awaiting human approval` |

Required reading before work:

1. `agent/AGENTS.md`
2. `agent/PROJECT_AGENTS.md`
3. `constitution.md`
4. `share_context.md`
5. Feature folder files: `context.md`, `spec.md`, `plan.md`, `tasks.md`

## 2. TECH STACK (STRICT - do not deviate)

Backend: NodeJS API kiểu Express trong `ocp-api` hoặc `/backend`.

Frontend: React và Bootstrap trong `ocp-web` hoặc `/frontend`.

Database: MySQL.

ORM: Prisma.

Auth: JWT lưu trong `httpOnly Cookie`; password hash bằng bcrypt.

Request validation: Zod cho body, query và params quan trọng.

Payment gateway: VNPAY.

API style: REST.

Testing: dùng bộ test hiện có của dự án. Không tự thêm framework test mới nếu chưa được duyệt.

Strict rules:

- Không thay MySQL bằng database khác.
- Không thay Prisma bằng ORM khác.
- Không thay JWT trong `httpOnly Cookie` bằng Bearer token.
- Không lưu JWT trong `localStorage` hoặc `sessionStorage`.
- Không thêm Stripe hoặc cổng thanh toán khác cho MVP nếu spec không yêu cầu rõ.
- Không tạo kiến trúc mới vòng qua layered architecture của dự án.

## 3. ARCHITECTURE PRINCIPLES

### Layered Architecture

Backend phải đi theo luồng:

```text
Route / API entry
  -> Middleware xác thực, phân quyền, validation
  -> Controller
  -> Service
  -> Repository hoặc cross-module contract
  -> Prisma / MySQL
```

Rules:

- Controller chỉ nhận request và trả response.
- Controller không chứa logic nghiệp vụ.
- Service chứa logic nghiệp vụ.
- Service không import Prisma trực tiếp.
- Repository là tầng duy nhất import Prisma và thao tác MySQL.
- Dữ liệu thuộc module khác phải đi qua service/contract/adapter, không gọi thẳng repository của module khác.

### Authentication

Rules:

- Backend đọc JWT từ `req.cookies`.
- Frontend request phải dùng `withCredentials: true`.
- Frontend không tự gắn `Authorization: Bearer <token>`.
- Backend không dùng header `Authorization` làm nguồn xác thực khi spec yêu cầu cookie auth.

### Authorization

Backend là nguồn quyết định quyền truy cập thật sự.

Rules:

- Frontend guard chỉ phục vụ UX.
- Backend phải kiểm tra JWT, role, enrollment, Mentor assignment và rule truy cập.
- Không tin `userId`, `role`, payment status hoặc access status do frontend gửi lên.

### Payment Integrity

Rules:

- Frontend không gửi hoặc quyết định `amount`, `price`, `status`, `paymentRef`, `userId`.
- Backend tạo payment request và URL VNPAY đã ký.
- Payment `PENDING` không mở khóa khóa học trả phí.
- `enrollment` là nguồn quyết định quyền học khóa trả phí.
- Callback/return VNPAY là feature riêng và phải verify ở backend.

### Module Ownership

| Thành viên | Module | Trách nhiệm chính |
| --- | --- | --- |
| AnhND | Auth, Email, Profile | Đăng ký, đăng nhập, JWT, xác minh email, quên mật khẩu, hồ sơ user |
| Nam | Course Catalog, Content | Course, category, section, lesson, giá và trạng thái course |
| CuongLH | Payment, Enrollment, Access | Payment, order, enrollment, my courses, quyền truy cập khóa học |
| Đức | Learning, Quiz, Project | Learning dashboard, progress, quiz, final project submission |
| Tiến | Mentor, Admin, Reports | Mentor assignment, Mentor review, Admin management, Reports |

### API Ownership

| Nhóm API | Chủ sở hữu | Ghi chú |
| --- | --- | --- |
| `/auth/*` | AnhND | Đăng ký, đăng nhập, xác minh, reset password |
| `/email/*` | AnhND | Email system |
| `/users/profile` | AnhND | Hồ sơ user hiện tại |
| `/courses/*` | Nam | Course list/detail/admin CRUD |
| `/categories/*` | Nam | Category CRUD |
| `/sections/*`, `/lessons/*` | Nam | Cấu trúc nội dung khóa học |
| `/payments/*` | CuongLH | VNPAY, checkout, payment history |
| `/enrollments/*`, `/my-courses` | CuongLH | Enrollment và quyền học |
| `/learning/*`, `/progress/*` | Đức | Learning và progress |
| `/quizzes/*` | Đức | Quiz và auto grading |
| `/projects/*` | Đức | Learner nộp final project |
| `/mentor/*` | Tiến | Mentor queue và review |
| `/admin/*` | Tiến | Admin management, dashboard, reports |

### Database Ownership

| Bảng hoặc nhóm bảng | Chủ sở hữu | Module khác chỉ được dùng thông qua |
| --- | --- | --- |
| `users`, `refresh_tokens` | AnhND | Auth/User service |
| `email_verifications`, `password_reset_tokens` | AnhND | Auth/Email service |
| `courses`, `categories`, `course_sections`, `lessons` | Nam | Course service |
| `orders`, `payments`, `enrollments` | CuongLH | Payment/Enrollment service |
| `lesson_progress`, `course_progress` | Đức | Learning/Progress service |
| `quizzes`, `quiz_questions`, `quiz_submissions` | Đức | Quiz service |
| `project_submissions` | Đức | Project submission service |
| `mentor_assignments`, `project_reviews`, `mentor_feedbacks` | Tiến | Mentor/Admin service |
| `reports_optional` | Tiến | Reports service/repository |

Rules:

- Một module không được query trực tiếp bảng do module khác sở hữu.
- Reports có thể đọc nhiều nguồn qua report contracts/repositories, và nếu bắt buộc dùng raw SQL thì phải parameterized.
- Payment không query trực tiếp `courses`; phải dùng Course contract.
- Learning không query `payments` để quyết định quyền học; phải dùng Enrollment/Access contract.

### Cross-Module Contracts

Course access:

```text
canAccessCourse(userId, courseId) -> boolean
```

Mentor assignment:

```text
isMentorAssignedToCourse(mentorId, courseId) -> boolean
```

Course price/status:

```text
courseService.getCourseById(courseId) -> { id, price, status, isPaid }
```

Payment success:

```text
payment SUCCESS -> enrollment CREATED -> enrollment success email
```

Payment idempotency:

```text
paymentRef / transactionId chỉ được xử lý thành công một lần
```

Report readers:

```text
getRevenueSummary(startDate, endDate, granularity)
getUserStats(startDate, endDate)
getCourseStats(startDate, endDate)
getEnrollmentStats(startDate, endDate)
getReviewStats(startDate, endDate)
```

## 4. FILE NAMING & STRUCTURE

### Backend `/backend`

```text
/backend
  /src
    /api
    /controllers
    /services
    /repositories
    /middlewares
    /utils
    /config
  /prisma
    schema.prisma
    /migrations
```

Backend naming:

- Controller: `[feature].controller.ts`
- Service: `[feature].service.ts`
- Repository: `[feature].repository.ts`
- Validator/schema: `[feature].validator.ts` hoặc `[feature].schema.ts`
- Types: `[feature].types.ts`
- Database table: `snake_case`
- JS/TS variable/function: `camelCase`
- Class/DTO type: `PascalCase`

### Frontend `/frontend`

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

Frontend rules:

- API call phải đi qua `/src/api`.
- Component không gọi endpoint trực tiếp nếu logic có thể tái sử dụng.
- Role-based UI không thay thế backend permission.
- HTTP client phải bật `withCredentials: true`.

### SDD Specs

Mỗi feature folder phải có:

```text
context.md
spec.md
plan.md
tasks.md
```

Rules:

- `context.md` có đúng 6 phần theo template.
- `spec.md` có đúng 8 phần và requirement dùng EARS.
- `plan.md` có đúng 6 phần.
- `tasks.md` là bảng task `T001`, `T002`, ... với task tối đa 4h.

## 5. FORBIDDEN PATTERNS

Không làm các việc sau nếu chưa có approval rõ:

- Không triển khai khi chưa đọc `AGENTS.md`, `PROJECT_AGENTS.md`, `SPEC.md`, `PLAN.md`, `TASKS.md` liên quan.
- Không viết code khi spec/plan/tasks còn `DRAFT` nếu người dùng chỉ yêu cầu lập kế hoạch.
- Không lưu JWT trong `localStorage` hoặc `sessionStorage`.
- Không dùng Bearer token khi spec yêu cầu cookie auth.
- Không để frontend quyết định quyền thật, role, payment status, enrollment hoặc course access.
- Không nhận `amount`, `price`, `userId`, `role`, `paymentRef`, `status` từ frontend cho logic nghiệp vụ payment.
- Không import Prisma trong service hoặc controller.
- Không query trực tiếp bảng do module khác sở hữu từ service hiện tại.
- Không gọi VNPAY trực tiếp từ frontend.
- Không mở khóa paid course từ frontend redirect.
- Không tạo enrollment từ payment `PENDING`.
- Không tạo enrollment trùng cho cùng `userId + courseId`.
- Không xử lý cùng một `paymentRef` hoặc `transactionId` thành công nhiều hơn một lần.
- Không log JWT, Cookie header, VNPAY secret, password, password hash hoặc API key.
- Không trả raw stack trace, lỗi SQL, lỗi Prisma thô hoặc secret về frontend.
- Không xóa hoặc sửa migration cũ.
- Không hard-delete dữ liệu nghiệp vụ quan trọng nếu spec không yêu cầu rõ.
- Không thêm tính năng ngoài `Out of Scope`.

## 6. DEFINITION OF DONE (per task)

Một task chỉ hoàn thành khi các điều kiện áp dụng đều đúng:

- [ ] Task chỉ triển khai đúng phạm vi đã duyệt.
- [ ] Acceptance Criteria liên quan trong `SPEC.md` đã được map và thỏa mãn.
- [ ] Code tuân thủ layered architecture.
- [ ] Controller không chứa logic nghiệp vụ.
- [ ] Service không import Prisma trực tiếp.
- [ ] Repository chịu trách nhiệm truy cập database.
- [ ] Có Zod validation cho body/query/params quan trọng mới.
- [ ] Auth dùng `httpOnly Cookie` khi spec yêu cầu.
- [ ] Không thêm Bearer auth khi spec yêu cầu cookie auth.
- [ ] Error response theo helper/format đã duyệt, không leak secret hoặc lỗi raw.
- [ ] Unit test bao phủ logic service/nghiệp vụ mới.
- [ ] Integration test bao phủ endpoint mới hoặc thay đổi, gồm happy path và ít nhất một error path.
- [ ] Test hiện có vẫn pass.
- [ ] Không còn debug statement tạm.
- [ ] Không còn TODO chưa xử lý, trừ khi owner chấp nhận rõ.
- [ ] Nếu đổi DB schema, có migration mới và không sửa/xóa migration cũ.

Feature-specific done criteria:

- Admin: hard delete phải chặn user có payment/enrollment; assignment duplicate phải bị DB/service chặn.
- Mentor Review: Mentor phải được assignment mới xem/chấm; review + feedback + submission status phải atomic.
- Reports: report phải read-only; adapter failure phải trả partial data và warnings, không crash toàn dashboard.
- Payment: paid course access dựa trên enrollment; amount lấy từ Course contract; VNPAY URL/signature tạo ở backend.

## 7. GIT CONVENTIONS

Branch naming:

- `feat/[feature-name]`
- `fix/[bug-name]`
- `spec/[feature-name]`
- `chore/[topic]`

Commit format:

```text
type(scope): mô tả ngắn
```

Examples:

- `spec(admin): chuẩn hóa task quản lý mentor`
- `feat(mentor): thêm kiểm tra assignment khi chấm bài`
- `fix(auth): đọc jwt từ httpOnly cookie`
- `test(reports): thêm test graceful degradation`

Rules:

- Không commit file không liên quan.
- Không trộn sửa spec và implementation trong cùng task nếu task không yêu cầu rõ.
- Không sửa lịch sử migration đã sinh.
- Pull request phải tham chiếu spec hoặc task ID liên quan.
- Code do AI agent tạo phải đạt checklist trước khi review.

## 8. CURRENT SPRINT CONTEXT

Sprint focus trong bộ Specs hiện tại:

1. Chuẩn hóa tài liệu SDD cho:
   - Admin Management.
   - Mentor Review System.
   - Reports & Analytics.
2. Resolve open questions trước khi implementation.
3. Lock `SPEC.md` từ `DRAFT` sang `APPROVED` sau khi Team Lead/Product Owner duyệt.

Active files:

- `constitution.md`: chuẩn SDD và task format.
- `share_context.md`: ngữ cảnh toàn cục, ownership, contracts.
- `feat-admin-management/context.md`, `spec.md`, `plan.md`, `tasks.md`.
- `feat-mentor-review/context.md`, `spec.md`, `plan.md`, `tasks.md`.
- `feat-reports/context.md`, `spec.md`, `plan.md`, `tasks.md`.
- `agent/AGENTS.md`: luật bắt buộc cho AI agent.
- `agent/PROJECT_AGENTS.md`: bách khoa dự án cho AI agent.

Open human confirmations before implementation:

- Auth cookie name và field user context trên request.
- Schema thật của `users.status`.
- Chính sách hard delete cần ADMIN hay SUPER_ADMIN.
- Assignment uniqueness: unique toàn bộ `(mentor_id, course_id)` hay chỉ active assignment.
- Revoke assignment khi còn pending submissions xử lý thế nào.
- Mentor Review có đúng là một submission chỉ có một final review không.
- `SubmissionUpdater` có thể nằm trong cùng transaction không, hay cần outbox/saga.
- Reports default date range, max range, cache, export và refund policy.

Agent behavior:

- Nếu thiếu contract bắt buộc, phải hỏi trước khi viết code.
- Nếu spec và code hiện có mâu thuẫn, phải báo mâu thuẫn; không tự chọn âm thầm.
- Nếu phát hiện thiếu requirement, phải cập nhật spec/plan/tasks trước, và chỉ implement sau khi được duyệt.
