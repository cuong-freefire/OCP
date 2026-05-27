# AGENTS.md

Project Context for AI Agents

# Version: 1.0 | Updated: 2026-05-26 | Project: OCP

File này là tài liệu bắt buộc cho mọi AI agent trước khi sửa đặc tả, kế hoạch, nhiệm vụ hoặc mã nguồn trong dự án OCP. Mục tiêu là giảm giả định ngầm, giữ đúng ranh giới module, và tránh AI agent tự ý triển khai ngoài phạm vi đã duyệt.

## 1. PROJECT OVERVIEW

Name: OCP (Online Course Platform)

Type: Ứng dụng web full-stack, gồm giao diện React và API phía máy chủ dùng NodeJS.

Domain: Giáo dục, nền tảng khóa học trực tuyến.

Stage: Đang phát triển theo quy trình Spec-Driven Development và Agent-Driven Development.

Main goal:

- Khách và học viên có thể xem danh sách, chi tiết khóa học.
- Học viên có thể mua khóa học trả phí qua VNPAY hoặc ghi danh khóa học miễn phí.
- Phía máy chủ là nguồn quyết định quyền học thật sự.
- Khóa học trả phí chỉ được mở khóa khi có `enrollment` hợp lệ sau khi phía máy chủ xác minh thanh toán thành công.
- Mentor chấm bài cuối khóa trong khóa học được phân công.
- Admin quản lý người dùng, khóa học, mentor và báo cáo.

Current active feature context:

- Tính năng: Payment Checkout, tức tạo yêu cầu thanh toán VNPAY.
- Tài liệu đang dùng: `SPEC.md`, `PLAN.md`, `TASKS.md`.
- Phạm vi hiện tại: chỉ tạo hoặc tái sử dụng payment `PENDING` và sinh URL VNPAY đã ký.
- Ngoài phạm vi hiện tại: xác minh VNPAY callback/return, cập nhật `SUCCESS/FAILED`, tạo `enrollment`, gửi email thành công.

## 2. TECH STACK (STRICT - do not deviate)

Backend: NodeJS và API kiểu Express trong `ocp-api`.

Frontend: React và Bootstrap trong `ocp-web`.

Database: MySQL.

ORM: Prisma.

Auth: JWT lưu trong httpOnly Cookie và bcrypt để băm mật khẩu.

Request validation: Zod cho các body, query và params quan trọng.

Payment gateway: VNPAY.

API style: REST.

Testing: dùng bộ test hiện có của dự án. Không tự ý thêm framework test mới nếu chưa có người phụ trách duyệt.

Strict rules:

- Không thay MySQL bằng cơ sở dữ liệu khác.
- Không thay Prisma bằng ORM khác.
- Không thay cơ chế JWT trong httpOnly Cookie bằng Bearer token.
- Không thêm Stripe hoặc cổng thanh toán khác cho MVP nếu đặc tả không yêu cầu rõ.
- Không thêm kiểu kiến trúc mới làm vòng qua cấu trúc phân tầng của dự án.

## 3. ARCHITECTURE PRINCIPLES

### Layered Architecture

Code phía máy chủ phải đi theo luồng sau:

```text
Route / điểm vào API
  -> Middleware xác thực, phân quyền, kiểm tra dữ liệu
  -> Controller
  -> Service
  -> Repository hoặc hợp đồng module ngoài
  -> Prisma / MySQL
```

Rules:

- Controller chỉ nhận request và trả response.
- Controller không chứa logic nghiệp vụ.
- Service chứa logic nghiệp vụ.
- Service không được import Prisma trực tiếp.
- Repository là tầng duy nhất được import Prisma và thao tác với MySQL.
- Dữ liệu thuộc module khác phải được truy cập thông qua service hoặc hợp đồng module, không gọi thẳng repository của module khác.

### Authentication

Dự án dùng JWT trong httpOnly Cookie.

Rules:

