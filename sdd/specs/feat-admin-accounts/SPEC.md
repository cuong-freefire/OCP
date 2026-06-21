# Feature: Admin Accounts & Auth Middleware

# Version: 1.0.0 | Owner: Member A | Status: APPROVED

# Mức độ: Detailed (Risk: High)

## 1. Context & Goal

Mục tiêu cốt lõi của tính năng này là giải quyết triệt để lỗ hổng bảo mật E2.2 bằng cách áp dụng cơ chế Role Versioning (phiên bản quyền) thông qua API thay đổi vai trò người dùng do Admin thực hiện. Đồng thời, tính năng này cung cấp hợp đồng giao tiếp `authMiddleware` chuẩn mực để tất cả các phân hệ khác (Member B, C, D, E) import và bảo vệ các API của họ. Việc đảm bảo Access JWT cũ lập tức vô hiệu hóa khi người dùng bị thay đổi quyền là ưu tiên bảo mật cao nhất.

## 2. Actors & Roles

* **Admin**: Người dùng có quyền quản trị cao nhất, được phép thay đổi vai trò (`role`) của các người dùng khác trong hệ thống.
* **Người dùng bị đổi quyền**: Đối tượng chịu tác động, sẽ bị vô hiệu hóa Access Token và Refresh Token cũ ngay khi quyền thay đổi.
* **Other Modules (Member B, C, D, E)**: Là "khách hàng" sử dụng `authMiddleware` như một Integration Contract để gác cổng các API của phân hệ mình.

## 3. Functional Requirements (EARS Notation)

**API Đổi Quyền (Role Change)**

* **WHEN** Admin gửi request `PUT /admin/users/:userId/role` với vai trò mới, **THE hệ thống SHALL** cập nhật trường `role` và tăng giá trị `role_version` lên 1 đơn vị (`increment: 1`) trong bảng `users`.
* **WHEN** thao tác đổi quyền được thực thi thành công, **THE hệ thống SHALL** trả về HTTP 200 OK với thông tin `role` và `role_version` mới cập nhật.
* **WHERE** Admin thay đổi quyền của một Admin khác (Admin-to-Admin Role Change), **THE hệ thống SHALL** ghi log hành động này vào system logs để phục vụ mục đích audit.

**Hợp đồng Middleware (Auth Middleware Contract)**

* **WHEN** một request đi qua `authMiddleware`, **THE hệ thống SHALL** giải mã Access JWT để trích xuất `userId`, `role`, và `roleVersion`.
* **THE hệ thống SHALL** truy vấn bảng `users` trong cơ sở dữ liệu ở mỗi request để lấy `status` và `role_version` hiện tại của người dùng.
* **WHEN** xác thực thành công (trạng thái hợp lệ và role version khớp), **THE hệ thống SHALL** gán `req.user = { userId, role, roleVersion }` và gọi hàm `next()`.
* **THE hệ thống SHALL** cung cấp chữ ký export middleware theo định dạng: `export const authMiddleware = (options?: { roles?: string[], skipRoleCheck?: boolean }) => { ... }`.
* **THE hệ thống SHALL** cung cấp middleware hỗ trợ kiểm tra mảng quyền thông qua tham số `roles`. Nếu `roles` được truyền vào (VD: `['ADMIN', 'MANAGER']`), middleware PHẢI kiểm tra `req.user.role` có nằm trong mảng này không.
* **(Ghi chú: authMiddleware KHÔNG xử lý logic bypass canAccessCourse. Đó là trách nhiệm của EnrollmentService do Member C đảm nhận theo share_context.md).**

## 4. Non-functional Requirements

* **Transaction Isolation**: Sử dụng mức `READ COMMITTED` cho thao tác cập nhật `role_version`. Mặc định của Prisma là đủ an toàn do đây là thao tác cập nhật đơn lẻ trên một row.

* **Security (Rate Limiting)**: API đổi quyền phải bị giới hạn ở mức 10 requests/phút trên mỗi tài khoản Admin (cấu hình qua biến môi trường `ADMIN_ROLE_CHANGE_RATE_LIMIT`) để chống tấn công DOS hoặc lạm dụng.

* **Performance**: `authMiddleware` chạy trên mỗi protected request, do đó query lấy user bắt buộc phải được tối ưu (< 50ms) bằng cách tận dụng index hiện có trên bảng `users`.

