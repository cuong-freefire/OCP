# Version: 2.0 | Updated: 2026-05-30 | Project: Online Course Platform (OCP)

## 1. PROJECT OVERVIEW

Name: Online Course Platform (OCP)
Type: Full-stack Web Application + REST API
Domain: Education / Online Course Platform / Course Payment / Learning Access
Stage: Development (Spec-Driven Development + Agent-Driven Development)

Bạn là một kỹ sư phần mềm senior trong dự án OCP.
Mục tiêu chính: Xây dựng nền tảng khóa học trực tuyến cho phép guest và learner xem khóa học, learner enroll khóa miễn phí hoặc mua khóa trả phí qua VNPAY, mentor chấm bài cuối khóa, admin quản lý user/course/mentor/report. Backend là nguồn quyết định quyền học thật sự; frontend chỉ hỗ trợ trải nghiệm người dùng.

Đọc trước:

1. PROJECT_AGENTS.md — kiến trúc hệ thống, workflow, patterns, conventions
2. CONSTITUTION.md — development principles và team agreements
3. File này — quy tắc vận hành cụ thể cho agent

## 2. TECH STACK (STRICT - do not deviate)

Backend: NodeJS + Express-style REST API trong `ocp-api`
Frontend: React + Bootstrap trong `ocp-web`
Database: MySQL
ORM: Prisma
Auth: JWT lưu trong httpOnly Cookie + bcrypt cho password hashing
Request validation: Zod cho body/query/params quan trọng
Payment gateway: VNPAY
API style: REST
Testing: dùng test setup hiện có của project; không tự thêm test framework mới nếu chưa có human approval

Không được tự ý đổi stack:

- Không thay MySQL bằng database khác.
- Không thay Prisma bằng ORM khác.
- Không thay JWT httpOnly Cookie auth bằng Bearer-token auth.
- Không thêm Stripe hoặc payment gateway khác cho MVP nếu spec không yêu cầu.
- Không thêm kiến trúc mới làm bypass layered architecture của project.

## 3. ARCHITECTURE PRINCIPLES

- Follow layered architecture: Route -> Middleware -> Controller -> Service -> Repository -> Prisma/MySQL
- Controller chỉ nhận request, gọi service, và trả response; không chứa business logic.
- Service chứa business logic; không được import Prisma trực tiếp.
- Repository là tầng duy nhất được import Prisma và thao tác database.
- Cross-module access phải đi qua service/contract của module sở hữu dữ liệu, không query trực tiếp table của module khác.
- API style là REST; endpoint phải đi qua middleware auth/role/validation phù hợp.
- Error handling phải thống nhất, không trả raw stack trace, Prisma raw error, SQL error, secret, JWT hoặc cookie value ra frontend.
- Response lỗi phải theo format project đã chốt: `{ success, message, code, details }` hoặc response helper tương đương.
- Payment, auth, enrollment, access control là high-risk domain; mọi thay đổi phải bám spec và giữ invariant.
- Backend là source of truth cho role, userId, payment status, enrollment và course access.
- Frontend guard chỉ là UX, không thay thế backend authorization.
- Không dùng frontend redirect từ VNPAY để unlock khóa học.

## 4. FILE NAMING & STRUCTURE

Backend controllers: `[feature].controller.ts`
Backend services: `[feature].service.ts`
Backend repositories: `[feature].repository.ts`
Backend validators/schemas: `[feature].validator.ts` hoặc `[feature].schema.ts`
Backend config: `[provider].config.ts`
Backend types/DTOs: `[feature].types.ts`
Frontend API client: đặt trong `/src/api`
Frontend components: PascalCase, ví dụ `PaymentButton.jsx`
Frontend hooks/utilities: camelCase, ví dụ `usePaymentCheckout.js`, `formatCurrency.js`
Database tables: snake_case, ví dụ `payments`, `payment_events`, `enrollments`
Specs: `specs/[feature-name]/`

Backend structure:

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

Frontend structure:

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

## 5. PHẠM VI HOẠT ĐỘNG

### Được phép

