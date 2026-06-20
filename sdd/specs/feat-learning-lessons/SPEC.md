# Feature: Learning Lessons (Xem bài học & Theo dõi tiến độ)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Mức độ:** Detailed (Risk: Medium) | **Inherits:** CLAUDE.md, share_context.md, AUTH_MIDDLEWARE, EnrollmentService

---

## 1. Context & Goal

Sau khi Learner đã mua khóa học (payment SUCCESS → enrollment active), họ cần API để truy cập nội dung bài học và theo dõi tiến độ học tập. Mục tiêu cốt lõi: Đảm bảo chỉ learner có enrollment active mới xem được lesson content. Sử dụng Dependency Injection (E4.4) để gọi `EnrollmentService.canAccessCourse()` từ Member C - tuyệt đối không HTTP fetch và không query trực tiếp bảng enrollments.

---

## 2. Actors & Roles

- **Learner**: Người dùng đã mua khóa học (enrollment active). Xem lesson, tải assets với signed URL, xem progress.
- **Mentor**: Chủ sở hữu khóa học. Xem lesson không cần enrollment (bypass qua ownership check trong canAccessCourse).
- **Manager/Admin**: Có quyền xem mọi khóa học để review/kiểm tra.
- **Guest**: Không có quyền truy cập. Bị authMiddleware chặn từ đầu.

---

## 3. Functional Requirements (EARS Notation)

### 3.1 Xem nội dung bài học (GET /lessons/:lessonId)

- **WHEN** User gửi GET `/lessons/:lessonId`, **THE hệ thống SHALL**:
  1. Parse `lessonId` từ path params, validate UUID format.
  2. Xác thực User qua `authMiddleware` (JWT trong httpOnly cookie).
  3. Gọi `EnrollmentService.canAccessCourse(userId, courseId, req.user.role)` để kiểm tra quyền truy cập:
     - LEARNER: Chỉ cho phép nếu `enrollment.status === 'active'`.
     - MENTOR: Cho phép nếu là chủ sở hữu khóa học.
     - MANAGER/ADMIN: Luôn cho phép (bypass).
  4. Nếu không có quyền → throw `ForbiddenError('NOT_ENROLLED')`.
  5. Truy vấn lesson từ DB (join section → course để lấy courseId).
  6. Nếu lesson không tồn tại → throw `NotFoundError('LESSON_NOT_FOUND')`.
  7. Trả về HTTP 200 với thông tin lesson: id, type, title, content, order_index, is_required_complete, section_id.

### 3.2 Lấy assets với signed URLs (GET /lessons/:lessonId/assets)

- **WHEN** User gửi GET `/lessons/:lessonId/assets`, **THE hệ thống SHALL**:
  1. Thực hiện kiểm tra quyền truy cập giống 3.1.
  2. Truy vấn lesson_assets từ DB theo lessonId.
  3. Với mỗi asset, gọi Cloudiary API để generate signed URL (expire 1 giờ).
  4. Trả về HTTP 200 với danh sách assets: [{ id, asset_type, signed_url, expires_at }].

### 3.3 Xem lịch sử nộp bài quiz (GET /quizzes/:quizId/submissions)

- **WHEN** Learner gửi GET `/quizzes/:quizId/submissions`, **THE hệ thống SHALL**:
  1. Xác thực User qua `authMiddleware` (yêu cầu role LEARNER).
  2. Kiểm tra enrollment active (giống 3.1, gọi canAccessCourse).
  3. Truy vấn tất cả submissions của `userId + quizId` từ bảng `quiz_submissions`.
  4. Trả về HTTP 200 với danh sách submissions: [{ id, score, passed, submitted_at }].
  5. KHÔNG trả về answers_json (chỉ learner xem được đáp án sau khi submit, và chỉ submission của chính mình).

### 3.4 Theo dõi tiến độ khóa học (GET /progress/:courseId)

- **WHEN** Learner gửi GET `/progress/:courseId`, **THE hệ thống SHALL**:
  1. Kiểm tra quyền truy cập khóa học (canAccessCourse).
  2. Đếm tổng số lessons trong khóa học (từ sections → lessons).
  3. Đếm số quiz submissions đã passed (từ quiz_submissions, join quizzes → lessons → section → course).
  4. Tính phần trăm hoàn thành = (số quiz passed / tổng số lessons) * 100.
  5. Trả về HTTP 200 với progress object: { courseId, totalLessons, completedLessons, progressPercent, passedQuizzes, totalQuizzes }.

