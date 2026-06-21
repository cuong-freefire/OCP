# SPEC.md - feat-submit-course-review

## 1. Context & Goal

Feature `feat-submit-course-review` cho phép Mentor submit course của mình cho Manager review. Khi submit, hệ thống tạo một `course_revisions` record ở trạng thái `pending_review`, chứa snapshot đầy đủ của course tại thời điểm submit.

Mục tiêu chính:

* Mentor submit course ở status `draft` hoặc `rejected`.
* Backend kiểm tra ownership bằng `course.mentor_id === req.user.id`.
* Backend chặn submit course `published`, `pending_review`, `archived` hoặc status không hợp lệ.
* Backend tạo `snapshot_data` đầy đủ curriculum.
* Backend tạo revision status `pending_review`.
* Backend bắt buộc cập nhật course status sang `pending_review` trong cùng transaction tạo revision.
* Backend export `canEditCourse(userId, courseId)` cho Member E.
* Backend không xử lý Manager publish/reject.

## 2. Actors & Roles

| Actor                    | Role                  | Quyền trong feature                                      |
| ------------------------ | --------------------- | -------------------------------------------------------- |
| Mentor                   | `MENTOR`              | Submit course do mình sở hữu cho Manager review          |
| Member A Auth Middleware | System dependency     | Xác thực JWT, roleVersion, role MENTOR                   |
| Member B                 | Module owner          | Tạo course revision snapshot và export `canEditCourse()` |
| Member E                 | Downstream dependency | Dùng pending revision để Manager publish/reject          |
| Manager                  | Out of scope          | Không publish/reject trong feature này                   |
| Learner                  | Out of scope          | Không thấy course pending review                         |
| Admin                    | Out of scope          | Không quản lý submit review trong feature này            |

## 3. Functional Requirements (EARS Notation)

**FR-001:** WHEN Mentor gửi `POST /mentor/courses/:courseId/submit-review`, THE system SHALL authenticate request bằng `AUTH_MIDDLEWARE` và yêu cầu role `MENTOR`.

**FR-002:** WHEN request chứa `courseId`, THE system SHALL validate `courseId` bằng Zod trước khi controller gọi service.

**FR-003:** WHERE `courseId` không tồn tại, THE system SHALL trả về lỗi `COURSE_NOT_FOUND`.

**FR-004:** WHERE course tồn tại nhưng `course.mentor_id !== req.user.id`, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-005:** WHERE course có `status = published`, THE system SHALL từ chối submit review và trả về lỗi `COURSE_LOCKED_PUBLISHED`.

**FR-006:** WHERE course có `status = pending_review`, THE system SHALL từ chối submit review và trả về lỗi `COURSE_ALREADY_PENDING_REVIEW`.

**FR-007:** WHERE course có `status = archived`, THE system SHALL từ chối submit review và trả về lỗi `COURSE_ARCHIVED`.

**FR-008:** WHERE course status không thuộc `draft` hoặc `rejected`, THE system SHALL từ chối submit review và trả về lỗi `COURSE_STATUS_NOT_SUBMITTABLE`.

**FR-009:** WHEN course thuộc Mentor hiện tại và status thuộc `draft` hoặc `rejected`, THE system SHALL collect full curriculum data gồm course metadata, sections, lessons, lesson assets, quizzes và quiz questions.

**FR-010:** THE system SHALL create `snapshot_data` từ dữ liệu curriculum tại thời điểm submit.

**FR-011:** THE system SHALL create một `course_revisions` record mới với `course_id`, `revision_num`, `status = pending_review`, và `snapshot_data`.

**FR-012:** THE system SHALL calculate `revision_num` theo thứ tự tăng dần trong phạm vi từng course.

**FR-013:** WHEN submit review thành công, THE system SHALL update `course.status = pending_review` trong cùng transaction tạo `course_revisions`.

**FR-014:** IF tạo revision hoặc update `course.status` thất bại, THEN THE system SHALL rollback toàn bộ transaction, không để lại revision hoặc course status partial.