- Đọc spec, plan, task, project rules và code liên quan trước khi chỉnh sửa.
- Chỉnh sửa code trong module được giao theo đúng task đã duyệt.
- Chạy build/test/lint theo setup hiện có của backend và frontend.
- Tạo hoặc chỉnh sửa Zod schema, controller, service, repository, Prisma schema/migration khi task yêu cầu.
- Tạo branch mới theo pattern: `feat/*`, `fix/*`, `spec/*`, `chore/*`.
- Cập nhật spec/plan/task trước khi code nếu phát hiện thiếu requirement quan trọng.

### Cấm tuyệt đối

- KHÔNG được đọc hoặc in giá trị thật trong `.env`, credentials, secrets, private keys, API keys.
- KHÔNG được xóa migration files, dữ liệu upload, dữ liệu seed quan trọng hoặc lịch sử database.
- KHÔNG được commit trực tiếp vào `main`, `master` hoặc `production`.
- KHÔNG được bỏ qua input validation trên API endpoints.
- KHÔNG được import Prisma trong controller hoặc service.
- KHÔNG được query trực tiếp table do module khác sở hữu.
- KHÔNG được chuyển auth sang `Authorization: Bearer <token>` khi project yêu cầu JWT trong httpOnly Cookie.
- KHÔNG được để frontend quyết định amount, role, userId, payment status, enrollment hoặc course access.
- KHÔNG được gọi VNPAY trực tiếp từ frontend.
- KHÔNG được tạo enrollment từ checkout `PENDING`.
- KHÔNG được unlock paid course nếu backend chưa xác nhận enrollment hợp lệ.

## 6. FORBIDDEN PATTERNS

- NEVER store JWT trong `localStorage` hoặc `sessionStorage`.
- NEVER manually attach `Authorization: Bearer <token>` khi cookie auth là chuẩn của project.
- NEVER accept `amount`, `price`, `userId`, `role`, `paymentRef` hoặc `status` từ frontend cho payment business logic.
- NEVER trust frontend for real authorization, course access, payment status hoặc enrollment.
- NEVER import Prisma inside controller/service.
- NEVER call another module repository directly from current module service.
- NEVER create duplicate enrollment cho cùng một cặp `userId + courseId`.
- NEVER process cùng một `paymentRef` hoặc VNPAY `transactionId` thành công nhiều hơn một lần.
- NEVER log JWT, Cookie header, VNPAY secret, raw signing payload, password, password hash hoặc API key.
- NEVER return raw stack trace, SQL error, Prisma raw error hoặc secret value ra frontend.
- NEVER delete generated migration history.
- NEVER hard-delete dữ liệu nghiệp vụ quan trọng như user, course, payment, enrollment, submission, grading result nếu spec không yêu cầu rõ.
- NEVER add feature ngoài `Out of Scope` của spec hiện hành.
- NEVER silently choose khi spec và code hiện có mâu thuẫn; phải báo conflict.

## 7. OCP DOMAIN RULES

### Auth rules

1. JWT phải được lưu trong httpOnly Cookie.
2. Backend đọc token từ `req.cookies`.
3. Frontend phải gửi request kèm cookie bằng `withCredentials: true`.
4. Frontend không được tự gắn Bearer token.
5. Password phải được hash bằng bcrypt; không log password hoặc password hash.

### Course access rules

1. Paid course chỉ unlock khi có `enrollment` hợp lệ do backend tạo sau khi payment đã được verify thành công.
2. Payment `PENDING` không bao giờ cấp quyền học.
3. Frontend route guard chỉ là UX; backend vẫn phải kiểm tra quyền truy cập.
4. Learning, quiz, lesson content và final project phải dùng access/enrollment contract để kiểm tra quyền.

### Payment checkout rules

1. Checkout chỉ nhận `courseId` từ frontend trong MVP.
2. Amount phải lấy từ Course Module, không lấy từ frontend.
3. Course inactive/deleted/unavailable phải được xử lý theo spec, không tự ý expose dữ liệu không cần thiết.
4. Checkout tạo hoặc reuse payment `PENDING`, sinh VNPAY signed URL và trả về frontend.
5. VNPAY URL hết hạn sau 15 phút.
6. Mỗi `userId + courseId` chỉ có tối đa một payment `PENDING` còn hiệu lực.
7. Duplicate checkout trước khi hết hạn phải reuse `checkout_url` hiện có.
8. Checkout không verify VNPAY result, không cập nhật `SUCCESS/FAILED`, không tạo enrollment, không gửi email success.
9. VNPAY signature phải được tạo ở backend bằng secret cấu hình; không expose secret ra frontend.

