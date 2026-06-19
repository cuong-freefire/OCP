# DATABASE SCHEMA - Online Course Platform (OCP)

**Ngày cập nhật:** 18/06/2026  
**Phiên bản:** V2 Final (Strict 19 tables + E3.x Fixes)  
**Scope:** STRICTLY 19 tables per V5 Task Assignment  
**Database:** MySQL 8.0+  
**ORM:** Prisma  
**Status:** ✅ Fully aligned with V5 + V2 Error Fixes + E3.x Fixes Applied

---

## 🎯 Critical Fixes Applied (from V2)

### E2.2: Role Version for JWT Invalidation

- **Issue:** Admin demotes Mentor → existing JWT still valid for 15 mins
- **Fix:** Add `role_version INT DEFAULT 1` to users table
- **Behavior:** JWT includes roleVersion, middleware validates match
- **Action:** On role change, increment to revoke all sessions

### E3.2: Remove UNIQUE on order_index (CASCADE Fix)

- **Issue:** Reorder sections/lessons triggers CASCADE delete of all lessons/quizzes/assets
- **Fix:** Remove UNIQUE constraint, keep INDEX for performance
- **Tables:** course_sections, lessons
- **Approach:** Update in transaction loop, not delete+create

### E3.3: Price as BIGINT (No Floating-Point Errors)

- **Issue:** DECIMAL(15,2) causes floating-point rounding on VND amounts
- **Fix:** Store as BIGINT integer (đồng, not VND with decimals)
- **Conversion:** 250,000 VND stored as `250000` in database
- **Validation:** Exact integer match on backend
- **Tables:** courses.price, orders.total_price, payments.amount

### E3.4-E3.6: New Indexes for Performance

- `idx_revisions_status_date(status, created_at DESC)` - Manager approval queue
- `idx_enrollments_user_status(user_id, status)` - "My courses" query
- `idx_refresh_tokens_user_revoke(user_id, revoked_at)` - Revoke on block

---

## 📊 Strict 19 Tables (SCOPED)

**Member A (Auth):** 4 tables

- users (with role_version)
- refresh_tokens
- email_verifications
- password_reset_tokens

**Member B (Mentor):** 7 tables

- courses
- course_revisions
- course_sections (NO UNIQUE order_index)
- lessons (NO UNIQUE order_index)
- lesson_assets
- quizzes
- quiz_questions

**Member C (Payment):** 3 tables

- orders (total_price BIGINT)
- payments (amount BIGINT)
- enrollments

**Member D (Learning):** 3 tables

- quiz_submissions
- ratings
- feedbacks

**Member E (Manager):** 2 tables

- course_reviews
- review_comments

**Total: 19 tables STRICTLY**

---

## Tổng Quan Hệ Thống

**19 Tables, 5 Members:**

- **Member A (Auth):** 4 tables
- **Member B (Mentor):** 7 tables
- **Member C (Payment):** 3 tables
- **Member D (Learning):** 3 tables
- **Member E (Manager):** 2 tables

---

## MEMBER A - AUTH & ACCOUNT (4 Tables)

### 1. Table: `users`

**Mô tả:** Lưu thông tin người dùng (Admin, Learner, Mentor, Manager)

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID người dùng |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email đăng nhập |
| `password_hash` | VARCHAR(255) | NULL | Bcrypt hash; NULL nếu Google-only |
| `name` | VARCHAR(255) | NULL | Tên hiển thị người dùng |
| `avatar_url` | VARCHAR(500) | NULL | URL ảnh đại diện (Cloudinary) |
| `role` | ENUM('ADMIN','LEARNER','MENTOR','MANAGER') | NOT NULL | Vai trò người dùng |
| `role_version` | INT | DEFAULT 1 | Phiên bản role (E2.2 - invalidate JWT khi đổi role) |
| `status` | ENUM('active','blocked','pending_verification') | NOT NULL | Trạng thái tài khoản |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- UNIQUE INDEX: `email`
- INDEX: `(role, status)` for role-based queries

