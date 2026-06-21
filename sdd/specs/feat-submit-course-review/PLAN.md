# PLAN.md - feat-submit-course-review

## 1. ARCHITECTURAL APPROACH

Feature `feat-submit-course-review` sử dụng layered architecture theo chuẩn backend OCP:

`Route -> Auth Middleware -> Role Middleware -> Zod Validator -> Controller -> Service -> Repository -> Prisma Transaction`

Nguyên tắc triển khai:

* Route khai báo endpoint `POST /mentor/courses/:courseId/submit-review`.
* Auth/role middleware xác thực JWT, roleVersion và role `MENTOR`.
* Zod validator kiểm tra `courseId`.
* Controller chỉ nhận request, gọi service và trả response.
* Service xử lý business rules:

  * lấy `mentorId` từ `req.user.id`,
  * kiểm tra course tồn tại,
  * kiểm tra ownership,
  * kiểm tra course status submittable,
  * build snapshot data,
  * điều phối transaction tạo revision và update course status,
  * export `canEditCourse()`.
* Repository là lớp duy nhất thao tác Prisma với `courses`, `course_revisions`, `course_sections`, `lessons`, `lesson_assets`, `quizzes`, `quiz_questions`.
* Submit review phải dùng transaction.
* Không implement Manager publish/reject trong feature này.

## 2. COMPONENTS

| Component                | File dự kiến                                                                                                 | Trách nhiệm                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Mentor routes            | `backend/src/api/mentor.routes.js`                                                                           | Đăng ký endpoint `POST /mentor/courses/:courseId/submit-review`         |
| Submit review controller | `backend/src/controllers/submitCourseReview.controller.js`                                                   | Nhận request submit, gọi service, trả response                          |
| Submit review service    | `backend/src/services/submitCourseReview.service.js`                                                         | Business rules: ownership, status, snapshot, transaction, canEditCourse |
| Submit review repository | `backend/src/repositories/submitCourseReview.repository.js`                                                  | Prisma access cho course, revision và curriculum snapshot               |
| Submit review validator  | `backend/src/validators/submitCourseReview.validator.js`                                                     | Zod schema cho `courseId`                                               |
| Auth middleware          | `backend/src/middlewares/auth.middleware.js` hoặc export từ Member A                                         | Xác thực JWT và roleVersion                                             |
| Role middleware          | `backend/src/middlewares/role.middleware.js`                                                                 | Yêu cầu role `MENTOR`                                                   |
| Error utils              | `backend/src/utils/errors.js` hoặc error utility hiện có                                                     | Chuẩn hóa error codes                                                   |
| Export contract          | `backend/src/services/submitCourseReview.service.js` hoặc `backend/src/services/coursePermission.service.js` | Export `canEditCourse(userId, courseId)` cho Member E                   |
| Tests                    | `backend/src/tests/submitCourseReview.test.js`                                                               | Integration/unit tests cho AC-001 đến AC-016                            |

## 3. DATA FLOW

### Submit course review

1. Client gọi `POST /mentor/courses/:courseId/submit-review`.
2. `AUTH_MIDDLEWARE` xác thực JWT và roleVersion.
3. Role middleware xác nhận role `MENTOR`.
4. Zod validator validate `courseId`.
5. Controller gọi `submitCourseReviewService.submitForReview(req.user.id, courseId)`.
6. Service load course.
7. Nếu course không tồn tại, throw `COURSE_NOT_FOUND`.
8. Nếu `course.mentor_id !== req.user.id`, throw `COURSE_NOT_OWNED`.
9. Nếu `course.status = published`, throw `COURSE_LOCKED_PUBLISHED`.
10. Nếu `course.status = pending_review`, throw `COURSE_ALREADY_PENDING_REVIEW`.
11. Nếu `course.status = archived`, throw `COURSE_ARCHIVED`.
12. Nếu status không thuộc `draft/rejected`, throw `COURSE_STATUS_NOT_SUBMITTABLE`.
13. Service gọi repository load full curriculum data.
14. Service build `snapshot_data`.
15. Service validate snapshot tối thiểu.
16. Service mở transaction.
17. Repository tính `revision_num` tiếp theo.
18. Repository tạo `course_revisions` với `status = pending_review`.
19. Repository bắt buộc update `course.status = pending_review` trong cùng transaction.
20. Nếu bất kỳ bước nào lỗi, transaction rollback.
21. Controller trả HTTP 200 hoặc 201 với revision info.

