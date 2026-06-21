# CONTEXT.md - feat-quiz-authoring

## 1. PROBLEM STATEMENT

Sau khi Mentor tạo được course, section và lesson trong `feat-curriculum-builder`, Mentor cần khả năng tạo quiz cho lesson để kiểm tra mức độ hiểu bài của Learner. Feature `feat-quiz-authoring` giải quyết phần authoring của quiz trong Mentor Course Studio: tạo/sửa/xóa quiz và tạo/sửa/xóa quiz question.

Feature này chỉ xử lý việc Mentor xây dựng nội dung quiz. Learner submit quiz, chấm điểm quiz submission, lưu kết quả làm bài, rating/feedback, learning flow và progress thuộc Member D, không thuộc feature này.

Nếu không có feature này, khóa học chỉ có video/document lesson mà chưa có bài kiểm tra. `feat-submit-course-review` cũng sẽ thiếu dữ liệu quiz/questions khi snapshot curriculum gửi Manager review.

Feature này phải đảm bảo Mentor chỉ CRUD quiz/question thuộc lesson trong course do mình sở hữu. Backend phải kiểm tra ownership theo chuỗi quan hệ `quiz/question -> lesson -> section -> course -> mentor_id`.

## 2. DOMAIN KNOWLEDGE

**Quiz** là bài kiểm tra gắn với một lesson. Theo database final của team, quiz nằm trong bảng `quizzes` và liên kết với lesson bằng `lesson_id`.

**Quiz Question** là câu hỏi trong quiz. Theo database final, câu hỏi được lưu trong bảng `quiz_questions`, gồm `question`, `options_json`, `correct_answer`, và `order_index`.

**options_json** là dữ liệu JSON lưu danh sách lựa chọn của câu hỏi. Feature này phải validate schema JSON để tránh dữ liệu rác hoặc sai format.

**correct_answer** là dữ liệu JSON lưu đáp án đúng phục vụ auto-grade ở Member D. Trong API Mentor authoring, Mentor được phép tạo/sửa đáp án đúng. Tuy nhiên, đáp án đúng không được expose cho Learner trước khi Learner submit quiz. Learner-facing API không thuộc feature này.

**Pass Score** là điểm đạt yêu cầu của quiz. Giá trị này thuộc bảng `quizzes` nếu database final quy định.

**Ownership Validation** là kiểm tra quiz/question thuộc lesson, lesson thuộc section, section thuộc course, và `course.mentor_id === req.user.id`.

**Editable Course** là course đang ở trạng thái Mentor được phép chỉnh sửa. Theo rule Member B, chỉ cho chỉnh quiz/question nếu course status thuộc `draft` hoặc `rejected`. Course `published` bị khóa chỉnh sửa theo E1.2.

## 3. STAKEHOLDERS

**Mentor** là actor chính. Mentor tạo, xem, sửa và xóa quiz/question trong course do mình sở hữu.

**Member A** cung cấp `AUTH_MIDDLEWARE`, JWT, roleVersion và `req.user.id`.

**Member B** sở hữu feature này và các bảng `quizzes`, `quiz_questions`, đồng thời dùng `courses`, `course_sections`, `lessons` để kiểm tra ownership.

**Member D** sẽ dùng quiz/questions ở learner flow để cho Learner làm quiz và auto-grade. Member D không được implement trong feature này.

**Manager** không gọi API trong feature này, nhưng sẽ review quiz content sau khi Mentor submit course ở feature/phân hệ khác.

**Learner** không gọi API trong feature này và không được nhận `correct_answer` trước khi submit quiz.

## 4. CONSTRAINTS

* Chỉ viết scope cho `feat-quiz-authoring`.
* Chỉ dùng các API thuộc feature này:

  * `POST /mentor/lessons/:lessonId/quizzes`
  * `GET /mentor/quizzes/:quizId`
  * `PUT /mentor/quizzes/:quizId`
  * `DELETE /mentor/quizzes/:quizId`
  * `POST /mentor/quizzes/:quizId/questions`
  * `GET /mentor/questions/:questionId`
  * `PUT /mentor/questions/:questionId`
  * `DELETE /mentor/questions/:questionId`
* Chỉ thao tác các bảng:

  * `courses`
  * `course_sections`
  * `lessons`
  * `quizzes`
  * `quiz_questions`
* Không tạo migration mới trong feature spec này.
* Không thêm bảng mới.
* Không thêm API mới.
* Không tự tạo bảng `quiz_options`.
* Không xử lý learner quiz submission.
* Không xử lý quiz score/result/progress.
* Không xử lý rating/feedback.
* Không xử lý public catalog, payment, enrollment, learning, manager publish/reject hoặc admin management.
* API phải dùng `AUTH_MIDDLEWARE` từ Member A.
* API phải yêu cầu role `MENTOR`.
* Backend phải lấy Mentor identity từ `req.user.id`.
* Backend không được nhận hoặc tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Mọi request body, params và JSON field phải validate bằng Zod.
* Mọi thao tác quiz/question phải validate ownership thông qua course owner.
* Không được cho Mentor sửa quiz/question nếu course đang `published`.
* Chỉ cho CRUD quiz/question nếu course status thuộc `draft` hoặc `rejected`.
* `options_json` và `correct_answer` phải được validate schema.
* Error response không được leak stack trace, secret, JWT, cookie hoặc query nội bộ.

## 5. ASSUMPTIONS

* `quizzes` thuộc `lessons` thông qua `lesson_id`.
* `quiz_questions` thuộc `quizzes` thông qua `quiz_id`.
* Ownership được kiểm tra bằng chain: `question -> quiz -> lesson -> section -> course -> mentor_id`, hoặc `quiz -> lesson -> section -> course -> mentor_id`.
* Theo database final, `quiz_questions` dùng `options_json` và `correct_answer`; không có bảng `quiz_options`.
* `correct_answer` có thể là JSON array để phục vụ auto-grade.
* Feature này không có API learner-facing, nên Mentor authoring response có thể chứa `correct_answer` nếu cần cho màn hình edit quiz.
* Nếu không gửi `order_index`, backend có thể tự tính thứ tự câu hỏi tiếp theo trong quiz.
* Xóa quiz/question phải tuân theo API final và chỉ được thực hiện sau khi đã check ownership + course status.
* Nếu database không có soft delete cho quizzes/questions, DELETE có thể là hard delete trong phạm vi quiz/question thuộc course của Mentor hiện tại.

## 6. OPEN QUESTIONS

* `quizzes.pass_score` dùng thang điểm phần trăm, tổng điểm câu hỏi, hay số câu đúng tối thiểu?
* `options_json` schema chính xác gồm các field nào: `id`, `text`, `orderIndex`, hay chỉ là array string?
* `correct_answer` lưu option id, index, hay text của đáp án?
* Có giới hạn số lượng câu hỏi tối đa trong một quiz không?
* Khi DELETE quiz, có được cascade delete toàn bộ quiz_questions không, hay phải chặn nếu quiz đã có questions?

