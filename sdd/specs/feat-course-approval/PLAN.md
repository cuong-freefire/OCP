# Implementation Plan: Course Approval & Operations (feat-course-approval)

**Version:** 1.0.0 | **Owner:** Member E | **Status:** DRAFT  
**Generated:** 2026-06-21 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy
- **Strict Layering:** Endpoint requests flow through: Route -> Validation Middleware -> Authorization Middleware -> Controller -> Service -> Repository.
- **Self-Approval Mitigation:** Trước khi xử lý Approve, Service của Member E sẽ gọi helper/contract `canEditCourse(userId, courseId)` của Member B. Nếu trả về `true` (nghĩa là Manager chính là Mentor), chặn thao tác ngay lập tức.
- **Serializable Snapshot Restoration:** Khi Approve, hệ thống đọc `snapshot_data` từ revision. Toàn bộ quá trình xóa các cấu trúc sections/lessons/quizzes cũ của khóa học và chèn mới cấu trúc từ snapshot được đóng gói trong một transaction `Serializable` với timeout 30s để tránh race conditions.

---

## 2. COMPONENTS

### Backend Components

#### A. Validators (`backend/src/validators/manager.validator.js`)
- `rejectRevisionSchema`: Validate body chứa `comment` string với độ dài `min(10)`.
- `updateUserSchema`: Validate body cho cập nhật thông tin user (ví dụ: `name`, `status`).

#### B. Repository (`backend/src/repositories/manager.repository.js`)
- `createReview(data)`: Ghi nhận lịch sử duyệt vào `course_reviews`.
- `createReviewComment(data)`: Ghi nhận lý do reject vào `review_comments`.
- `updateCourseStatus(courseId, status)`: Cập nhật status khóa học trong `courses`.
- `updateRevisionStatus(revisionId, status)`: Cập nhật status revision trong `course_revisions`.
- `supersedeOldRevisions(courseId, currentRevisionId)`: Đổi trạng thái các revision cũ của khóa học sang `superseded`.
- `findUsers(filters)`: Lấy danh sách users kèm phân trang và tìm kiếm (đọc bảng `users`).
- `findUserById(userId)`: Lấy chi tiết user từ database.
- `updateUser(userId, data)`: Cập nhật thông tin user hoặc đổi trạng thái `status = 'blocked'`.

#### C. Service (`backend/src/services/manager.service.js`)
- `getPendingReviews()`: Truy vấn danh sách revision có trạng thái `pending_review`.
- `getReviewDetail(revisionId)`: Trả về chi tiết revision kèm snapshot curriculum.
- `publishRevision(revisionId, managerId)`: Thực hiện kiểm tra self-approval, chạy transaction Serializable để restore curriculum, cập nhật trạng thái khóa học sang `published`.
- `rejectRevision(revisionId, managerId, comment)`: Ghi nhận reject và tạo comment nhận xét.
- `disableCourse(courseId)`: Cập nhật trạng thái khóa học sang `archived`.
- `unpublishCourse(courseId)`: Cập nhật trạng thái khóa học sang `draft`.
- `listUsers(filters)`: Lấy danh sách users phục vụ giao diện quản lý của Admin.
- `getUserDetail(userId)`: Lấy thông tin chi tiết user (ẩn password_hash).
- `updateUserDetail(userId, data)`: Cập nhật thông tin user.
- `blockUser(userId)`: Đặt `status = 'blocked'` và tăng `role_version` (hoặc thu hồi refresh tokens) để logout user lập tức.

#### D. Controller & Routes (`backend/src/controllers/manager.controller.js`, `backend/src/api/manager.routes.js`, `backend/src/api/admin.routes.js`)
- Cấu hình routes bảo vệ quyền `MANAGER` (cho các route `/manager/*`) và `ADMIN` (cho các route `/admin/*`).
- Tích hợp `authMiddleware` chuẩn từ Member A để kiểm tra JWT và `role_version` (E2.2).

### Frontend Components

- **CourseApprovalQueue.jsx:** Màn hình danh sách các revision đang chờ duyệt.
- **CourseReviewDetail.jsx:** Màn hình chi tiết curriculum read-only.
- **RejectCommentModal.jsx:** Modal nhập nhận xét khi bấm Reject.
- **AdminUserManagement.jsx:** Màn hình của Admin để xem danh sách user, xem chi tiết và nút bấm Block user.

---

## 3. DATA FLOW

### Luồng Phục Hồi Curriculum Khi Approve (Publish)

```
Manager
  │
  ├─► POST /manager/reviews/:revisionId/publish
  │
  ▼
manager.service.publishRevision
  │
  ├─► Gọi canEditCourse(managerId, courseId) của Member B
  │     Nếu true ──► Throw SELF_APPROVAL_FORBIDDEN (403)
  │
  ├─► Bắt đầu Transaction (Serializable, 30s timeout)
  │     ├─► Đọc snapshot_data (JSON) của revision
  │     ├─► Xóa sạch sections/lessons/quizzes cũ của khóa học
  │     ├─► Thêm mới sections/lessons/quizzes từ snapshot_data
  │     ├─► Cập nhật status khóa học = 'published'
  │     ├─► Cập nhật status revision = 'published'
  │     └─► Đổi các revision khác của khóa học sang status = 'superseded'
  │
  ▼
Trả về HTTP 200 OK
```

---

## 4. DEPENDENCIES

- **Member B (Mentor Course Studio):** Cung cấp API/contract `canEditCourse(userId, courseId)` và hỗ trợ phục hồi dữ liệu curriculum.
- **Member A (Auth & Users):** Middleware xác thực `role_version` và cung cấp database structure của bảng `users`, `refresh_tokens`.

---

## 5. RISKS & MITIGATIONS

### Risk: Lỗi đứt gãy curriculum do Transaction thất bại (HIGH)
- **Scenario:** Do cấu trúc bài học lớn hoặc nghẽn database, transaction restore bị timeout hoặc lỗi nửa chừng khiến khóa học bị trống nội dung.
- **Mitigation:**
  - Sử dụng transaction `Serializable` để đảm bảo khôi phục trọn vẹn (all-or-nothing).
  - Nếu thất bại, rollback toàn bộ, cập nhật `course_revisions.status = 'failed_publish'` để hệ thống báo lỗi rõ ràng và giữ nguyên trạng thái cũ.

---

## 6. QUESTIONS FOR HUMAN

1. Khi phục hồi curriculum từ snapshot, các lesson assets (video, document) có cần được gia hạn link Cloudinary mới hay giữ nguyên link cũ trong snapshot?
   - *Đề xuất:* Giữ nguyên Cloudinary public_id, link truy cập sẽ được ký động (signed URL) khi Learner hoặc Manager xem bài học.
2. Quản lý Category nên xử lý thế nào để giữ đúng quy tắc 19 bảng DB?
   - *Đề xuất:* Bỏ tính năng CRUD categories động trong Database. Thay vào đó, định nghĩa danh mục cứng (static array) ở cả frontend và backend. Mọi cập nhật danh mục sẽ được xử lý qua thay đổi code (git) thay vì chạy API.
