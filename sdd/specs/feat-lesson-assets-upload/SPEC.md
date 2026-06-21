# SPEC.md - feat-lesson-assets-upload

## 1. Context & Goal

Feature `feat-lesson-assets-upload` cung cấp endpoint để Mentor lấy Cloudinary upload signature cho lesson thuộc course của mình. Backend không nhận file upload trực tiếp, không expose Cloudinary secret, và không cấp signature nếu Mentor không sở hữu lesson.

Mục tiêu chính:

* Mentor lấy upload signature cho lesson của mình.
* Backend kiểm tra JWT, role `MENTOR`, lesson tồn tại, ownership và course status.
* Backend áp dụng E2.1 Lesson Ownership Validation.
* Backend tạo signed upload parameters an toàn cho Cloudinary.
* Backend không upload file trực tiếp và không thêm API ngoài tài liệu final.

## 2. Actors & Roles

| Actor                    | Role              | Quyền trong feature                                              |
| ------------------------ | ----------------- | ---------------------------------------------------------------- |
| Mentor                   | `MENTOR`          | Lấy Cloudinary upload signature cho lesson thuộc course của mình |
| Member A Auth Middleware | System dependency | Xác thực JWT, roleVersion, role MENTOR                           |
| Cloudinary               | External service  | Nhận upload trực tiếp từ frontend bằng signed params             |
| Manager                  | Out of scope      | Không gọi API feature này                                        |
| Learner                  | Out of scope      | Không gọi API feature này                                        |
| Admin                    | Out of scope      | Không quản lý asset upload trong feature này                     |

## 3. Functional Requirements (EARS Notation)

**FR-001:** WHEN Mentor gửi `GET /mentor/lessons/:lessonId/upload-signature`, THE system SHALL authenticate request bằng `AUTH_MIDDLEWARE` và yêu cầu role `MENTOR`.

**FR-002:** WHEN request chứa `lessonId`, THE system SHALL validate `lessonId` bằng Zod trước khi controller gọi service.

**FR-003:** WHEN Mentor yêu cầu upload signature cho lesson, THE system SHALL tìm lesson kèm section và course để kiểm tra ownership.

**FR-004:** WHERE `lessonId` không tồn tại, THE system SHALL trả về lỗi `LESSON_NOT_FOUND`.

**FR-005:** WHERE lesson tồn tại nhưng `lesson.section.course.mentor_id !== req.user.id`, THE system SHALL trả về lỗi `COURSE_NOT_OWNED`.

**FR-006:** WHERE course có `status = published`, THE system SHALL từ chối cấp upload signature và trả về lỗi `COURSE_LOCKED_PUBLISHED`.

**FR-007:** WHERE course status không thuộc `draft` hoặc `rejected`, THE system SHALL từ chối cấp upload signature và trả về lỗi `COURSE_STATUS_NOT_EDITABLE`.

**FR-008:** WHEN lesson thuộc course của Mentor hiện tại và course status editable, THE system SHALL tạo Cloudinary signed upload parameters cho lesson asset.

**FR-009:** THE system SHALL NOT expose Cloudinary API secret trong response.

**FR-010:** THE system SHALL return signature response có đủ thông tin để frontend upload trực tiếp lên Cloudinary theo signed upload flow.

**FR-011:** IF query params có `assetType`, THEN THE system SHALL validate `assetType` theo enum asset type trong database final.

**FR-012:** WHERE `assetType` không hợp lệ, THE system SHALL trả về lỗi `INVALID_ASSET_TYPE`.

**FR-013:** THE system SHALL NOT receive, stream, buffer, store, hoặc proxy file upload qua backend trong feature này.

**FR-014:** THE system SHALL NOT create, update, hoặc delete `lesson_assets` record nếu API final không có endpoint lưu metadata asset trong feature này.

**FR-015:** THE system SHALL return sanitized error response without stack trace, Cloudinary secret, JWT, cookie hoặc database query nội bộ.

**FR-016:** THE backend SHALL only issue signed upload parameters; THE frontend SHALL upload the file directly to Cloudinary using those parameters.

**FR-017:** WHERE database final uses `lesson_assets.cloudinary_public_id`, THE system SHALL treat `cloudinary_public_id` as the primary persisted asset reference and SHALL NOT treat a public delivery URL as the source of truth.

**FR-018:** WHERE database final requires Cloudinary `type = authenticated`, THE signed parameters SHALL include the authenticated upload/delivery configuration required by the final contract.

## 4. Non-functional Requirements

**Security**

