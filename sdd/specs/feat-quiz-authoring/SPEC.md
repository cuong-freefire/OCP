# SPEC.md - feat-quiz-authoring

## 1. Context & Goal

Feature `feat-quiz-authoring` cho phép Mentor tạo và quản lý quiz/question trong course của mình. Feature này nằm trong Member B - Mentor Course Studio, sau khi course/section/lesson đã được tạo ở các feature trước.

Mục tiêu chính:

* Mentor tạo quiz cho lesson thuộc course của mình.
* Mentor xem chi tiết quiz thuộc course của mình.
* Mentor sửa quiz thuộc course của mình khi course còn editable.
* Mentor xóa quiz thuộc course của mình theo API final.
* Mentor tạo question trong quiz thuộc course của mình.
* Mentor xem chi tiết question thuộc course của mình.
* Mentor sửa question thuộc course của mình khi course còn editable.
* Mentor xóa question thuộc course của mình theo API final.
* Backend validate `options_json` và `correct_answer` theo schema.
* Backend không tạo bảng `quiz_options`.
* Backend không xử lý learner quiz submission.

## 2. Actors & Roles

| Actor                    | Role                  | Quyền trong feature                                          |
| ------------------------ | --------------------- | ------------------------------------------------------------ |
| Mentor                   | `MENTOR`              | CRUD quiz và quiz question trong course do mình sở hữu       |
| Member A Auth Middleware | System dependency     | Xác thực JWT, roleVersion, role MENTOR                       |
| Member D                 | Downstream dependency | Sử dụng quiz/questions cho learner submission ở feature khác |
| Manager                  | Out of scope          | Không gọi API feature này                                    |
| Learner                  | Out of scope          | Không gọi API feature này                                    |
| Admin                    | Out of scope          | Không quản lý quiz authoring trong feature này               |

## 3. Functional Requirements (EARS Notation)

**FR-001:** WHEN Mentor gửi `POST /mentor/lessons/:lessonId/quizzes` với payload hợp lệ, THE system SHALL tạo quiz mới cho lesson nếu lesson tồn tại, thuộc course của Mentor hiện tại, và course status thuộc `draft` hoặc `rejected`.

**FR-002:** WHERE `lessonId` không tồn tại, THE system SHALL trả về lỗi `LESSON_NOT_FOUND`.

**FR-003:** WHERE lesson tồn tại nhưng `lesson.section.course.mentor_id !== req.user.id`, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-004:** WHERE course có `status = published`, THE system SHALL từ chối tạo/sửa/xóa quiz hoặc question và trả về lỗi `COURSE_LOCKED_PUBLISHED`.

**FR-005:** WHERE course status không thuộc `draft` hoặc `rejected`, THE system SHALL từ chối thao tác ghi quiz/question và trả về lỗi `COURSE_STATUS_NOT_EDITABLE`.

**FR-006:** WHEN Mentor gửi `GET /mentor/quizzes/:quizId`, THE system SHALL trả về chi tiết quiz nếu quiz tồn tại và thuộc course của Mentor hiện tại.

**FR-007:** WHERE `quizId` không tồn tại, THE system SHALL trả về lỗi `QUIZ_NOT_FOUND`.

**FR-008:** WHERE quiz tồn tại nhưng thuộc course của Mentor khác, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-009:** WHEN Mentor gửi `PUT /mentor/quizzes/:quizId` với payload hợp lệ, THE system SHALL cập nhật quiz nếu quiz thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-010:** WHEN Mentor gửi `DELETE /mentor/quizzes/:quizId`, THE system SHALL xóa quiz theo API final nếu quiz thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-011:** WHEN Mentor gửi `POST /mentor/quizzes/:quizId/questions` với payload hợp lệ, THE system SHALL tạo question mới trong quiz nếu quiz thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-012:** WHEN Mentor gửi `GET /mentor/questions/:questionId`, THE system SHALL trả về chi tiết question nếu question tồn tại và thuộc course của Mentor hiện tại.

**FR-013:** WHERE `questionId` không tồn tại, THE system SHALL trả về lỗi `QUESTION_NOT_FOUND`.

**FR-014:** WHERE question tồn tại nhưng thuộc course của Mentor khác, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-015:** WHEN Mentor gửi `PUT /mentor/questions/:questionId` với payload hợp lệ, THE system SHALL cập nhật question nếu question thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-016:** WHEN Mentor gửi `DELETE /mentor/questions/:questionId`, THE system SHALL xóa question theo API final nếu question thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-017:** THE system SHALL validate `options_json` bằng Zod hoặc validator tương đương trước khi tạo/cập nhật question.

