# PLAN.md - feat-curriculum-builder

## 1. ARCHITECTURAL APPROACH

Feature `feat-curriculum-builder` sử dụng layered architecture theo chuẩn backend OCP:

`Route -> Auth Middleware -> Role Middleware -> Zod Validator -> Controller -> Service -> Repository -> Prisma`

Nguyên tắc triển khai:

* Route khai báo các endpoint section/lesson dưới namespace `/mentor`.
* Auth/role middleware xác thực JWT, roleVersion và role `MENTOR`.
* Zod validator kiểm tra params và request body.
* Controller chỉ nhận request, gọi service và trả response.
* Service xử lý business rules:

  * lấy `mentorId` từ `req.user.id`,
  * kiểm tra course tồn tại,
  * kiểm tra section/lesson tồn tại,
  * kiểm tra ownership qua `course.mentor_id`,
  * kiểm tra course status editable,
  * điều phối CRUD section/lesson.
* Repository là lớp duy nhất thao tác Prisma với `courses`, `course_sections`, `lessons`.
* Error middleware toàn cục xử lý custom error và sanitize response.
* DELETE section/lesson là decision gate: không implement persistence hard delete/cascade trước khi human xác nhận contract final.
* Reorder và cleanup `order_index` không được dùng delete/cascade; toàn bộ reorder thuộc `feat-course-reorder`.

Không viết logic trực tiếp trong route hoặc controller. Không query database từ validator hoặc controller.

## 2. COMPONENTS

| Component             | File dự kiến                                                         | Trách nhiệm                                                                     |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Mentor routes         | `backend/src/api/mentor.routes.js`                                   | Đăng ký endpoint section/lesson dưới `/mentor`                                  |
| Curriculum controller | `backend/src/controllers/curriculum.controller.js`                   | Nhận request CRUD section/lesson, gọi service, trả response                     |
| Curriculum service    | `backend/src/services/curriculum.service.js`                         | Business rules: ownership, status editable, create/update; DELETE chỉ sau human confirm |
| Curriculum repository | `backend/src/repositories/curriculum.repository.js`                  | Prisma access; không thêm hard-delete/cascade method khi DELETE chưa được confirm |
| Curriculum validator  | `backend/src/validators/curriculum.validator.js`                     | Zod schemas cho section/lesson params/body                                      |
| Auth middleware       | `backend/src/middlewares/auth.middleware.js` hoặc export từ Member A | Xác thực JWT và roleVersion                                                     |
| Role middleware       | `backend/src/middlewares/role.middleware.js`                         | Yêu cầu role `MENTOR`                                                           |
| Error utils           | `backend/src/utils/errors.js` hoặc error utility hiện có             | Chuẩn hóa error codes                                                           |
| Tests                 | `backend/src/tests/curriculum.test.js`                               | Integration/unit tests cho AC-001 đến AC-014                                    |

## 3. DATA FLOW

### Create section

1. Client gọi `POST /mentor/courses/:courseId/sections`.
2. `AUTH_MIDDLEWARE` xác thực JWT và roleVersion.
3. Role middleware xác nhận role `MENTOR`.
4. Zod validator validate `courseId` và body.
5. Controller gọi `curriculumService.createSection(req.user.id, courseId, body)`.
6. Service load course.
7. Nếu course không tồn tại, throw `COURSE_NOT_FOUND`.
8. Nếu course không thuộc Mentor hiện tại, throw `COURSE_NOT_OWNED`.
9. Nếu course published, throw `COURSE_LOCKED_PUBLISHED`.
10. Nếu course status không editable, throw `COURSE_STATUS_NOT_EDITABLE`.
11. Repository tạo section.
12. Controller trả HTTP 201.

### Get section detail

1. Client gọi `GET /mentor/sections/:sectionId`.
2. Auth và role middleware xác thực Mentor.
3. Validator validate `sectionId`.
4. Service load section kèm course.
5. Nếu section không tồn tại, throw `SECTION_NOT_FOUND`.
6. Nếu section.course.mentor_id khác `req.user.id`, throw `COURSE_NOT_OWNED`.
7. Controller trả section detail.

### Update section

1. Client gọi `PUT /mentor/sections/:sectionId`.
2. Auth, role và validator chạy trước.
3. Service load section kèm course.
4. Service kiểm tra tồn tại, ownership, status editable.
5. Repository update section.
6. Controller trả HTTP 200.

### Delete section