* Endpoint phải đi qua `AUTH_MIDDLEWARE`.
* Endpoint phải yêu cầu role `MENTOR`.
* Mentor identity phải lấy từ `req.user.id`.
* Không được tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Phải check ownership qua `lesson -> section -> course`.
* Không expose Cloudinary API secret.
* Response không được chứa `apiSecret` dưới bất kỳ casing hoặc nested field nào.
* Upload signature phải có timestamp để tránh reuse lâu dài.
* Signed params phải dùng authenticated upload/delivery configuration (`type = authenticated`) theo database final.
* Error response không được leak secret hoặc stack trace.

**Data Integrity**

* Không cấp signature cho lesson không tồn tại.
* Không cấp signature cho lesson thuộc course của Mentor khác.
* Không cấp signature cho course đã `published`.
* Không cấp signature cho course status không editable.
* Không tự tạo hoặc sửa `lesson_assets` nếu chưa có API final tương ứng.
* `cloudinary_public_id` là asset reference chính theo database final; không lưu hoặc trả public URL như source of truth chính.
* Backend không nhận file; frontend upload trực tiếp lên Cloudinary.

**Maintainability**

* Controller không chứa business logic.
* Service xử lý ownership, status, và gọi Cloudinary utility.
* Repository là lớp duy nhất truy cập Prisma để load lesson/section/course.
* Cloudinary signing logic nên tách vào utility/service riêng để dễ test.

**Performance**

* Query lesson ownership nên lấy đủ relation trong một lần query hợp lý.
* Endpoint chỉ tạo signature, không xử lý file upload nên response phải nhẹ.
* Không query toàn bộ course/curriculum để check ownership.

**Testability**

* Test phải cover auth, role, lesson not found, not owned, published lock, invalid asset type, success response và secret sanitization.

## 5. Data Model

Feature này liên quan đến các bảng sau để check ownership và asset domain:

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

### `lesson_assets`

| Field                  | Type                 | Required | Ghi chú                        |
| ---------------------- | -------------------- | -------- | ------------------------------ |
| `id`                   | CHAR(36) / UUID      | Yes      | Asset id                       |
| `lesson_id`            | CHAR(36) / UUID      | Yes      | FK tới `lessons.id`            |
| `cloudinary_public_id` | VARCHAR              | Yes      | Source of truth chính cho asset |
| `asset_type`           | ENUM/VARCHAR theo DB | Yes      | Loại asset theo database final |
| `created_at`           | DATETIME             | Yes      | Tạo bởi database               |

Trong feature này, `lesson_assets` là data model liên quan đến domain asset. Endpoint `GET /mentor/lessons/:lessonId/upload-signature` không tự tạo record `lesson_assets` nếu API final không quy định.

Signature response contract gợi ý:

| Field          | Ghi chú                               |
| -------------- | ------------------------------------- |
| `timestamp`    | Timestamp dùng để ký upload           |
| `signature`    | Cloudinary signature                  |
| `apiKey`       | Cloudinary API key, không phải secret |
| `cloudName`    | Cloudinary cloud name                 |
| `folder`       | Folder/path cho asset của lesson      |
| `publicId`     | Public id gợi ý nếu service tạo       |
| `resourceType` | Resource type theo asset/lesson       |
| `type`         | Phải là `authenticated` theo database final |
| `expiresIn`    | Thời hạn gợi ý của signature nếu có   |

Response không được chứa `apiSecret` và không dùng public delivery URL làm asset source of truth chính.

## 6. Error Handling

| Case                                  | HTTP | Error Code                   | Message gợi ý                         |
| ------------------------------------- | ---- | ---------------------------- | ------------------------------------- |
| Chưa đăng nhập                        | 401  | `UNAUTHORIZED`               | Authentication required               |
| JWT hết hạn hoặc roleVersion mismatch | 401  | `TOKEN_REVOKED`              | Token revoked or expired              |
| Role không phải Mentor                | 403  | `FORBIDDEN_ROLE`             | Mentor role required                  |
| Params/query sai schema               | 400  | `VALIDATION_ERROR`           | Invalid request                       |
| `lessonId` không tồn tại              | 404  | `LESSON_NOT_FOUND`           | Lesson not found                      |
| Lesson thuộc course của Mentor khác   | 403  | `COURSE_NOT_OWNED`           | Lesson is not owned by current mentor |
| Course đã published                   | 403  | `COURSE_LOCKED_PUBLISHED`    | Published course cannot be edited     |
| Course status không editable          | 403  | `COURSE_STATUS_NOT_EDITABLE` | Course status is not editable         |
| `assetType` không hợp lệ              | 400  | `INVALID_ASSET_TYPE`         | Asset type is invalid                 |
| Cloudinary config thiếu               | 500  | `CLOUDINARY_CONFIG_MISSING`  | Upload provider is not configured     |
| Lỗi tạo signature                     | 500  | `UPLOAD_SIGNATURE_FAILED`    | Failed to create upload signature     |
| Signed params thiếu authenticated config | 500 | `UPLOAD_SIGNATURE_FAILED` | Authenticated upload configuration is invalid |

