# SPEC.md - feat-curriculum-builder

## 1. Context & Goal

Feature `feat-curriculum-builder` cho phép Mentor xây dựng curriculum cho course của mình thông qua CRUD section và lesson. Feature này là bước tiếp theo sau `feat-mentor-course-draft`, tạo nền cho các feature lesson assets, quiz authoring, reorder và submit review.

Mục tiêu chính:

* Mentor tạo section trong course của mình.
* Mentor xem chi tiết section thuộc course của mình.
* Mentor sửa section thuộc course của mình khi course còn editable.
* Mentor dùng DELETE section theo contract final sau khi hành vi xóa được human confirm.
* Mentor tạo lesson trong section thuộc course của mình.
* Mentor xem chi tiết lesson thuộc course của mình.
* Mentor sửa lesson thuộc course của mình khi course còn editable.
* Mentor dùng DELETE lesson theo contract final sau khi hành vi xóa được human confirm.
* Backend kiểm tra ownership qua `course.mentor_id === req.user.id`.
* Backend không cho sửa curriculum nếu course đã `published`.

## 2. Actors & Roles

| Actor                    | Role              | Quyền trong feature                                |
| ------------------------ | ----------------- | -------------------------------------------------- |
| Mentor                   | `MENTOR`          | CRUD section và lesson trong course do mình sở hữu |
| Member A Auth Middleware | System dependency | Xác thực JWT, roleVersion, role MENTOR             |
| Manager                  | Out of scope      | Không gọi API feature này                          |
| Learner                  | Out of scope      | Không gọi API feature này                          |
| Admin                    | Out of scope      | Không quản lý curriculum trong feature này         |

## 3. Functional Requirements (EARS Notation)

**FR-001:** WHEN Mentor gửi `POST /mentor/courses/:courseId/sections` với payload hợp lệ, THE system SHALL tạo section mới trong course nếu course tồn tại, thuộc Mentor hiện tại, và course status thuộc `draft` hoặc `rejected`.

**FR-002:** WHERE `courseId` không tồn tại, THE system SHALL trả về lỗi `COURSE_NOT_FOUND`.

**FR-003:** WHERE course tồn tại nhưng `course.mentor_id !== req.user.id`, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-004:** WHERE course có `status = published`, THE system SHALL từ chối tạo/sửa/xóa section hoặc lesson và trả về lỗi `COURSE_LOCKED_PUBLISHED`.

**FR-005:** WHERE course status không thuộc `draft` hoặc `rejected`, THE system SHALL từ chối thao tác ghi curriculum và trả về lỗi `COURSE_STATUS_NOT_EDITABLE`.

**FR-006:** WHEN Mentor gửi `GET /mentor/sections/:sectionId`, THE system SHALL trả về chi tiết section nếu section tồn tại và thuộc course của Mentor hiện tại.

**FR-007:** WHERE `sectionId` không tồn tại, THE system SHALL trả về lỗi `SECTION_NOT_FOUND`.

**FR-008:** WHERE section tồn tại nhưng thuộc course của Mentor khác, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-009:** WHEN Mentor gửi `PUT /mentor/sections/:sectionId` với payload hợp lệ, THE system SHALL cập nhật section nếu section thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-010:** WHEN Mentor gửi `DELETE /mentor/sections/:sectionId`, THE system SHALL tuân theo hành vi DELETE đã được human confirm dựa trên API/database final; THE system SHALL NOT hard delete section hoặc kích hoạt cascade khi chưa có xác nhận đó.

**FR-011:** WHEN Mentor gửi `POST /mentor/sections/:sectionId/lessons` với payload hợp lệ, THE system SHALL tạo lesson mới trong section nếu section thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-012:** WHEN Mentor gửi `GET /mentor/lessons/:lessonId`, THE system SHALL trả về chi tiết lesson nếu lesson tồn tại và thuộc course của Mentor hiện tại.

