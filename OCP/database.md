# DATABASE SCHEMA - Online Course Platform (OCP)

<<<<<<< Updated upstream:OCP/database.md
Tài liệu này định nghĩa cấu trúc cơ sở dữ liệu cho hệ thống **Online Course Platform (OCP)**. Cơ sở dữ liệu sử dụng **MySQL** và được truy cập qua **Prisma** trong backend NodeJS/Express-style API.

Mục tiêu thiết kế:

- Hỗ trợ luồng học viên đăng ký, xác thực email, đăng nhập bằng email/password hoặc Google OAuth, và quản lý hồ sơ.
- Hỗ trợ Guest/Learner xem khóa học, section, lesson và preview content.
- Hỗ trợ thanh toán khóa học trả phí qua VNPAY, lưu lịch sử thanh toán, chống xử lý trùng.
- Hỗ trợ enrollment, course access, learning progress, quiz và final project.
- Hỗ trợ mentor review, admin dashboard/report và notification cơ bản.
- Giữ đúng ranh giới module trong `AGENTS.md`, `PROJECT_AGENTS.md` và `chia job (1).docx`.
=======
**Ngày cập nhật:** 18/06/2026  
**Phiên bản:** V2 Final (Strict 19 tables + E3.x Fixes)  
**Scope:** STRICTLY 19 tables per V5 Task Assignment  
**Database:** MySQL 8.0+  
**ORM:** Prisma  
**Status:** ✅ Fully aligned with V5 + V2 Error Fixes + E3.x Fixes Applied
>>>>>>> Stashed changes:DATABASE.md

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