---

## 4. Non-functional Requirements

- **Security (Access Control - E4.4)**: Gọi `EnrollmentService` qua Dependency Injection (constructor injection). TUYỆT ĐỐI KHÔNG dùng HTTP fetch() cho internal backend-to-backend calls.
- **Security (Role-based Bypass)**: `canAccessCourse` phải support dynamic role parameter (role từ req.user.role). MANAGER/ADMIN bypass check; MENTOR access own courses.
- **Performance**: Cloudinary signed URL generation < 200ms. API response < 500ms P95.
- **Security**: KHÔNG trả về Cloudinary public_id hoặc raw URL cho client. Chỉ trả về signed URL đã expire.
- **Data Privacy**: Learner chỉ xem được submission của chính mình. Ngăn IDOR bằng cách luôn lấy userId từ JWT.

---

## 5. Data Model (Tóm tắt từ DATABASE.md)

Sử dụng các bảng thuộc Member B (Mentor Course Studio) - READ ONLY qua repository:

- `lessons`: id, section_id, type ('video'|'document'), title, content, order_index, is_required_complete
- `lesson_assets`: id, lesson_id, cloudinary_public_id, asset_type ('video'|'document')
- `course_sections`: id, course_id, title, order_index
- `courses`: id, title, mentor_id

Và bảng thuộc Member D:

- `quiz_submissions`: id, user_id, quiz_id, answers_json, score, passed, submitted_at

---

## 6. Error Handling (EARS Unwanted Patterns)

- **WHERE** lesson không tồn tại hoặc đã bị soft-delete, **THE hệ thống SHALL** trả về HTTP 404 Not Found với code `LESSON_NOT_FOUND`.
- **WHERE** User không có enrollment active, **THE hệ thống SHALL** trả về HTTP 403 Forbidden với code `NOT_ENROLLED`.
- **WHERE** Learner cố tình truyền `lessonId` không phải UUID, **THE hệ thống SHALL** trả về HTTP 400 Bad Request.
- **WHERE** EnrollmentService throw error (DB timeout, service unavailable), **THE hệ thống SHALL** trả về HTTP 503 Service Unavailable với code `ACCESS_CHECK_FAILED`.
- **WHERE** Cloudinary signed URL generation thất bại, **THE hệ thống SHALL** trả về asset data với signed_url = null và log error (không fail toàn bộ request).
- **WHERE** courseId không tồn tại hoặc learner chưa enroll, **THE hệ thống SHALL** trả về HTTP 404 với code `COURSE_NOT_FOUND`.

---

## 7. Acceptance Criteria

- [ ] GET `/lessons/:lessonId`: Learner có enrollment active nhận được lesson content + metadata.
- [ ] GET `/lessons/:lessonId`: Learner không có enrollment active nhận HTTP 403 `NOT_ENROLLED`.
- [ ] GET `/lessons/:lessonId/assets`: Trả về danh sách assets với Cloudinary signed URLs.
- [ ] GET `/progress/:courseId`: Trả về progress object với tổng lessons, số lessons đã pass, phần trăm.
- [ ] Security: MANAGER/ADMIN bypass enrollment check và xem được lesson.
- [ ] Security: MENTOR xem được lesson của khóa học mình sở hữu.
- [ ] DI Pattern: EnrollmentService được inject qua constructor, không dùng HTTP fetch.
- [ ] GET `/quizzes/:quizId/submissions`: Learner chỉ xem được submission của chính mình.

---

## 8. Out of Scope

- Không track progress real-time (không có bảng progress riêng - chỉ tính từ quiz_submissions).
- Không có certificate/ completion certificate.
- Không có video streaming - Cloudinary tự xử lý.
- Không có lesson completion tracking manual (không có "Mark as Complete" button - chỉ quiz pass mới tính complete).
- Không có discussion/comments dưới bài học.
- Không có note-taking feature.
- Không có download lesson content (chỉ xem online qua Cloudinary signed URL).