**Business Rules:**

- Email dùng cho local email/password login
- Password_hash NULL cho Google-only users
- Admin block user → status = 'blocked'
- Admin change role → increment role_version (revoke all JWT tokens)
- Middleware check users.status và role_version match on mọi protected route

---

### 2. Table: `refresh_tokens`

**Mô tả:** Lưu refresh token cho JWT rotation

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID token |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Người dùng sở hữu token |
| `token_hash` | VARCHAR(255) | UNIQUE, NOT NULL | Hash của refresh token (không lưu raw) |
| `expires_at` | DATETIME(3) | NOT NULL | Thời gian hết hạn |
| `revoked_at` | DATETIME(3) | NULL | Thời gian revoke (block user sẽ revoke tất cả) |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |

**Business Rules:**

- Refresh token expire 7-30 ngày
- Block user → revoke tất cả refresh_tokens
- Access token expire 5 phút (FIXED per E2.2 - không dùng 15-60)
- Refresh token rotation on use

---

### 3. Table: `email_verifications`

**Mô tả:** OTP xác thực email khi đăng ký

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID OTP |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Người dùng cần xác thực |
| `otp_hash` | VARCHAR(255) | NOT NULL | Hash OTP 6 số (không lưu raw) |
| `expires_at` | DATETIME(3) | NOT NULL | Thời gian hết hạn (10 phút) |
| `used_at` | DATETIME(3) | NULL | Thời gian dùng OTP |
| `failed_attempts` | INT | DEFAULT 0 | Số lần nhập sai |
| `locked_at` | DATETIME(3) | NULL | Khóa sau 5 lần sai |
| `last_sent_at` | DATETIME(3) | NOT NULL | Lần gửi OTP cuối (resend cooldown 60s) |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |

**Business Rules:**

- OTP 6 số, hết hạn 10 phút
- Tối đa 5 lần nhập sai
- Resend cooldown 60 giây
- Verify success → users.email_verified = true, users.status = 'active'

---

### 4. Table: `password_reset_tokens`

**Mô tả:** OTP reset password khi người dùng quên mật khẩu

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID token reset |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Người dùng reset password |
| `otp_hash` | VARCHAR(255) | NOT NULL | Hash OTP 6 số (không lưu raw) |
| `expires_at` | DATETIME(3) | NOT NULL | Thời gian hết hạn (10 phút) |
| `used_at` | DATETIME(3) | NULL | Thời gian dùng OTP reset |
| `failed_attempts` | INT | DEFAULT 0 | Số lần nhập sai |
| `locked_at` | DATETIME(3) | NULL | Khóa sau 5 lần sai |
| `last_sent_at` | DATETIME(3) | NOT NULL | Lần gửi OTP reset cuối |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |

**Business Rules:**

- Chỉ tạo cho local account có password_hash NOT NULL
- Chỉ tạo khi email tồn tại (public response dùng thông báo chung)
- Google-only user (password_hash NULL) KHÔNG được tạo password reset
- OTP 6 số, hết hạn 10 phút, tối đa 5 lần sai, resend cooldown 60s

---

## MEMBER B - MENTOR COURSE STUDIO (7 Tables)

### 5. Table: `courses`

**Mô tả:** Khóa học (do Mentor tạo, Manager duyệt)

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID khóa học |
| `mentor_id` | CHAR(36) | FK → users.id, NOT NULL | Mentor tạo khóa học |
| `title` | VARCHAR(255) | NOT NULL | Tên khóa học |
| `description` | LONGTEXT | NULL | Mô tả khóa học |
| `thumbnail` | VARCHAR(500) | NULL | Cloudinary thumbnail URL |
| `price` | BIGINT | NOT NULL DEFAULT 0 | Giá khóa học (đồng, không decimals - E3.3 fix) |
| `category` | VARCHAR(100) | NULL | Danh mục |
| `level` | ENUM('beginner','intermediate','advanced') | NULL | Mức độ |
| `status` | ENUM('draft','pending_review','rejected','published','archived') | DEFAULT 'draft' | Trạng thái |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `mentor_id` → users.id
- INDEX: `(mentor_id, status)` for Mentor dashboard