**FR-015:** THE system SHALL NOT publish, approve hoặc reject course trong feature này.

**FR-016:** THE system SHALL NOT modify public catalog, payment, enrollment hoặc learner access trong feature này.

**FR-017:** THE system SHALL export `canEditCourse(userId, courseId)`.

**FR-018:** WHEN `canEditCourse(userId, courseId)` được gọi với course thuộc user và status thuộc `draft` hoặc `rejected`, THE system SHALL return `true`.

**FR-019:** WHEN `canEditCourse(userId, courseId)` được gọi với course không thuộc user hoặc status không thuộc `draft/rejected`, THE system SHALL return `false`.

**FR-020:** THE system SHALL return sanitized error response without stack trace, database query, JWT, cookie hoặc secret.

## 4. Non-functional Requirements

**Security**

* Endpoint phải đi qua `AUTH_MIDDLEWARE`.
* Endpoint phải yêu cầu role `MENTOR`.
* Mentor identity phải lấy từ `req.user.id`.
* Không được tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Mentor không được submit course của Mentor khác.
* Error response không được leak stack trace, JWT, cookie, database query hoặc secret.

**Data Integrity**

* Submit review phải nằm trong transaction.
* Revision snapshot phải đại diện cho dữ liệu course tại thời điểm submit.
* Không tạo partial revision nếu snapshot hoặc status update fail.
* Không cho submit course đang `published`, `pending_review`, `archived` hoặc status không hợp lệ.
* `revision_num` phải tăng đúng theo course.
* `snapshot_data` phải chứa đủ curriculum cần Manager review.

**Maintainability**

* Controller không chứa business logic.
* Service chịu trách nhiệm ownership, submit status, snapshot assembly, transaction orchestration.
* Repository là lớp duy nhất truy cập Prisma cho `courses`, `course_revisions`, `course_sections`, `lessons`, `lesson_assets`, `quizzes`, `quiz_questions`.
* `canEditCourse()` phải được export rõ ràng để Member E dùng.
* Không gộp Manager approval logic vào Member B.

**Performance**

* Snapshot query nên lấy curriculum bằng include/select hợp lý, tránh N+1 query không cần thiết.
* Transaction chỉ bao gồm các bước cần atomic: tạo revision và update course status.
* Không query payment/enrollment/learner data trong feature này.

**Testability**

* Test phải cover submit success, not found, not owned, published lock, pending review lock, archived lock, transaction rollback, snapshot completeness và `canEditCourse()` contract.
* Test phải trace về acceptance criteria.

## 5. Data Model

Feature này dùng các bảng sau:

### `courses`

| Field         | Type                 | Required | Ghi chú                      |
| ------------- | -------------------- | -------- | ---------------------------- |
| `id`          | CHAR(36) / UUID      | Yes      | Course id                    |
| `mentor_id`   | CHAR(36) / UUID      | Yes      | Owner của course             |
| `title`       | VARCHAR              | Yes      | Course metadata              |
| `description` | TEXT/LONGTEXT        | Optional | Course metadata              |
| `thumbnail`   | VARCHAR              | Optional | Course metadata              |
| `price`       | BIGINT               | Yes      | Course metadata              |
| `category`    | VARCHAR/ENUM theo DB | Optional | Course metadata              |
| `level`       | VARCHAR/ENUM theo DB | Optional | Course metadata              |
| `status`      | ENUM                 | Yes      | Dùng để check submit allowed |

### `course_revisions`

| Field            | Type            | Required | Ghi chú                          |
| ---------------- | --------------- | -------- | -------------------------------- |
| `id`             | CHAR(36) / UUID | Yes      | Revision id                      |
| `course_id`      | CHAR(36) / UUID | Yes      | FK tới `courses.id`              |
| `revision_num`   | INT             | Yes      | Số revision tăng dần theo course |
| `status`         | ENUM            | Yes      | `pending_review` khi submit      |
| `reject_comment` | TEXT            | Optional | Do Member E ghi khi reject       |
| `snapshot_data`  | JSON/LONGTEXT   | Yes      | Full curriculum snapshot         |
| `created_at`     | DATETIME        | Yes      | Tạo bởi database                 |
| `updated_at`     | DATETIME        | Optional | Cập nhật bởi database nếu có     |

