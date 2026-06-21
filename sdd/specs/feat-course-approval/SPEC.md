# Feature Specification: Course Approval & Operations (Member E)

**Feature Branch**: `feat/course-approval`

**Created**: 2026-06-21

**Status**: Draft

---

## 1. Context & Goal

Xây dựng quy trình phê duyệt khóa học (Course Approval Queue) giúp Manager kiểm duyệt các phiên bản khóa học (`course_revisions`) do Mentor nộp. Quy trình này bảo vệ tính toàn vẹn của curriculum thông qua snapshot (E1.1) và ngăn chặn việc tự phê duyệt (E2.3). Đồng thời, cung cấp tính năng quản lý vận hành để Disable/Unpublish khóa học và quản lý Category nếu được phân quyền.

---

## 2. Actors & Roles

- **Manager**:
  - Xem hàng đợi kiểm duyệt (Approval Queue).
  - Review chi tiết curriculum (sections, lessons, quizzes, questions) ở dạng read-only từ snapshot.
  - Approve (Publish) khóa học để mở bán ngay lập tức.
  - Reject khóa học kèm nhận xét để Mentor sửa đổi.
  - Disable (Archive) hoặc Unpublish khóa học vi phạm chính sách.
  - Quản lý danh sách Category (Danh mục khóa học).

---

## 3. Functional Requirements (EARS Notation)

### Quy trình duyệt khóa học (Course Approval Queue)

- **WHEN** Manager truy cập hàng đợi bằng GET `/manager/reviews/pending`, **THE hệ thống SHALL** trả về danh sách các `course_revisions` có trạng thái `pending_review`, sắp xếp theo thời gian nộp mới nhất trước.
- **WHEN** Manager chọn một revision bằng GET `/manager/reviews/:revisionId`, **THE hệ thống SHALL** trả về chi tiết thông tin khóa học và toàn bộ curriculum (sections, lessons, quizzes, questions) đọc từ JSON `snapshot_data` dưới dạng read-only.
- **WHEN** Manager bấm duyệt bằng POST `/manager/reviews/:revisionId/publish`, **THE hệ thống SHALL**:
  1. Kiểm tra Manager hiện tại không phải là Mentor của khóa học đó (ngăn chặn E2.3 Self-Approval).
  2. Bắt đầu một database transaction cô lập ở mức `Serializable` với timeout tối đa là 30 giây (E1.1).
  3. Khôi phục (restore) toàn bộ dữ liệu curriculum từ JSON `snapshot_data` vào các bảng `course_sections`, `lessons`, `quizzes`, và `quiz_questions`.
  4. Cập nhật `courses.status = 'published'` và `course_revisions.status = 'published'`.
  5. Đổi trạng thái toàn bộ các revision cũ hơn của khóa học này thành `superseded`.
- **WHEN** Manager bấm từ chối bằng POST `/manager/reviews/:revisionId/reject`, **THE hệ thống SHALL**:
  1. Yêu cầu nhập lý do từ chối (trường `comment` bắt buộc và tối thiểu 10 ký tự).
  2. Cập nhật `course_revisions.status = 'rejected'` và `courses.status = 'rejected'`.
  3. Lưu nhận xét vào bảng `review_comments` và tạo bản ghi kết quả trong `course_reviews`.

### Vận hành & Quản lý trạng thái khóa học (Operations)

- **WHEN** Manager muốn vô hiệu hóa khóa học bằng POST `/manager/courses/:courseId/disable`, **THE hệ thống SHALL** cập nhật trạng thái khóa học thành `archived` (học viên đã mua vẫn học được, không bán mới - E1.3).
- **WHEN** Manager muốn thu hồi xuất bản bằng POST `/manager/courses/:courseId/unpublish`, **THE hệ thống SHALL** cập nhật trạng thái khóa học thành `draft` (trả về trạng thái nháp cho Mentor cập nhật).
*(Ghi chú: Hai API vận hành này bổ sung cho luồng kiểm duyệt thực tế của Manager, cập nhật trực tiếp trường status của bảng courses).*

### Quản lý Người dùng dành cho Admin (Admin User Management)

- **WHEN** Admin yêu cầu danh sách user bằng GET `/admin/users`, **THE hệ thống SHALL** trả về danh sách toàn bộ users (hỗ trợ filters: `role`, `status`, `search` theo tên/email, có phân trang).
- **WHEN** Admin yêu cầu chi tiết user bằng GET `/admin/users/:userId`, **THE hệ thống SHALL** trả về thông tin chi tiết của user đó (không bao gồm password_hash).
- **WHEN** Admin cập nhật thông tin user bằng PUT `/admin/users/:userId`, **THE hệ thống SHALL** cập nhật thông tin được phép (name, status) trong bảng `users`.
- **WHEN** Admin muốn khóa tài khoản bằng DELETE `/admin/users/:userId`, **THE hệ thống SHALL** cập nhật `users.status = 'blocked'` và revoke toàn bộ refresh tokens của user đó (E2.2).

---

## 4. Non-functional Requirements