**Business Rules:**

- 100% khóa học trả phí (price > 0)
- Mentor chỉ CRUD course của mình
- Published course chỉ xuất hiện catalog
- Archived course không bán, learner đã enroll vẫn học

---

### 6. Table: `course_revisions`

**Mô tả:** Lịch sử revision để Manager review trước khi publish. Snapshot course data tại thời điểm submit.

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID revision |
| `course_id` | CHAR(36) | FK → courses.id, NOT NULL | Khóa học |
| `revision_num` | INT | NOT NULL | Số revision (1, 2, 3...) |
| `status` | ENUM('pending_review','rejected','published') | NOT NULL | Trạng thái review |
| `reject_comment` | TEXT | NULL | Nhận xét từ Manager nếu reject |
| `snapshot_data` | JSON | NOT NULL | Snapshot course data (FULL CURRICULUM): {title, description, thumbnail, price, category, level, sections: [...], quizzes: [...]} |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian submit review |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `course_id` → courses.id
- UNIQUE: `(course_id, revision_num)`

**Business Rules:**

- Mentor submit course → tạo revision PENDING_REVIEW + snapshot course data
- snapshot_data JSON format (FULL CURRICULUM - Per E1.1):

  ```javascript
  {
    // Metadata
    title, description, thumbnail, price, category, level,
    // Full curriculum
    sections: [{ id, title, order_index, lessons: [...] }],
    lessons: [{ id, section_id, type, title, content, order_index, is_required_complete, assets: [...] }],
    quizzes: [{ id, lesson_id, title, pass_score, questions: [...] }],
    quiz_questions: [{ id, quiz_id, question, options_json, correct_answer, order_index }]
  }
  ```

- Manager review dùng snapshot_data, KHÔNG query live course table
- Manager publish → restore FULL curriculum từ snapshot, khôi phục sections/lessons/quizzes/assets trong cùng 1 transaction
- Manager reject → revision.status = REJECTED, reject_comment bắt buộc
- Mentor resubmit → tạo revision mới với revision_num tăng, snapshot_data cập nhật với full curriculum mới
- **⚠️ CRITICAL (E1.1)**: Manager LUÔN review revision snapshot, không bị ảnh hưởng bởi Mentor sửa course sau khi submit

---

### 7. Table: `course_sections`

**Mô tả:** Section của khóa học (chứa lessons)

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID section |
| `course_id` | CHAR(36) | FK → courses.id, NOT NULL | Khóa học |
| `title` | VARCHAR(255) | NOT NULL | Tên section |
| `order_index` | INT | NOT NULL | Vị trí section (1, 2, 3...) |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `course_id` → courses.id
- INDEX: `(course_id, order_index)` (E3.2 - NO UNIQUE to prevent CASCADE delete on reorder)

**Business Rules:**

- Mentor CRUD section của course mình
- Soft delete (không hard delete)
- Check ownership qua canEditCourse()
- **⚠️ CRITICAL (E3.2)**: Reorder dùng UPDATE loop in transaction, KHÔNG DELETE then CREATE

---

### 8. Table: `lessons`

**Mô tả:** Bài học (video, tài liệu)

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID bài học |
| `section_id` | CHAR(36) | FK → course_sections.id, NOT NULL | Section chứa lesson |
| `type` | ENUM('video','document') | NOT NULL | Loại nội dung |
| `title` | VARCHAR(255) | NOT NULL | Tên bài học |
| `content` | LONGTEXT | NULL | Nội dung (markdown/HTML) |
| `order_index` | INT | NOT NULL | Vị trí lesson (1, 2, 3...) |
| `is_required_complete` | BOOLEAN | DEFAULT true | Bắt buộc hoàn thành |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `section_id` → course_sections.id (ON DELETE CASCADE)
- INDEX: `(section_id, order_index)` (E3.2 - NO UNIQUE to prevent CASCADE delete on reorder)

