# SPEC.md - feat-mentor-course-draft

## 1. Context & Goal

Feature `feat-mentor-course-draft` cung cấp nền tảng Course Studio cho Mentor tạo và quản lý metadata khóa học của chính mình. Feature này chỉ xử lý course-level metadata và ownership, chưa xử lý curriculum, lesson, quiz, asset, reorder hoặc submit review.

Mục tiêu chính:

* Mentor tạo course draft mới.
* Mentor xem danh sách course của mình.
* Mentor xem chi tiết course của mình.
* Mentor sửa metadata của course khi course còn ở trạng thái `draft` hoặc `rejected`.
* Mentor soft delete/archive course theo API final.
* Backend bảo vệ ownership bằng `req.user.id`, không tin dữ liệu identity từ frontend.
* Backend khóa chỉnh sửa course đã `published` theo E1.2.

## 2. Actors & Roles

| Actor                    | Role              | Quyền trong feature                          |
| ------------------------ | ----------------- | -------------------------------------------- |
| Mentor                   | `MENTOR`          | Tạo, xem, sửa, archive course do mình sở hữu |
| Member A Auth Middleware | System dependency | Xác thực JWT, roleVersion, role MENTOR       |
| Manager                  | Out of scope      | Không gọi API feature này                    |
| Learner                  | Out of scope      | Không gọi API feature này                    |
| Admin                    | Out of scope      | Không quản lý course trong feature này       |

## 3. Functional Requirements (EARS Notation)

**FR-001:** WHEN Mentor gửi `POST /mentor/courses` với payload hợp lệ, THE system SHALL tạo course mới với `mentor_id = req.user.id`, `status = draft`, `title` hợp lệ, `price` là số nguyên lớn hơn 0, và các metadata optional được validate nếu có.

**FR-002:** THE system SHALL ignore mọi field identity do frontend gửi lên như `mentorId`, `mentor_id`, hoặc `userId` khi tạo course.

**FR-003:** WHEN Mentor gửi `GET /mentor/courses`, THE system SHALL trả về danh sách course có `mentor_id = req.user.id`.

**FR-004:** WHEN Mentor gửi `GET /mentor/courses/:courseId`, THE system SHALL kiểm tra course tồn tại và thuộc sở hữu của Mentor hiện tại trước khi trả về chi tiết course.

**FR-005:** WHERE `courseId` không tồn tại, THE system SHALL trả về lỗi `COURSE_NOT_FOUND`.

**FR-006:** WHERE course tồn tại nhưng `course.mentor_id !== req.user.id`, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-007:** WHEN Mentor gửi `PUT /mentor/courses/:courseId` với payload hợp lệ, THE system SHALL cập nhật metadata course nếu course thuộc Mentor hiện tại và `course.status` thuộc `draft` hoặc `rejected`.

**FR-008:** WHERE course có `status = published`, THE system SHALL từ chối update và trả về lỗi `COURSE_LOCKED_PUBLISHED`.

**FR-009:** WHERE course có `status` không thuộc `draft` hoặc `rejected`, THE system SHALL từ chối update và trả về lỗi `COURSE_STATUS_NOT_EDITABLE`.

**FR-010:** WHEN Mentor gửi `DELETE /mentor/courses/:courseId`, THE system SHALL soft delete course bằng cách cập nhật `status = archived` nếu course thuộc Mentor hiện tại và status cho phép archive.

**FR-011:** THE system SHALL NOT hard delete course record khỏi database trong feature này.

**FR-012:** THE system SHALL validate mọi request body bằng Zod trước khi controller gọi service.

**FR-013:** THE system SHALL return sanitized error response without stack trace, secret, JWT, cookie hoặc query nội bộ.

## 4. Non-functional Requirements

**Security**

* Tất cả endpoint `/mentor/courses*` trong feature này phải đi qua `AUTH_MIDDLEWARE`.
* Tất cả endpoint phải yêu cầu role `MENTOR`.
* `mentor_id` phải lấy từ `req.user.id`.
* Không được tin identity từ request body, query hoặc params ngoài `courseId`.
* Mentor không được xem/sửa/archive course của Mentor khác.

