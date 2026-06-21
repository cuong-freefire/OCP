# PLAN.md - feat-course-reorder

## 1. ARCHITECTURAL APPROACH

Feature `feat-course-reorder` sử dụng layered architecture theo chuẩn backend OCP:

`Route -> Auth Middleware -> Role Middleware -> Zod Validator -> Controller -> Service -> Repository -> Prisma Transaction`

Nguyên tắc triển khai:

* Route khai báo endpoint `PUT /mentor/courses/:courseId/reorder`.
* Auth/role middleware xác thực JWT, roleVersion và role `MENTOR`.
* Zod validator kiểm tra `courseId` và reorder payload.
* Payload shape trong SPEC chỉ là proposed payload; phải human confirm trước implementation vì API catalog chưa chốt chi tiết.
* Controller chỉ nhận request, gọi service và trả response.
* Service xử lý business rules:

  * lấy `mentorId` từ `req.user.id`,
  * kiểm tra course tồn tại,
  * kiểm tra ownership,
  * kiểm tra course status editable,
  * validate tất cả section/lesson id thuộc course,
  * validate `orderIndex`,
  * gọi repository transaction để update loop.
* Repository là lớp duy nhất thao tác Prisma.
* Reorder phải dùng transaction.
* Reorder chỉ update `order_index`, không delete/recreate record.

Không viết logic trực tiếp trong route hoặc controller. Không dùng `deleteMany`, `delete`, hoặc create lại section/lesson để reorder.

## 2. COMPONENTS

| Component                 | File dự kiến                                                         | Trách nhiệm                                                                       |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Mentor routes             | `backend/src/api/mentor.routes.js`                                   | Đăng ký endpoint `PUT /mentor/courses/:courseId/reorder`                          |
| Course reorder controller | `backend/src/controllers/courseReorder.controller.js`                | Nhận request reorder, gọi service, trả response                                   |
| Course reorder service    | `backend/src/services/courseReorder.service.js`                      | Business rules: ownership, status, payload consistency, transaction orchestration |
| Course reorder repository | `backend/src/repositories/courseReorder.repository.js`               | Prisma queries và transaction update loop                                         |
| Course reorder validator  | `backend/src/validators/courseReorder.validator.js`                  | Zod schemas cho `courseId`, section/lesson ids, `orderIndex`                      |
| Auth middleware           | `backend/src/middlewares/auth.middleware.js` hoặc export từ Member A | Xác thực JWT và roleVersion                                                       |
| Role middleware           | `backend/src/middlewares/role.middleware.js`                         | Yêu cầu role `MENTOR`                                                             |
| Error utils               | `backend/src/utils/errors.js` hoặc error utility hiện có             | Chuẩn hóa error codes                                                             |
| Tests                     | `backend/src/tests/courseReorder.test.js`                            | Integration/unit tests cho AC-001 đến AC-013                                      |

## 3. DATA FLOW

### Reorder course curriculum

1. Client gọi `PUT /mentor/courses/:courseId/reorder`.
2. `AUTH_MIDDLEWARE` xác thực JWT và roleVersion.
3. Role middleware xác nhận role `MENTOR`.
4. Zod validator validate `courseId` và request body.
5. Controller gọi `courseReorderService.reorderCourse(req.user.id, courseId, body)`.
6. Service load course.
7. Nếu course không tồn tại, throw `COURSE_NOT_FOUND`.
8. Nếu `course.mentor_id !== req.user.id`, throw `COURSE_NOT_OWNED`.
9. Nếu `course.status = published`, throw `COURSE_LOCKED_PUBLISHED`.
10. Nếu course status không thuộc `draft/rejected`, throw `COURSE_STATUS_NOT_EDITABLE`.
11. Service validate tất cả section id trong payload tồn tại và thuộc course.
12. Service validate tất cả lesson id trong payload tồn tại và thuộc course/section hợp lệ.
13. Service validate `orderIndex` là integer dương, không trùng trong phạm vi tương ứng.
14. Service gọi repository transaction.
15. Repository dùng transaction để update loop từng `course_sections.order_index`.
16. Repository dùng transaction để update loop từng `lessons.order_index`.
17. Nếu bất kỳ update nào fail, transaction rollback.
18. Nếu thành công, controller trả HTTP 200.

### Safety flow for E3.2

1. Không gọi `deleteMany`.
2. Không xóa section.
3. Không xóa lesson.
4. Không create lại section/lesson.
5. Không đụng tới `quizzes`, `quiz_questions`, `lesson_assets`.
6. Chỉ update field `order_index`.

## 4. DEPENDENCIES

**Member A**

* `AUTH_MIDDLEWARE`
* JWT access token trong httpOnly cookie
* `req.user.id`
* `req.user.role`
* `req.user.roleVersion`

**Feature trước đó**

* `feat-mentor-course-draft` tạo course draft hợp lệ.
* `feat-curriculum-builder` tạo section/lesson hợp lệ.
* `feat-lesson-assets-upload` có thể tạo lesson assets phụ thuộc lesson.
* `feat-quiz-authoring` có thể tạo quiz/questions phụ thuộc lesson.

**Database**

* `courses`
* `course_sections`
* `lessons`
* Related protected tables: `lesson_assets`, `quizzes`, `quiz_questions`

**Global backend utilities**

* Prisma client
* App error classes
* Error middleware
* Response helper nếu project đã có

**Downstream features/modules**

* `feat-submit-course-review` sẽ snapshot curriculum sau reorder.
* Member D learning flow sẽ hiển thị lesson theo order sau khi course published.

## 5. RISKS & MITIGATIONS

| Risk                                        | Impact                                        | Mitigation                                                      |
| ------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Dùng `deleteMany` rồi `create` lại          | Cascade delete làm mất lessons/quizzes/assets | E3.2: chỉ update loop trong transaction                         |
| Không dùng transaction                      | Reorder một phần, dữ liệu bị lệch             | Bọc toàn bộ updates trong database transaction                  |
| Payload chứa section/lesson của course khác | Mentor A reorder data của Mentor B            | Validate tất cả ids thuộc course hiện tại trước update          |
| Duplicate `orderIndex`                      | UI hiển thị sai thứ tự                        | Zod/service validate uniqueness trong phạm vi course/section    |
| Reorder course published                    | Sai lệch course đã bán/enroll                 | Service chặn bằng `COURSE_LOCKED_PUBLISHED`                     |
| Race condition nhiều request reorder        | Thứ tự cuối bị ghi đè khó đoán                | Dùng transaction và cân nhắc isolation level/updated_at nếu cần |
| Reorder bị scope creep sang move/delete     | Mất dữ liệu hoặc lệch feature                 | Out of Scope ghi rõ không delete/recreate/move nếu chưa confirm |

## 6. QUESTIONS FOR HUMAN

* Payload chính thức cho reorder sẽ là flat arrays hay nested sections với lessons?
* Có cho phép move lesson sang section khác trong API reorder không?
* Nếu payload thiếu item hiện có, backend giữ nguyên item đó hay trả `INVALID_REORDER_PAYLOAD`?
* Có cần dùng isolation level `Serializable` cho reorder transaction không?
* Có cần kiểm tra `updated_at` để tránh overwrite khi nhiều tab Mentor reorder cùng lúc không?