**Business Rules:**

- Learner xem lesson tự do, không track tiến độ (out of scope)
- Mentor upload assets (video, tài liệu) qua lesson_assets

---

### 9. Table: `lesson_assets`

**Mô tả:** Assets (video, document) từ Cloudinary

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID asset |
| `lesson_id` | CHAR(36) | FK → lessons.id, NOT NULL | Bài học |
| `cloudinary_public_id` | VARCHAR(500) | NOT NULL | Cloudinary public_id |
| `asset_type` | ENUM('video','document') | NOT NULL | Loại asset |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian upload |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `lesson_id` → lessons.id

**Business Rules:**

- Frontend upload trực tiếp Cloudinary
- Backend cấp signature với type="authenticated"
- Learner/Manager access qua signed URL (expire 1 giờ)
- KHÔNG lưu public URL

---

### 10. Table: `quizzes`

**Mô tả:** Quiz của bài học

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID quiz |
| `lesson_id` | CHAR(36) | FK → lessons.id, NOT NULL | Bài học |
| `title` | VARCHAR(255) | NOT NULL | Tên quiz |
| `pass_score` | DECIMAL(5,2) | DEFAULT 0 | Điểm tối thiểu pass |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `lesson_id` → lessons.id

**Business Rules:**

- Mentor CRUD quiz của course mình
- Learner auto-grade (chỉ câu có đáp án rõ)

---

### 11. Table: `quiz_questions`

**Mô tả:** Câu hỏi của quiz

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID câu hỏi |
| `quiz_id` | CHAR(36) | FK → quizzes.id, NOT NULL | Quiz |
| `question` | TEXT | NOT NULL | Nội dung câu hỏi |
| `options_json` | JSON | NOT NULL | Options dạng JSON |
| `correct_answer` | JSON | NOT NULL | Đáp án đúng (NOT NULL để auto-grade) |
| `order_index` | INT | NOT NULL | Thứ tự câu hỏi |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `quiz_id` → quizzes.id

**Business Rules:**

- correct_answer là JSON array (multi-select)
- Mentor CRUD (không expose correct_answer cho learner trước submit)
- Backend validate answers_json schema

---

## MEMBER C - CATALOG & PAYMENT & ENROLLMENT (3 Tables)

### 12. Table: `orders`

**Mô tả:** Đơn mua khóa học

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID order |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Learner mua |
| `course_id` | CHAR(36) | FK → courses.id, NOT NULL | Khóa học mua |
| `total_price` | BIGINT | NOT NULL | Giá snapshot lúc tạo (đồng, không decimals - E3.3 fix) |
| `status` | ENUM('pending','paid','failed','cancelled') | NOT NULL | Trạng thái order |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → users.id
- FOREIGN KEY: `course_id` → courses.id
- **NO UNIQUE CONSTRAINT** (Per E3.4 fix - allow learner retry after failed payment)

**Business Rules:**

- 1 order = 1 course (MVP không có cart)
- Backend snapshot course.price tại thời điểm tạo
- PENDING → PAID sau payment SUCCESS
- Learner có thể tạo multiple orders (ví dụ: retry sau lỗi thanh toán)
- Check duplicate enrollment qua `enrollments` table (UNIQUE user_id_course_id), KHÔNG qua orders constraint
- Only first successful payment (payment.status = SUCCESS) tạo enrollment

---

### 13. Table: `payments`