**FR-013:** WHERE `lessonId` không tồn tại, THE system SHALL trả về lỗi `LESSON_NOT_FOUND`.

**FR-014:** WHERE lesson tồn tại nhưng thuộc course của Mentor khác, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-015:** WHEN Mentor gửi `PUT /mentor/lessons/:lessonId` với payload hợp lệ, THE system SHALL cập nhật lesson nếu lesson thuộc course của Mentor hiện tại và course status thuộc `draft` hoặc `rejected`.

**FR-016:** WHEN Mentor gửi `DELETE /mentor/lessons/:lessonId`, THE system SHALL tuân theo hành vi DELETE đã được human confirm dựa trên API/database final; THE system SHALL NOT hard delete lesson hoặc kích hoạt cascade khi chưa có xác nhận đó.

**FR-017:** THE system SHALL validate mọi request body, params và query bằng Zod trước khi controller gọi service.

**FR-018:** THE system SHALL NOT expose stack trace, database query, JWT, cookie hoặc secret trong error response.

**FR-019:** THE system SHALL NOT implement quiz authoring, lesson asset upload, reorder hoặc submit review trong feature này.

**FR-020:** WHERE database final không có `deleted_at` hoặc status soft-delete cho `course_sections`/`lessons`, THE implementation SHALL require human confirmation before implementing DELETE persistence behavior.

**FR-021:** THE system SHALL NOT use delete cascade, `deleteMany`, delete/recreate, hoặc bất kỳ thao tác xóa nào để reorder, cleanup, hoặc chuẩn hóa curriculum.

**FR-022:** THE system SHALL treat section deletion as a high-risk operation because the final database defines `lessons.section_id -> course_sections.id` with `ON DELETE CASCADE`, which can remove lessons and dependent curriculum data.

**FR-023:** THE system SHALL keep all reorder behavior in `feat-course-reorder`; this feature SHALL NOT implement reorder as part of CRUD or delete cleanup.

## 4. Non-functional Requirements

**Security**

* Tất cả endpoint trong feature này phải đi qua `AUTH_MIDDLEWARE`.
* Tất cả endpoint phải yêu cầu role `MENTOR`.
* Mentor identity phải lấy từ `req.user.id`.
* Không được tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Mọi API section/lesson phải validate ownership qua course owner.
* Mentor không được xem/sửa/xóa section hoặc lesson thuộc course của Mentor khác.

**Data Integrity**

* Không cho tạo/sửa/xóa section/lesson trong course đã `published`.
* Không cho thao tác ghi curriculum nếu course không ở status `draft` hoặc `rejected`.
* Lesson type phải tuân theo database final.
* Không tạo quiz hoặc asset trong feature này.
* Không hard delete section/lesson khi chưa có human confirm về DELETE contract.
* Database final không có `deleted_at`/status soft-delete cho section/lesson; không được tự suy diễn hard delete là mặc định.
* Xóa section có thể cascade sang lessons, assets, quizzes và questions; mọi tác động phụ thuộc phải được xác nhận trước implementation.
* Không dùng cascade, delete/create hoặc cleanup bằng delete để reorder.

**Maintainability**

* Controller không chứa business logic.
* Service chịu trách nhiệm kiểm tra ownership, status và điều phối repository.
* Repository là lớp duy nhất truy cập Prisma cho `courses`, `course_sections`, `lessons`.
* Validator tách riêng bằng Zod.

**Performance**

* Query section/lesson detail phải include đủ relation để check ownership trong một số lượng query hợp lý.
* Không query toàn bộ course list để kiểm tra ownership.
* CRUD response nên trả object vừa tạo/cập nhật hoặc thông báo success theo response convention của project.

**Testability**

* Test phải cover ownership, not found, status lock, validation và CRUD success.
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

