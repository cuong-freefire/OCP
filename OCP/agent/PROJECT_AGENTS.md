# PROJECT_AGENTS.md — Online Course Platform (OCP) v1.0
## Nền tảng khóa học trực tuyến với thanh toán VNPAY và kiểm soát quyền học

---

## TL;DR (Đọc trước — 60 giây)

> **Đây là hệ thống Online Course Platform (OCP)**
>
> **Backend**: NodeJS + Express-style REST API + Prisma + MySQL
> **Frontend**: React + Bootstrap
> **Auth**: JWT lưu trong httpOnly Cookie + bcrypt + Google OAuth
> **Payment**: VNPAY, backend ký URL và xác minh kết quả thanh toán
>
> **Nguyên tắc cứng**: Backend là source of truth cho auth, role, payment, enrollment và course access.

### Đọc trước

1. `agent/AGENTS.md` → Project context đầy đủ (Tech stack, forbidden patterns, domain model)
2. `constitution.md` → Development principles và team agreements
3. `DATABASE.md` → Database design, auth tables, payment/enrollment schema
4. File này → Workflow, patterns, và conventions

---

## KIẾN TRÚC HỆ THỐNG

### Sơ đồ tổng quan

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                              │
│                                                                      │
│  Course List  Course Detail  Checkout Button  My Courses  Learning  │
│      │             │              │              │           │       │
└──────┼─────────────┼──────────────┼──────────────┼───────────┼───────┘
       │             │              │              │           │
       ▼             ▼              ▼              ▼           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND (NodeJS REST API)                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Route / API Layer                                               │  │
│  │ /auth  /courses  /payments  /enrollments  /learning  /admin    │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                  ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Middleware Layer                                                │  │
│  │ auth cookie, role guard, validation, error handling             │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                  ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Controller Layer                                                │  │
│  │ nhận request, gọi service, trả response                         │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                  ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Service Layer                                                   │  │
│  │ business logic, transaction, payment flow, access rules          │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                  ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Repository / Module Contract Layer                              │  │
│  │ Prisma repositories hoặc service contract giữa các module        │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
└──────────────────────────────────┼───────────────────────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │       MySQL + Prisma          │
                    │ users, courses, payments, ... │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │            VNPAY              │
                    │ payment URL, return, callback │
                    └──────────────────────────────┘