**Data Integrity**

* Không hard delete course.
* Không sửa course đã `published`.
* Price phải lưu chính xác bằng integer/BIGINT, không dùng decimal/floating point.
* Update course phải bảo toàn các field không nằm trong payload.

**Performance**

* `GET /mentor/courses` phải hỗ trợ pagination mặc định để tránh response quá lớn.
* Repository phải query theo `mentor_id` để không lọc ownership ở frontend.

**Maintainability**

* Controller không chứa business logic.
* Service chịu trách nhiệm kiểm tra ownership và status.
* Repository là lớp duy nhất truy cập Prisma cho bảng `courses`.
* Validator phải tách riêng bằng Zod.

**Testability**

* Mỗi rule quan trọng phải có acceptance criteria và test tương ứng.
* Test phải cover create, list, detail, ownership, lock published, invalid status, soft delete và validation error.

## 5. Data Model

Feature này chỉ dùng bảng `courses`.

| Field         | Type                 | Required | Ghi chú                                                        |
| ------------- | -------------------- | -------- | -------------------------------------------------------------- |
| `id`          | CHAR(36) / UUID      | Yes      | Primary key                                                    |
| `mentor_id`   | CHAR(36) / UUID      | Yes      | FK tới `users.id`, lấy từ `req.user.id`                        |
| `title`       | VARCHAR              | Yes      | Tên khóa học                                                   |
| `description` | TEXT/LONGTEXT        | Optional | Mô tả khóa học                                                 |
| `thumbnail`   | VARCHAR              | Optional | URL/string metadata                                            |
| `price`       | BIGINT               | Yes      | Đơn vị đồng, integer > 0                                       |
| `category`    | VARCHAR/ENUM theo DB | Optional | Validate nếu được gửi                                          |
| `level`       | VARCHAR/ENUM theo DB | Optional | Validate nếu được gửi                                          |
| `status`      | ENUM                 | Yes      | `draft`, `pending_review`, `rejected`, `published`, `archived` |
| `created_at`  | DATETIME             | Yes      | Tạo bởi database                                               |
| `updated_at`  | DATETIME             | Yes      | Cập nhật bởi database                                          |

Status rules trong feature:

| Status           | Cho xem | Cho sửa metadata | Cho archive        |
| ---------------- | ------- | ---------------- | ------------------ |
| `draft`          | Yes     | Yes              | Yes                |
| `rejected`       | Yes     | Yes              | Yes                |
| `pending_review` | Yes     | No               | Open question      |
| `published`      | Yes     | No               | Open question      |
| `archived`       | Yes     | No               | Idempotent archive |

## 6. Error Handling

| Case                                  | HTTP | Error Code                     | Message gợi ý                         |
| ------------------------------------- | ---- | ------------------------------ | ------------------------------------- |
| Chưa đăng nhập                        | 401  | `UNAUTHORIZED`                 | Authentication required               |
| JWT hết hạn hoặc roleVersion mismatch | 401  | `TOKEN_REVOKED`                | Token revoked or expired              |
| Role không phải Mentor                | 403  | `FORBIDDEN_ROLE`               | Mentor role required                  |
| Payload sai schema                    | 400  | `VALIDATION_ERROR`             | Invalid request body                  |
| `price` không phải integer > 0        | 400  | `INVALID_PRICE`                | Price must be positive integer        |
| `courseId` không tồn tại              | 404  | `COURSE_NOT_FOUND`             | Course not found                      |
| Course không thuộc Mentor hiện tại    | 403  | `COURSE_NOT_OWNED`             | Course is not owned by current mentor |
| Update course published               | 403  | `COURSE_LOCKED_PUBLISHED`      | Published course cannot be edited     |
| Update course status không cho phép   | 403  | `COURSE_STATUS_NOT_EDITABLE`   | Course status is not editable         |
| Archive course status không cho phép  | 403  | `COURSE_STATUS_NOT_ARCHIVABLE` | Course status is not archivable       |

