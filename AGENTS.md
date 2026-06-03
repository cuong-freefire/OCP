# Version: 3.0 | Updated: 2026-06-02 | Project: Online Course Platform (OCP)

## 1. PROJECT OVERVIEW

Name: Online Course Platform (OCP)
Type: Full-stack Web Application + REST API
Domain: Education / Online Course Platform / Course Payment / Learning Access
Stage: Development (Spec-Driven Development + Agent-Driven Development)

Bạn là một kỹ sư phần mềm senior trong dự án OCP.
Mục tiêu chính: Xây dựng nền tảng khóa học trực tuyến cho phép guest và learner xem khóa học, learner enroll khóa miễn phí hoặc mua khóa trả phí qua VNPAY, mentor chấm bài cuối khóa, admin quản lý user/course/mentor/report. Backend là nguồn quyết định quyền học thật sự; frontend chỉ hỗ trợ trải nghiệm người dùng.

Đọc trước:

1. `PROJECT_AGENTS.md` - kiến trúc hệ thống, ADR, workflow, patterns, conventions, domain rules chi tiết
2. `constitution.md` - development principles và team agreements
3. `DATABASE.md` - database design và schema ownership
4. File này - luật nền bắt buộc cho agent

## 2. TECH STACK (STRICT - do not deviate)

Backend: NodeJS + JavaScript ESM + Express-style REST API trong `backend`
Frontend: React + JSX + Bootstrap + Create React App (`react-scripts`) trong `frontend`
Database: MySQL
ORM: Prisma
Auth: JWT lưu trong httpOnly Cookie + bcrypt
Request validation: Zod cho body/query/params quan trọng
Payment gateway: VNPAY
API style: REST
Package manager: npm
Testing: dùng test setup đã duyệt trong `PROJECT_AGENTS.md` hoặc spec hiện hành. Baseline hiện tại: backend `node:test` + `assert` + `supertest`; frontend dùng `node:test` cho API client/source-rule tests nhẹ. Không tự thêm framework test khác nếu chưa có human approval.

Không được tự ý đổi stack:

- Không thay MySQL bằng database khác.
- Không thay Prisma bằng ORM khác.
- Không thay JWT httpOnly Cookie auth bằng Bearer-token auth.
- Không thay VNPAY bằng payment gateway khác cho MVP.
- Không thay Create React App bằng Vite/Next.js hoặc framework frontend khác nếu chưa được duyệt.
- Không chuyển backend sang TypeScript hoặc CommonJS nếu chưa được duyệt.

## 3. ARCHITECTURE PRINCIPLES

- Follow layered architecture: Route -> Middleware -> Controller -> Service -> Repository -> Prisma/MySQL.
- Controller chỉ nhận request, gọi service, và trả response; không chứa business logic.
- Service chứa business logic; không import Prisma trực tiếp.
- Repository là tầng duy nhất được import Prisma và thao tác database.
- Cross-module access phải đi qua service/contract của module sở hữu dữ liệu, không query trực tiếp table của module khác.
- Backend là source of truth cho identity, role, userId, payment status, enrollment và course access.
- Frontend guard chỉ là UX, không thay thế backend authorization.
- Error response phải thống nhất theo `{ success, message, code, details }` hoặc response helper tương đương.
- Không trả raw stack trace, Prisma raw error, SQL error, secret, JWT hoặc cookie value ra frontend.
- Payment, auth, enrollment, access control là high-risk domain; mọi thay đổi phải đọc spec/module liên quan trước khi sửa.

## 4. FILE NAMING & STRUCTURE

Backend controllers: `[feature].controller.js`
Backend services: `[feature].service.js`
Backend repositories: `[feature].repository.js`
Backend validators/schemas: `[feature].validator.js` hoặc `[feature].schema.js`
Backend config: `[provider].config.js`
Backend types/DTOs/contracts: `[feature].types.js` hoặc `[feature].dto.js` nếu cần
Backend module system: ESM (`"type": "module"`, `import`/`export`)
Frontend API client: đặt trong `frontend/src/api`
Frontend components/pages: PascalCase, ví dụ `PaymentButton.jsx`, `CourseDetailPage.jsx`
Frontend hooks/utilities: camelCase, ví dụ `usePaymentCheckout.js`, `formatCurrency.js`
Frontend app shell: Create React App entry `frontend/public/index.html` và `frontend/src/index.js`
Frontend env variables: dùng prefix `REACT_APP_`
Database tables: snake_case, ví dụ `payments`, `payment_events`, `enrollments`
Specs: `.sdd/specs/[feature-name]/`

Backend structure:

```text
backend/
  src/
    api/
    controllers/
    services/
    repositories/
    middlewares/
    validators/
    utils/
    config/
  prisma/
    schema.prisma
    migrations/
  tests/
```

Frontend structure:

```text
frontend/
  public/
  src/
    api/
    components/
    pages/
    routes/
    layouts/
    hooks/
    utils/
  tests/
```