```

### Layer Architecture (Backend)

```text
┌─────────────────────────────────────────┐
│ Route / API Entry                       │
│ - Define endpoint                       │
│ - Attach middleware                     │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ Middleware Layer                        │
│ - Auth từ httpOnly Cookie               │
│ - Role/access guard                     │
│ - Zod validation                        │
│ - Global error handling                 │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ Controller Layer                        │
│ - Nhận request                          │
│ - Gọi service                           │
│ - Format response                       │
│ - Không chứa business logic             │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ Service Layer                           │
│ - Business logic                        │
│ - Transaction orchestration             │
│ - Payment/access invariants             │
│ - Cross-module contract calls           │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ Repository Layer                        │
│ - Prisma queries                        │
│ - Database persistence                  │
│ - Không chứa HTTP logic                 │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ MySQL Database                          │
└─────────────────────────────────────────┘
```

### Repository Structure

```text
OCP/
├── agent/
│   ├── AGENTS.md
│   └── PROJECT_AGENTS.md
├── sdd/
│   └── specs/
│       └── feat-[feature-name]/
│           ├── context.md
│           ├── spec.md
│           ├── plan.md
│           └── tasks.md
├── backend/
│   ├── src/
│   └── prisma/
├── frontend/
│   └── src/
├── DATABASE.md
└── constitution.md
```

---

## QUYẾT ĐỊNH KIẾN TRÚC QUAN TRỌNG (ADR)

### ADR-001: NodeJS + Express-style API cho backend
**Quyết định**: Backend dùng NodeJS với REST API kiểu Express.
**Lý do**: Phù hợp team, dễ tích hợp Prisma, React frontend và VNPAY flow.
**Trade-off**: Cần kỷ luật layer rõ ràng để tránh service/controller bị trộn logic.
**Status**: Approved

### ADR-002: MySQL + Prisma cho persistence
**Quyết định**: Database chính là MySQL, ORM là Prisma.
**Lý do**: Dễ migration, schema rõ, phù hợp đồ án và stack hiện tại.
**Trade-off**: MySQL không hỗ trợ partial unique index như PostgreSQL; các constraint kiểu active `PENDING` cần transaction lock/application logic hoặc generated column.
**Status**: Approved

### ADR-003: Local auth + Google OAuth, JWT trong httpOnly Cookie
**Quyết định**: Hỗ trợ đăng nhập local bằng email/password và đăng nhập Google OAuth; sau khi xác thực thành công, backend phát JWT trong httpOnly Cookie và đọc token từ `req.cookies`.
**Lý do**: Giữ UX đăng nhập Google nhưng vẫn bảo toàn nguyên tắc backend là source of truth cho identity/session.
**Trade-off**: Cần bảng `oauth_accounts`, verify Google ID token ở backend, và cấu hình CORS/cookie đúng với `withCredentials: true`.
**Status**: Approved

### ADR-004: Backend là source of truth cho authorization
**Quyết định**: Backend quyết định role, userId, enrollment, payment status và course access.
**Lý do**: Frontend có thể bị sửa request/state; access paid course là nghiệp vụ rủi ro cao.
**Trade-off**: Mỗi endpoint nhạy cảm phải có guard hoặc service check đầy đủ.
**Status**: Approved

### ADR-005: VNPAY xử lý ở backend
**Quyết định**: Backend tạo signed payment URL và xác minh return/callback; frontend không ký hoặc gọi VNPAY trực tiếp.
**Lý do**: Secret và signing payload không được expose ra client.
**Trade-off**: Backend phải quản lý transaction, idempotency và audit log cẩn thận.
**Status**: Approved

### ADR-006: Payment Checkout tách khỏi Payment Verification
**Quyết định**: Checkout chỉ tạo/reuse payment `PENDING`; verification/callback tạo `SUCCESS/FAILED` và enrollment là feature riêng.
**Lý do**: Giảm scope, tránh AI agent tự implement enrollment trong checkout.
**Trade-off**: Cần spec riêng cho VNPAY return/callback và enrollment creation.
**Status**: Approved

### ADR-007: Module ownership là ranh giới bắt buộc
**Quyết định**: Module chỉ truy cập dữ liệu module khác qua service/contract.
**Lý do**: Giảm coupling, tránh phá trách nhiệm của thành viên khác.
**Trade-off**: Cần định nghĩa contract rõ trước khi implement cross-module flow.
**Status**: Approved

---

## NHỮNG GÌ ĐÃ KHÔNG HOẠT ĐỘNG (Lessons Learned)

### LESSON-001: Implicit auth assumption gây sai kiến trúc
**Vấn đề**: Nếu spec chỉ ghi "JWT hợp lệ" mà không nói token lấy từ đâu, AI dễ tự dùng `Authorization: Bearer <token>`.
**Giải pháp**: Mọi spec/API contract liên quan auth phải ghi rõ JWT lấy từ httpOnly Cookie, backend đọc `req.cookies`, frontend dùng `withCredentials: true`.
**Áp dụng**: Tất cả endpoint cần login.

### LESSON-002: Payment `PENDING` không được unlock course
**Vấn đề**: Nếu checkout và enrollment không tách scope, AI có thể tạo enrollment ngay sau khi redirect hoặc sau khi tạo payment.
**Giải pháp**: Checkout chỉ tạo/reuse `PENDING`; enrollment chỉ tạo sau backend verify payment success.
**Áp dụng**: Payment Checkout, VNPAY callback/return, My Courses, Learning.

### LESSON-003: Không query chéo module
**Vấn đề**: Ghi "lấy course trực tiếp từ database" khiến AI có thể gọi Prisma vào bảng `courses` trong Payment service.
**Giải pháp**: Payment phải gọi Course Module contract, không query trực tiếp table `courses`.
**Áp dụng**: Payment checkout, payment verification, access checking.

### LESSON-004: MySQL không có partial unique index kiểu PostgreSQL
**Vấn đề**: Spec hoặc migration có thể sai nếu yêu cầu unique `(user_id, course_id) WHERE status = 'PENDING'`.
**Giải pháp**: Dùng transaction lock/application lock hoặc generated column nếu cần DB-level enforcement.
**Áp dụng**: Duplicate checkout và race condition.

### LESSON-005: Formal Spec cần state diagram trực quan
**Vấn đề**: Chỉ mô tả transition bằng text khiến AI dễ trôi ngữ cảnh.
**Giải pháp**: Formal Spec mức 3 phải có ASCII state diagram và invalid transitions.
**Áp dụng**: Payment, enrollment, course access, final project grading.

### LESSON-006: Tách identity provider khỏi payment provider
**Vấn đề**: Cùng tên `provider` có thể khiến AI nhầm `payments.provider = VNPAY` với Google login.
**Giải pháp**: Auth dùng `oauth_accounts.provider = GOOGLE`; payment dùng `payments.provider = VNPAY`; không dùng lẫn hai khái niệm.
**Áp dụng**: Auth, Google OAuth, Payment, Database schema.

---

## FILE STRUCTURE

### Backend (NodeJS + Prisma)

```text
backend/
├── src/
│   ├── api/              # API entry points, route definitions
│   ├── controllers/      # Nhận request, gọi service, trả response
│   ├── services/         # Business logic, transaction orchestration
│   ├── repositories/     # Prisma/database access
│   ├── middlewares/      # Auth, role, validation, global error handler
│   ├── utils/            # Response helpers, errors, pure utilities
│   ├── config/           # Env/config cho VNPAY, auth, database
│   └── types/            # Shared DTO/types nếu project dùng TypeScript
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── tests/
```

### Frontend (React + Bootstrap)

```text
frontend/
├── src/
│   ├── api/              # API client, axios/fetch wrappers
│   ├── components/       # Reusable components
│   ├── pages/            # Page components
│   ├── routes/           # Route definitions/guards
│   ├── layouts/          # Shared layouts
│   ├── hooks/            # Custom hooks
│   └── utils/            # Pure utilities
└── public/
```

### Specs

```text
sdd/
└── specs/
    └── feat-[feature-name]/
        ├── context.md
        ├── spec.md
        ├── plan.md
        └── tasks.md
