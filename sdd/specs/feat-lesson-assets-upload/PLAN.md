
# PLAN.md - feat-lesson-assets-upload

## 1. ARCHITECTURAL APPROACH

Feature `feat-lesson-assets-upload` sử dụng layered architecture theo chuẩn backend OCP:

`Route -> Auth Middleware -> Role Middleware -> Zod Validator -> Controller -> Service -> Repository -> Cloudinary Utility`

Nguyên tắc triển khai:

* Route khai báo endpoint `GET /mentor/lessons/:lessonId/upload-signature`.
* Auth/role middleware xác thực JWT, roleVersion và role `MENTOR`.
* Zod validator kiểm tra `lessonId` và query params như `assetType` nếu có.
* Controller chỉ nhận request, gọi service và trả response.
* Service xử lý business rules:

  * lấy `mentorId` từ `req.user.id`,
  * load lesson kèm section và course,
  * kiểm tra lesson tồn tại,
  * kiểm tra ownership,
  * kiểm tra course status editable,
  * gọi Cloudinary utility để tạo signed upload params.
* Repository là lớp duy nhất thao tác Prisma để load lesson/section/course.
* Cloudinary utility chỉ tạo signed params với `type = authenticated`, không upload file.
* Error middleware toàn cục xử lý custom error và sanitize response.

Frontend dùng signed params để upload trực tiếp lên Cloudinary. Backend không nhận multipart/file bytes, không proxy upload, không lưu Cloudinary secret ra response, và dùng `cloudinary_public_id` thay vì public URL làm asset source of truth chính.

## 2. COMPONENTS

| Component               | File dự kiến                                                         | Trách nhiệm                                                   |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| Mentor routes           | `backend/src/api/mentor.routes.js`                                   | Đăng ký endpoint `/mentor/lessons/:lessonId/upload-signature` |
| Lesson asset controller | `backend/src/controllers/lessonAsset.controller.js`                  | Nhận request upload signature, gọi service, trả response      |
| Lesson asset service    | `backend/src/services/lessonAsset.service.js`                        | Business rules: ownership, status editable, signature request |
| Lesson asset repository | `backend/src/repositories/lessonAsset.repository.js`                 | Load lesson kèm section/course bằng Prisma                    |
| Lesson asset validator  | `backend/src/validators/lessonAsset.validator.js`                    | Zod schemas cho `lessonId` và query `assetType` nếu có        |
| Cloudinary utility      | `backend/src/utils/cloudinary.js` hoặc util hiện có                  | Tạo authenticated signed upload params, không expose secret   |
| Auth middleware         | `backend/src/middlewares/auth.middleware.js` hoặc export từ Member A | Xác thực JWT và roleVersion                                   |
| Role middleware         | `backend/src/middlewares/role.middleware.js`                         | Yêu cầu role `MENTOR`                                         |
| Error utils             | `backend/src/utils/errors.js` hoặc error utility hiện có             | Chuẩn hóa error codes                                         |
| Tests                   | `backend/src/tests/lessonAsset.test.js`                              | Integration/unit tests cho AC-001 đến AC-011                  |

## 3. DATA FLOW

### Get upload signature

1. Client gọi `GET /mentor/lessons/:lessonId/upload-signature`.
2. `AUTH_MIDDLEWARE` xác thực JWT và roleVersion.
3. Role middleware xác nhận role `MENTOR`.
4. Zod validator validate `lessonId` và query `assetType` nếu có.
5. Controller gọi `lessonAssetService.getUploadSignature(req.user.id, lessonId, query)`.
6. Service gọi repository load lesson kèm section và course.
7. Nếu lesson không tồn tại, service throw `LESSON_NOT_FOUND`.
8. Nếu `lesson.section.course.mentor_id !== req.user.id`, service throw `COURSE_NOT_OWNED`.
9. Nếu course `status = published`, service throw `COURSE_LOCKED_PUBLISHED`.
10. Nếu course status không thuộc `draft/rejected`, service throw `COURSE_STATUS_NOT_EDITABLE`.
11. Service gọi Cloudinary utility để tạo signed upload params.
12. Utility dùng Cloudinary config từ environment variables.
13. Utility trả params gồm signature, timestamp, cloudName, apiKey, `type = authenticated`, folder/publicId/resourceType nếu có.
14. Controller trả HTTP 200.
15. Response không chứa Cloudinary API secret.
16. Frontend upload file trực tiếp lên Cloudinary; backend không nhận hoặc chuyển tiếp file.
17. Khi asset metadata được dùng ở flow final, `cloudinary_public_id` là reference chính; không dùng public URL làm source of truth.

