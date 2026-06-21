# PLAN.md - feat-quiz-authoring

## 1. ARCHITECTURAL APPROACH

Feature `feat-quiz-authoring` sử dụng layered architecture theo chuẩn backend OCP:

`Route -> Auth Middleware -> Role Middleware -> Zod Validator -> Controller -> Service -> Repository -> Prisma`

Nguyên tắc triển khai:

* Route khai báo các endpoint quiz/question dưới namespace `/mentor`.
* Auth/role middleware xác thực JWT, roleVersion và role `MENTOR`.
* Zod validator kiểm tra params và request body.
* Controller chỉ nhận request, gọi service và trả response.
* Service xử lý business rules:

  * lấy `mentorId` từ `req.user.id`,
  * kiểm tra lesson/quiz/question tồn tại,
  * kiểm tra ownership qua `course.mentor_id`,
  * kiểm tra course status editable,
  * validate nghiệp vụ `options_json` và `correct_answer`,
  * điều phối CRUD quiz/question.
* Repository là lớp duy nhất thao tác Prisma với `quizzes`, `quiz_questions` và relation ownership.
* Error middleware toàn cục xử lý custom error và sanitize response.
* Service không kiểm tra hoặc chặn lesson type eligibility vì source of truth final không định nghĩa rule đó.

Không viết logic trực tiếp trong route hoặc controller. Không implement learner submission hoặc grading trong feature này.

## 2. COMPONENTS

| Component                 | File dự kiến                                                         | Trách nhiệm                                                                   |
| ------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Mentor routes             | `backend/src/api/mentor.routes.js`                                   | Đăng ký endpoint quiz/question dưới `/mentor`                                 |
| Quiz authoring controller | `backend/src/controllers/quizAuthoring.controller.js`                | Nhận request CRUD quiz/question, gọi service, trả response                    |
| Quiz authoring service    | `backend/src/services/quizAuthoring.service.js`                      | Business rules: ownership, status editable, options/correct answer validation |
| Quiz authoring repository | `backend/src/repositories/quizAuthoring.repository.js`               | Prisma access cho lesson ownership context, `quizzes`, `quiz_questions`       |
| Quiz authoring validator  | `backend/src/validators/quizAuthoring.validator.js`                  | Zod schemas cho quiz/question params/body                                     |
| Auth middleware           | `backend/src/middlewares/auth.middleware.js` hoặc export từ Member A | Xác thực JWT và roleVersion                                                   |
| Role middleware           | `backend/src/middlewares/role.middleware.js`                         | Yêu cầu role `MENTOR`                                                         |
| Error utils               | `backend/src/utils/errors.js` hoặc error utility hiện có             | Chuẩn hóa error codes                                                         |
| Tests                     | `backend/src/tests/quizAuthoring.test.js`                            | Integration/unit tests cho AC-001 đến AC-016                                  |

## 3. DATA FLOW

### Create quiz

1. Client gọi `POST /mentor/lessons/:lessonId/quizzes`.
2. `AUTH_MIDDLEWARE` xác thực JWT và roleVersion.
3. Role middleware xác nhận role `MENTOR`.
4. Zod validator validate `lessonId` và body.
5. Controller gọi `quizAuthoringService.createQuiz(req.user.id, lessonId, body)`.
6. Service load lesson kèm section và course.
7. Nếu lesson không tồn tại, throw `LESSON_NOT_FOUND`.
8. Nếu lesson không thuộc course của Mentor hiện tại, throw `COURSE_NOT_OWNED`.
9. Nếu course `published`, throw `COURSE_LOCKED_PUBLISHED`.
10. Nếu course status không editable, throw `COURSE_STATUS_NOT_EDITABLE`.
11. Repository tạo quiz.
12. Controller trả HTTP 201.

### Get/update/delete quiz

1. Client gọi endpoint quiz tương ứng.
2. Auth, role và validator chạy trước.
3. Service load quiz kèm lesson, section và course.
4. Nếu quiz không tồn tại, throw `QUIZ_NOT_FOUND`.
5. Nếu quiz thuộc course của Mentor khác, throw `COURSE_NOT_OWNED`.
6. Với update/delete, service kiểm tra course status editable.
7. Repository thực hiện thao tác.
8. Controller trả response chuẩn.

### Create question

1. Client gọi `POST /mentor/quizzes/:quizId/questions`.
2. Auth, role và validator chạy trước.
3. Service load quiz kèm lesson, section và course.
4. Nếu quiz không tồn tại, throw `QUIZ_NOT_FOUND`.
5. Nếu quiz thuộc course của Mentor khác, throw `COURSE_NOT_OWNED`.
6. Service kiểm tra course status editable.
7. Service validate `options_json`.
8. Service validate `correct_answer` khớp options.
9. Repository tạo quiz question.
10. Controller trả HTTP 201.

### Get/update/delete question

1. Client gọi endpoint question tương ứng.
2. Auth, role và validator chạy trước.
3. Service load question kèm quiz, lesson, section và course.
4. Nếu question không tồn tại, throw `QUESTION_NOT_FOUND`.
5. Nếu question thuộc course của Mentor khác, throw `COURSE_NOT_OWNED`.
6. Với update/delete, service kiểm tra course status editable.
7. Với update, service validate `options_json` và `correct_answer` nếu có trong payload.
8. Repository thực hiện thao tác.
9. Controller trả response chuẩn.

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
* `quizzes`
* `quiz_questions`

**Global backend utilities**

* Prisma client
* App error classes
* Error middleware
* Response helper nếu project đã có

**Downstream features/modules**

* Member D sẽ dùng `quizzes` và `quiz_questions` cho learner quiz submission.
* `feat-submit-course-review` cần quiz/question để snapshot full curriculum.

## 5. RISKS & MITIGATIONS

| Risk                                       | Impact                                    | Mitigation                                                                         |
| ------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Quên check ownership qua course            | Mentor A có thể xem/sửa quiz của Mentor B | Service bắt buộc load quiz/question kèm lesson/section/course và check `mentor_id` |
| Cho sửa quiz khi course published          | Sai lệch content của course đã bán/enroll | Service áp dụng E1.2 cho mọi thao tác ghi                                          |
| `options_json` sai format                  | Member D không auto-grade được            | Zod/validator kiểm tra schema options trước khi lưu                                |
| `correct_answer` không khớp options        | Auto-grade sai                            | Service validate correct_answer phải thuộc options                                 |
| Tự tạo bảng `quiz_options`                 | Lệch database final                       | Spec/TASKS ghi rõ không tạo bảng mới                                               |
| Gộp learner submission vào authoring       | Scope creep, trùng Member D               | Out of Scope và tests check không có submission endpoint                           |
| Expose correct_answer cho Learner          | Gian lận quiz                             | Feature này chỉ là Mentor API; learner-facing API thuộc Member D phải tự filter    |
| Tự chặn quiz theo lesson type              | Thêm business rule không có trong final docs | Không dùng `INVALID_LESSON_FOR_QUIZ`; chỉ validate lesson tồn tại, ownership và course status |
| Delete quiz làm mất questions ngoài ý muốn | Mất dữ liệu authoring                     | Confirm cascade rule theo API final; chỉ delete sau ownership/status check         |

## 6. QUESTIONS FOR HUMAN

* `options_json` schema chính xác nên dùng option id nội bộ hay index?
* `correct_answer` lưu option id, index hay text?
* `pass_score` dùng phần trăm hay điểm tuyệt đối?
* Delete quiz có cascade delete questions hay phải chặn nếu quiz còn questions?
* Mentor có được view quiz/question khi course đang `pending_review` không?