- Phía máy chủ đọc token từ `req.cookies`.
- Giao diện phải dùng `withCredentials: true`.
- Giao diện không được lưu JWT trong `localStorage` hoặc `sessionStorage`.
- Giao diện không được tự gắn `Authorization: Bearer <token>`.
- Phía máy chủ không được dùng header `Authorization` làm nguồn xác thực khi đặc tả yêu cầu xác thực bằng cookie.

### Authorization

Phía máy chủ là nguồn quyết định quyền truy cập thật sự.

Rules:

- Guard ở giao diện chỉ phục vụ trải nghiệm người dùng.
- Phía máy chủ phải kiểm tra JWT, vai trò, enrollment, phân công mentor và quy tắc truy cập.
- Không tin vai trò, `userId`, trạng thái thanh toán hoặc trạng thái quyền học do giao diện gửi lên.

### Payment Integrity

Logic thanh toán phải do phía máy chủ kiểm soát.

Rules:

- Giao diện chỉ gửi dữ liệu ý định thanh toán được đặc tả cho phép, thường là `courseId`.
- Giao diện không được gửi hoặc quyết định `amount`, `price`, `status`, `paymentRef`, `userId`.
- Phía máy chủ tạo yêu cầu thanh toán và URL VNPAY đã ký.
- Phía máy chủ xác minh callback/return của VNPAY trong tính năng webhook/return riêng.
- Payment `PENDING` không được mở khóa khóa học trả phí.
- `enrollment` là nguồn quyết định quyền học khóa trả phí.

### Module Ownership

| Thành viên | Module | Trách nhiệm chính |
| --- | --- | --- |
| Thành viên 1 - AnhND | Xác thực + Email + Hồ sơ | đăng ký, đăng nhập, JWT, xác minh email, quên mật khẩu, hồ sơ người dùng, email thành công khi enrollment |
| Thành viên 2 - Nam | Danh mục khóa học + Nội dung | khóa học, danh mục, section, lesson, giá và trạng thái khóa học |
| Thành viên 3 - CuongLH | Payment + Enrollment + Access | thanh toán, order, enrollment, khóa học của tôi, quyền truy cập khóa học |
| Thành viên 4 - Đức | Học tập + Quiz + Bài cuối khóa | bảng học tập, lesson, tiến độ, quiz, nộp bài cuối khóa |
| Thành viên 5 - Tiến | Mentor + Admin + Báo cáo | phân công mentor, đánh giá của mentor, quản lý admin, báo cáo |

### API Ownership

| Nhóm API | Chủ sở hữu | Ghi chú |
| --- | --- | --- |
| `/auth/*` | Thành viên 1 | đăng ký, đăng nhập, xác minh, đặt lại mật khẩu |
| `/email/*` | Thành viên 1 | hệ thống email |
| `/users/profile` | Thành viên 1 | hồ sơ user hiện tại |
| `/courses/*` | Thành viên 2 | danh sách, chi tiết, CRUD khóa học cho admin |
| `/categories/*` | Thành viên 2 | CRUD danh mục |
| `/sections/*`, `/lessons/*` | Thành viên 2 | cấu trúc nội dung khóa học |
| `/payments/*` | Thành viên 3 | VNPAY, checkout, lịch sử thanh toán |
| `/enrollments/*`, `/my-courses` | Thành viên 3 | enrollment và quyền truy cập khóa học |
| `/learning/*`, `/progress/*` | Thành viên 4 | học tập và tiến độ |
| `/quizzes/*` | Thành viên 4 | quiz và chấm tự động |
| `/projects/*` | Thành viên 4 | học viên nộp bài cuối khóa |
| `/mentor/*` | Thành viên 5 | hàng đợi mentor và đánh giá |
| `/admin/*` | Thành viên 5 | bảng điều khiển, user, mentor, báo cáo |

### Database Ownership

