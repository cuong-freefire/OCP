# SPEC.md - feat-course-reorder

## 1. Context & Goal

Feature `feat-course-reorder` cho phép Mentor sắp xếp lại thứ tự section và lesson trong course của mình thông qua API `PUT /mentor/courses/:courseId/reorder`.

Mục tiêu chính:

* Mentor reorder section trong course của mình.
* Mentor reorder lesson trong section thuộc course của mình.
* Backend kiểm tra course ownership bằng `course.mentor_id === req.user.id`.
* Backend chỉ cho reorder khi course status thuộc `draft` hoặc `rejected`.
* Backend khóa reorder khi course đã `published`.
* Backend thực hiện reorder an toàn bằng transaction và update loop.
* Backend tuyệt đối không dùng delete/create để reorder.
* Backend không làm mất `quizzes`, `quiz_questions`, `lesson_assets` hoặc dữ liệu liên quan.

## 2. Actors & Roles

| Actor                    | Role              | Quyền trong feature                                |
| ------------------------ | ----------------- | -------------------------------------------------- |
| Mentor                   | `MENTOR`          | Reorder section/lesson trong course do mình sở hữu |
| Member A Auth Middleware | System dependency | Xác thực JWT, roleVersion, role MENTOR             |
| Member B                 | Module owner      | Bảo vệ dữ liệu curriculum khi reorder              |
| Manager                  | Out of scope      | Không gọi API feature này                          |
| Learner                  | Out of scope      | Không gọi API feature này                          |
| Admin                    | Out of scope      | Không quản lý reorder trong feature này            |

## 3. Functional Requirements (EARS Notation)

**FR-001:** WHEN Mentor gửi `PUT /mentor/courses/:courseId/reorder`, THE system SHALL authenticate request bằng `AUTH_MIDDLEWARE` và yêu cầu role `MENTOR`.

**FR-002:** WHEN request chứa `courseId` và reorder payload, THE system SHALL validate params và request body bằng Zod trước khi controller gọi service.

**FR-003:** WHERE `courseId` không tồn tại, THE system SHALL trả về lỗi `COURSE_NOT_FOUND`.

**FR-004:** WHERE course tồn tại nhưng `course.mentor_id !== req.user.id`, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-005:** WHERE course có `status = published`, THE system SHALL từ chối reorder và trả về lỗi `COURSE_LOCKED_PUBLISHED`.

**FR-006:** WHERE course status không thuộc `draft` hoặc `rejected`, THE system SHALL từ chối reorder và trả về lỗi `COURSE_STATUS_NOT_EDITABLE`.

**FR-007:** WHEN payload chứa danh sách section reorder, THE system SHALL kiểm tra tất cả section id tồn tại và thuộc `courseId` hiện tại.

**FR-008:** WHERE bất kỳ section id nào trong payload không tồn tại, THE system SHALL trả về lỗi `SECTION_NOT_FOUND`.

**FR-009:** WHERE bất kỳ section id nào trong payload không thuộc course hiện tại, THE system SHALL trả về lỗi `SECTION_NOT_IN_COURSE`.

**FR-010:** WHEN payload chứa danh sách lesson reorder, THE system SHALL kiểm tra tất cả lesson id tồn tại và thuộc section/course hợp lệ trong course hiện tại.

**FR-011:** WHERE bất kỳ lesson id nào trong payload không tồn tại, THE system SHALL trả về lỗi `LESSON_NOT_FOUND`.

**FR-012:** WHERE bất kỳ lesson id nào trong payload không thuộc course hiện tại, THE system SHALL trả về lỗi `LESSON_NOT_IN_COURSE`.

**FR-013:** WHEN reorder payload hợp lệ, THE system SHALL execute reorder trong một database transaction.

**FR-014:** THE system SHALL update từng record `course_sections.order_index` bằng update loop, không dùng `deleteMany`, `delete`, hoặc recreate section.

**FR-015:** THE system SHALL update từng record `lessons.order_index` bằng update loop, không dùng `deleteMany`, `delete`, hoặc recreate lesson.

**FR-016:** IF bất kỳ update nào trong transaction thất bại, THEN THE system SHALL rollback toàn bộ transaction và giữ nguyên thứ tự cũ.

**FR-017:** THE system SHALL NOT delete or recreate `course_sections`, `lessons`, `quizzes`, `quiz_questions`, hoặc `lesson_assets` trong feature này.

**FR-018:** WHEN reorder thành công, THE system SHALL trả về HTTP 200 cùng success response và/hoặc curriculum order mới theo response convention của project.