1. Client gọi `DELETE /mentor/sections/:sectionId`.
2. Auth, role và validator chạy trước.
3. Service load section kèm course.
4. Service kiểm tra tồn tại, ownership, status editable.
5. Service kiểm tra decision gate về DELETE contract.
6. Nếu human chưa confirm, không implement/call hard delete hoặc cascade; giữ đây là blocker trước implementation.
7. Sau khi contract được confirm, repository chỉ thực hiện đúng hành vi đã duyệt.

### Create lesson

1. Client gọi `POST /mentor/sections/:sectionId/lessons`.
2. Auth, role và validator chạy trước.
3. Service load section kèm course.
4. Nếu section không tồn tại, throw `SECTION_NOT_FOUND`.
5. Nếu section.course.mentor_id khác `req.user.id`, throw `COURSE_NOT_OWNED`.
6. Service kiểm tra course status editable.
7. Service validate lesson type theo database final.
8. Repository tạo lesson.
9. Controller trả HTTP 201.

### Get/update/delete lesson

1. Client gọi endpoint lesson tương ứng.
2. Auth, role và validator chạy trước.
3. Service load lesson kèm section và course.
4. Nếu lesson không tồn tại, throw `LESSON_NOT_FOUND`.
5. Nếu lesson.section.course.mentor_id khác `req.user.id`, throw `COURSE_NOT_OWNED`.
6. Với update/delete, service kiểm tra course status editable.
7. Với delete, service áp dụng decision gate; không hard delete/cascade khi chưa có human confirm.
8. Repository thực hiện thao tác đã được contract cho phép.
9. Controller trả response chuẩn.

## 4. DEPENDENCIES

**Member A**

* `AUTH_MIDDLEWARE`
* JWT access token trong httpOnly cookie
* `req.user.id`
* `req.user.role`
* `req.user.roleVersion`

**Feature trước đó**

* `feat-mentor-course-draft` phải tạo được course draft hợp lệ.
* `courses.id`, `courses.mentor_id`, `courses.status` phải hoạt động đúng.

**Database**

* `courses`
* `course_sections`
* `lessons`

**Global backend utilities**

* Prisma client
* App error classes
* Error middleware
* Response helper nếu project đã có

**Downstream features**

* `feat-lesson-assets-upload` cần lesson hợp lệ để cấp upload signature.
* `feat-quiz-authoring` cần lesson hợp lệ để tạo quiz.
* `feat-course-reorder` cần section/lesson tồn tại để reorder.
* `feat-submit-course-review` cần full curriculum để tạo snapshot.

## 5. RISKS & MITIGATIONS

| Risk                                         | Impact                                           | Mitigation                                                                             |
| -------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Quên check ownership qua course              | Mentor A có thể xem/sửa lesson của Mentor B      | Service bắt buộc load section/lesson kèm course và check `mentor_id`                   |
| Cho sửa curriculum khi course published      | Sai lệch nội dung course đã bán/enroll           | Service áp dụng E1.2 cho mọi thao tác ghi                                              |
| Thêm lesson type ngoài DB                    | Lệch database final và làm hỏng learner flow     | Validator chỉ allow type theo database final                                           |
| Gộp quiz authoring vào curriculum            | Scope creep, trùng feature `feat-quiz-authoring` | Out of Scope và tasks không chứa quiz APIs                                             |
| Delete section làm mất lessons và dữ liệu phụ thuộc | Mất curriculum do `ON DELETE CASCADE` | Không implement hard delete/cascade trước human confirm; xác nhận contract và tác động dữ liệu trước implementation |
| Database không có soft-delete field cho section/lesson | Agent tự suy diễn hard delete | Ghi rõ decision gate; không thêm migration trong feature này và yêu cầu human quyết định |
| Controller chứa business logic               | Khó test, dễ drift architecture                  | Controller chỉ gọi service                                                             |
| Reorder/cleanup bằng delete hoặc cascade | Gây cascade delete nguy hiểm | Cấm `deleteMany`, delete/recreate và cascade; reorder để riêng `feat-course-reorder` |

## 6. QUESTIONS FOR HUMAN

* Delete section có được cascade delete lessons bên trong không, hay phải từ chối nếu section còn lesson?
* Delete lesson là hard delete hay soft delete nếu database final không có status/deleted flag?
* Khi tạo section/lesson, backend có tự tính `order_index` tiếp theo không?
* Mentor có được view section/lesson khi course đang `pending_review` không?