| Bảng hoặc nhóm bảng | Chủ sở hữu | Module khác chỉ được dùng thông qua |
| --- | --- | --- |
| `users` | Thành viên 1 | hợp đồng Auth/User service |
| `refresh_tokens` | Thành viên 1 | Auth service |
| `email_verifications`, `password_reset_tokens` | Thành viên 1 | Auth/Email service |
| `courses`, `categories`, `course_sections`, `lessons` | Thành viên 2 | hợp đồng Course service |
| `orders`, `payments`, `enrollments` | Thành viên 3 | hợp đồng Payment/Enrollment service |
| `lesson_progress`, `course_progress` | Thành viên 4 | hợp đồng Learning/Progress service |
| `quizzes`, `quiz_questions`, `quiz_submissions` | Thành viên 4 | hợp đồng Quiz service |
| `project_submissions` | Thành viên 4 | service nộp bài cuối khóa |
| `mentor_assignments`, `project_reviews`, `mentor_feedbacks` | Thành viên 5 | service Mentor/Admin |
| `reports_optional` | Thành viên 5 | service báo cáo hoặc repository |

Rules:

- Một module không được query trực tiếp bảng do module khác sở hữu.
- Module thanh toán không được query trực tiếp bảng `courses`; phải dùng hợp đồng module khóa học.
- Module học tập không được query `payments` để quyết định quyền học; phải dùng hợp đồng Enrollment/Access.
- Module báo cáo có thể đọc dữ liệu nhiều module thông qua report repository/service, dùng query có tham số nếu bắt buộc phải dùng SQL trực tiếp.

### Cross-Module Contracts

Hợp đồng kiểm tra quyền học:

```text
canAccessCourse(userId, courseId) -> boolean
```

Used by:

- Kiểm soát quyền xem chi tiết khóa học hoặc nội dung lesson.
- Luồng học tập, quiz và bài cuối khóa.

Hợp đồng sau thanh toán thành công:

```text
payment SUCCESS -> enrollment CREATED -> gửi email enrollment thành công
```

Used by:

- Thông báo email.
- Khóa học của tôi và bảng học tập.
- Report.

Hợp đồng giá khóa học:

```text
courseService.getCourseById(courseId) -> thông tin khóa học gồm price/status/isPaid
```

Used by:

- Payment Checkout.
- Xác minh webhook thanh toán.

Hợp đồng chống xử lý lặp thanh toán:

```text
paymentRef / transactionId chỉ được xử lý thành công một lần
```

Used by:

- Tính năng VNPAY callback/return.

## 4. FILE NAMING & STRUCTURE

### Backend `/backend`

```text
/backend
  /src
    /api            # Điểm vào API, định nghĩa endpoint và map tới controller.
    /controllers    # Nhận request, gọi service, trả response.
    /services       # Logic nghiệp vụ, không được gọi Prisma trực tiếp.
    /repositories   # Truy cập dữ liệu, là tầng duy nhất được import Prisma.
    /middlewares    # Xác thực, vai trò, kiểm tra dữ liệu, xử lý lỗi chung.
    /utils          # Tiện ích thuần, response builder, custom error.
    /config         # Biến môi trường và cấu hình bên thứ ba.
  /prisma
    schema.prisma
    /migrations
```

Backend naming:

- Controller: `[tinh-nang].controller.ts`
- Service: `[tinh-nang].service.ts`
- Repository: `[tinh-nang].repository.ts`
- Validator hoặc schema: `[tinh-nang].validator.ts` hoặc `[tinh-nang].schema.ts`
- File cấu hình: `[provider].config.ts`
- Kiểu dữ liệu: `[tinh-nang].types.ts`
- Bảng cơ sở dữ liệu: `snake_case`
- Biến và hàm JS/TS: `camelCase`
- Class và DTO type: `PascalCase`

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

- Lệnh gọi API phải đi qua `/src/api`.
- Component không được gọi endpoint trực tiếp nếu logic đó được tái sử dụng.
- Giao diện theo vai trò không được thay thế kiểm tra quyền ở phía máy chủ.
- Axios hoặc client HTTP phải dùng `withCredentials: true` cho cookie auth.