| Field         | Type            | Required | Ghi chú                     |
| ------------- | --------------- | -------- | --------------------------- |
| `id`          | CHAR(36) / UUID | Yes      | Section id                  |
| `course_id`   | CHAR(36) / UUID | Yes      | FK tới `courses.id`         |
| `title`       | VARCHAR         | Yes      | Tên section                 |
| `order_index` | INT             | Yes      | Thứ tự section trong course |
| `created_at`  | DATETIME        | Yes      | Tạo bởi database            |
| `updated_at`  | DATETIME        | Yes      | Cập nhật bởi database       |

### `lessons`

| Field                  | Type                 | Required | Ghi chú                                     |
| ---------------------- | -------------------- | -------- | ------------------------------------------- |
| `id`                   | CHAR(36) / UUID      | Yes      | Lesson id                                   |
| `section_id`           | CHAR(36) / UUID      | Yes      | FK tới `course_sections.id`                 |
| `type`                 | ENUM/VARCHAR theo DB | Yes      | Lesson type theo database final             |
| `title`                | VARCHAR              | Yes      | Tên lesson                                  |
| `content`              | TEXT/LONGTEXT        | Optional | Nội dung lesson/document metadata           |
| `order_index`          | INT                  | Yes      | Thứ tự lesson trong section                 |
| `is_required_complete` | BOOLEAN              | Optional | Dùng cho learning/progress về sau nếu DB có |
| `created_at`           | DATETIME             | Yes      | Tạo bởi database                            |
| `updated_at`           | DATETIME             | Yes      | Cập nhật bởi database                       |

Status rules trong feature:

| Course Status    | Được xem section/lesson | Được tạo/sửa/xóa section/lesson |
| ---------------- | ----------------------- | ------------------------------- |
| `draft`          | Yes                     | Yes                             |
| `rejected`       | Yes                     | Yes                             |
| `pending_review` | Open question           | No                              |
| `published`      | Yes                     | No                              |
| `archived`       | Open question           | No                              |

## 6. Error Handling

| Case                                  | HTTP | Error Code                   | Message gợi ý                         |
| ------------------------------------- | ---- | ---------------------------- | ------------------------------------- |
| Chưa đăng nhập                        | 401  | `UNAUTHORIZED`               | Authentication required               |
| JWT hết hạn hoặc roleVersion mismatch | 401  | `TOKEN_REVOKED`              | Token revoked or expired              |
| Role không phải Mentor                | 403  | `FORBIDDEN_ROLE`             | Mentor role required                  |
| Payload/params sai schema             | 400  | `VALIDATION_ERROR`           | Invalid request                       |
| `courseId` không tồn tại              | 404  | `COURSE_NOT_FOUND`           | Course not found                      |
| Course không thuộc Mentor hiện tại    | 403  | `COURSE_NOT_OWNED`           | Course is not owned by current mentor |
| Course đã published                   | 403  | `COURSE_LOCKED_PUBLISHED`    | Published course cannot be edited     |
| Course status không editable          | 403  | `COURSE_STATUS_NOT_EDITABLE` | Course status is not editable         |
| `sectionId` không tồn tại             | 404  | `SECTION_NOT_FOUND`          | Section not found                     |
| `lessonId` không tồn tại              | 404  | `LESSON_NOT_FOUND`           | Lesson not found                      |
| Lesson type không hợp lệ              | 400  | `INVALID_LESSON_TYPE`        | Lesson type is invalid                |

Error response phải được sanitize. Không trả stack trace, database query, JWT, cookie hoặc secret ra frontend.

## 7. Acceptance Criteria (Given-When-Then)

**AC-001 maps to FR-001, FR-002, FR-003**
Given Mentor A đã đăng nhập hợp lệ và có course X ở status `draft`, When Mentor A gọi `POST /mentor/courses/X/sections` với title hợp lệ, Then hệ thống trả về HTTP 201 và tạo section thuộc course X.

**AC-002 maps to FR-002**
Given Mentor A gọi `POST /mentor/courses/:courseId/sections` với courseId không tồn tại, When request được xử lý, Then hệ thống trả về HTTP 404 `COURSE_NOT_FOUND`.