Error response phải sanitize. Không trả stack trace, Cloudinary secret, JWT, cookie hoặc database query nội bộ.

## 7. Acceptance Criteria (Given-When-Then)

**AC-001 maps to FR-001, FR-002**
Given Mentor đã đăng nhập hợp lệ với role `MENTOR`, When Mentor gọi `GET /mentor/lessons/:lessonId/upload-signature` với `lessonId` đúng định dạng, Then request đi qua auth, role middleware và Zod params validation.

**AC-002 maps to FR-004**
Given Mentor gọi endpoint upload signature với `lessonId` không tồn tại, When request được xử lý, Then hệ thống trả về HTTP 404 `LESSON_NOT_FOUND`.

**AC-003 maps to FR-003, FR-005**
Given lesson L thuộc course của Mentor B, When Mentor A gọi `GET /mentor/lessons/L/upload-signature`, Then hệ thống trả về HTTP 403 `COURSE_NOT_OWNED`.

**AC-004 maps to FR-006**
Given lesson L thuộc course của Mentor A và course có `status = published`, When Mentor A gọi endpoint upload signature, Then hệ thống trả về HTTP 403 `COURSE_LOCKED_PUBLISHED`.

**AC-005 maps to FR-007**
Given lesson L thuộc course của Mentor A và course có `status = pending_review`, When Mentor A gọi endpoint upload signature, Then hệ thống trả về HTTP 403 `COURSE_STATUS_NOT_EDITABLE`.

**AC-006 maps to FR-008, FR-010, FR-016, FR-018**
Given lesson L thuộc course của Mentor A và course có `status = draft`, When Mentor A gọi endpoint upload signature, Then hệ thống trả về HTTP 200 với signed upload parameters có authenticated config đủ để frontend upload trực tiếp lên Cloudinary.

**AC-007 maps to FR-009**
Given request upload signature thành công, When response được trả về frontend, Then response không chứa Cloudinary API secret.

**AC-008 maps to FR-011, FR-012**
Given Mentor gọi endpoint với query `assetType` không hợp lệ, When request được validate, Then hệ thống trả về HTTP 400 `INVALID_ASSET_TYPE` hoặc `VALIDATION_ERROR`.

**AC-009 maps to FR-013**
Given feature này được implement, When review backend route/controller, Then không có code nhận multipart file, stream file, buffer file hoặc proxy upload qua backend.

**AC-010 maps to FR-014**
Given endpoint upload signature được gọi thành công, When kiểm tra database, Then endpoint này không tự tạo/update/delete `lesson_assets` record nếu API final không quy định metadata persistence trong feature này.

**AC-011 maps to FR-015**
Given một lỗi bất kỳ xảy ra trong endpoint, When response được trả về frontend, Then response không chứa stack trace, Cloudinary secret, JWT, cookie hoặc query nội bộ.

**AC-012 maps to FR-017**
Given asset được Cloudinary trả về cả `public_id` và delivery URL, When metadata được sử dụng theo final contract, Then `cloudinary_public_id` là source of truth chính và public URL không được lưu/trả như định danh chính.

**AC-013 maps to FR-009, FR-015**
Given signature response thành công hoặc lỗi, When kiểm tra toàn bộ response body, Then không có field `apiSecret` hoặc giá trị Cloudinary API secret.

## 8. Out of Scope

Feature này không xử lý:

* Tạo/sửa/xóa course metadata.
* Tạo/sửa/xóa section.
* Tạo/sửa/xóa lesson.
* Tạo/sửa/xóa quiz.
* Tạo/sửa/xóa quiz question.
* Reorder section/lesson.
* Submit course review.
* Tạo `course_revisions`.
* Manager publish/reject.
* Public catalog.
* Payment hoặc enrollment.
* Learner learning flow.
* Learner xem/download asset.
* Learner quiz submission.
* Rating/feedback.
* Admin user management.
* Upload file trực tiếp qua backend.
* Multipart upload.
* Migration/database schema change.
* Frontend implementation.