### canEditCourse contract

1. Member E gọi `canEditCourse(userId, courseId)`.
2. Function load course tối thiểu gồm `mentor_id` và `status`.
3. Nếu không có course, return false.
4. Nếu `course.mentor_id !== userId`, return false.
5. Nếu `course.status` thuộc `draft/rejected`, return true.
6. Ngược lại return false.

### Snapshot assembly flow

1. Load course metadata.
2. Load sections theo `order_index`.
3. Load lessons theo section và `order_index`.
4. Load lesson assets theo lesson.
5. Load quizzes theo lesson.
6. Load quiz questions theo quiz và `order_index`.
7. Build JSON snapshot.
8. Không query payment/enrollment/learner data.

## 4. DEPENDENCIES

**Member A**

* `AUTH_MIDDLEWARE`
* JWT access token trong httpOnly cookie
* `req.user.id`
* `req.user.role`
* `req.user.roleVersion`

**Feature trước đó**

* `feat-mentor-course-draft` tạo course draft/rejected hợp lệ.
* `feat-curriculum-builder` tạo section/lesson.
* `feat-lesson-assets-upload` cung cấp asset metadata nếu đã có.
* `feat-quiz-authoring` tạo quiz/questions.
* `feat-course-reorder` cập nhật thứ tự curriculum trước snapshot.

**Database**

* `courses`
* `course_revisions`
* `course_sections`
* `lessons`
* `lesson_assets`
* `quizzes`
* `quiz_questions`

**Downstream Member E**

* Dùng pending revision để Manager publish/reject.
* Dùng `canEditCourse(userId, courseId)` integration contract.

**Global backend utilities**

* Prisma client
* App error classes
* Error middleware
* Response helper nếu project đã có

## 5. RISKS & MITIGATIONS

| Risk                                                    | Impact                           | Mitigation                                                                   |
| ------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Submit course của Mentor khác                           | Lộ/ghi sai review data           | Check `course.mentor_id === req.user.id`                                     |
| Submit course published                                 | Sai lệch course đã publish       | Chặn bằng `COURSE_LOCKED_PUBLISHED`                                          |
| Submit khi đã pending_review                            | Tạo nhiều pending revision trùng | Chặn bằng `COURSE_ALREADY_PENDING_REVIEW`                                    |
| Snapshot thiếu curriculum                               | Manager review thiếu dữ liệu     | Build snapshot từ course + sections + lessons + assets + quizzes + questions |
| Revision tạo thành công nhưng course status update fail | Dữ liệu lệch                     | Bắt buộc rollback toàn bộ transaction; không giữ revision hoặc status partial |
| Tính `revision_num` sai                                 | Trùng/lệch version               | Tính max revision trong transaction hoặc unique constraint nếu DB có         |
| Gộp publish/reject vào Member B                         | Sai phân quyền, trùng Member E   | Out of Scope ghi rõ Manager approval thuộc Member E                          |
| `canEditCourse()` return sai                            | Member E approval flow sai       | Unit test contract với owned/not owned/status cases                          |

## 6. QUESTIONS FOR HUMAN

* Có yêu cầu tối thiểu course phải có section/lesson trước submit không?
* Nếu snapshot không có quiz hoặc asset thì vẫn cho submit không?
* `snapshot_data` có cần lưu `correct_answer` trong quiz_questions để Manager review đầy đủ không?
* Có cần unique constraint đảm bảo chỉ có một pending review revision cho một course không?