**Mô tả:** Thanh toán qua VNPAY

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID payment |
| `order_id` | CHAR(36) | FK → orders.id, NOT NULL | Order liên kết |
| `vnpay_transaction_id` | VARCHAR(100) | UNIQUE, NULL | VNPAY transaction ID |
| `status` | ENUM('PENDING','EXPIRED','SUCCESS','FAILED','CANCELLED') | NOT NULL | Trạng thái payment |
| `amount` | BIGINT | NOT NULL | Số tiền (đồng, không decimals - E3.3 fix) |
| `paid_at` | DATETIME(3) | NULL | Thời gian thanh toán thành công |
| `expires_at` | DATETIME(3) | NOT NULL | Thời gian hết hạn PENDING |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `order_id` → orders.id
- UNIQUE INDEX: `vnpay_transaction_id` (cho idempotent)
- INDEX: `(status, expires_at)` (dashboard query)

**Business Rules:**

- Backend validate amount = courses.price realtime
- PENDING → SUCCESS sau VNPAY callback verify
- Payment callback dùng transaction + SELECT FOR UPDATE
- Idempotent: không process cùng vnpay_transaction_id 2 lần

---

### 14. Table: `enrollments`

**Mô tả:** Ghi danh khóa học (free hoặc paid) - Per E1.5 & E2.4

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID enrollment |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Learner |
| `course_id` | CHAR(36) | FK → courses.id, NOT NULL | Khóa học |
| `status` | ENUM('active', 'cancelled') | DEFAULT 'active', NOT NULL | Trạng thái đăng ký (E1.5, E2.4 - required) |
| `enrolled_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian ghi danh |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian cập nhật |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → users.id
- FOREIGN KEY: `course_id` → courses.id
- UNIQUE: `(user_id, course_id)` (one enrollment per learner-course)

**Business Rules:**

- Tạo enrollment sau khi payment SUCCESS với status = 'active'
- Check `status === 'active'` trước khi cho learner access lesson/submit quiz/rating (E2.4)
- Enrollment bị cancel → status = 'cancelled' (soft cancel, không xóa)
- Member D gọi canAccessCourse() từ Member C via DI, KHÔNG query trực tiếp
- Member D kiểm tra `enrollment.status === 'active'` trước POST /ratings (E2.4)

---

## MEMBER D - LEARNING EXPERIENCE (3 Tables)

### 15. Table: `quiz_submissions`

**Mô tả:** Bài làm quiz của learner

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID submission |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Learner |
| `quiz_id` | CHAR(36) | FK → quizzes.id, NOT NULL | Quiz |
| `answers_json` | JSON | NOT NULL | Câu trả lời dạng JSON |
| `score` | DECIMAL(6,2) | DEFAULT 0 | Điểm số |
| `passed` | BOOLEAN | DEFAULT false | Pass/Fail |
| `submitted_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian submit |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian tạo |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` → users.id (ON DELETE RESTRICT)
- FOREIGN KEY: `quiz_id` → quizzes.id (ON DELETE CASCADE - E5 fix)
- INDEX: `(user_id, quiz_id)` (để lấy lịch submit)

**Business Rules:**

- Auto-grade dựa trên correct_answer
- Learner chỉ xem data của mình
- Quiz chỉ là bài học (KHÔNG cấp certificate)

---

### 16. Table: `ratings`

**Mô tả:** Đánh giá khóa học từ learner

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID rating |
| `course_id` | CHAR(36) | FK → courses.id, NOT NULL | Khóa học |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Learner |
| `rating_value` | INT | CHECK(1-5) | Điểm (1-5 stars) |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian rating |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `course_id` → courses.id
- FOREIGN KEY: `user_id` → users.id
- UNIQUE: `(course_id, user_id)` (1 rating per learner-course)

**Business Rules:**

- Learner rating bất cứ lúc nào sau khi enroll (KHÔNG yêu cầu 100% lessons)
- **Archived course**: Learner với valid enrollment (paid+success) vẫn có thể access + rate/feedback
- Chỉ cần check enrollment hợp lệ (paid+success)
- **⚠️ CRITICAL (Issue 1.3)**: Archived course không bán mới nhưng không block learner đã enroll

---

### 17. Table: `feedbacks`

**Mô tả:** Feedback/bình luận khóa học từ learner

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID feedback |
| `course_id` | CHAR(36) | FK → courses.id, NOT NULL | Khóa học |
| `user_id` | CHAR(36) | FK → users.id, NOT NULL | Learner |
| `feedback_text` | TEXT | NOT NULL | Nội dung feedback |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian feedback |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `course_id` → courses.id
- FOREIGN KEY: `user_id` → users.id

**Business Rules:**

- Learner feedback bất cứ lúc nào sau khi enroll
- KHÔNG limit số lần feedback (khác rating)
- Chỉ cần check enrollment hợp lệ (paid+success)

---

## MEMBER E - MANAGER APPROVAL (2 Tables)

### 18. Table: `course_reviews`

**Mô tả:** Kết quả review course của Manager

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID review |
| `revision_id` | CHAR(36) | FK → course_revisions.id, NOT NULL | Revision được review |
| `manager_id` | CHAR(36) | FK → users.id, NOT NULL | Manager thực hiện review |
| `status` | ENUM('pending','published','rejected') | NOT NULL | Trạng thái review |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian review |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `revision_id` → course_revisions.id
- FOREIGN KEY: `manager_id` → users.id

**Business Rules:**

- Manager duyệt revision PENDING_REVIEW
- Publish → revision.status = PUBLISHED, courses.status = PUBLISHED
- Reject → revision.status = REJECTED (lưu comment ở review_comments)

---

### 19. Table: `review_comments`

**Mô tả:** Nhận xét từ Manager khi reject course

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID comment |
| `review_id` | CHAR(36) | FK → course_reviews.id, NOT NULL | Review |
| `comment` | TEXT | NOT NULL | Nhận xét reject (minLength 10 chars) |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian comment |

**Constraints:**

- PRIMARY KEY: `id`
- FOREIGN KEY: `review_id` → course_reviews.id

**Business Rules:**

- Reject bắt buộc comment (minLength 10)
- Mentor xem comment để sửa course
- Zod validate comment NOT NULL và minLength

---

## TỔNG KẾT INDEXES & FOREIGN KEY CONSTRAINTS

```sql
-- Auth
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at);