### Snapshot data contents

`snapshot_data` phải chứa tối thiểu:

| Nhóm dữ liệu    | Nội dung                                                                       |
| --------------- | ------------------------------------------------------------------------------ |
| Course metadata | id, title, description, thumbnail, price, category, level                      |
| Sections        | id, title, order_index                                                         |
| Lessons         | id, section_id, type, title, content, order_index, is_required_complete nếu có |
| Lesson assets   | id, lesson_id, cloudinary_public_id, asset_type                                |
| Quizzes         | id, lesson_id, title, pass_score                                               |
| Quiz questions  | id, quiz_id, question, options_json, correct_answer, order_index               |

### Related tables read for snapshot

| Table             | Mục đích                      |
| ----------------- | ----------------------------- |
| `course_sections` | Lấy section trong course      |
| `lessons`         | Lấy lesson trong sections     |
| `lesson_assets`   | Lấy asset metadata của lesson |
| `quizzes`         | Lấy quiz gắn lesson           |
| `quiz_questions`  | Lấy questions gắn quiz        |

Status rules trong feature:

| Course Status    | Submit Review |
| ---------------- | ------------- |
| `draft`          | Yes           |
| `rejected`       | Yes           |
| `pending_review` | No            |
| `published`      | No            |
| `archived`       | No            |

## 6. Error Handling

| Case                                  | HTTP | Error Code                         | Message gợi ý                         |
| ------------------------------------- | ---- | ---------------------------------- | ------------------------------------- |
| Chưa đăng nhập                        | 401  | `UNAUTHORIZED`                     | Authentication required               |
| JWT hết hạn hoặc roleVersion mismatch | 401  | `TOKEN_REVOKED`                    | Token revoked or expired              |
| Role không phải Mentor                | 403  | `FORBIDDEN_ROLE`                   | Mentor role required                  |
| Params sai schema                     | 400  | `VALIDATION_ERROR`                 | Invalid request                       |
| `courseId` không tồn tại              | 404  | `COURSE_NOT_FOUND`                 | Course not found                      |
| Course không thuộc Mentor hiện tại    | 403  | `COURSE_NOT_OWNED`                 | Course is not owned by current mentor |
| Course đã published                   | 403  | `COURSE_LOCKED_PUBLISHED`          | Published course cannot be submitted  |
| Course đang pending review            | 409  | `COURSE_ALREADY_PENDING_REVIEW`    | Course is already pending review      |
| Course đã archived                    | 403  | `COURSE_ARCHIVED`                  | Archived course cannot be submitted   |
| Course status không submit được       | 403  | `COURSE_STATUS_NOT_SUBMITTABLE`    | Course status is not submittable      |
| Snapshot thiếu dữ liệu bắt buộc       | 400  | `INVALID_REVIEW_SNAPSHOT`          | Review snapshot is invalid            |
| Tạo revision thất bại                 | 500  | `COURSE_REVISION_CREATE_FAILED`    | Failed to create course revision      |
| Transaction thất bại                  | 500  | `SUBMIT_REVIEW_TRANSACTION_FAILED` | Failed to submit course review        |

Error response phải sanitize. Không trả stack trace, database query, JWT, cookie hoặc secret ra frontend.

## 7. Acceptance Criteria (Given-When-Then)

**AC-001 maps to FR-001, FR-002**
Given Mentor đã đăng nhập hợp lệ với role `MENTOR`, When Mentor gọi `POST /mentor/courses/:courseId/submit-review` với `courseId` đúng định dạng, Then request đi qua auth, role middleware và Zod validation.