- **Access Control**: Chặn tất cả request không có role `MANAGER` hoặc `ADMIN` tương ứng, hoặc có token bị mismatch `role_version` (E2.2).
- **Transaction Safety**: Các hoạt động restore curriculum từ JSON snapshot phải chạy trong transaction cô lập cao nhất `Serializable` để tránh xung đột dữ liệu ghi chèn (E1.1).
- **Comment Validation**: Trường comment reject bắt buộc phải validate bằng Zod schema, từ chối chuỗi trống hoặc ngắn hơn 10 ký tự.
- **Database Limits**: Tuân thủ nghiêm ngặt 19 bảng database cố định. Không thiết kế thêm bảng `categories`.

---

## 5. Data Model

Sử dụng các bảng sau (thuộc sở hữu của Member E):

### Bảng: `course_reviews`
- `id`: CHAR(36) - PK (UUID)
- `revision_id`: CHAR(36) - FK -> `course_revisions.id`
- `manager_id`: CHAR(36) - FK -> `users.id`
- `status`: ENUM('pending', 'published', 'rejected')
- `created_at`: DATETIME(3)

### Bảng: `review_comments`
- `id`: CHAR(36) - PK (UUID)
- `review_id`: CHAR(36) - FK -> `course_reviews.id`
- `comment`: TEXT
- `created_at`: DATETIME(3)

*(Đọc và ghi trạng thái bảng `users` và `courses` của Member A và Member B).*

---

## 6. Error Handling

- **WHERE** Manager cố gắng phê duyệt khóa học do chính mình tạo ra dưới vai trò Mentor, **THE hệ thống SHALL** từ chối thực hiện, trả về HTTP 403 Forbidden kèm mã lỗi `SELF_APPROVAL_FORBIDDEN`.
- **WHERE** Quá trình restore curriculum từ snapshot JSON bị timeout quá 30 giây, **THE hệ thống SHALL** rollback toàn bộ transaction, cập nhật `course_revisions.status = 'failed_publish'` và trả về HTTP 500 kèm thông báo rõ ràng cho Manager thử duyệt lại.
- **WHERE** Một Manager/Admin có token hết hạn hoặc quyền thay đổi gọi API, **THE hệ thống SHALL** trả về HTTP 401 Unauthorized do mismatch `role_version` (E2.2).
- **WHERE** Admin cố tình tự khóa (block) chính mình qua API DELETE `/admin/users/:userId`, **THE hệ thống SHALL** từ chối và trả về HTTP 403 Forbidden.

---

## 7. Acceptance Criteria (Given-When-Then)

### Phê duyệt khóa học thành công (Approve Course)
- **Given** Một revision có ID `rev-123` của khóa học `course-abc` do Mentor `mentor-x` sở hữu đang ở trạng thái `pending_review`.
- **When** Manager `manager-y` (không phải `mentor-x`) gọi POST `/manager/reviews/rev-123/publish`.
- **Then** Hệ thống khôi phục curriculum thành công từ snapshot, chuyển status khóa học sang `published`, chuyển status revision cũ sang `superseded` và trả về HTTP 200.

### Ngăn chặn Tự Phê duyệt (Self-Approval Check)
- **Given** Khóa học `course-abc` được tạo bởi `manager-y` (dưới vai trò Mentor) và có revision `rev-123` đang chờ duyệt.
- **When** Manager `manager-y` gọi POST `/manager/reviews/rev-123/publish`.
- **Then** Hệ thống từ chối và trả về HTTP 403 Forbidden kèm mã lỗi `SELF_APPROVAL_FORBIDDEN`.

### Từ chối kiểm duyệt (Reject Revision)
- **Given** Revision `rev-123` đang chờ duyệt.
- **When** Manager gọi POST `/manager/reviews/rev-123/reject` với comment `"Nội dung bài viết quá ngắn."` (28 ký tự).
- **Then** Hệ thống cập nhật status revision thành `rejected`, tạo review comment và trả về HTTP 200.

### Khóa người dùng thành công (Admin Block User)
- **Given** Admin `admin-a` đã đăng nhập và user `learner-b` ở trạng thái `active`.
- **When** Admin gọi DELETE `/admin/users/learner-b`.
- **Then** `users.status` của `learner-b` chuyển sang `blocked`, các refresh token bị hủy, và trả về HTTP 200.

---

## 8. Out of Scope

- Manager không thể trực tiếp thay đổi nội dung curriculum, bài viết, quiz trong giao diện review (chỉ có quyền đọc read-only).
- Không xử lý phê duyệt hàng loạt (bulk approve) trong Sprint này.
- **Category Management động**: Không thiết kế các API CRUD Category (`/manager/categories`) trong database. Danh mục khóa học được quản lý dưới dạng danh sách tĩnh (static config) trong mã nguồn để tuân thủ giới hạn 19 bảng.
- **Thay đổi vai trò user**: Quyền thay đổi vai trò (role) của user thuộc về Member A thông qua API `PUT /admin/users/:userId/role`. Mamber E chỉ cập nhật thông tin chung và khóa tài khoản.