**FR-018:** THE system SHALL validate `correct_answer` bằng Zod hoặc validator tương đương trước khi tạo/cập nhật question.

**FR-019:** WHERE `options_json` không hợp lệ, THE system SHALL trả về lỗi `INVALID_OPTIONS_JSON`.

**FR-020:** WHERE `correct_answer` không hợp lệ hoặc không khớp với options, THE system SHALL trả về lỗi `INVALID_CORRECT_ANSWER`.

**FR-021:** THE system SHALL NOT create or require bảng `quiz_options` trong feature này.

**FR-022:** THE system SHALL NOT implement learner quiz submission, quiz scoring, quiz result hoặc progress trong feature này.

**FR-023:** THE system SHALL validate mọi request body, params và query bằng Zod trước khi controller gọi service.

**FR-024:** THE system SHALL NOT expose stack trace, database query, JWT, cookie hoặc secret trong error response.

**FR-025:** WHERE API_CATALOG.md và database.md không quy định lesson type eligibility cho quiz, THE system SHALL NOT block quiz creation based on `lessons.type`.

## 4. Non-functional Requirements

**Security**

* Tất cả endpoint trong feature này phải đi qua `AUTH_MIDDLEWARE`.
* Tất cả endpoint phải yêu cầu role `MENTOR`.
* Mentor identity phải lấy từ `req.user.id`.
* Không được tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Mọi API quiz/question phải validate ownership qua course owner.
* Mentor không được xem/sửa/xóa quiz hoặc question thuộc course của Mentor khác.
* Learner-facing APIs không thuộc feature này và không được expose `correct_answer` cho Learner.

**Data Integrity**

* Không cho tạo/sửa/xóa quiz/question trong course đã `published`.
* Không cho thao tác ghi quiz/question nếu course không ở status `draft` hoặc `rejected`.
* `options_json` phải đúng schema.
* `correct_answer` phải đúng schema và khớp options.
* Không tạo bảng `quiz_options`.
* Không tự thay đổi lesson/section/course metadata trong feature này.
* Không áp đặt rule lesson type nào được tạo quiz khi source of truth final không quy định.

**Maintainability**

* Controller không chứa business logic.
* Service chịu trách nhiệm kiểm tra ownership, status, JSON validation nghiệp vụ và điều phối repository.
* Repository là lớp duy nhất truy cập Prisma cho `quizzes`, `quiz_questions` và relation ownership.
* Validator tách riêng bằng Zod.
* Quiz authoring không được gộp với learner submission.

**Performance**

* Query quiz/question detail phải include đủ relation để check ownership trong số lượng query hợp lý.
* Không query toàn bộ curriculum để check ownership.
* CRUD response nên trả object vừa tạo/cập nhật hoặc thông báo success theo response convention của project.

**Testability**

* Test phải cover ownership, not found, status lock, invalid JSON, invalid answer, CRUD success và scope không lan sang learner submission.
* Test phải trace về acceptance criteria.

## 5. Data Model

Feature này dùng các bảng sau:

### `courses`

| Field       | Type            | Required | Ghi chú                |
| ----------- | --------------- | -------- | ---------------------- |
| `id`        | CHAR(36) / UUID | Yes      | Course id              |
| `mentor_id` | CHAR(36) / UUID | Yes      | Owner của course       |
| `status`    | ENUM            | Yes      | Dùng để check editable |

### `course_sections`

| Field       | Type            | Required | Ghi chú             |
| ----------- | --------------- | -------- | ------------------- |
| `id`        | CHAR(36) / UUID | Yes      | Section id          |
| `course_id` | CHAR(36) / UUID | Yes      | FK tới `courses.id` |

### `lessons`

| Field        | Type                 | Required | Ghi chú                         |
| ------------ | -------------------- | -------- | ------------------------------- |
| `id`         | CHAR(36) / UUID      | Yes      | Lesson id                       |
| `section_id` | CHAR(36) / UUID      | Yes      | FK tới `course_sections.id`     |
| `type`       | ENUM/VARCHAR theo DB | Yes      | Lesson type theo database final |
| `title`      | VARCHAR              | Yes      | Tên lesson                      |

### `quizzes`

