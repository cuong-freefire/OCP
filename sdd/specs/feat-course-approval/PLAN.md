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

#### B. Repository (`backend/src/repositories/manager.repository.js`)
- `createReview(data)`: Ghi nhận lịch sử duyệt vào `course_reviews`.
- `createReviewComment(data)`: Ghi nhận lý do reject vào `review_comments`.
- `updateCourseStatus(courseId, status)`: Cập nhật status khóa học trong `courses`.
- `updateRevisionStatus(revisionId, status)`: Cập nhật status revision trong `course_revisions`.
- `supersedeOldRevisions(courseId, currentRevisionId)`: Đổi trạng thái các revision cũ của khóa học sang `superseded`.

#### C. Service (`backend/src/services/manager.service.js`)
- `getPendingReviews()`: Truy vấn danh sách revision có trạng thái `pending_review`.
- `getReviewDetail(revisionId)`: Trả về chi tiết revision kèm snapshot curriculum.
- `publishRevision(revisionId, managerId)`: Thực hiện kiểm tra self-approval, chạy transaction Serializable để restore curriculum, cập nhật trạng thái khóa học sang `published`.
- `rejectRevision(revisionId, managerId, comment)`: Ghi nhận reject và tạo comment nhận xét.
- `disableCourse(courseId)`: Cập nhật trạng thái khóa học sang `archived`.
- `unpublishCourse(courseId)`: Cập nhật trạng thái khóa học sang `draft`.

#### D. Controller & Routes (`backend/src/controllers/manager.controller.js`, `backend/src/api/manager.routes.js`)
- Cấu hình routes và gọi middleware `authMiddleware` để kiểm tra phân quyền Manager.

### Frontend Components

- **CourseApprovalQueue.jsx:** Màn hình danh sách các revision đang chờ duyệt.
- **CourseReviewDetail.jsx:** Màn hình chi tiết curriculum read-only.
- **RejectCommentModal.jsx:** Modal nhập nhận xét khi bấm Reject.

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
- **Member A (Auth & Users):** Middleware xác thực `role_version` và `role === 'MANAGER'`.

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
