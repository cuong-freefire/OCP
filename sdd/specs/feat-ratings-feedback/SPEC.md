# Feature: Ratings & Feedback (Đánh giá & Phản hồi khóa học)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Mức độ:** Detailed (Risk: Medium) | **Inherits:** CLAUDE.md, share_context.md, AUTH_MIDDLEWARE, EnrollmentService

---

## 1. Context & Goal

Cho phép Learner đánh giá khóa học (rating 1-5 sao) và gửi phản hồi (feedback text) sau khi đã mua và có enrollment active. Đồng thời cung cấp Internal API cho Manager/Admin xem thống kê đánh giá tổng hợp. Yêu cầu kiểm tra enrollment active (E2.4) trước khi cho phép rating/feedback.

---

## 2. Actors & Roles

- **Learner**: Người dùng có enrollment active. Tạo/sửa/xóa rating, tạo feedback.
- **Manager/Admin**: Xem rating-stats qua Internal API (Bearer SERVICE_TOKEN hoặc Manager/Admin JWT).
- **Mentor**: Xem rating-stats của khóa học mình qua Internal API (chỉ đọc, aggregate data).

---

## 3. Functional Requirements (EARS Notation)

### 3.1 Tạo đánh giá (POST /ratings)

- **WHEN** Learner gửi POST `/ratings` với `{ courseId, rating }`, **THE hệ thống SHALL**:
  1. Xác thực User qua `authMiddleware` (yêu cầu role LEARNER).
  2. Validate body: courseId (UUID), rating (INT 1-5).
  3. Kiểm tra enrollment active (E2.4):
     - Gọi `this.enrollmentService.canSubmitRating(userId, courseId)`.
     - Nếu không active → throw `ForbiddenError('NOT_ENROLLED_ACTIVE')`.
  4. Kiểm tra duplicate rating (UNIQUE course_id + user_id):
     - Nếu đã tồn tại → throw `ConflictError('ALREADY_RATED')`.
  5. Tạo rating record: { course_id, user_id, rating_value }.
  6. Trả về HTTP 201 với rating object.

### 3.2 Cập nhật đánh giá (PUT /ratings/:ratingId)

- **WHEN** Learner gửi PUT `/ratings/:ratingId` với `{ rating }`, **THE hệ thống SHALL**:
  1. Xác thực User (role LEARNER).
  2. Truy vấn rating theo ratingId.
  3. Kiểm tra ownership: `rating.user_id === req.user.userId`.
  4. Nếu không sở hữu → throw `ForbiddenError('NOT_RATING_OWNER')`.
  5. Kiểm tra enrollment vẫn active (E2.4).
  6. Cập nhật rating_value.
  7. Trả về HTTP 200 với rating đã cập nhật.

### 3.3 Xóa đánh giá (DELETE /ratings/:ratingId)

- **WHEN** Learner gửi DELETE `/ratings/:ratingId`, **THE hệ thống SHALL**:
  1. Kiểm tra ownership (giống 3.2).
  2. Xóa rating (hard delete - không soft delete vì rating không phải dữ liệu nghiệp vụ quan trọng).
  3. Trả về HTTP 200 với success message.

### 3.4 Tạo phản hồi (POST /feedbacks)

- **WHEN** Learner gửi POST `/feedbacks` với `{ courseId, feedbackText }`, **THE hệ thống SHALL**:
  1. Xác thực User (role LEARNER).
  2. Kiểm tra enrollment active (E2.4) qua `canSubmitRating()`.
  3. Tạo feedback record (không giới hạn số lần).
  4. Trả về HTTP 201 với feedback object.

### 3.5 Internal: Rating Stats API (GET /internal/courses/:courseId/rating-stats)