**FR-019:** WHERE payload có `order_index` trùng, thiếu, âm, bằng 0 hoặc không phải integer, THE system SHALL trả về lỗi `INVALID_REORDER_PAYLOAD`.

**FR-020:** THE system SHALL return sanitized error response without stack trace, database query, JWT, cookie hoặc secret.

## 4. Non-functional Requirements

**Security**

* Endpoint phải đi qua `AUTH_MIDDLEWARE`.
* Endpoint phải yêu cầu role `MENTOR`.
* Mentor identity phải lấy từ `req.user.id`.
* Không được tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Mentor không được reorder course của Mentor khác.
* Payload id phải được validate ownership trước transaction update.

**Data Integrity**

* Reorder không được hard delete hoặc recreate section/lesson.
* Reorder không được làm mất `quizzes`, `quiz_questions`, `lesson_assets`.
* Reorder phải nằm trong transaction.
* Nếu có bất kỳ item không thuộc course hiện tại, toàn bộ reorder phải fail.
* `order_index` phải là integer hợp lệ.
* Course `published` không được reorder.
* Course không thuộc `draft/rejected` không được reorder.

**Maintainability**

* Controller không chứa business logic.
* Service chịu trách nhiệm validate ownership, editable status, payload consistency và transaction orchestration.
* Repository là lớp duy nhất truy cập Prisma cho course/sections/lessons.
* Reorder logic phải được tách rõ để tránh tái sử dụng nhầm pattern delete/create.

**Performance**

* Ownership validation nên query theo `courseId` và danh sách ids trong payload, không query toàn bộ curriculum không cần thiết.
* Transaction chỉ update các record có trong payload.
* Payload nên giới hạn số lượng item hợp lý nếu project có rule limit.

**Testability**

* Test phải cover success reorder, ownership fail, published lock, invalid payload, rollback, và kiểm tra không mất quiz/assets sau reorder.
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
| `order_index` | INT             | Yes      | Thứ tự section trong course |
| `title`       | VARCHAR         | Yes      | Không sửa trong feature này |

### `lessons`

| Field         | Type                 | Required | Ghi chú                     |
| ------------- | -------------------- | -------- | --------------------------- |
| `id`          | CHAR(36) / UUID      | Yes      | Lesson id                   |
| `section_id`  | CHAR(36) / UUID      | Yes      | FK tới `course_sections.id` |
| `order_index` | INT                  | Yes      | Thứ tự lesson trong section |
| `title`       | VARCHAR              | Yes      | Không sửa trong feature này |
| `type`        | ENUM/VARCHAR theo DB | Yes      | Không sửa trong feature này |

### Related data protected by this feature

| Table            | Lý do cần bảo vệ                             |
| ---------------- | -------------------------------------------- |
| `lesson_assets`  | Phụ thuộc lesson; không được mất khi reorder |
| `quizzes`        | Phụ thuộc lesson; không được mất khi reorder |
| `quiz_questions` | Phụ thuộc quiz; không được mất khi reorder   |

**Proposed payload only, cần human confirm trước implementation** vì `API_CATALOG.md` chưa chốt format payload chi tiết:

```json
{
  "sections": [
    { "id": "section-id-1", "orderIndex": 1 },
    { "id": "section-id-2", "orderIndex": 2 }
  ],
  "lessons": [
    { "id": "lesson-id-1", "sectionId": "section-id-1", "orderIndex": 1 },
    { "id": "lesson-id-2", "sectionId": "section-id-1", "orderIndex": 2 }
  ]
}
```

Payload chính thức phải được human confirm và theo API final của team trước implementation.

## 6. Error Handling

| Case                                  | HTTP | Error Code                   | Message gợi ý                         |
| ------------------------------------- | ---- | ---------------------------- | ------------------------------------- |
| Chưa đăng nhập                        | 401  | `UNAUTHORIZED`               | Authentication required               |
| JWT hết hạn hoặc roleVersion mismatch | 401  | `TOKEN_REVOKED`              | Token revoked or expired              |
| Role không phải Mentor                | 403  | `FORBIDDEN_ROLE`             | Mentor role required                  |
| Params/body sai schema                | 400  | `VALIDATION_ERROR`           | Invalid request                       |
| Payload reorder sai format            | 400  | `INVALID_REORDER_PAYLOAD`    | Reorder payload is invalid            |
| `courseId` không tồn tại              | 404  | `COURSE_NOT_FOUND`           | Course not found                      |
| Course không thuộc Mentor hiện tại    | 403  | `COURSE_NOT_OWNED`           | Course is not owned by current mentor |
| Course đã published                   | 403  | `COURSE_LOCKED_PUBLISHED`    | Published course cannot be edited     |
| Course status không editable          | 403  | `COURSE_STATUS_NOT_EDITABLE` | Course status is not editable         |
| Section không tồn tại                 | 404  | `SECTION_NOT_FOUND`          | Section not found                     |
| Section không thuộc course hiện tại   | 400  | `SECTION_NOT_IN_COURSE`      | Section does not belong to course     |
| Lesson không tồn tại                  | 404  | `LESSON_NOT_FOUND`           | Lesson not found                      |
| Lesson không thuộc course hiện tại    | 400  | `LESSON_NOT_IN_COURSE`       | Lesson does not belong to course      |
| Transaction fail                      | 500  | `REORDER_TRANSACTION_FAILED` | Failed to reorder course curriculum   |