| Field        | Type                | Required | Ghi chú                              |
| ------------ | ------------------- | -------- | ------------------------------------ |
| `id`         | CHAR(36) / UUID     | Yes      | Quiz id                              |
| `lesson_id`  | CHAR(36) / UUID     | Yes      | FK tới `lessons.id`                  |
| `title`      | VARCHAR             | Yes      | Tên quiz                             |
| `pass_score` | INT/DECIMAL theo DB | Optional | Điểm đạt yêu cầu theo database final |
| `created_at` | DATETIME            | Yes      | Tạo bởi database                     |
| `updated_at` | DATETIME            | Yes      | Cập nhật bởi database                |

### `quiz_questions`

| Field            | Type              | Required | Ghi chú                         |
| ---------------- | ----------------- | -------- | ------------------------------- |
| `id`             | CHAR(36) / UUID   | Yes      | Question id                     |
| `quiz_id`        | CHAR(36) / UUID   | Yes      | FK tới `quizzes.id`             |
| `question`       | TEXT/VARCHAR      | Yes      | Nội dung câu hỏi                |
| `options_json`   | JSON/TEXT theo DB | Yes      | Danh sách options               |
| `correct_answer` | JSON/TEXT theo DB | Yes      | Đáp án đúng dùng cho auto-grade |
| `order_index`    | INT               | Yes      | Thứ tự câu hỏi trong quiz       |
| `created_at`     | DATETIME          | Yes      | Tạo bởi database                |
| `updated_at`     | DATETIME          | Yes      | Cập nhật bởi database           |

Status rules trong feature:

| Course Status    | Được xem quiz/question | Được tạo/sửa/xóa quiz/question |
| ---------------- | ---------------------- | ------------------------------ |
| `draft`          | Yes                    | Yes                            |
| `rejected`       | Yes                    | Yes                            |
| `pending_review` | Open question          | No                             |
| `published`      | Yes                    | No                             |
| `archived`       | Open question          | No                             |

## 6. Error Handling

| Case                                                            | HTTP | Error Code                   | Message gợi ý                           |
| --------------------------------------------------------------- | ---- | ---------------------------- | --------------------------------------- |
| Chưa đăng nhập                                                  | 401  | `UNAUTHORIZED`               | Authentication required                 |
| JWT hết hạn hoặc roleVersion mismatch                           | 401  | `TOKEN_REVOKED`              | Token revoked or expired                |
| Role không phải Mentor                                          | 403  | `FORBIDDEN_ROLE`             | Mentor role required                    |
| Payload/params sai schema                                       | 400  | `VALIDATION_ERROR`           | Invalid request                         |
| `lessonId` không tồn tại                                        | 404  | `LESSON_NOT_FOUND`           | Lesson not found                        |
| `quizId` không tồn tại                                          | 404  | `QUIZ_NOT_FOUND`             | Quiz not found                          |
| `questionId` không tồn tại                                      | 404  | `QUESTION_NOT_FOUND`         | Question not found                      |
| Resource thuộc course của Mentor khác                           | 403  | `COURSE_NOT_OWNED`           | Resource is not owned by current mentor |
| Course đã published                                             | 403  | `COURSE_LOCKED_PUBLISHED`    | Published course cannot be edited       |
| Course status không editable                                    | 403  | `COURSE_STATUS_NOT_EDITABLE` | Course status is not editable           |
| `options_json` không hợp lệ                                     | 400  | `INVALID_OPTIONS_JSON`       | Options JSON is invalid                 |
| `correct_answer` không hợp lệ                                   | 400  | `INVALID_CORRECT_ANSWER`     | Correct answer is invalid               |
Error response phải được sanitize. Không trả stack trace, database query, JWT, cookie hoặc secret ra frontend.

## 7. Acceptance Criteria (Given-When-Then)

**AC-001 maps to FR-001, FR-002, FR-003**
Given Mentor A đã đăng nhập hợp lệ và có lesson L trong course status `draft`, When Mentor A gọi `POST /mentor/lessons/L/quizzes` với payload hợp lệ, Then hệ thống trả về HTTP 201 và tạo quiz thuộc lesson L.

**AC-002 maps to FR-002**
Given Mentor gọi `POST /mentor/lessons/:lessonId/quizzes` với lessonId không tồn tại, When request được xử lý, Then hệ thống trả về HTTP 404 `LESSON_NOT_FOUND`.

**AC-003 maps to FR-003**
Given lesson L thuộc course của Mentor B, When Mentor A gọi `POST /mentor/lessons/L/quizzes`, Then hệ thống trả về HTTP 403 `COURSE_NOT_OWNED`.