- **WHEN** Manager/Admin/Mentor gọi GET `/internal/courses/:courseId/rating-stats`, **THE hệ thống SHALL**:
  1. Xác thực qua SERVICE_TOKEN (Bearer) hoặc Manager/Admin JWT (httpOnly cookie).
  2. Tính toán: avgRating (AVG), totalRatings (COUNT), feedbackCount (COUNT), recentFeedbacks (5 mới nhất).
  3. Trả về HTTP 200 với aggregate data (KHÔNG learner PII).
  4. KHÔNG trả về payment/enrollment details.

---

## 4. Non-functional Requirements

- **Security (E2.4)**: Chỉ enrollment active mới được rating/feedback. Gọi `canSubmitRating()` từ EnrollmentService.
- **Security (Ownership - E2.4)**: Learner chỉ sửa/xóa rating của chính mình. Dùng `userId` từ JWT, không từ body.
- **Security (No PII)**: Internal API KHÔNG trả về learner email, name, avatar trong recentFeedbacks.
- **Performance**: Rating-stats API response < 200ms (dùng aggregate query + index trên ratings.course_id).
- **Data Integrity**: Rating value trong khoảng 1-5 (Zod validation + DB CHECK constraint).

---

## 5. Data Model (Tóm tắt từ DATABASE.md)

Bảng thuộc Member D:

- `ratings`: id, course_id, user_id, rating_value (INT 1-5)
  - UNIQUE: (course_id, user_id) - 1 rating per learner-course
  - INDEX: (course_id) for avgRating calculation
  
- `feedbacks`: id, course_id, user_id, feedback_text (TEXT NOT NULL)
  - INDEX: (course_id) for recent feedbacks query

---

## 6. Error Handling (EARS Unwanted Patterns)

- **WHERE** Learner không có enrollment active, **THE hệ thống SHALL** trả về HTTP 403 với code `NOT_ENROLLED_ACTIVE`.
- **WHERE** Learner đã rating course này rồi (POST duplicate), **THE hệ thống SHALL** trả về HTTP 409 với code `ALREADY_RATED`.
- **WHERE** Learner cố sửa/xóa rating của người khác, **THE hệ thống SHALL** trả về HTTP 403 với code `NOT_RATING_OWNER`.
- **WHERE** rating không tồn tại, **THE hệ thống SHALL** trả về HTTP 404 với code `RATING_NOT_FOUND`.
- **WHERE** rating_value < 1 hoặc > 5, **THE hệ thống SHALL** trả về HTTP 400 Bad Request.
- **WHERE** Internal API không có SERVICE_TOKEN hoặc Manager/Admin JWT, **THE hệ thống SHALL** trả về HTTP 401/403.

---

## 7. Acceptance Criteria

- [ ] POST `/ratings`: Learner active enrollment tạo rating 1-5 → HTTP 201.
- [ ] POST `/ratings`: Learner không active enrollment → HTTP 403 `NOT_ENROLLED_ACTIVE`.
- [ ] POST `/ratings`: Learner rating duplicate course → HTTP 409 `ALREADY_RATED`.
- [ ] PUT `/ratings/:ratingId`: Owner cập nhật rating → HTTP 200.
- [ ] PUT `/ratings/:ratingId`: Non-owner cố gắng → HTTP 403 `NOT_RATING_OWNER`.
- [ ] DELETE `/ratings/:ratingId`: Owner xóa rating → HTTP 200.
- [ ] POST `/feedbacks`: Learner active enrollment tạo feedback → HTTP 201.
- [ ] GET `/internal/courses/:courseId/rating-stats`:
  - Manager/Admin: Trả về aggregate data.
  - Learner: HTTP 403 Forbidden.
- [ ] RecentFeedbacks không chứa learner PII (email, name).

---

## 8. Out of Scope

- Không có rating trung bình hiển thị trên catalog (Member C sẽ làm).
- Không có report/abuse feedback.
- Không có Mentor reply to feedback.
- Không có rating distribution (5-star count, 4-star count, etc.).
- Không có sort/filter feedbacks.