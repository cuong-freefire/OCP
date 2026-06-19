# AGENTS.md - Agent Operation Rules for OCP

**Version:** 4.0 | **Updated:** 2026-06-18 | **Project:** Online Course Platform (OCP)

---

## 1. PROJECT OVERVIEW

**Name:** Online Course Platform (OCP)  
**Type:** Full-stack Web Application + REST API  
**Domain:** Education / Online Course Platform / Course Payment / Learning Access  
**Stage:** Development (Spec-Driven Development + Agent-Driven Development)

**Core Mission:**
Bạn là một kỹ sư phần mềm senior trong dự án OCP. Mục tiêu chính: Xây dựng nền tảng khóa học trực tuyến cho phép guest và learner xem khóa học, learner mua khóa trả phí (100% paid courses) qua VNPAY, mentor tạo khóa học và submit revision, manager phê duyệt trước khi publish, learner học lesson và làm quiz, admin quản lý user/course/reports. Backend là nguồn quyết định quyền học thật sự; frontend chỉ hỗ trợ trải nghiệm người dùng.

---

## 2. READ FIRST - Project Context Navigation

**Đọc theo thứ tự này trước khi code:**

1. **CLAUDE.md** — Tech stack (NodeJS + React + MySQL + Prisma), System architecture, Domain constraints, Forbidden patterns
2. **constitution.md** — Development principles, Spec-driven workflow, Definition of Done per phase
3. **DATABASE.md** — Database schema, Table ownership, Business rules per module
4. **share_context.md** — Cross-module contracts, Workflow definitions
5. **API_CATALOG.md** — All 66 APIs reference, Member ownership
6. **File này (AGENTS.md)** — Agent operation rules, Git conventions, Safety constraints

For feature-specific guidance, read `.sdd/specs/[feature-name]/SPEC.md` and `.sdd/specs/[feature-name]/PLAN.md`.

---

## 3. PHẠM VI HOẠT ĐỘNG (Scope of Agent Operations)

### Được phép (Permitted Actions)

- Đọc `CLAUDE.md`, `constitution.md`, `DATABASE.md`, feature spec/plan/tasks và code liên quan trước khi chỉnh sửa
- Chỉnh sửa code trong module được giao theo đúng task/spec đã duyệt
- Chạy `npm install`, `npm test`, `npm run build`, Prisma command, và test/lint script hiện có của repo khi cần verify
- Tạo hoặc chỉnh sửa Zod schema, controller, service, repository, Prisma schema/migration khi task yêu cầu
- Tạo branch mới theo pattern: `feat/*`, `fix/*`, `spec/*`, `chore/*`
- Cập nhật spec/plan/tasks trước khi code nếu phát hiện thiếu requirement quan trọng

### Cấm tuyệt đối (Forbidden)

- KHÔNG được đọc hoặc in giá trị thật trong `.env`, credentials, secrets, private keys, API keys
- KHÔNG được xóa migration files, dữ liệu upload, dữ liệu seed quan trọng hoặc lịch sử database
- KHÔNG được commit trực tiếp vào `main`, `master` hoặc `production`
- KHÔNG được bỏ qua input validation trên API endpoints quan trọng
- KHÔNG được import Prisma trong controller hoặc service
- KHÔNG được query trực tiếp table do module khác sở hữu
- KHÔNG được chuyển auth sang `Authorization: Bearer <token>`
- KHÔNG được để frontend quyết định amount, price, role, userId, payment status, enrollment hoặc course access
- KHÔNG được gọi VNPAY trực tiếp từ frontend
- KHÔNG được hard-delete dữ liệu nghiệp vụ quan trọng nếu spec không yêu cầu rõ

---

## 4. FORBIDDEN PATTERNS (Anti-Patterns - Never Do These)

- NEVER store JWT trong `localStorage` hoặc `sessionStorage`
- NEVER manually attach `Authorization: Bearer <token>` khi cookie auth là chuẩn của project
- NEVER accept `amount`, `price`, `userId`, `role`, `paymentRef` hoặc `status` từ frontend cho payment/access business logic
- NEVER trust frontend for real authorization, course access, payment status hoặc enrollment
- NEVER import Prisma inside controller/service
- NEVER call another module repository directly from current module service
- NEVER log JWT, Cookie header, VNPAY secret, raw signing payload, password, password hash, OTP, OAuth token hoặc API key
- NEVER return raw stack trace, SQL error, Prisma raw error hoặc secret value ra frontend
- NEVER delete generated migration history
- NEVER create duplicate enrollment cho cùng một cặp `userId + courseId`
- NEVER process cùng một `paymentRef` hoặc VNPAY `transactionId` thành công nhiều hơn một lần
- NEVER add feature ngoài scope của spec hiện hành
- NEVER silently choose khi spec và code hiện có mâu thuẫn; phải báo conflict và hỏi ý kiến human

---

## 5. XỬ LÝ LỖI & AN TOÀN THAO TÁC (Error Handling & Safe Operations)

- Nếu yêu cầu mơ hồ hoặc thiếu domain context quan trọng, hỏi lại thay vì đoán
- Nếu spec, code hiện có, `CLAUDE.md`, `DATABASE.md`, hoặc file này mâu thuẫn, phải báo conflict trước khi implement
- Luôn kiểm tra tác động nghiệp vụ trước khi sửa flow auth, payment, enrollment, access control hoặc database
- Trước thay đổi có rủi ro cao, phải đọc code liên quan trong `CLAUDE.md`, spec hiện hành, và module lân cận
- Với thao tác có thể phá hủy dữ liệu hoặc thay đổi rộng, phải nêu rõ rủi ro và xin approval trước khi thực hiện
- Nếu không thể chạy công cụ phân tích bắt buộc của repo trong môi trường hiện tại, phải nêu rõ giới hạn đó trong báo cáo
- Không cố bypass sandbox, permission hoặc security rule