## 5. FORBIDDEN PATTERNS

Không làm các việc sau nếu chưa có người phụ trách duyệt thay đổi đặc tả rõ ràng:

- Không triển khai khi chưa đọc `AGENTS.md`, `SPEC.md`, `PLAN.md` và `TASKS.md` liên quan.
- Không viết mã trước khi đặc tả, kế hoạch hoặc nhiệm vụ được duyệt nếu người dùng chỉ yêu cầu lập kế hoạch.
- Không lưu JWT trong `localStorage` hoặc `sessionStorage`.
- Không tự gắn `Authorization: Bearer <token>` khi dự án yêu cầu xác thực bằng cookie.
- Không để giao diện quyết định quyền thật, vai trò, trạng thái thanh toán, enrollment hoặc quyền truy cập khóa học.
- Không nhận `amount`, `price`, `userId`, `role`, `paymentRef` hoặc `status` từ giao diện cho logic nghiệp vụ thanh toán.
- Không query trực tiếp bảng do module khác sở hữu từ service của module hiện tại.
- Không import Prisma trong service hoặc controller.
- Không gọi VNPAY trực tiếp từ giao diện.
- Không mở khóa khóa học trả phí từ redirect phía giao diện.
- Không tạo enrollment từ checkout `PENDING`.
- Không tạo enrollment trùng cho cùng một cặp user-course.
- Không xử lý cùng một `paymentRef` hoặc `transactionId` từ cổng thanh toán thành công nhiều hơn một lần.
- Không log JWT, Cookie header, VNPAY secret, payload ký thô, mật khẩu, password hash hoặc API key.
- Không trả raw stack trace, lỗi SQL, lỗi Prisma thô hoặc giá trị bí mật về giao diện.
- Không xóa lịch sử migration hoặc file migration cũ.
- Không hard-delete dữ liệu nghiệp vụ quan trọng như người dùng, khóa học, thanh toán, enrollment, bài nộp, kết quả chấm nếu đặc tả không yêu cầu rõ.
- Không thêm tính năng ngoài phạm vi `Out of Scope`.

## 6. DEFINITION OF DONE (per task)

Một nhiệm vụ chỉ được xem là hoàn thành khi mọi điều kiện áp dụng bên dưới đều đúng:

- [ ] Nhiệm vụ chỉ triển khai đúng phạm vi đã duyệt.
- [ ] Acceptance Criteria liên quan trong `SPEC.md` đã được map và thỏa mãn.
- [ ] Code tuân thủ kiến trúc phân tầng.
- [ ] Controller không chứa logic nghiệp vụ.
- [ ] Service không import Prisma trực tiếp.
- [ ] Repository chịu trách nhiệm truy cập cơ sở dữ liệu.
- [ ] Có Zod validation cho body, query hoặc params quan trọng mới.
- [ ] Xác thực dùng httpOnly Cookie thông qua middleware khi đặc tả yêu cầu.
- [ ] Không thêm Bearer-token auth khi đặc tả yêu cầu cookie auth.
- [ ] Phản hồi lỗi theo dạng `{ success, message, code, details }` hoặc helper phản hồi đã được dự án duyệt.
- [ ] Không lộ secret, JWT, cookie hoặc lỗi SQL thô trong response hay log.
- [ ] Unit test bao phủ logic service hoặc nghiệp vụ mới.
- [ ] Integration test bao phủ endpoint API mới hoặc thay đổi, gồm luồng thành công và ít nhất một luồng lỗi.
- [ ] Test hiện có vẫn pass.
- [ ] Không còn debug statement như `console.log`, `debugger` hoặc log tạm.
- [ ] Không còn TODO chưa xử lý, trừ khi người phụ trách chấp nhận rõ.
- [ ] Không thêm tính năng ngoài phạm vi.
- [ ] Nếu đổi DB schema, phải có migration và không sửa/xóa migration cũ.