### Module ownership rules

| Module | Owner | Quy tắc |
| --- | --- | --- |
| Auth + Email + Profile | Member 1 - AnhND | Payment không tự xử lý login/JWT/email ngoài contract |
| Course Catalog + Content | Member 2 - Nam | Payment lấy course price/status qua Course Module contract |
| Payment + Enrollment + Access | Member 3 - CuongLH | Sở hữu payments, orders, enrollments, my courses, course access |
| Learning + Quiz + Final Project | Member 4 - Đức | Dùng Access contract, không tự đọc payments để unlock |
| Mentor + Admin + Reports | Member 5 - Tiến | Report đọc cross-module data qua service/repository được duyệt |

### Soft delete rules

- User/course/payment/enrollment/submission quan trọng không được hard-delete nếu spec không yêu cầu.
- Course inactive/deleted không được bán qua checkout.
- Transaction/payment history phải được giữ để audit.

## 8. CODE & QUALITY RULES

- Backend code phải theo layered architecture hiện có.
- Frontend API calls phải đi qua `/src/api`.
- Zod validation bắt buộc cho body/query/params quan trọng.
- Business logic phức tạp phải nằm trong service, không nằm trong controller.
- Database access phải nằm trong repository.
- Function nên ngắn, rõ trách nhiệm; tách helper khi logic lặp hoặc khó đọc.
- Comments giải thích why, không giải thích what hiển nhiên.
- Không để `console.log`, `debugger`, print tạm hoặc TODO chưa được duyệt trong code hoàn thành.
- Unit test phải cover service/business logic mới.
- Integration test phải cover endpoint mới hoặc endpoint thay đổi, gồm happy path và ít nhất một error path.
- Payment/auth/access changes phải có test cho case lỗi và race/concurrency nếu spec yêu cầu.
- Không bỏ qua update API contract/documentation khi thêm hoặc sửa endpoint.

## 9. XỬ LÝ LỖI & AN TOÀN THAO TÁC

- Nếu yêu cầu mơ hồ hoặc thiếu domain context quan trọng, hỏi lại thay vì đoán.
- Nếu spec và code hiện có mâu thuẫn, báo conflict trước khi implement.
- Nếu task có rủi ro cao liên quan payment/auth/enrollment/access/database, phải đọc spec và module liên quan trước khi sửa.
- Trước thay đổi có thể phá hủy dữ liệu hoặc thay đổi rộng, phải nêu rõ rủi ro và xin approval.
- Nếu môi trường hiện tại không chạy được tool bắt buộc của repo, phải nêu rõ giới hạn đó trong báo cáo.
- Không cố bypass sandbox, permission hoặc security rule.
- Khi lỗi audit/logging xảy ra trong luồng payment, xử lý theo spec; không tự ý nuốt lỗi nếu spec yêu cầu rollback.
- Khi gặp race condition trong checkout, phải đảm bảo không tạo hai active `PENDING` payments cho cùng `userId + courseId`.

## 10. DEFINITION OF DONE (per task)

- [ ] Task chỉ implement đúng phạm vi đã duyệt.
- [ ] Relevant `SPEC.md` acceptance criteria được map và thỏa mãn.
- [ ] Code follows layered architecture.
- [ ] Controller không chứa business logic.
- [ ] Service không import Prisma trực tiếp.
- [ ] Repository chịu trách nhiệm database access.
- [ ] Zod validation có cho request body/query/params quan trọng.
- [ ] Auth dùng JWT httpOnly Cookie khi endpoint yêu cầu login.
- [ ] Không thêm Bearer-token auth khi cookie auth là chuẩn.
- [ ] Error response theo `{ success, message, code, details }` hoặc helper đã duyệt.
- [ ] Không leak secret/JWT/cookie/raw SQL error/raw Prisma error ra response hoặc logs.
- [ ] Unit tests written and passing cho business logic mới.
- [ ] Integration tests cho endpoint mới hoặc thay đổi.
- [ ] Existing tests pass trong phạm vi có thể chạy.
- [ ] Không còn debug statement hoặc TODO chưa duyệt.
- [ ] Không thêm out-of-scope feature.
- [ ] Nếu DB schema changed, migration được tạo và migration cũ không bị sửa/xóa.
- [ ] Payment-specific: amount lấy từ Course Module, VNPAY URL ký ở backend, checkout `PENDING` không tạo enrollment.

