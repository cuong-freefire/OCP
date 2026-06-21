# PLAN.md - feat-mentor-course-draft

## 1. ARCHITECTURAL APPROACH

Feature `feat-mentor-course-draft` sử dụng layered architecture theo chuẩn backend OCP:

`Route -> Auth Middleware -> Role Middleware -> Zod Validator -> Controller -> Service -> Repository -> Prisma`

Nguyên tắc triển khai:

* Route khai báo endpoint `/mentor/courses`.
* Auth/role middleware xác thực JWT, roleVersion và role `MENTOR`.
* Zod validator kiểm tra request body và params.
* Controller chỉ nhận request, gọi service và trả response.
* Service xử lý business rules:

  * lấy `mentorId` từ `req.user.id`,
  * kiểm tra ownership,
  * kiểm tra status editable,
  * áp dụng E1.2 khóa published course,
  * soft delete/archive.
* Repository là lớp duy nhất thao tác bảng `courses` qua Prisma.
* Error middleware toàn cục xử lý `AppError`/custom error và sanitize response.

Không viết logic trực tiếp trong route hoặc controller. Không query database từ validator hoặc controller.

## 2. COMPONENTS

| Component                | File dự kiến                                                         | Trách nhiệm                                                               |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Mentor routes            | `backend/src/api/mentor.routes.js`                                   | Đăng ký các endpoint `/mentor/courses*`                                   |
| Mentor course controller | `backend/src/controllers/mentorCourse.controller.js`                 | Nhận request, gọi service, trả response                                   |
| Mentor course service    | `backend/src/services/mentorCourse.service.js`                       | Business rules: create/list/detail/update/archive, ownership, status lock |
| Mentor course repository | `backend/src/repositories/mentorCourse.repository.js`                | Prisma access cho bảng `courses`                                          |
| Mentor course validator  | `backend/src/validators/mentorCourse.validator.js`                   | Zod schemas cho create/update/params/query                                |
| Auth middleware          | `backend/src/middlewares/auth.middleware.js` hoặc export từ Member A | Xác thực JWT và roleVersion                                               |
| Role middleware          | `backend/src/middlewares/role.middleware.js`                         | Yêu cầu role `MENTOR`                                                     |
| Error utils              | `backend/src/utils/errors.js` hoặc error util hiện có                | Chuẩn hóa error codes                                                     |
| Tests                    | `backend/src/tests/mentorCourse.test.js`                             | Integration/unit tests cho AC-001 đến AC-012                              |

## 3. DATA FLOW

### Create draft course

1. Client gọi `POST /mentor/courses`.
2. `AUTH_MIDDLEWARE` xác thực JWT và roleVersion.
3. Role middleware xác nhận role `MENTOR`.
4. Zod validator validate payload.
5. Controller gọi `mentorCourseService.createDraftCourse(req.user.id, body)`.
6. Service bỏ qua mọi identity trong body và gắn `mentor_id = req.user.id`.
7. Repository tạo course với `status = draft`.
8. Controller trả HTTP 201.

### List mentor courses

1. Client gọi `GET /mentor/courses`.
2. Auth và role middleware xác thực Mentor.
3. Validator validate query pagination nếu có.
4. Controller gọi `mentorCourseService.listMyCourses(req.user.id, query)`.
5. Repository query theo `mentor_id = req.user.id`.
6. Controller trả danh sách course của Mentor hiện tại.

### Get course detail

1. Client gọi `GET /mentor/courses/:courseId`.
2. Auth và role middleware xác thực Mentor.
3. Validator validate `courseId`.
4. Service gọi repository tìm course.
5. Nếu không có course, throw `COURSE_NOT_FOUND`.
6. Nếu `course.mentor_id !== req.user.id`, throw `COURSE_NOT_OWNED`.
7. Controller trả course detail.

### Update course metadata

1. Client gọi `PUT /mentor/courses/:courseId`.
2. Auth, role và validator chạy trước.
3. Service load course hiện tại.
4. Nếu không tồn tại, throw `COURSE_NOT_FOUND`.
5. Nếu không owned, throw `COURSE_NOT_OWNED`.
6. Nếu `status = published`, throw `COURSE_LOCKED_PUBLISHED`.
7. Nếu status không thuộc `draft/rejected`, throw `COURSE_STATUS_NOT_EDITABLE`.
8. Repository update metadata.
9. Controller trả HTTP 200.

### Archive course

1. Client gọi `DELETE /mentor/courses/:courseId`.
2. Auth, role và params validator chạy trước.
3. Service load course hiện tại.
4. Service kiểm tra tồn tại và ownership.
5. Service validate status archivable.
6. Repository update `status = archived`.
7. Controller trả HTTP 200.

## 4. DEPENDENCIES

**Member A**

* `AUTH_MIDDLEWARE`
* JWT access token trong httpOnly cookie
* `req.user.id`
* `req.user.role`
* `req.user.roleVersion`

**Database**

* Bảng `courses`

**Global backend utilities**

* App error classes
* Error middleware
* Response helper nếu project đã có
* Prisma client

**Downstream features**

* `feat-curriculum-builder` cần course draft hợp lệ để tạo section/lesson.
* `feat-quiz-authoring` phụ thuộc gián tiếp vào course qua lesson.
* `feat-course-reorder` phụ thuộc course ownership.
* `feat-submit-course-review` phụ thuộc course status `draft/rejected`.

## 5. RISKS & MITIGATIONS

| Risk                                            | Impact                                                 | Mitigation                                                                 |
| ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Frontend gửi `mentorId` giả mạo                 | Mentor có thể tạo course cho user khác                 | Backend luôn lấy mentor id từ `req.user.id`, ignore identity trong body    |
| Quên check ownership ở GET detail/update/delete | Mentor A xem/sửa/xóa course của Mentor B               | Service bắt buộc dùng helper `assertCourseOwnedByMentor(course, mentorId)` |
| Update course đã published                      | Sai lệch course đã bán/enroll                          | Service áp dụng E1.2 trước mọi update                                      |
| Hard delete course                              | Mất dữ liệu liên quan review/payment/enrollment về sau | DELETE chỉ update `status = archived`                                      |
| Price dùng decimal                              | Sai số tiền khi payment                                | Zod validate integer > 0, repository lưu BIGINT                            |
| Controller chứa business logic                  | Khó test, dễ drift kiến trúc                           | Controller chỉ gọi service                                                 |
| TASKS sau này lan sang section/lesson/quiz      | Scope creep                                            | Out of Scope ghi rõ và tasks chỉ trỏ bảng `courses`                        |

## 6. QUESTIONS FOR HUMAN

* Có cho archive course đang `pending_review` không, hay chỉ cho archive `draft/rejected`?
* `GET /mentor/courses` dùng pagination mặc định `page/pageSize` hay `limit/offset`?
* Course archived có cần API restore ở feature sau không?