<<<<<<< Updated upstream:OCP/database.md
    users ||--o{ enrollments : "enrolls"
    courses ||--o{ enrollments : "enrolled_course"
    users ||--o{ course_progress : "tracks"
    courses ||--o{ course_progress : "tracked_course"
    users ||--o{ lesson_progress : "completes"
    lessons ||--o{ lesson_progress : "tracked_lesson"

    courses ||--o{ quizzes : "has"
    lessons ||--o{ quizzes : "attached_to"
    quizzes ||--o{ quiz_questions : "contains"
    quizzes ||--o{ quiz_submissions : "submitted_for"
    users ||--o{ quiz_submissions : "submits"

    users ||--o{ project_submissions : "submits"
    courses ||--o{ project_submissions : "final_project_for"
    project_submissions ||--o{ project_reviews : "reviewed_by"
    users ||--o{ project_reviews : "mentor_reviews"
    project_reviews ||--o{ mentor_feedbacks : "has_feedback"

    users ||--o{ mentor_assignments : "mentor"
    courses ||--o{ mentor_assignments : "assigned_course"

    users ||--o{ notifications : "receives"
    users ||--o{ audit_logs : "actor"
    users ||--o{ report_snapshots : "created_by"
```
=======
### E3.4-E3.6: New Indexes for Performance
- `idx_revisions_status_date(status, created_at DESC)` - Manager approval queue
- `idx_enrollments_user_status(user_id, status)` - "My courses" query
- `idx_refresh_tokens_user_revoke(user_id, revoked_at)` - Revoke on block
>>>>>>> Stashed changes:DATABASE.md

---

## 📊 Strict 19 Tables (SCOPED)

<<<<<<< Updated upstream:OCP/database.md
1. **Khóa chính (Primary Key):** Dùng UUID cho tất cả bảng. Với MySQL + Prisma, khuyến nghị lưu dạng `CHAR(36)` qua `String @id @default(uuid()) @db.Char(36)`.
2. **Kiểu dữ liệu tiền tệ:** Dùng `DECIMAL(15,2)` cho giá khóa học, order amount và payment amount. Không dùng `FLOAT/DOUBLE` cho tiền.
3. **Múi giờ:** Lưu thời gian dạng UTC bằng `DATETIME(3)` hoặc `TIMESTAMP(3)` thống nhất trong toàn hệ thống.
4. **Xóa mềm (Soft Delete):**
   - Master data như `users`, `courses`, `categories`, `lessons` dùng `is_active` và/hoặc `deleted_at`.
   - Transaction data như `payments`, `orders`, `enrollments`, `project_submissions` không xóa cứng; dùng `status`.
5. **Ranh giới module:** Module không query trực tiếp bảng do module khác sở hữu. Cross-module data phải đi qua service/contract.
6. **Auth:** JWT lưu trong httpOnly Cookie; database không lưu JWT access token. Hệ thống hỗ trợ local login bằng email/password và Google OAuth. Nếu dùng refresh flow, chỉ lưu refresh token đã hash; không lưu raw Google `id_token`, `access_token` hoặc `refresh_token`.
7. **Payment:** Frontend không quyết định `amount`, `payment_ref`, `status`, `user_id`. Backend snapshot `amount` từ Course Module tại thời điểm tạo payment.
8. **Course access:** Paid course chỉ unlock khi có `enrollment` hợp lệ. Payment `PENDING` không cấp quyền học.
9. **MySQL partial index:** MySQL không hỗ trợ partial unique index kiểu PostgreSQL. Rule "một active PENDING payment cho `user_id + course_id`" phải enforce bằng transaction lock/application lock; generated column chỉ là lựa chọn nâng cao.

---

## 3. Chi Tiết Từng Bảng (26 Bảng, 8 Nhóm)

### 3.1 Nhóm Người Dùng, Auth & Email

#### `roles` (Vai trò)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL. Ví dụ: `ADMIN`, `LEARNER`, `MENTOR` |
| `name` | VARCHAR(100) | NOT NULL |
| `permissions` | JSON | Danh sách quyền nếu project cần permission chi tiết |
| `is_active` | BOOLEAN | DEFAULT true, NOT NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

#### `users` (Người dùng)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `role_id` | CHAR(36) | FOREIGN KEY -> `roles(id)`, NOT NULL |
| `name` | VARCHAR(120) | NOT NULL |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `phone` | VARCHAR(20) | NULL |
| `avatar_url` | VARCHAR(500) | NULL |
| `bio` | TEXT | NULL |
| `password_hash` | VARCHAR(255) | NULL với user chỉ đăng nhập Google; NOT NULL với local email/password account; không bao giờ trả về frontend |
| `email_verified` | BOOLEAN | DEFAULT false, NOT NULL |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN (`active`, `blocked`, `pending_verification`) |
| `last_login_at` | DATETIME(3) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `deleted_at` | DATETIME(3) | NULL, soft delete nếu cần |

#### `oauth_accounts` (Tài khoản đăng nhập bên ngoài)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NOT NULL |
| `provider` | VARCHAR(30) | NOT NULL, CHECK IN (`GOOGLE`) |
| `provider_user_id` | VARCHAR(255) | NOT NULL; Google `sub`, định danh ổn định của tài khoản Google |
| `provider_email` | VARCHAR(255) | NOT NULL; email nhận từ Google sau khi backend verify token |
| `provider_email_verified` | BOOLEAN | DEFAULT false, NOT NULL |
| `provider_display_name` | VARCHAR(120) | NULL |
| `provider_avatar_url` | VARCHAR(500) | NULL |
| `metadata` | JSON | NULL; profile payload đã sanitize, không chứa token/secret |
| `linked_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `last_login_at` | DATETIME(3) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| *Ràng buộc* | | UNIQUE(`provider`, `provider_user_id`), UNIQUE(`user_id`, `provider`) |

Ghi chú: Google login không thay thế bảng `users`. Sau khi backend verify Google ID token thành công, hệ thống map `oauth_accounts.provider = GOOGLE` + `provider_user_id = sub` về một `users.id`, rồi phát JWT httpOnly Cookie giống local login.

#### `refresh_tokens` (Refresh token)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NOT NULL |
| `token_hash` | VARCHAR(255) | UNIQUE, NOT NULL; không lưu raw token |
| `expires_at` | DATETIME(3) | NOT NULL |
| `revoked_at` | DATETIME(3) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

#### `email_verifications` (Token xác thực email)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NOT NULL |
| `token_hash` | VARCHAR(255) | UNIQUE, NOT NULL |
| `expires_at` | DATETIME(3) | NOT NULL |
| `used_at` | DATETIME(3) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

#### `password_reset_tokens` (Token đặt lại mật khẩu)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NOT NULL |
| `token_hash` | VARCHAR(255) | UNIQUE, NOT NULL |
| `expires_at` | DATETIME(3) | NOT NULL |
| `used_at` | DATETIME(3) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
=======
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
>>>>>>> Stashed changes:DATABASE.md

---

## MEMBER A - AUTH & ACCOUNT (4 Tables)

### 1. Table: `users`

**Mô tả:** Lưu thông tin người dùng (Admin, Learner, Mentor, Manager)

| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID người dùng |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email đăng nhập |
| `password_hash` | VARCHAR(255) | NULL | Bcrypt hash; NULL nếu Google-only |
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

<<<<<<< Updated upstream:OCP/database.md
#### `payments` (Thanh toán)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `order_id` | CHAR(36) | FOREIGN KEY -> `orders(id)`, NULL trong MVP nếu chưa tạo order riêng |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NOT NULL |
| `course_id` | CHAR(36) | FOREIGN KEY -> `courses(id)`, NOT NULL |
| `payment_ref` | VARCHAR(80) | UNIQUE, NOT NULL; gửi sang VNPAY dưới dạng `vnp_TxnRef` |
| `provider` | VARCHAR(30) | DEFAULT `VNPAY`, NOT NULL |
| `amount` | DECIMAL(15,2) | NOT NULL, snapshot từ course price |
| `currency` | VARCHAR(10) | DEFAULT `VND`, NOT NULL |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN (`PENDING`, `EXPIRED`, `SUCCESS`, `FAILED`, `CANCELLED`) |
| `checkout_url` | TEXT | Full VNPAY signed URL để reuse khi còn active `PENDING` |
| `transaction_id` | VARCHAR(100) | NULL, gateway transaction id sau callback |
| `provider_response_code` | VARCHAR(50) | NULL |
| `provider_payload` | JSON | NULL, sanitized payload; không chứa secret |
| `paid_at` | DATETIME(3) | NULL |
| `expires_at` | DATETIME(3) | NOT NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

Ghi chú: `payments.provider` là nhà cung cấp thanh toán, hiện mặc định `VNPAY`; không dùng cột này cho Google login.

#### `payment_events` (Sự kiện payment/audit payment)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `payment_id` | CHAR(36) | FOREIGN KEY -> `payments(id)`, NOT NULL |
| `event_type` | VARCHAR(50) | NOT NULL. Ví dụ: `CREATED`, `REUSED`, `EXPIRED`, `SUCCESS`, `FAILED` |
| `actor_user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NULL |
| `metadata` | JSON | NULL; không chứa VNPAY secret/JWT |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

#### `enrollments` (Ghi danh khóa học)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NOT NULL |
| `course_id` | CHAR(36) | FOREIGN KEY -> `courses(id)`, NOT NULL |
| `payment_id` | CHAR(36) | FOREIGN KEY -> `payments(id)`, NULL với khóa free |
| `source` | VARCHAR(20) | CHECK IN (`free`, `payment`, `admin`) |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN (`active`, `completed`, `cancelled`, `refunded`) |
| `enrolled_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `completed_at` | DATETIME(3) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| `updated_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |
| *Ràng buộc* | | UNIQUE(`user_id`, `course_id`) |
=======
**Business Rules:**
- Refresh token expire 7-30 ngày
- Block user → revoke tất cả refresh_tokens
- Access token expire 5 phút (FIXED per E2.2 - không dùng 15-60)
- Refresh token rotation on use
>>>>>>> Stashed changes:DATABASE.md

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

<<<<<<< Updated upstream:OCP/database.md
#### `mentor_assignments` (Gán mentor vào course)
=======
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
>>>>>>> Stashed changes:DATABASE.md

**Business Rules:**
- 100% khóa học trả phí (price > 0)
- Mentor chỉ CRUD course của mình
- Published course chỉ xuất hiện catalog
- Archived course không bán, learner đã enroll vẫn học

---

<<<<<<< Updated upstream:OCP/database.md
### 3.7 Nhóm Notification, Audit & Report

#### `notifications` (Thông báo)
=======
### 6. Table: `course_revisions`

**Mô tả:** Lịch sử revision để Manager review trước khi publish. Snapshot course data tại thời điểm submit.
>>>>>>> Stashed changes:DATABASE.md

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

<<<<<<< Updated upstream:OCP/database.md
#### `audit_logs` (Nhật ký hệ thống)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `user_id` | CHAR(36) | FOREIGN KEY -> `users(id)`, NULL nếu system event |
| `action` | VARCHAR(80) | NOT NULL. Ví dụ: `CREATE`, `UPDATE`, `PAYMENT_CALLBACK` |
| `table_name` | VARCHAR(80) | NOT NULL |
| `record_id` | CHAR(36) | NULL |
| `old_data` | JSON | NULL, sanitized |
| `new_data` | JSON | NULL, sanitized |
| `ip_address` | VARCHAR(64) | NULL |
| `user_agent` | VARCHAR(500) | NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

#### `report_snapshots` (Bản chụp báo cáo, tùy chọn)

| Cột | Kiểu | Ghi chú / Ràng buộc |
|:---|:---|:---|
| `id` | CHAR(36) | PRIMARY KEY |
| `report_type` | VARCHAR(50) | Ví dụ: `revenue`, `course`, `mentor`, `overview` |
| `period_start` | DATE | NULL |
| `period_end` | DATE | NULL |
| `data` | JSON | NOT NULL |
| `created_by` | CHAR(36) | FOREIGN KEY -> `users(id)`, NULL |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) |

Ghi chú: Admin report có thể query trực tiếp từ bảng thật qua `reportService/reportRepository`; `report_snapshots` chỉ dùng khi team muốn cache hoặc lưu kết quả báo cáo theo kỳ.
=======
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
>>>>>>> Stashed changes:DATABASE.md

---

### 7. Table: `course_sections`

**Mô tả:** Section của khóa học (chứa lessons)

<<<<<<< Updated upstream:OCP/database.md
- `certificates`: lưu certificate PDF sau khi hoàn thành course.
- `comments`: Q&A/comment trong lesson.
- `course_reviews`: learner review/rating course.
- `coupons`, `coupon_redemptions`: mã giảm giá; hiện Payment Checkout MVP đã chốt không hỗ trợ coupon/voucher.
- `chat_threads`, `chat_messages`: chat system.
=======
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
>>>>>>> Stashed changes:DATABASE.md

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

<<<<<<< Updated upstream:OCP/database.md
```sql
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE UNIQUE INDEX idx_roles_code ON roles (code);
```

```sql
CREATE UNIQUE INDEX idx_oauth_accounts_provider_user
  ON oauth_accounts (provider, provider_user_id);
```

```sql
CREATE UNIQUE INDEX idx_oauth_accounts_user_provider
  ON oauth_accounts (user_id, provider);
```

```sql
ALTER TABLE oauth_accounts
  ADD CONSTRAINT chk_oauth_accounts_provider
  CHECK (provider IN ('GOOGLE'));
```

Rule bắt buộc ở service layer:

- Local login chỉ hợp lệ khi `users.password_hash IS NOT NULL`.
- Google login phải verify Google ID token ở backend; không tin `email`, `name`, `avatar_url` do frontend tự gửi.
- Google account lookup dùng `oauth_accounts.provider + oauth_accounts.provider_user_id`, không dùng email làm định danh chính.
- Nếu Google email đã verify và trùng `users.email`, việc auto-link hay từ chối phải theo Auth spec; không tự tạo user trùng email.
- User `blocked` hoặc đã `deleted_at` không được đăng nhập bằng local password hoặc Google OAuth.

### 4.2 Course Constraints

```sql
ALTER TABLE courses
  ADD CONSTRAINT chk_courses_price
  CHECK (price >= 0);
```

```sql
ALTER TABLE courses
  ADD CONSTRAINT chk_courses_status
  CHECK (status IN ('draft', 'active', 'inactive', 'archived'));
```

```sql
ALTER TABLE course_sections
  ADD CONSTRAINT uq_course_sections_order
  UNIQUE (course_id, order_index);
```

```sql
ALTER TABLE lessons
  ADD CONSTRAINT uq_lessons_order
  UNIQUE (section_id, order_index);
```

### 4.3 Payment & Enrollment Constraints

```sql
CREATE UNIQUE INDEX idx_payments_payment_ref ON payments (payment_ref);
```

```sql
CREATE UNIQUE INDEX idx_payments_transaction_id ON payments (transaction_id);
```

Ghi chú MySQL: unique index cho phép nhiều giá trị `NULL`, nên nhiều payment chưa có `transaction_id` vẫn hợp lệ. Khi VNPAY callback gán `transaction_id`, DB sẽ chặn trùng transaction id.

```sql
ALTER TABLE enrollments
  ADD CONSTRAINT uq_enrollments_user_course
  UNIQUE (user_id, course_id);
```

```sql
ALTER TABLE payments
  ADD CONSTRAINT chk_payments_status
  CHECK (status IN ('PENDING', 'EXPIRED', 'SUCCESS', 'FAILED', 'CANCELLED'));
```

Rule bắt buộc ở service layer:

- Không tạo hơn một active `PENDING` payment cho cùng `user_id + course_id`.
- Khi checkout lại và pending cũ hết hạn, phải cập nhật pending cũ thành `EXPIRED` trong transaction trước khi tạo payment mới.
- Payment callback phải idempotent theo `payment_ref` và `transaction_id`.
- Tạo `payment SUCCESS -> enrollment CREATED` phải nằm trong cùng transaction.

### 4.4 Learning & Quiz Constraints

```sql
ALTER TABLE lesson_progress
  ADD CONSTRAINT uq_lesson_progress_user_lesson
  UNIQUE (user_id, lesson_id);
```

```sql
ALTER TABLE course_progress
  ADD CONSTRAINT uq_course_progress_user_course
  UNIQUE (user_id, course_id);
```

```sql
ALTER TABLE lesson_progress
  ADD CONSTRAINT chk_lesson_progress_percent
  CHECK (progress_percent >= 0 AND progress_percent <= 100);
```

```sql
ALTER TABLE course_progress
  ADD CONSTRAINT chk_course_progress_percent
  CHECK (progress_percent >= 0 AND progress_percent <= 100);
```

### 4.5 Mentor & Review Constraints

```sql
ALTER TABLE mentor_assignments
  ADD CONSTRAINT uq_mentor_assignments_mentor_course
  UNIQUE (mentor_id, course_id);
```

```sql
ALTER TABLE project_reviews
  ADD CONSTRAINT chk_project_reviews_result
  CHECK (result IN ('PASS', 'FAIL'));
```

Rule bắt buộc ở service layer:

- Mentor chỉ được review submission thuộc course mà mentor đang được assign.
- User có role Mentor chưa đủ; phải có `mentor_assignments.status = 'active'`.
- Khi review PASS/FAIL, cập nhật `project_submissions.status` tương ứng trong transaction.
=======
**Business Rules:**
- Learner xem lesson tự do, không track tiến độ (out of scope)
- Mentor upload assets (video, tài liệu) qua lesson_assets
>>>>>>> Stashed changes:DATABASE.md

---

### 9. Table: `lesson_assets`

**Mô tả:** Assets (video, document) từ Cloudinary

<<<<<<< Updated upstream:OCP/database.md
```sql
CREATE INDEX idx_users_role_status ON users (role_id, status);
CREATE INDEX idx_oauth_accounts_provider_email ON oauth_accounts (provider, provider_email);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id, expires_at);
CREATE INDEX idx_email_verifications_user ON email_verifications (user_id, expires_at);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id, expires_at);
```
=======
| Field | Type | Constraints | Mô tả |
|-------|------|-------------|-------|
| `id` | CHAR(36) | PK | UUID asset |
| `lesson_id` | CHAR(36) | FK → lessons.id, NOT NULL | Bài học |
| `cloudinary_public_id` | VARCHAR(500) | NOT NULL | Cloudinary public_id |
| `asset_type` | ENUM('video','document') | NOT NULL | Loại asset |
| `created_at` | DATETIME(3) | DEFAULT CURRENT_TIMESTAMP(3) | Thời gian upload |
>>>>>>> Stashed changes:DATABASE.md

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `lesson_id` → lessons.id

<<<<<<< Updated upstream:OCP/database.md
```sql
CREATE INDEX idx_courses_category_status ON courses (category_id, status);
CREATE INDEX idx_courses_paid_price ON courses (is_paid, price);
CREATE INDEX idx_courses_created_at ON courses (created_at DESC);
CREATE INDEX idx_course_sections_course_order ON course_sections (course_id, order_index);
CREATE INDEX idx_lessons_section_order ON lessons (section_id, order_index);
```

Nếu MySQL full-text search được bật:

```sql
CREATE FULLTEXT INDEX idx_courses_search ON courses (title, description);
```

### 5.3 Payment/Enrollment Indexes

```sql
CREATE INDEX idx_payments_user_course_status ON payments (user_id, course_id, status);
CREATE INDEX idx_payments_status_expires ON payments (status, expires_at);
CREATE INDEX idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_enrollments_user_status ON enrollments (user_id, status);
CREATE INDEX idx_enrollments_course_status ON enrollments (course_id, status);
CREATE INDEX idx_payment_events_payment_time ON payment_events (payment_id, created_at DESC);
```

### 5.4 Learning/Quiz Indexes

```sql
CREATE INDEX idx_lesson_progress_user_status ON lesson_progress (user_id, status);
CREATE INDEX idx_course_progress_user_status ON course_progress (user_id, status);
CREATE INDEX idx_quizzes_course_status ON quizzes (course_id, status);
CREATE INDEX idx_quiz_submissions_user_quiz ON quiz_submissions (user_id, quiz_id, submitted_at DESC);
```

### 5.5 Project/Mentor/Admin Indexes

```sql
CREATE INDEX idx_project_submissions_course_status ON project_submissions (course_id, status);
CREATE INDEX idx_project_submissions_user_course ON project_submissions (user_id, course_id);
CREATE INDEX idx_mentor_assignments_mentor_status ON mentor_assignments (mentor_id, status);
CREATE INDEX idx_project_reviews_submission ON project_reviews (submission_id);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_time ON audit_logs (created_at DESC);
```
=======
**Business Rules:**
- Frontend upload trực tiếp Cloudinary
- Backend cấp signature với type="authenticated"
- Learner/Manager access qua signed URL (expire 1 giờ)
- KHÔNG lưu public URL
>>>>>>> Stashed changes:DATABASE.md

---

### 10. Table: `quizzes`

<<<<<<< Updated upstream:OCP/database.md
1. Prisma schema nên dùng `Decimal` cho `price`, `amount`, `score`, `progress_percent`.
2. Với MySQL, UUID có thể lưu bằng `String @db.Char(36)` để dễ debug trong đồ án.
3. Không tự viết raw SQL trong service. Nếu cần `SELECT ... FOR UPDATE` cho payment race condition, chỉ đặt trong repository và ghi rõ lý do.
4. Migration cũ không được sửa/xóa sau khi đã apply vào database chung.
5. `provider_payload`, `metadata`, `permissions`, `answers`, `options`, `correct_answer`, `data` dùng JSON nhưng phải sanitize trước khi lưu.
6. Không lưu secret VNPAY, JWT, password plain text, raw reset token, raw verification token, Google `id_token`, Google `access_token` hoặc Google `refresh_token` vào DB.
7. Với Google-only user, `users.password_hash` được phép `NULL`; nếu người dùng muốn đăng nhập local password sau này, phải đi qua flow set password riêng.
8. `payments.provider` là payment provider như `VNPAY`; `oauth_accounts.provider` là identity provider như `GOOGLE`. Không dùng lẫn hai khái niệm này.
9. Các bảng `payment_events`, `audit_logs`, `notifications`, `report_snapshots` có thể triển khai sau nếu MVP muốn giảm scope, nhưng `payments` và `enrollments` là bắt buộc cho paid course access.
=======
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
>>>>>>> Stashed changes:DATABASE.md