**AC-004 maps to FR-004**
Given lesson L thuộc course của Mentor A và course status `published`, When Mentor A gọi `POST /mentor/lessons/L/quizzes`, Then hệ thống trả về HTTP 403 `COURSE_LOCKED_PUBLISHED`.

**AC-005 maps to FR-006, FR-007, FR-008**
Given quiz Q thuộc course của Mentor A, When Mentor A gọi `GET /mentor/quizzes/Q`, Then hệ thống trả về HTTP 200 và quiz detail. If quiz không tồn tại, Then trả `QUIZ_NOT_FOUND`. If quiz thuộc Mentor khác, Then trả `COURSE_NOT_OWNED`.

**AC-006 maps to FR-009**
Given quiz Q thuộc course của Mentor A và course status `draft`, When Mentor A gọi `PUT /mentor/quizzes/Q` với payload hợp lệ, Then hệ thống cập nhật quiz và trả HTTP 200.

**AC-007 maps to FR-010**
Given quiz Q thuộc course của Mentor A và course status `draft`, When Mentor A gọi `DELETE /mentor/quizzes/Q`, Then hệ thống xóa quiz theo API final và trả HTTP 200.

**AC-008 maps to FR-011, FR-017, FR-018**
Given quiz Q thuộc course của Mentor A và course status `draft`, When Mentor A gọi `POST /mentor/quizzes/Q/questions` với `question`, `options_json`, `correct_answer` hợp lệ, Then hệ thống tạo question mới và trả HTTP 201.

**AC-009 maps to FR-012, FR-013, FR-014**
Given question N thuộc course của Mentor A, When Mentor A gọi `GET /mentor/questions/N`, Then hệ thống trả về HTTP 200 và question detail. If question không tồn tại, Then trả `QUESTION_NOT_FOUND`. If question thuộc Mentor khác, Then trả `COURSE_NOT_OWNED`.

**AC-010 maps to FR-015, FR-017, FR-018**
Given question N thuộc course của Mentor A và course status `rejected`, When Mentor A gọi `PUT /mentor/questions/N` với payload hợp lệ, Then hệ thống cập nhật question và trả HTTP 200.

**AC-011 maps to FR-016**
Given question N thuộc course của Mentor A và course status `draft`, When Mentor A gọi `DELETE /mentor/questions/N`, Then hệ thống xóa question theo API final và trả HTTP 200.

**AC-012 maps to FR-019**
Given Mentor gửi `options_json` sai format, When request tạo/cập nhật question được validate, Then hệ thống trả về HTTP 400 `INVALID_OPTIONS_JSON` hoặc `VALIDATION_ERROR`.

**AC-013 maps to FR-020**
Given Mentor gửi `correct_answer` không khớp với options, When request tạo/cập nhật question được validate, Then hệ thống trả về HTTP 400 `INVALID_CORRECT_ANSWER`.

**AC-014 maps to FR-021**
Given feature này được implement, When review database/task/code scope, Then không có task hoặc code tạo bảng `quiz_options`.

**AC-015 maps to FR-022**
Given feature này được implement, When review route/controller/service, Then không có endpoint hoặc logic learner quiz submission, scoring, result hoặc progress.

**AC-016 maps to FR-023, FR-024**
Given một lỗi bất kỳ xảy ra trong API quiz/question, When response được trả về frontend, Then response không chứa stack trace, secret, JWT, cookie hoặc query nội bộ.

**AC-017 maps to FR-001, FR-025**
Given lesson L tồn tại, thuộc course editable của Mentor và có bất kỳ `lessons.type` hợp lệ theo database final, When Mentor tạo quiz cho L, Then hệ thống không từ chối chỉ vì lesson type.

## 8. Out of Scope

Feature này không xử lý:

* Tạo/sửa/xóa course metadata.
* Tạo/sửa/xóa section.
* Tạo/sửa/xóa lesson.
* Upload lesson asset.
* Cloudinary upload signature.
* Reorder section/lesson.
* Submit course review.
* Tạo `course_revisions`.
* Manager publish/reject.
* Public catalog.
* Payment hoặc enrollment.
* Learner learning flow.
* Learner quiz submission.
* Quiz scoring/result/progress.
* Rating/feedback.
* Admin user management.
* Tạo bảng `quiz_options`.
* Migration/database schema change.
* Frontend implementation.