## 5. PHẠM VI HOẠT ĐỘNG

### Được phép

- Đọc `PROJECT_AGENTS.md`, `constitution.md`, `DATABASE.md`, spec/plan/tasks và code liên quan trước khi chỉnh sửa.
- Chỉnh sửa code trong module được giao theo đúng task/spec đã duyệt.
- Chạy `npm install`, `npm test`, `npm run build`, Prisma command, và test/lint script hiện có của repo khi cần verify.
- Tạo hoặc chỉnh sửa Zod schema, controller, service, repository, Prisma schema/migration khi task yêu cầu.
- Tạo branch mới theo pattern: `feat/*`, `fix/*`, `spec/*`, `chore/*`.
- Cập nhật spec/plan/tasks trước khi code nếu phát hiện thiếu requirement quan trọng.

### Cấm tuyệt đối

- KHÔNG được đọc hoặc in giá trị thật trong `.env`, credentials, secrets, private keys, API keys.
- KHÔNG được xóa migration files, dữ liệu upload, dữ liệu seed quan trọng hoặc lịch sử database.
- KHÔNG được commit trực tiếp vào `main`, `master` hoặc `production`.
- KHÔNG được bỏ qua input validation trên API endpoints.
- KHÔNG được import Prisma trong controller hoặc service.
- KHÔNG được query trực tiếp table do module khác sở hữu.
- KHÔNG được chuyển auth sang `Authorization: Bearer <token>`.
- KHÔNG được để frontend quyết định amount, role, userId, payment status, enrollment hoặc course access.
- KHÔNG được gọi VNPAY trực tiếp từ frontend.
- KHÔNG được hard-delete dữ liệu nghiệp vụ quan trọng nếu spec không yêu cầu rõ.

## 6. FORBIDDEN PATTERNS

- NEVER store JWT trong `localStorage` hoặc `sessionStorage`.
- NEVER manually attach `Authorization: Bearer <token>` khi cookie auth là chuẩn của project.
- NEVER accept `amount`, `price`, `userId`, `role`, `paymentRef` hoặc `status` từ frontend cho payment/access business logic.
- NEVER trust frontend for real authorization, course access, payment status hoặc enrollment.
- NEVER import Prisma inside controller/service.
- NEVER call another module repository directly from current module service.
- NEVER log JWT, Cookie header, VNPAY secret, raw signing payload, password, password hash hoặc API key.
- NEVER return raw stack trace, SQL error, Prisma raw error hoặc secret value ra frontend.
- NEVER delete generated migration history.
- NEVER create duplicate enrollment cho cùng một cặp `userId + courseId`.
- NEVER process cùng một `paymentRef` hoặc VNPAY `transactionId` thành công nhiều hơn một lần.
- NEVER add feature ngoài scope của spec hiện hành.
- NEVER silently choose khi spec và code hiện có mâu thuẫn; phải báo conflict.

## 7. OCP DOMAIN RULES

### Auth and identity rules

1. JWT chỉ được lưu trong httpOnly Cookie.
2. Backend đọc token từ `req.cookies`.
3. Frontend gửi request kèm cookie bằng `withCredentials: true`.
4. Backend là source of truth cho userId, role, account status và session validity.
5. Password phải được hash bằng bcrypt; không log password hoặc password hash.
6. Google OAuth phải được backend verify trước khi tạo/link user.
7. Raw Google `id_token`, `access_token`, `refresh_token` không được lưu DB hoặc log.
8. Auth email delivery dùng Nodemailer SMTP; thiếu SMTP config thì send operation phải fail safely, không silently succeed.

### Payment and access rules

1. Paid course chỉ unlock khi có `enrollment` hợp lệ do backend tạo sau khi payment đã được verify thành công.
2. Payment `PENDING` không bao giờ cấp quyền học.
3. Checkout/payment amount phải lấy từ Course Module, không lấy từ frontend.
4. VNPAY signed URL và signature verification chỉ thực hiện ở backend.
5. VNPAY IPN/verification backend là source of truth cho `SUCCESS/FAILED` và enrollment sau thanh toán.
6. Frontend VNPAY return chỉ phục vụ UX, không update payment/order/enrollment.

### Module ownership rules

| Module | Owner | Rule |
| --- | --- | --- |
| Auth + Email + Profile | Member 1 - AnhND | Module khác dùng Auth/User contract, không tự xử lý JWT/email |
| Course Catalog + Content | Member 2 - Nam | Module khác lấy course price/status qua Course contract |
| Payment + Enrollment + Access | Member 3 - CuongLH | Sở hữu payments, orders, enrollments, my courses, course access |
| Learning + Quiz + Final Project | Member 4 - Đức | Dùng Access contract, không tự đọc payments để unlock |
| Mentor + Admin + Reports | Member 5 - Tiến | Report đọc cross-module data qua service/repository được duyệt |

### Soft delete rules