-- Courses
CREATE INDEX idx_courses_mentor_status ON courses(mentor_id, status);
CREATE INDEX idx_course_sections_course_order ON course_sections(course_id, order_index);
CREATE INDEX idx_lessons_section_order ON lessons(section_id, order_index);

-- Payment
CREATE UNIQUE INDEX idx_payments_vnpay_transaction_id ON payments(vnpay_transaction_id);
CREATE INDEX idx_payments_status_date ON payments(status, created_at);
CREATE INDEX idx_payments_status_expires ON payments(status, expires_at);  -- Issue 3.7: Auto-cancel cron query

-- Enrollment
CREATE UNIQUE INDEX idx_enrollments_user_course ON enrollments(user_id, course_id);
CREATE INDEX idx_enrollments_user_status ON enrollments(user_id, status);  -- E1.5, E2.4: Check active status
CREATE INDEX idx_enrollments_course ON enrollments(course_id);  -- Issue 3.5: Query by course
CREATE INDEX idx_enrollments_user ON enrollments(user_id);      -- Issue 3.5: Query by learner

-- Learning
CREATE UNIQUE INDEX idx_ratings_course_user ON ratings(course_id, user_id);
CREATE INDEX idx_ratings_course ON ratings(course_id);          -- Issue 3.5: Query avg rating by course
CREATE INDEX idx_quiz_submissions_user ON quiz_submissions(user_id, quiz_id);
```

**Issue 3.5 & 3.7 - New Indexes:**

- `idx_enrollments_course`: Filter enrollments by course (Member C analytics)
- `idx_enrollments_user`: Filter enrollments by learner (Member D access check)
- `idx_ratings_course`: Calculate avg rating per course (Member D analytics)
- `idx_payments_status_expires`: Auto-cancel expired PENDING payments (cron job)

**Issue 3.4 - orders UNIQUE constraint:**

- Current: `UNIQUE: (user_id, course_id)` - prevents multiple purchase attempts
- Fix: **REMOVE constraint** to allow learner retry after failed payment
- Business logic: Check `enrollments` table for duplicate instead of `orders`
- Learner can create multiple orders → only first successful payment creates enrollment

### Foreign Key ON DELETE Behavior

**CASCADE (Auto-delete child records):**

- `course_sections.course_id` → `courses.id`: ON DELETE CASCADE
  - Xóa course → auto-delete tất cả sections, lessons, quizzes
- `lessons.section_id` → `course_sections.id`: ON DELETE CASCADE
  - Xóa section → auto-delete tất cả lessons + lesson_assets
- `lesson_assets.lesson_id` → `lessons.id`: ON DELETE CASCADE
  - Xóa lesson → auto-delete tất cả assets
- `quizzes.lesson_id` → `lessons.id`: ON DELETE CASCADE
  - Xóa lesson → auto-delete tất cả quizzes + quiz_questions
- `quiz_questions.quiz_id` → `quizzes.id`: ON DELETE CASCADE
  - Xóa quiz → auto-delete tất cả questions
- `course_revisions.course_id` → `courses.id`: ON DELETE CASCADE
  - Xóa course → auto-delete tất cả revisions + review_comments

**RESTRICT (Prevent delete if child exists):**

- `enrollments.user_id` → `users.id`: ON DELETE RESTRICT
  - Cannot delete user nếu có enrollment
- `enrollments.course_id` → `courses.id`: ON DELETE RESTRICT
  - Cannot delete course nếu learner đã enroll
- `orders.user_id` → `users.id`: ON DELETE RESTRICT
  - Cannot delete user nếu có order
- `orders.course_id` → `courses.id`: ON DELETE RESTRICT
  - Cannot delete course nếu có order (tính toán revenue)
- `payments.order_id` → `orders.id`: ON DELETE RESTRICT
  - Cannot delete order nếu có payment
- `quiz_submissions.user_id` → `users.id`: ON DELETE RESTRICT
  - Cannot delete user nếu có quiz submission
- `quiz_submissions.quiz_id` → `quizzes.id`: ON DELETE RESTRICT
  - Cannot delete quiz nếu learner đã submit
- `ratings.user_id` → `users.id`: ON DELETE RESTRICT
  - Cannot delete user nếu có rating
- `ratings.course_id` → `courses.id`: ON DELETE RESTRICT
  - Cannot delete course nếu có rating
- `feedbacks.user_id` → `users.id`: ON DELETE RESTRICT
  - Cannot delete user nếu có feedback
- `feedbacks.course_id` → `courses.id`: ON DELETE RESTRICT
  - Cannot delete course nếu có feedback
- `course_reviews.revision_id` → `course_revisions.id`: ON DELETE RESTRICT
  - Cannot delete revision nếu có review

**⚠️ CRITICAL**:

- CASCADE rules cho content (sections, lessons, quizzes) để tránh orphaned data
- RESTRICT rules cho relationships có dữ liệu user/audit trail để maintain integrity
- Soft delete ưu tiên hơn hard delete: Thêm `deleted_at` field thay vì ON DELETE CASCADE cho high-risk tables

---

## CONSTRAINTS & BUSINESS RULES

✅ **REQUIRED:**

- Backend validate course.price từ DB
- Payment callback idempotent (SELECT FOR UPDATE)
- Enrollment unique per user+course
- Middleware check users.status
- Block user → revoke refresh_tokens
- Foreign Key constraints enforce ON DELETE behavior (CASCADE vs RESTRICT)

❌ **FORBIDDEN:**

- Frontend quyết định amount, price, userId
- Member D query trực tiếp enrollments, payments, orders
- Hard delete dữ liệu quan trọng
- Store raw JWT, password, OTP
- Duplicate enrollment

---

**END OF DATABASE SCHEMA**