### Error flow

1. Nếu validation fail, validator trả `VALIDATION_ERROR` hoặc `INVALID_ASSET_TYPE`.
2. Nếu Cloudinary config thiếu, service/util throw `CLOUDINARY_CONFIG_MISSING`.
3. Error middleware sanitize response.
4. Response không chứa stack trace, secret, JWT, cookie hoặc query nội bộ.

## 4. DEPENDENCIES

**Member A**

* `AUTH_MIDDLEWARE`
* JWT access token trong httpOnly cookie
* `req.user.id`
* `req.user.role`
* `req.user.roleVersion`

**Feature trước đó**

* `feat-mentor-course-draft` tạo course draft hợp lệ.
* `feat-curriculum-builder` tạo section và lesson hợp lệ.

**Database**

* `courses`
* `course_sections`
* `lessons`
* `lesson_assets` theo domain ownership của Member B

**External provider**

* Cloudinary account/config.
* Environment variables cho Cloudinary cloud name, API key và API secret.

**Global backend utilities**

* Prisma client
* App error classes
* Error middleware
* Response helper nếu project đã có

**Downstream features**

* `feat-submit-course-review` có thể snapshot lesson/asset metadata.
* Learner asset access không thuộc feature này.

## 5. RISKS & MITIGATIONS

| Risk                                | Impact                                               | Mitigation                                                                      |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Quên check ownership lesson         | Mentor A có thể upload asset vào lesson của Mentor B | Service load `lesson -> section -> course` và check `mentor_id === req.user.id` |
| Expose Cloudinary API secret        | Lộ secret, attacker upload/xóa tài nguyên            | Response chỉ trả signature/apiKey/cloudName, không trả apiSecret                |
| Thiếu authenticated upload config   | Asset delivery lệch database final                   | Ký request với `type = authenticated` và test signed params                     |
| Cấp signature cho course published  | Mentor thay đổi asset của course đã bán/enroll       | Service chặn `published` bằng `COURSE_LOCKED_PUBLISHED`                         |
| Backend nhận file upload trực tiếp  | Tăng tải server, lệch kiến trúc signed upload        | Endpoint chỉ tạo signature, không nhận multipart                                |
| Dùng public URL làm source of truth  | URL delivery thay đổi hoặc bypass authenticated flow | Dùng `cloudinary_public_id` làm reference chính; signed delivery thuộc flow đọc |
| Signature sống quá lâu              | Tăng rủi ro reuse signature                          | Dùng timestamp và policy hết hạn ngắn nếu provider hỗ trợ                       |
| Asset type không validate           | Upload sai loại tài nguyên                           | Zod validate `assetType` theo database final                                    |
| Tự thêm endpoint lưu asset metadata | Lệch API_CATALOG.md                                  | Out of Scope ghi rõ không thêm API mới                                          |

## 6. QUESTIONS FOR HUMAN

* Endpoint upload signature có cần query `assetType` bắt buộc không, hay tự suy ra từ `lessons.type`?
* Sau khi frontend upload Cloudinary thành công, metadata `cloudinary_public_id` sẽ được lưu bằng endpoint nào?
* Cloudinary folder convention nên là gì: theo `courseId/lessonId` hay theo `mentorId/courseId/lessonId`?
* Signature nên hết hạn sau bao nhiêu giây/phút?