```

---

## DEVELOPMENT WORKFLOW

### Standard Flow

```text
/spec  ->  /plan  ->  /tasks  ->  /build  ->  /test  ->  /review
Define     Plan      Split      Code       Verify    Review
```

### Workflow Rules

| Phase | Output | Rule |
| --- | --- | --- |
| Define | `SPEC.md` | Feature rủi ro cao phải dùng Formal Spec mức 3 |
| Plan | `PLAN.md` | Không viết code; chỉ thiết kế implementation approach |
| Tasks | `TASKS.md` | Task độc lập, tối đa 4 giờ/task, có spec refs và done criteria |
| Build | Code changes | Chỉ implement task đã duyệt |
| Verify | Tests/build output | Chạy test phù hợp scope |
| Review | Findings/fixes | Ưu tiên bugs, regressions, missing tests |

### Supporting Commands

| Command/Action | Use when |
| --- | --- |
| `rg` | Tìm file/text nhanh trong repo |
| `pnpm build` hoặc project build command | Kiểm tra frontend/backend build nếu có |
| Existing test command | Verify task implementation |
| Prisma migration command | Khi schema thay đổi |
| Manual review | Khi tool không chạy được trong môi trường hiện tại |

---

## RULES & GUIDELINES

### ALWAYS DO

| Rule | Description |
| --- | --- |
| Read context first | Đọc `agent/AGENTS.md`, `agent/PROJECT_AGENTS.md`, `DATABASE.md`, spec/plan/task liên quan trước khi sửa |
| Cookie auth | Dùng JWT trong httpOnly Cookie, backend đọc `req.cookies` |
| Google OAuth backend verify | Verify Google ID token ở backend trước khi tạo/link user |
| Input validation | Dùng Zod cho body/query/params quan trọng |
| Layered architecture | Route -> Middleware -> Controller -> Service -> Repository |
| Backend authorization | Backend check role/user/enrollment/access |
| Payment snapshot | Amount lấy từ Course Module, không lấy từ frontend |
| Idempotency | Payment callback/transaction success phải xử lý đúng một lần |
| Error safety | Không leak secret/raw errors |
| Tests | Thêm unit/integration tests cho logic mới |
| Comments | Giải thích why, không giải thích what hiển nhiên |

### NEVER DO

| Rule | Description |
| --- | --- |
| No Bearer auth | Không tự chuyển sang `Authorization: Bearer <token>` |
| No localStorage JWT | Không lưu JWT trong `localStorage`/`sessionStorage` |
| No raw OAuth tokens | Không lưu Google `id_token`, `access_token`, `refresh_token` vào DB/log |
| No frontend identity trust | Không tin `email`, `name`, `avatar_url`, `providerUserId` do frontend tự gửi |
| No frontend authority | Frontend không quyết định role, amount, status, access |
| No Prisma in service | Service/controller không import Prisma |
| No cross-module query | Không query table của module khác trực tiếp |
| No pending unlock | Payment `PENDING` không unlock paid course |
| No frontend VNPAY signing | Frontend không ký/gọi VNPAY trực tiếp |
| No duplicate enrollment | Không tạo enrollment trùng user-course |
| No secret logs | Không log JWT/cookie/VNPAY secret/password/API key |
| No out-of-scope | Không thêm feature ngoài spec |

### Code Quality

| Metric | Limit |
| --- | --- |
| Max function length | Nên dưới 40 lines khi khả thi |
| Max file length | Nên dưới 300 lines, trừ file cấu hình/schema |
| Test coverage | Ưu tiên service/business logic mới |
| Task size | Tối đa 4 giờ/task theo `TASKS.md` |

---

## NAMING CONVENTIONS

### Backend

| Type | Convention | Example |
| --- | --- | --- |
| Controllers | `[feature].controller.ts` | `payment.controller.ts` |
| Services | `[feature].service.ts` | `payment.service.ts` |
| Repositories | `[feature].repository.ts` | `payment.repository.ts` |
| Validators | `[feature].validator.ts` | `payment.validator.ts` |
| Config | `[provider].config.ts` | `vnpay.config.ts`, `google.config.ts` |
| Types/DTOs | `[feature].types.ts` | `payment.types.ts` |
| Tables | snake_case | `payment_events` |
| Functions | camelCase | `createPaymentCheckout()` |
| Classes/types | PascalCase | `PaymentCheckoutResponse` |

### Frontend

| Type | Convention | Example |
| --- | --- | --- |
| Components | PascalCase | `PaymentButton.jsx` |
| Pages | PascalCase | `CourseDetailPage.jsx` |
| Hooks | camelCase | `usePaymentCheckout.js` |
| Utils | camelCase | `formatCurrency.js` |
| API clients | camelCase | `paymentApi.js` |

### API Routes

| Type | Convention | Example |
| --- | --- | --- |
| Endpoints | plural resource | `/payments/create` |
| Methods | uppercase in docs | `POST /payments/create` |
| Error code | UPPER_SNAKE_CASE | `COURSE_NOT_FOUND` |

---

## MODULE, API & DATABASE OWNERSHIP

### Module Ownership

| Member | Module | Main responsibility |
| --- | --- | --- |
| Member 1 - AnhND | Auth + Email + Profile | register, login, Google OAuth, JWT, email verify/reset, profile, enrollment success email |
| Member 2 - Nam | Course Catalog + Content | courses, categories, sections, lessons, course price/status |
| Member 3 - CuongLH | Payment + Enrollment + Access | payments, orders, enrollments, my courses, course access |
| Member 4 - Đức | Learning + Quiz + Final Project | learning dashboard, lessons, progress, quiz, final project submission |
| Member 5 - Tiến | Mentor + Admin + Reports | mentor assignment, mentor review, admin users, reports |

### API Ownership

| API group | Owner | Notes |
| --- | --- | --- |
| `/auth/*` | Member 1 | register, login, Google OAuth, verify, reset password |
| `/email/*` | Member 1 | email system |
| `/users/profile` | Member 1 | current user profile |
| `/courses/*` | Member 2 | course list/detail/admin CRUD |
| `/categories/*` | Member 2 | category CRUD |
| `/sections/*`, `/lessons/*` | Member 2 | course content structure |
| `/payments/*` | Member 3 | VNPAY, checkout, payment history |
| `/enrollments/*`, `/my-courses` | Member 3 | enroll and course access |
| `/learning/*`, `/progress/*` | Member 4 | learning and progress |
| `/quizzes/*` | Member 4 | quiz and auto-grading |
| `/projects/*` | Member 4 | learner final project submission |
| `/mentor/*` | Member 5 | mentor queue and review |
| `/admin/*` | Member 5 | dashboard, users, mentors, reports |

### Database Ownership

| Table/group | Owner | Other modules may use through |
| --- | --- | --- |
| `users`, `oauth_accounts` | Member 1 | Auth/User service contract |
| `refresh_tokens` | Member 1 | Auth service |
| `email_verifications`, `password_reset_tokens` | Member 1 | Auth/Email service |
| `courses`, `categories`, `course_sections`, `lessons` | Member 2 | Course service contract |
| `orders`, `payments`, `enrollments` | Member 3 | Payment/Enrollment service contract |
| `lesson_progress`, `course_progress` | Member 4 | Learning/Progress service contract |
| `quizzes`, `quiz_questions`, `quiz_submissions` | Member 4 | Quiz service contract |
| `project_submissions` | Member 4 | Project submission service |
| `mentor_assignments`, `project_reviews`, `mentor_feedbacks` | Member 5 | Mentor/Admin service |
| `reports_optional` | Member 5 | Report service/repository |

---

## OCP DOMAIN RULES

### Auth Rules

1. JWT lưu trong httpOnly Cookie.
2. Backend đọc token từ `req.cookies`.
3. Frontend gửi request kèm cookie bằng `withCredentials: true`.
4. Frontend không lưu JWT trong `localStorage` hoặc `sessionStorage`.
5. Frontend không tự gắn `Authorization: Bearer <token>`.
6. Backend không dùng `Authorization` header làm nguồn auth khi spec yêu cầu cookie auth.
7. Local login chỉ hợp lệ khi user có `password_hash`.
8. Google OAuth phải verify Google ID token ở backend.
9. Google account lookup dùng `oauth_accounts.provider = GOOGLE` và Google `sub` trong `provider_user_id`.
10. Không dùng email làm định danh chính để link Google account; email chỉ dùng cho policy auto-link theo spec.
11. Không lưu raw Google `id_token`, `access_token`, `refresh_token` vào database hoặc log.
12. Google-only user được phép có `users.password_hash = NULL`.
13. User `blocked` hoặc `deleted_at` không được login bằng local password hoặc Google OAuth.

### Course Access Rules

1. Paid course chỉ unlock khi có `enrollment` hợp lệ.
2. Payment `PENDING` không cấp quyền học.
3. Payment `SUCCESS` cũng không tự đủ để học nếu enrollment chưa được tạo theo flow.
4. Learning/quiz/final project phải kiểm tra access qua Enrollment/Access contract.
5. Frontend route guard không thay thế backend access check.

### Payment Checkout Rules

1. Request body MVP chỉ nhận `courseId`.
2. Amount lấy từ Course Module, không lấy từ frontend.
3. Checkout tạo hoặc reuse payment `PENDING`.
4. VNPAY signed URL tạo ở backend.
5. URL hết hạn sau 15 phút.
6. Mỗi `userId + courseId` chỉ có một active `PENDING`.
7. Duplicate checkout trước khi hết hạn reuse existing `checkout_url`.
8. Checkout không verify VNPAY result.
9. Checkout không cập nhật `SUCCESS/FAILED`.
10. Checkout không tạo `enrollment`.
11. Checkout không gửi email success.

### Payment State Model

```text
[none] ──(initiate checkout)──► [pending_payment]
                                      │
                                      ├──(duplicate before expiry)──► [pending_payment]
                                      │
                                      └──(expires after 15 minutes)──► [expired]
                                                                          │
                                                                          └──(retry checkout)──► [pending_payment]
```

Invalid trong Payment Checkout:

- `pending_payment -> success`
- `pending_payment -> failed`
- `pending_payment -> enrollment_created`
- `pending_payment -> amount_changed`
- `pending_payment -> payment_ref_changed`

### Response Format Rules

Success response:

```json
{
  "success": true,
  "message": "Payment checkout created successfully",
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Course not found",
  "code": "COURSE_NOT_FOUND",
  "details": {}
}
```

---

## GIT CONVENTIONS

### Branch Naming

```text
feat/[feature-name]      # New features
fix/[bug-name]           # Bug fixes
spec/[feature-name]      # Specification work
chore/[short-name]       # Maintenance tasks
```

### Commit Format

```text
[type]([scope]): [description]

Types: feat, fix, docs, style, refactor, test, chore, spec
Scopes: auth, course, payment, enrollment, learning, quiz, mentor, admin
```

Examples:

```text
spec(payment): add checkout formal spec
feat(payment): create pending checkout payment
fix(auth): read jwt from httpOnly cookie
test(payment): add duplicate checkout coverage
```

### Pull Request Rules

- Minimum 1 approval before merge.
- All relevant tests should pass.
- No unrelated files.
- No TODO comments left unless approved.
- Reference relevant spec/task IDs.

---

## GITNEXUS INTEGRATION

### Current Setup

- Repository indexing status: Unknown in current environment.
- Nếu GitNexus không khả dụng, agent phải báo rõ giới hạn trước khi thay đổi shared contract hoặc symbol có blast radius lớn.

### Recommended Commands

```bash
gitnexus query "payment checkout" --limit 10
gitnexus impact --target PaymentService --repo OCP
gitnexus sync --repo OCP
gitnexus status --repo OCP
```

### MCP Tools (when GitNexus MCP server is running)

| Tool | Purpose |
| --- | --- |
| `gitnexus_query` | Tìm execution flows cho một concept |
| `gitnexus_impact` | Blast radius analysis |
| `gitnexus_context` | Full symbol context |
| `gitnexus_detect_changes` | Map git changes to affected flows |

### Workflow Integration

```text
Before editing shared symbol:
1. Run impact analysis nếu tool khả dụng.
2. Report blast radius nếu HIGH/CRITICAL.
3. Get confirmation trước khi đổi public contract.

Before committing:
1. Detect changed symbols nếu tool khả dụng.
2. Verify only expected areas changed.
3. Investigate unexpected impact.
```

---

## SEMBLE INTEGRATION

### What is Semble?

Semble là semantic code search tool dùng để tìm code theo ý nghĩa, không chỉ theo text matching.

### Semble vs GitNexus - When to Use What?

| Task | Tool | Why |
| --- | --- | --- |
| Find all payment checkout implementations | Semble | Semantic search |
| What breaks if I change PaymentService? | GitNexus | Call graph + impact analysis |
| Show code similar to auth middleware | Semble | Similarity detection |
| Who calls `canAccessCourse`? | GitNexus | Relationship graph |
| Trace checkout flow end-to-end | GitNexus | Execution flow analysis |
| Find validation patterns | Semble | Pattern search |

Note: Nếu Semble không có trong môi trường hiện tại, dùng `rg` và đọc code thủ công.

---

## ANTI-PATTERNS (Tránh xa)

### Code Anti-Patterns

| Anti-Pattern | Description | How to Avoid |
| --- | --- | --- |
| God Controller | Controller chứa validation, business logic, database calls | Chỉ nhận request, gọi service, trả response |
| God Service | Một service làm quá nhiều module | Tách helper/service theo responsibility |
| Prisma in Service | Service import Prisma trực tiếp | Chỉ repository được gọi Prisma |
| Cross-module Query | Module này query table của module khác | Dùng service/contract |
| Magic Requirement | Requirement thiếu ELSE/edge case | Bổ sung expected behavior trong spec |
| The Implicit Assumption | Con người hiểu ngầm, AI không biết | Ghi rõ nguồn auth, owner, state, response format |

### Payment Anti-Patterns

| Anti-Pattern | Description | How to Avoid |
| --- | --- | --- |
| Frontend Amount | Frontend gửi amount/price | Backend lấy price từ Course Module |
| Pending Unlock | Payment `PENDING` mở khóa course | Chỉ enrollment hợp lệ mới unlock |
| Callback Duplicate | Callback xử lý success nhiều lần | Idempotency bằng `paymentRef`/`transactionId` |
| Secret Leak | Log VNPAY secret/signing payload | Mask secret, không log payload nhạy cảm |
| Checkout Creates Enrollment | Checkout tạo enrollment trước verify | Tách checkout và verification |

### Auth Anti-Patterns

| Anti-Pattern | Description | How to Avoid |
| --- | --- | --- |
| Bearer Drift | AI tự chuyển sang Bearer token | Ghi rõ cookie auth trong spec và API contract |
| JWT in Storage | Lưu JWT ở localStorage/sessionStorage | Chỉ dùng httpOnly Cookie |
| Frontend Role Trust | Tin role frontend gửi lên | Backend decode token và check DB/contract |
| Frontend Google Trust | Tin Google profile/token do frontend parse sẵn | Backend verify Google ID token và lấy `sub` từ kết quả verify |
| OAuth Token Storage | Lưu Google raw token trong DB/log | Chỉ lưu mapping `provider + provider_user_id` và profile đã sanitize |
| Provider Confusion | Dùng `payments.provider` cho Google login | Auth dùng `oauth_accounts.provider`; payment dùng `payments.provider` |

### Testing Anti-Patterns

| Anti-Pattern | Description | Fix |
| --- | --- | --- |
| No Assertion | Test chỉ chạy code | Assert expected output/state |
| Only Happy Path | Không test lỗi | Thêm validation/auth/business error cases |
| Race Untested | Không test duplicate checkout | Thêm concurrent/duplicate checkout test |
| Brittle UI Tests | Test phụ thuộc text/layout dễ đổi | Ưu tiên API/service tests cho payment logic |