## 5. Data Model

Sử dụng trực tiếp bảng `users` hiện tại với các trường liên quan:

* `id` CHAR(36) PRIMARY KEY
* `role` ENUM('ADMIN', 'LEARNER', 'MENTOR', 'MANAGER')
* `status` ENUM('active', 'blocked', 'pending_verification')
* `role_version` INT DEFAULT 1.

## 6. Error Handling (Unwanted Patterns)

* **WHERE** client gọi API `PUT /admin/users/:userId/role` nhưng không mang quyền `ADMIN`, **THE hệ thống SHALL** từ chối và trả về HTTP 403 Forbidden.
* **WHERE** Admin cố tình thay đổi vai trò của chính mình (`req.user.id === targetUserId`), **THE hệ thống SHALL** chặn request và trả về HTTP 403 Forbidden để ngăn chặn việc tự đánh mất quyền quản trị hệ thống.
* **WHERE** Admin giáng cấp một người dùng đang có role là `ADMIN` VÀ đó là Admin duy nhất còn lại đang hoạt động (Định nghĩa: `count(role='ADMIN' AND status='active') === 1`), **THE hệ thống SHALL** ném lỗi `LAST_ADMIN_PROTECTED` và trả về HTTP 400 Bad Request.
* **WHERE** request đi qua `authMiddleware` có `users.status !== 'active'`, **THE hệ thống SHALL** ném lỗi `ForbiddenError` chặn đứng người dùng.
* **WHERE** `roleVersion` trong JWT payload không khớp với `users.role_version` lưu trong Database, **THE hệ thống SHALL** ném lỗi `UnauthorizedError` với mã `TOKEN_REVOKED` (người dùng bị vô hiệu hóa session và phải đăng nhập lại).
* **THE hệ thống SHALL** trả về tất cả các lỗi trên theo đúng format chuẩn của CLAUDE.md: `{ success: false, message: string, code: string, details: any }`.

## 7. Acceptance Criteria (Given-When-Then)

* [ ] **GIVEN** Admin A và Mentor B, **WHEN** Admin A gọi `PUT /admin/users/{B.id}/role` để đổi B thành Learner, **THEN** API trả về 200 OK, `users.role` của B thành `LEARNER`, và `users.role_version` của B tăng thêm 1.
* [ ] **GIVEN** Admin A, **WHEN** Admin A gọi API đổi role cho chính `A.id`, **THEN** hệ thống trả về 403 Forbidden và từ chối cập nhật (Self-Action Prevention).
* [ ] **GIVEN** Mentor B bị giáng cấp (role_version đã thay đổi trong DB), **WHEN** B dùng JWT cũ để gọi các API thuộc route `/mentor/*`, **THEN** `authMiddleware` chặn lại và ném lỗi `TOKEN_REVOKED`.
* [ ] **GIVEN** hệ thống chỉ còn đúng 1 Admin đang active, **WHEN** có request giáng cấp Admin này xuống role khác, **THEN** hệ thống chặn với mã lỗi `LAST_ADMIN_PROTECTED`.

## 8. Out of Scope

* **KHÔNG** can thiệp hay xóa trực tiếp dữ liệu trong bảng `refresh_tokens`. Luồng refresh token sẽ tự động từ chối cấp mới Access Token dựa vào sự sai lệch `role_version` [12, 14].
* **KHÔNG** triển khai bảng Audit Log riêng cho Admin do Schema V2 đã khóa cứng ở 19 bảng. Chỉ sử dụng system/server log.
* **KHÔNG** xử lý tính năng Block User, Batch Block, và Admin Reset Password. Đây là phạm vi của Member E (API 62, 63).
* **KHÔNG** kiểm tra các trạng thái pending của Mentor (như submit revision) khi giáng cấp. Dữ liệu khóa học vẫn được giữ nguyên (`mentor_id` immutable), nhưng Mentor sẽ lập tức bị chặn sửa khóa học bởi middleware.
* **KHÔNG** yêu cầu xử lý chống Race Condition phức tạp bằng Locking thủ công cho thao tác đổi Role. Lệnh update `increment` của Prisma ORM mặc định đã đảm bảo tính atomic an toàn.
* **Vấn đề Known Gap**: "Block User during Payment" nằm ngoài phạm vi spec này và thuộc trách nhiệm phối hợp của Member C và Member E.