## 11. GIT CONVENTIONS

### Branch naming

`feat/[feature-name]` - tính năng mới
`fix/[bug-name]` - sửa lỗi
`spec/[feature-name]` - viết hoặc sửa spec
`chore/[short-name]` - cập nhật nhỏ

### Commit format

`[type]([scope]): [description]`

Example:
`feat(payment): create pending checkout payment`

### PR rules

- Không commit file không liên quan.
- Không mix spec edits và implementation edits nếu task không yêu cầu rõ.
- PR phải reference spec/task IDs liên quan.
- Không commit trực tiếp vào `main`, `master` hoặc `production`.
- Không edit generated migration history.
- Work lớn phải split thành PR/task nhỏ hơn.

## 12. CURRENT SPRINT CONTEXT

Sprint: Payment Checkout MVP
Focus: Tạo hoặc reuse payment `PENDING` và sinh VNPAY signed URL.
Active specs: `specs/feature-payment-checkout/SPEC.md`
Active plan: `specs/feature-payment-checkout/PLAN.md`
Active tasks: `specs/feature-payment-checkout/TASKS.md`

Current approved checkout decisions:

- URL VNPAY hết hạn sau 15 phút.
- MVP không có coupon/voucher.
- Chỉ có một active `PENDING` payment cho cùng `userId + courseId`.
- Duplicate checkout trước khi hết hạn reuse existing `checkout_url`.
- Checkout không verify VNPAY callback/return.
- Checkout không cập nhật payment thành `SUCCESS` hoặc `FAILED`.
- Checkout không tạo `enrollment`.
- Checkout không gửi enrollment success email.

Pending confirmations before implementation:

- Tên cookie auth chính xác và field user context trong request.
- Course Module function chính xác và return shape.
- Enrollment Module function chính xác và valid enrollment status.
- Có tạo bảng `payment_events` trong MVP hay chỉ dùng structured logs.
- Tên VNPAY env variables và format `vnp_OrderInfo`.
- Repository có được dùng raw SQL `SELECT ... FOR UPDATE` để lock trên MySQL hay không.

## 13. PROJECT CONTEXT REFERENCES

- `agents/PROJECT_AGENTS.md` - kiến trúc hệ thống, ADR, design patterns, folder conventions, security rules
- `specs/feature-payment-checkout/CONTEXT.md` - context feature Payment Checkout
- `specs/feature-payment-checkout/SPEC.md` - source of truth cho hành vi feature
- `specs/feature-payment-checkout/PLAN.md` - implementation approach
- `specs/feature-payment-checkout/TASKS.md` - task breakdown
- `chia job.docx` - phân chia module, API ownership, database ownership theo thành viên
- `spec-driven-&-agent-driven-development.pdf` - quy trình Spec-Driven Development và Agent-Driven Development

## 14. GITNEXUS INTEGRATION

### Always do

- MUST run impact analysis before editing shared symbols nếu GitNexus tooling có trong môi trường.
- MUST inspect dependency/usage impact trước khi rename, move hoặc change public contract.
- MUST warn nếu impact analysis trả về HIGH hoặc CRITICAL risk.

### Never do

- NEVER ignore HIGH hoặc CRITICAL impact warnings.
- NEVER rename bằng find-and-replace thủ công khi có tool rename an toàn hơn.
- NEVER edit shared API/service contract mà không kiểm tra nơi đang dùng.

### Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/document/context` | Codebase overview |
| `gitnexus://repo/document/clusters` | Functional areas |
| `gitnexus://repo/document/processes` | Execution flows |

Note: Nếu môi trường hiện tại không có GitNexus tooling, AI agent phải báo rõ không thể thực thi automation này trước khi tiếp tục các thay đổi thủ công có rủi ro.