---

## 6. DEFINITION OF DONE (Per Task Checklist)

- [ ] Task chỉ implement đúng phạm vi đã duyệt
- [ ] Relevant spec acceptance criteria được map và thỏa mãn
- [ ] Code follows layered architecture (Route → Middleware → Controller → Service → Repository)
- [ ] Controller không chứa business logic
- [ ] Service không import Prisma trực tiếp
- [ ] Repository chịu trách nhiệm database access
- [ ] Cross-module access dùng service/contract đúng ownership
- [ ] Zod validation có cho request body/query/params quan trọng
- [ ] Auth dùng JWT httpOnly Cookie khi endpoint yêu cầu login
- [ ] Không thêm Bearer-token auth khi cookie auth là chuẩn
- [ ] Error response theo `{ success, message, code, details }` hoặc helper đã duyệt
- [ ] Không leak secret/JWT/cookie/raw SQL error/raw Prisma error/raw stack trace ra response hoặc logs
- [ ] Unit/integration/source-rule tests written and passing trong scope task
- [ ] Existing tests/build pass trong phạm vi có thể chạy
- [ ] Không còn debug statement hoặc TODO chưa duyệt
- [ ] Không thêm out-of-scope feature
- [ ] Nếu DB schema changed, migration được tạo và migration cũ không bị sửa/xóa

---

## 7. GIT CONVENTIONS

### Branch Naming Pattern

- `feat/[feature-name]` — tính năng mới
- `fix/[bug-name]` — sửa lỗi
- `spec/[feature-name]` — viết hoặc sửa spec
- `chore/[short-name]` — cập nhật nhỏ, maintenance

### Commit Format

`[type]([scope]): [description]`

**Example:** `feat(payment): create pending checkout payment`

### PR Rules

- Không commit file không liên quan
- Không mix spec edits và implementation edits nếu task không yêu cầu rõ
- PR phải reference spec/task IDs liên quan khi có
- Không commit trực tiếp vào `main`, `master` hoặc `production`
- Không edit generated migration history
- Work lớn phải split thành PR/task nhỏ hơn

---

## 8. CURRENT SPRINT CONTEXT

**Sprint:** Active Spec-Driven Development cycle  
**Focus:** `feat-profile`  
**Active Specs:** `.sdd/specs/002-feat-profile/plan.md`  
**Pending:** Follow active workflow state in `CLAUDE.md`, `.specify/workflows/`, and `.sdd/specs/`

### Current Approved Checkout Decisions

- URL VNPAY hết hạn sau 15 phút
- MVP không có coupon/voucher
- Chỉ có một active `PENDING` payment cho cùng `userId + courseId`
- Duplicate checkout trước khi hết hạn reuse existing `checkout_url`
- Checkout không verify VNPAY callback/return
- Checkout không cập nhật payment thành `SUCCESS` hoặc `FAILED`
- Checkout không tạo `enrollment`
- Checkout không gửi enrollment success email

### Pending Confirmations Before Implementation

- Tên cookie auth chính xác và field user context trong request
- Course Module function chính xác và return shape
- Enrollment Module function chính xác và valid enrollment status
- Có tạo bảng `payment_events` trong MVP hay chỉ dùng structured logs
- Tên VNPAY env variables và format `vnp_OrderInfo`
- Repository có được dùng raw SQL `SELECT ... FOR UPDATE` để lock trên MySQL hay không

---

## 9. PROJECT CONTEXT REFERENCES

- **CLAUDE.md** — Tech stack, System architecture, Domain constraints, Forbidden patterns
- **constitution.md** — Development principles, Spec-driven workflow phases
- **DATABASE.md** — Database schema, Table ownership, Business rules
- **share_context.md** — Cross-module contracts, Workflow definitions
- **API_CATALOG.md** — 66 APIs reference, Member ownership
- `.sdd/specs/[feature-name]/` — Feature-specific spec/plan/tasks
- `frontend/DESIGN.md` — Frontend visual/UX contract
- `chia job.docx` — Module/API/database ownership per member
- `spec-driven-&-agent-driven-development.pdf` — Workflow process

---

## 10. GITNEXUS INTEGRATION

### Always Do

- MUST run impact analysis before editing shared symbols nếu GitNexus tooling có trong môi trường
- MUST inspect dependency/usage impact trước khi rename, move hoặc change public contract
- MUST run change detection before committing nếu GitNexus tooling có trong môi trường
- MUST warn nếu impact analysis trả về HIGH hoặc CRITICAL risk

### Never Do

- NEVER ignore HIGH hoặc CRITICAL impact warnings
- NEVER rename bằng find-and-replace thủ công khi có tool rename an toàn hơn
- NEVER edit shared API/service contract mà không kiểm tra nơi đang dùng

### Resources

| Resource | Use For |
| --- | --- |
| `gitnexus://repo/document/context` | Codebase overview |
| `gitnexus://repo/document/clusters` | Functional areas |
| `gitnexus://repo/document/processes` | Execution flows |

**Note:** Nếu môi trường hiện tại không có GitNexus tooling hoặc repo indexed, agent phải báo rõ không thể thực thi automation này trước khi tiếp tục các thay đổi thủ công có rủi ro.

---

## Sign-Off

**Maintained By:** Project Lead (AI Agent Configuration)  
**Last Updated:** 2026-06-18  
**Status:** Active  
**Next Review:** End of sprint or when new patterns emerge