Payment-specific done criteria:

- [ ] Quyền học khóa trả phí dựa trên `enrollment`, không dựa trên payment `PENDING`.
- [ ] Amount lấy từ hợp đồng Course Module, không lấy từ giao diện.
- [ ] URL và chữ ký VNPAY được tạo ở phía máy chủ.
- [ ] Hành vi checkout hoặc callback trùng không được tạo tác dụng phụ lặp ở những nơi đặc tả yêu cầu.

## 7. GIT CONVENTIONS

Branch naming:

- `feat/[ten-tinh-nang]`
- `fix/[bug-name]`
- `spec/[ten-tinh-nang]`
- `chore/[topic]`

Commit format:

```text
type(scope): mô tả ngắn
```

Examples:

- `spec(payment): thêm đặc tả mức 3 cho checkout`
- `feat(payment): tạo thanh toán checkout đang chờ`
- `fix(auth): đọc jwt từ httpOnly cookie`
- `test(payment): thêm test checkout trùng`

Rules:

- Không commit file không liên quan.
- Không trộn sửa đặc tả và sửa phần triển khai trong cùng một nhiệm vụ nếu nhiệm vụ không yêu cầu rõ cả hai.
- Không sửa lịch sử migration đã sinh.
- Pull request phải tham chiếu đặc tả hoặc mã nhiệm vụ liên quan.
- Mã do AI agent tạo phải đạt checklist trước khi đưa rà soát.

## 8. CURRENT SPRINT CONTEXT

Sprint focus:

- Payment Checkout: tạo hoặc tái sử dụng payment `PENDING` và sinh URL VNPAY đã ký.

Active files:

- `SPEC.md`: nguồn sự thật cho hành vi tính năng.
- `PLAN.md`: cách tiếp cận triển khai.
- `TASKS.md`: danh sách nhiệm vụ triển khai.
- `AGENTS.md`: ngữ cảnh toàn cục của dự án cho AI agent.

Current approved checkout decisions:

- URL VNPAY hết hạn sau 15 phút.
- MVP không có coupon/voucher.
- Chỉ có một payment `PENDING` còn hiệu lực cho cùng `userId + courseId`.
- Checkout trùng trước khi hết hạn sẽ tái sử dụng `checkout_url` hiện có.
- Checkout không xác minh kết quả VNPAY.
- Checkout không cập nhật thanh toán thành `SUCCESS` hoặc `FAILED`.
- Checkout không tạo `enrollment`.
- Checkout không gửi email enrollment thành công.

Current implementation priority:

1. Xác nhận hợp đồng: cookie auth/user context, hàm Course Module, hàm Enrollment Module, tên biến môi trường VNPAY.
2. Triển khai schema, repository và service thanh toán theo `TASKS.md`.
3. Thêm test cho cookie auth, validation, chữ ký VNPAY, checkout trùng, pending hết hạn và rollback.

Open human confirmations before implementation:

- Tên cookie auth chính xác và field user context trong request.
- Hàm Course Module chính xác và dạng dữ liệu trả về.
- Hàm Enrollment Module chính xác và trạng thái enrollment hợp lệ.
- MVP có tạo bảng `payment_events` hay chỉ dùng log có cấu trúc.
- Tên biến môi trường VNPAY chính xác và format `vnp_OrderInfo`.
- Repository có được dùng raw SQL `SELECT ... FOR UPDATE` để lock trên MySQL hay không.

Agent behavior in this sprint:

- Nếu thiếu hợp đồng bắt buộc, phải hỏi trước khi viết mã.
- Nếu đặc tả và mã nguồn hiện có mâu thuẫn, phải báo mâu thuẫn; không tự chọn âm thầm.
- Nếu khi triển khai phát hiện thiếu yêu cầu, phải cập nhật đặc tả, kế hoạch hoặc nhiệm vụ trước, rồi chỉ triển khai sau khi được duyệt.