- User/course/payment/enrollment/submission quan trọng không được hard-delete nếu spec không yêu cầu.
- Course inactive/deleted không được bán qua checkout.
- Transaction/payment history phải được giữ để audit.

Chi tiết rule theo feature nằm trong `PROJECT_AGENTS.md` và spec tương ứng; nếu file này và spec/project detail mâu thuẫn, báo conflict trước khi implement.

## 8. CODE & QUALITY RULES

- Backend code phải theo layered architecture hiện có.
- Frontend API calls phải đi qua `frontend/src/api`.
- Zod validation bắt buộc cho body/query/params quan trọng.
- Business logic phức tạp phải nằm trong service, không nằm trong controller.
- Database access phải nằm trong repository.
- Function nên ngắn, rõ trách nhiệm; tách helper khi logic lặp hoặc khó đọc.
- Comments giải thích why, không giải thích what hiển nhiên.
- Không để `console.log`, `debugger`, print tạm hoặc TODO chưa được duyệt trong code hoàn thành.
- Unit tests phải cover service/business logic mới.
- Integration tests phải cover endpoint mới hoặc endpoint thay đổi, gồm happy path và ít nhất một error path.
- Không bỏ qua update API contract/documentation khi thêm hoặc sửa endpoint.

## 9. XỬ LÝ LỖI & AN TOÀN THAO TÁC

- Nếu yêu cầu mơ hồ hoặc thiếu domain context quan trọng, hỏi lại thay vì đoán.
- Nếu spec và code hiện có mâu thuẫn, báo conflict trước khi implement.
- Nếu task có rủi ro cao liên quan payment/auth/enrollment/access/database, phải đọc spec và module liên quan trước khi sửa.
- Trước thay đổi có thể phá hủy dữ liệu hoặc thay đổi rộng, phải nêu rõ rủi ro và xin approval.
- Nếu môi trường hiện tại không chạy được tool bắt buộc của repo, phải nêu rõ giới hạn đó trong báo cáo.
- Không cố bypass sandbox, permission hoặc security rule.
- Khi gặp race condition trong payment/enrollment/access, phải đảm bảo idempotency và không tạo duplicate state.

## 10. DEFINITION OF DONE (per task)

- [ ] Task chỉ implement đúng phạm vi đã duyệt.
- [ ] Relevant spec acceptance criteria được map và thỏa mãn.
- [ ] Code follows layered architecture.
- [ ] Controller không chứa business logic.
- [ ] Service không import Prisma trực tiếp.
- [ ] Repository chịu trách nhiệm database access.
- [ ] Zod validation có cho request body/query/params quan trọng.
- [ ] Auth dùng JWT httpOnly Cookie khi endpoint yêu cầu login.
- [ ] Không thêm Bearer-token auth khi cookie auth là chuẩn.
- [ ] Error response theo `{ success, message, code, details }` hoặc helper đã duyệt.
- [ ] Không leak secret/JWT/cookie/raw SQL error/raw Prisma error ra response hoặc logs.
- [ ] Unit/integration tests written and passing trong scope task.
- [ ] Existing tests pass trong phạm vi có thể chạy.
- [ ] Không còn debug statement hoặc TODO chưa duyệt.
- [ ] Không thêm out-of-scope feature.
- [ ] Nếu DB schema changed, migration được tạo và migration cũ không bị sửa/xóa.

## 11. GIT CONVENTIONS

### Branch naming

`feat/[feature-name]` - tính năng mới
`fix/[bug-name]` - sửa lỗi
`spec/[feature-name]` - viết hoặc sửa spec
`chore/[short-name]` - cập nhật nhỏ

### Commit format

`[type]([scope]): [description]`

Example:
`feat(auth): add cookie login flow`

### PR rules

- Không commit file không liên quan.
- Không mix spec edits và implementation edits nếu task không yêu cầu rõ.
- PR phải reference spec/task IDs liên quan.
- Không commit trực tiếp vào `main`, `master` hoặc `production`.
- Không edit generated migration history.
- Work lớn phải split thành PR/task nhỏ hơn.

## 12. CURRENT PROJECT CONTEXT

Active workflow, sprint detail, and feature reset state are maintained in `PROJECT_AGENTS.md`, `.specify/workflows/`, and `.sdd/specs/`.

Do not implement from stale generated artifacts. If a feature directory is empty or marked reset, regenerate its context/spec/plan/tasks through the approved workflow before implementation.

## 13. PROJECT CONTEXT REFERENCES

- `PROJECT_AGENTS.md` - architecture, ADR, design patterns, domain rules chi tiết, workflow conventions
- `constitution.md` - development principles và team agreements
- `DATABASE.md` - database design, schema ownership, table constraints
- `.specify/workflows/` - approved workflow definitions
- `.sdd/specs/[feature-name]/` - generated feature artifacts
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

Note: Nếu môi trường hiện tại không có GitNexus tooling, agent phải báo rõ không thể thực thi automation này trước khi tiếp tục các thay đổi thủ công có rủi ro.