Error response phải được sanitize. Không trả stack trace, database query, JWT, cookie hoặc secret ra frontend.

## 7. Acceptance Criteria (Given-When-Then)

**AC-001 maps to FR-001, FR-002**
Given Mentor đã đăng nhập hợp lệ với role `MENTOR`, When Mentor gọi `POST /mentor/courses` với `title` hợp lệ và `price = 250000`, Then hệ thống trả về HTTP 201 và tạo course có `mentor_id = req.user.id`, `status = draft`, `price = 250000`.

**AC-002 maps to FR-002**
Given Mentor đã đăng nhập hợp lệ, When payload tạo course chứa `mentorId` hoặc `mentor_id` giả mạo, Then hệ thống bỏ qua field đó và vẫn lưu `mentor_id = req.user.id`.

**AC-003 maps to FR-003**
Given Mentor A và Mentor B đều có course, When Mentor A gọi `GET /mentor/courses`, Then response chỉ chứa course có `mentor_id` của Mentor A.

**AC-004 maps to FR-004, FR-005**
Given Mentor gọi `GET /mentor/courses/:courseId` với `courseId` không tồn tại, When request được xử lý, Then hệ thống trả về HTTP 404 `COURSE_NOT_FOUND`.

**AC-005 maps to FR-004, FR-006**
Given course X thuộc Mentor B, When Mentor A gọi `GET /mentor/courses/X`, Then hệ thống trả về HTTP 403 `COURSE_NOT_OWNED`.

**AC-006 maps to FR-007**
Given course X thuộc Mentor A và có `status = draft`, When Mentor A gọi `PUT /mentor/courses/X` với payload hợp lệ, Then hệ thống cập nhật metadata và trả về HTTP 200.

**AC-007 maps to FR-007**
Given course X thuộc Mentor A và có `status = rejected`, When Mentor A gọi `PUT /mentor/courses/X` với payload hợp lệ, Then hệ thống cập nhật metadata và trả về HTTP 200.

**AC-008 maps to FR-008**
Given course X thuộc Mentor A và có `status = published`, When Mentor A gọi `PUT /mentor/courses/X`, Then hệ thống trả về HTTP 403 `COURSE_LOCKED_PUBLISHED`.

**AC-009 maps to FR-009**
Given course X thuộc Mentor A và có `status = pending_review`, When Mentor A gọi `PUT /mentor/courses/X`, Then hệ thống trả về HTTP 403 `COURSE_STATUS_NOT_EDITABLE`.

**AC-010 maps to FR-010, FR-011**
Given course X thuộc Mentor A và có `status = draft`, When Mentor A gọi `DELETE /mentor/courses/X`, Then hệ thống trả về HTTP 200 và cập nhật `status = archived` mà không xóa record khỏi database.

**AC-011 maps to FR-012**
Given Mentor gọi `POST /mentor/courses` với `price = 10.5`, When request được validate, Then hệ thống trả về HTTP 400 `INVALID_PRICE` hoặc `VALIDATION_ERROR`.

**AC-012 maps to FR-013**
Given một lỗi bất kỳ xảy ra trong API, When response được trả về frontend, Then response không chứa stack trace, secret, JWT, cookie hoặc query nội bộ.

## 8. Out of Scope

Feature này không xử lý:

* Tạo/sửa/xóa section.
* Tạo/sửa/xóa lesson.
* Upload lesson asset hoặc Cloudinary upload signature.
* Tạo/sửa/xóa quiz.
* Tạo/sửa/xóa quiz question.
* Reorder section/lesson.
* Submit course review.
* Tạo `course_revisions`.
* Manager publish/reject.
* Public catalog.
* Payment hoặc enrollment.
* Learner learning flow.
* Learner quiz submission.
* Rating/feedback.
* Admin user management.
* Migration/database schema change.
* Frontend implementation.