Error response phải sanitize. Không trả stack trace, database query, JWT, cookie hoặc secret ra frontend.

## 7. Acceptance Criteria (Given-When-Then)

**AC-001 maps to FR-001, FR-002**
Given Mentor đã đăng nhập hợp lệ với role `MENTOR`, When Mentor gọi `PUT /mentor/courses/:courseId/reorder` với params/body hợp lệ, Then request đi qua auth, role middleware và Zod validation.

**AC-002 maps to FR-003**
Given Mentor gọi reorder với `courseId` không tồn tại, When request được xử lý, Then hệ thống trả về HTTP 404 `COURSE_NOT_FOUND`.

**AC-003 maps to FR-004**
Given course X thuộc Mentor B, When Mentor A gọi `PUT /mentor/courses/X/reorder`, Then hệ thống trả về HTTP 403 `COURSE_NOT_OWNED`.

**AC-004 maps to FR-005**
Given course X thuộc Mentor A và có `status = published`, When Mentor A gọi reorder, Then hệ thống trả về HTTP 403 `COURSE_LOCKED_PUBLISHED`.

**AC-005 maps to FR-006**
Given course X thuộc Mentor A và có `status = pending_review`, When Mentor A gọi reorder, Then hệ thống trả về HTTP 403 `COURSE_STATUS_NOT_EDITABLE`.

**AC-006 maps to FR-007, FR-008, FR-009**
Given course X thuộc Mentor A, When Mentor A gửi payload reorder chứa section id không tồn tại hoặc không thuộc course X, Then hệ thống trả lỗi tương ứng `SECTION_NOT_FOUND` hoặc `SECTION_NOT_IN_COURSE`.

**AC-007 maps to FR-010, FR-011, FR-012**
Given course X thuộc Mentor A, When Mentor A gửi payload reorder chứa lesson id không tồn tại hoặc không thuộc course X, Then hệ thống trả lỗi tương ứng `LESSON_NOT_FOUND` hoặc `LESSON_NOT_IN_COURSE`.

**AC-008 maps to FR-013, FR-014, FR-015, FR-018**
Given course X thuộc Mentor A và có status `draft`, When Mentor A gửi payload reorder hợp lệ, Then hệ thống update `order_index` của sections/lessons trong transaction và trả HTTP 200.

**AC-009 maps to FR-016**
Given reorder payload hợp lệ nhưng một update trong transaction thất bại, When request được xử lý, Then toàn bộ transaction rollback và thứ tự cũ vẫn được giữ nguyên.

**AC-010 maps to FR-017**
Given course X có lessons gắn `quizzes`, `quiz_questions`, và `lesson_assets`, When Mentor reorder section/lesson thành công, Then các record `quizzes`, `quiz_questions`, `lesson_assets` vẫn còn và vẫn liên kết đúng lesson.

**AC-011 maps to FR-019**
Given Mentor gửi payload có `orderIndex` trùng, âm, bằng 0 hoặc không phải integer, When request được validate, Then hệ thống trả HTTP 400 `INVALID_REORDER_PAYLOAD`.

**AC-012 maps to FR-020**
Given một lỗi bất kỳ xảy ra trong endpoint reorder, When response được trả về frontend, Then response không chứa stack trace, secret, JWT, cookie hoặc query nội bộ.

**AC-013 maps to FR-014, FR-015, FR-017**
Given feature này được implement, When review service/repository/tasks, Then không có logic `deleteMany`, `delete` rồi `create`, hoặc recreate section/lesson để reorder.

## 8. Out of Scope

Feature này không xử lý:

* Tạo/sửa/xóa course metadata.
* Tạo/sửa/xóa section content.
* Tạo/sửa/xóa lesson content.
* Upload lesson asset.
* Cloudinary upload signature.
* Tạo/sửa/xóa quiz.
* Tạo/sửa/xóa quiz question.
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
* Hard delete hoặc recreate curriculum để reorder.