**AC-002 maps to FR-003**
Given Mentor gọi submit review với `courseId` không tồn tại, When request được xử lý, Then hệ thống trả về HTTP 404 `COURSE_NOT_FOUND`.

**AC-003 maps to FR-004**
Given course X thuộc Mentor B, When Mentor A gọi `POST /mentor/courses/X/submit-review`, Then hệ thống trả về HTTP 403 `COURSE_NOT_OWNED`.

**AC-004 maps to FR-005**
Given course X thuộc Mentor A và có `status = published`, When Mentor A gọi submit review, Then hệ thống trả về HTTP 403 `COURSE_LOCKED_PUBLISHED`.

**AC-005 maps to FR-006**
Given course X thuộc Mentor A và có `status = pending_review`, When Mentor A gọi submit review, Then hệ thống trả về HTTP 409 `COURSE_ALREADY_PENDING_REVIEW`.

**AC-006 maps to FR-007**
Given course X thuộc Mentor A và có `status = archived`, When Mentor A gọi submit review, Then hệ thống trả về HTTP 403 `COURSE_ARCHIVED`.

**AC-007 maps to FR-008**
Given course X thuộc Mentor A nhưng status không thuộc `draft/rejected`, When Mentor A gọi submit review, Then hệ thống trả về HTTP 403 `COURSE_STATUS_NOT_SUBMITTABLE`.

**AC-008 maps to FR-009, FR-010**
Given course X thuộc Mentor A, status `draft`, và có sections/lessons/assets/quizzes/questions, When Mentor A submit review, Then hệ thống tạo `snapshot_data` chứa đầy đủ course metadata, sections, lessons, assets, quizzes và quiz questions.

**AC-009 maps to FR-011, FR-012**
Given course X chưa có revision nào, When Mentor A submit review thành công, Then hệ thống tạo `course_revisions` record với `revision_num = 1` và `status = pending_review`.

**AC-010 maps to FR-011, FR-012**
Given course X đã có revision trước đó, When Mentor A submit review lại từ status `rejected`, Then hệ thống tạo revision mới với `revision_num` tăng thêm 1.

**AC-011 maps to FR-013, FR-014**
Given course X submit review hợp lệ, When transaction thành công, Then hệ thống tạo revision `pending_review` và update `course.status = pending_review`; When một trong hai bước thất bại, Then toàn bộ transaction rollback và không còn partial state.

**AC-012 maps to FR-015, FR-016**
Given feature này được implement, When review route/service/repository, Then không có logic Manager publish/reject, public catalog, payment, enrollment hoặc learner access.

**AC-013 maps to FR-017, FR-018**
Given course X thuộc Mentor A và có status `draft`, When `canEditCourse(MentorA, X)` được gọi, Then hàm trả về `true`.

**AC-014 maps to FR-017, FR-019**
Given course X thuộc Mentor B, When `canEditCourse(MentorA, X)` được gọi, Then hàm trả về `false`.

**AC-015 maps to FR-017, FR-019**
Given course X thuộc Mentor A nhưng status `published`, When `canEditCourse(MentorA, X)` được gọi, Then hàm trả về `false`.

**AC-016 maps to FR-020**
Given một lỗi bất kỳ xảy ra trong submit review API, When response được trả về frontend, Then response không chứa stack trace, secret, JWT, cookie hoặc query nội bộ.

## 8. Out of Scope

Feature này không xử lý:

* Tạo/sửa/xóa course metadata.
* Tạo/sửa/xóa section.
* Tạo/sửa/xóa lesson.
* Upload lesson asset.
* Cloudinary upload signature.
* Tạo/sửa/xóa quiz.
* Tạo/sửa/xóa quiz question.
* Reorder section/lesson.
* Manager publish course.
* Manager reject course.
* Manager dashboard.
* Public catalog.
* Payment hoặc enrollment.
* Learner learning flow.
* Learner quiz submission.
* Rating/feedback.
* Admin user management.
* Migration/database schema change.
* Frontend implementation.