**AC-003 maps to FR-003**
Given course X thuộc Mentor B, When Mentor A gọi `POST /mentor/courses/X/sections`, Then hệ thống trả về HTTP 403 `COURSE_NOT_OWNED`.

**AC-004 maps to FR-004**
Given course X thuộc Mentor A và có status `published`, When Mentor A gọi `POST /mentor/courses/X/sections`, Then hệ thống trả về HTTP 403 `COURSE_LOCKED_PUBLISHED`.

**AC-005 maps to FR-006, FR-007, FR-008**
Given section S thuộc course của Mentor A, When Mentor A gọi `GET /mentor/sections/S`, Then hệ thống trả về HTTP 200 và section detail. If section không tồn tại, Then trả `SECTION_NOT_FOUND`. If section thuộc Mentor khác, Then trả `COURSE_NOT_OWNED`.

**AC-006 maps to FR-009**
Given section S thuộc course của Mentor A và course status `draft`, When Mentor A gọi `PUT /mentor/sections/S` với title hợp lệ, Then hệ thống cập nhật section và trả HTTP 200.

**AC-007 maps to FR-010, FR-020, FR-022**
Given database final chưa có soft-delete field và human chưa confirm hành vi DELETE section, When implementation được review, Then không có hard delete/cascade section được implement.

**AC-008 maps to FR-011**
Given section S thuộc course của Mentor A và course status `draft`, When Mentor A gọi `POST /mentor/sections/S/lessons` với payload hợp lệ, Then hệ thống tạo lesson mới thuộc section S và trả HTTP 201.

**AC-009 maps to FR-012, FR-013, FR-014**
Given lesson L thuộc course của Mentor A, When Mentor A gọi `GET /mentor/lessons/L`, Then hệ thống trả về HTTP 200 và lesson detail. If lesson không tồn tại, Then trả `LESSON_NOT_FOUND`. If lesson thuộc Mentor khác, Then trả `COURSE_NOT_OWNED`.

**AC-010 maps to FR-015**
Given lesson L thuộc course của Mentor A và course status `rejected`, When Mentor A gọi `PUT /mentor/lessons/L` với payload hợp lệ, Then hệ thống cập nhật lesson và trả HTTP 200.

**AC-011 maps to FR-016, FR-020**
Given database final chưa có soft-delete field và human chưa confirm hành vi DELETE lesson, When implementation được review, Then không có hard delete/cascade lesson được implement.

**AC-012 maps to FR-017**
Given Mentor gửi payload tạo lesson thiếu title hoặc type không hợp lệ, When request được validate, Then hệ thống trả về HTTP 400 `VALIDATION_ERROR` hoặc `INVALID_LESSON_TYPE`.

**AC-013 maps to FR-018**
Given một lỗi bất kỳ xảy ra trong API section/lesson, When response được trả về frontend, Then response không chứa stack trace, secret, JWT, cookie hoặc query nội bộ.

**AC-014 maps to FR-019**
Given feature này được implement, When review scope task, Then không có endpoint hoặc code xử lý quiz authoring, lesson asset upload, reorder hoặc submit review.

**AC-015 maps to FR-021, FR-023**
Given curriculum cần đổi thứ tự hoặc cleanup `order_index`, When review service/repository, Then không có `deleteMany`, delete/recreate hoặc cascade delete; reorder được để lại cho `feat-course-reorder`.

**AC-016 maps to FR-022**
Given section S có lessons và dữ liệu phụ thuộc, When human chưa xác nhận rõ tác động cascade, Then implementation không được xóa section S.

## 8. Out of Scope

Feature này không xử lý:

* Tạo/sửa/xóa course metadata.
* Upload lesson asset.
* Cloudinary upload signature.
* Tạo/sửa/xóa quiz.
* Tạo/sửa/xóa quiz question.
* Reorder toàn bộ course.
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

