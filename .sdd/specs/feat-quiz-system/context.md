## 1. PROBLEM STATEMENT (Tuyên bố bài toán)

Tính năng `feat-quiz-system` cần xây dựng hệ thống kiểm tra (quiz) trực tuyến cho OCP, cho phép học viên đã ghi danh (enrolled learner) truy cập các bài quiz gắn với khóa học hoặc bài học, nộp câu trả lời, nhận điểm tự động từ backend, và xem lại kết quả cùng lịch sử bài nộp của chính mình. Backend là nguồn dữ liệu chuẩn duy nhất cho quiz eligibility, timing, scoring và result ownership.

Học viên cần có các luồng quiz chính: xem danh sách quiz đang hoạt động trong khóa học/bài học có quyền truy cập; bắt đầu quiz và nhận câu hỏi an toàn (không bao gồm đáp án đúng trước khi nộp); nộp câu trả lời và nhận điểm tự động từ backend cho các loại câu hỏi `single_choice`, `multiple_choice`, `true_false`; xem kết quả bài nộp (score, max score, passed status, per-question review); và xem lịch sử bài nộp của chính mình.

Tính năng phải ngăn các triển khai sai hợp đồng bảo mật OCP: không để frontend quyết định score, max score, pass status, correct answer, userId, course access, payment status hoặc result ownership; không tiết lộ đáp án đúng trước khi nộp bài; không cho learner xem bài nộp của learner khác; và không cho phép truy cập quiz của khóa học trả phí khi chưa có enrollment hợp lệ.

Đầu ra của pha này chỉ là tài liệu bối cảnh tại `.sdd/specs/feat-quiz-system/context.md`. Không triển khai code, không tạo endpoint, không sửa Prisma schema, không tạo migration, không tạo UI, và không triển khai các module ngoài Quiz System.

## 2. DOMAIN KNOWLEDGE (Kiến thức chuyên môn / Nghiệp vụ)

- OCP là nền tảng khóa học trực tuyến. Quiz System bảo đảm mỗi bài kiểm tra đều có eligibility, timing, scoring và result ownership đáng tin cậy từ backend trước khi kết quả được dùng cho course progress, certificate hoặc các module nghiệp vụ khác.
- Backend sử dụng NodeJS, JavaScript ESM, Express-style REST API, Prisma và MySQL. Frontend sử dụng React JSX, Bootstrap và Create React App (`react-scripts`).
- Backend phải theo kiến trúc `Route -> Middleware -> Controller -> Service -> Repository -> Prisma/MySQL`. Controller chỉ nhận request và trả response; service chứa business logic (bao gồm auto-grading logic); repository là tầng duy nhất thao tác Prisma/MySQL.
- Quiz + Question + Submission thuộc sở hữu module Member 4 - Đức (Learning + Quiz + Final Project). Module khác phải dùng Quiz contract, không tự xử lý quiz scoring, submission hoặc result.
- Quiz System sử dụng các cross-module contracts:
  - Auth/User module (Member 1 - AnhND): cung cấp backend-authenticated learner identity và role.
  - Course module (Member 2 - Nam): cung cấp course structure, lesson context, quiz ownership (course_id, lesson_id).
  - Enrollment/Access module (Member 3 - CuongLH): cung cấp course access decision, xác nhận learner có active enrollment hay không trước khi cho phép truy cập quiz của paid course.
- Các bảng Quiz cốt lõi theo thiết kế database gồm:
  - `quizzes`: lưu quiz gắn với `course_id` (bắt buộc) và `lesson_id` (tùy chọn); gồm `title`, `description`, `time_limit_minutes`, `passing_score`, `status` (active/draft/inactive), và timestamps.
  - `quiz_questions`: lưu câu hỏi thuộc quiz; gồm `question_text`, `question_type` (single_choice, multiple_choice, true_false), `options` (JSON array), `correct_answer`, `explanation`, `points`, `order`, và timestamps.
  - `quiz_submissions`: lưu bài nộp của learner; gồm `user_id`, `quiz_id`, `answers` (JSON snapshot), `score`, `max_score`, `passed`, `started_at`, `submitted_at`, và `created_at`.
- Quiz gắn với course (bắt buộc) và có thể gắn với lesson (khi có lesson_id). Quiz chỉ available khi course active, lesson active (nếu lesson-bound), và quiz status = active.
- Chỉ learner có enrollment hợp lệ (active course access) mới được xem và làm quiz của paid course. Free course quiz cũng yêu cầu enrollment nhưng không qua payment.
- Backend auto-grade áp dụng cho các loại câu hỏi: `single_choice` (so khớp chính xác một đáp án), `multiple_choice` (so khớp chính xác tập đáp án, order-insensitive, extra selections bị tính sai), `true_false` (so khớp boolean). Các loại câu hỏi khác (essay, free-text) không được auto-grade trong MVP này.
- Score được backend tính từ `points` của mỗi câu hỏi đúng. Max score là tổng `points` của tất cả câu hỏi trong quiz. Passed status được backend xác định bằng cách so sánh (score / max_score * 100) với `quiz.passing_score` threshold.
- Quiz có thể có `time_limit_minutes`. Nếu có, backend ghi `started_at` khi learner bắt đầu quiz và so sánh với `submitted_at` để kiểm tra late submission. Nếu `time_limit_minutes = null`, quiz không có timer enforcement.
- Pre-submission question payload KHÔNG bao gồm `correct_answer`, `explanation`, hoặc bất kỳ field nào tiết lộ đáp án đúng. Post-submission result có thể reveal explanation và correct answer, nhưng chỉ cho learner sở hữu submission.
- Quiz submission là authoritative record của một assessment attempt. Mỗi submission gồm snapshot answers, backend-calculated score, max score, passed status và timestamps. Learners có thể có multiple submissions trừ khi later spec định nghĩa retake limits.
- Quiz System chỉ owns `quizzes`, `quiz_questions`, `quiz_submissions`. Không tự query bảng `users`, `courses`, `lessons`, `enrollments`, `payments`. Mọi thông tin về user identity, course structure, và course access đều qua approved contracts.
- Quiz authoring UI, question CRUD và bulk import không thuộc learner-facing MVP này. Quiz và question được tạo qua seed data, admin workflow hoặc later quiz-authoring feature.

## 3. STAKEHOLDERS (Các bên liên quan)

- Learner (đã sign-in, có enrollment): truy cập quiz listing, start quiz, submit answers, xem kết quả và lịch sử bài nộp của chính mình.
- Learner (không có enrollment): không được xem hoặc làm quiz của paid course; có thể thấy quiz không available.
- Guest: không có quyền truy cập quiz behavior vì chưa có session hợp lệ.
- Backend Quiz service: chịu trách nhiệm validate quiz eligibility, cung cấp safe question payload (không correct_answer trước submission), auto-grading, lưu submission, tính score/max score/passed status, enforce timed quiz rules, kiểm tra submission ownership, và không leak sensitive data.
- Auth/User module (Member 1 - AnhND): cung cấp identity và role qua session cookie.
- Course module (Member 2 - Nam): cung cấp course và lesson structure, quiz ownership context.
- Enrollment/Access module (Member 3 - CuongLH): cung cấp course access decision, xác nhận enrollment active cho paid course.
- Frontend Quiz UI/API client: cung cấp màn hình quiz listing, quiz taking, quiz result và quiz history; gọi API qua `frontend/src/api`, dùng `REACT_APP_API_BASE_URL` và `withCredentials: true`; không tự quyết định score, pass status, correct answer hoặc timer validity.
- Future modules: Learning Progress, Certificate, Report có thể dùng Quiz submission data cho course completion, certificate eligibility và analytics, nhưng các module đó tự định nghĩa eligibility và business rules riêng.

## 4. CONSTRAINTS (Các ràng buộc)

- Stack cố định: backend NodeJS + JavaScript ESM + Express-style REST API; frontend React + JSX + Bootstrap + CRA `react-scripts`; MySQL; Prisma; JWT trong httpOnly Cookie; bcrypt; Zod; npm.
- Không chuyển sang TypeScript, CommonJS, Vite/Next.js, ORM/database khác, Bearer-token auth hoặc provider thanh toán khác cho MVP.
- JWT chỉ được lưu trong Cookie httpOnly. Backend đọc token từ `req.cookies`. Frontend gửi request kèm cookie bằng `withCredentials: true`.
- Cookie auth MVP dùng `sameSite = "lax"`, `secure = false` ở local dev, `secure = true` ở production.
- CORS phải allow chính xác `FRONTEND_ORIGIN` và `credentials: true`; không dùng wildcard origin khi gửi cookie.
- Quiz System yêu cầu session backend-authenticated hợp lệ cho mọi hành vi protected: quiz listing, start, submission, result review, và history.
- Backend-authenticated identity là nguồn duy nhất cho learner user id. KHÔNG chấp nhận frontend-supplied user id, role, enrollment state, payment state, access state, score, max score, hoặc passed state.
- Quyền truy cập khóa học phải được xác nhận qua Enrollment/Access authority trước khi trả về quiz details, quiz questions, chấp nhận submission, hoặc trả về quiz history cho paid course.
- Quiz System KHÔNG đọc hoặc quyết định payment status trực tiếp. Paid-course quiz unlock decisions thuộc về Payment/Enrollment/Access module.
- Hệ thống chỉ trả về active quizzes cho learner-facing quiz listing. Draft hoặc inactive quizzes không được hiển thị.
- Quiz gắn với `course_id` (bắt buộc) và có thể gắn với `lesson_id` (tùy chọn). Hệ thống phải validate quiz thuộc course active/accessible và lesson active/available (nếu lesson-bound) trước khi cho learner start hoặc submit.
- Pre-submission question payload KHÔNG bao gồm `correct_answer`, `explanation`, raw scoring internals, hoặc bất kỳ field nào tiết lộ đáp án đúng.
- Hỗ trợ loại câu hỏi: `single_choice`, `multiple_choice`, `true_false` cho auto-grading.
- Submitted answers phải được validated: check question ids có thuộc quiz không, question type có khớp không, answer values có hợp lệ không. Reject unknown question ids, duplicate question ids, malformed values, unsupported types.
- Score và max score được backend tính từ stored question points và stored correct answers. Passed status được backend xác định từ `quiz.passing_score` threshold và calculated score percentage.
- KHÔNG trust frontend-provided score, max score, passed status, correct answer, explanation, started time, submitted time, hoặc elapsed time.
- Multiple-choice scoring: so sánh selected options order-insensitive; extra selected options bị tính là incorrect cho câu hỏi đó.
- Timed quiz: khi `time_limit_minutes` được cấu hình, backend phải so sánh `submitted_at - started_at` với `time_limit_minutes` và ngăn normal successful scoring cho late submissions.
- Quiz với `time_limit_minutes = null` không có timer enforcement.
- Quiz với no active questions phải unavailable cho successful submission.
- Mỗi valid quiz submission phải được lưu với: learner identity, quiz identity, snapshot submitted answers, backend-calculated score, max score, passed status, started time, submitted time và creation time.
- Learner chỉ được xem result và history của chính mình. KHÔNG cho phép view, modify hoặc delete submission của learner khác.
- Submission history trả về sanitized attempt data (quiz title, score, max score, passed status, submitted time). KHÔNG bao gồm raw correct answer data trừ khi là allowed post-submission result view cho learner sở hữu submission.
- Correct answer và explanation có thể revealed sau submission, nhưng chỉ cho learner sở hữu submission.
- Quiz module ownership: `quizzes`, `quiz_questions`, `quiz_submissions` thuộc Quiz module. Sử dụng approved Auth/User, Course, và Enrollment/Access contracts cho external data.
- Frontend route guards, visible quiz buttons, cached quiz state hoặc timer displays MAY improve UX nhưng KHÔNG được treated là real quiz eligibility, timing, scoring, hoặc result ownership.
- Quiz request bodies và route parameters quan trọng phải được validated bằng Zod trước khi business behavior chạy.
- Error responses phải follow project response shape `{ success, message, code, details }` hoặc approved equivalent. Không trả raw stack trace, Prisma/SQL raw error, secret, JWT, cookie value, password hash, correct_answer trước submission, hoặc submission data của learner khác.
- Quiz responses KHÔNG expose password hashes, JWT values, cookie values, payment internals, raw SQL errors, raw persistence errors, secrets, hoặc submission data của learner khác.
- Hệ thống phải fail safely khi required Auth, Course, hoặc Enrollment/Access dependencies không thể confirm identity, quiz context, course structure, hoặc access.
- API error response phải thống nhất theo `{ success, message, code, details }` hoặc response helper tương đương. Không trả raw stack trace, Prisma/SQL raw error, secret, JWT, cookie value, password hash, OTP hoặc OAuth token.
- Request body/query/params quan trọng phải validate bằng Zod hoặc validator đã duyệt.
- Frontend API calls phải đi qua `frontend/src/api`; không tự gắn `Authorization: Bearer <token>`; không dùng `localStorage` hoặc `sessionStorage` để lưu JWT.
- Frontend dùng CRA env contract: `REACT_APP_API_BASE_URL`; không dùng `VITE_*`, `REACT_API_URL` hoặc biến khác cho cùng ý nghĩa.
- Backend env contract phải dùng đúng tên trong `backend/.env.example`: `PORT`, `API_PREFIX`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `AUTH_SECRET`, `COOKIE_ACCESS_NAME`, `COOKIE_REFRESH_NAME`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
- Frontend env contract phải dùng đúng tên trong `frontend/.env.example`: `PORT` và `REACT_APP_API_BASE_URL`.
- Không đọc/in giá trị thật trong `.env`, credentials, secrets, private keys hoặc API keys. Chỉ dùng `.env.example` làm hợp đồng tên biến.
- Tests sau này phải dùng setup đã duyệt: backend `node:test` + `assert` + `supertest`; frontend `node:test` cho API client/source-rule checks nhẹ. Không tự thêm test framework khác nếu chưa có approval.
- Phạm vi ngoài `feat-quiz-system`: quiz authoring UI, quiz/question CRUD, bulk import, manual grading, essay/free-text questions, partial-credit scoring, randomized question pools, anti-cheating, proctoring, browser lockdown, retake limits, cooldowns, leaderboards, gamification, certificate generation, admin report dashboards, payment checkout, enrollment creation, course CRUD, lesson management, learning progress ngoài quiz attempt history, final project submission, mentor review, auth registration, login, logout, profile management.

## 5. ASSUMPTIONS (Các giả định)

- `.sdd/specs/feat-quiz-system/context.md` là artifact Pha 0 cho workflow Quiz System; `spec.md`, `plan.md` và `tasks.md` sẽ được tạo hoặc cập nhật sau dựa trên context này.
- Active quizzes và questions đã tồn tại qua seed data, approved admin/content workflow, hoặc later quiz-authoring feature; authoring không phải part của learner-facing MVP này.
- Active course access được determine bởi Payment/Enrollment/Access module, bao gồm free enrollment và paid enrollment sau verified successful payment.
- Course và lesson status, structure, và availability được owned bởi Course module và consumed bởi Quiz qua approved contracts. Quiz module không tự query bảng courses/lessons.
- Quiz `passing_score` được interpret là percentage threshold từ 0 đến 100. Ví dụ: passing_score = 70 nghĩa là learner cần đạt 70% tổng số điểm để passed.
- Quiz với `time_limit_minutes = null` không có timer enforcement. Timed quiz windows bắt đầu khi backend records learner's quiz start time.
- Learners có thể có multiple submissions trừ khi later spec định nghĩa retake limits, cooldowns, hoặc best-score behavior.
- Explanations chỉ được show sau submission và chỉ khi safe cho learner sở hữu submission.
- Frontend quiz screens có thể improve navigation và feedback, nhưng tất cả real access, timing, scoring, pass/fail và result ownership decisions remain backend-controlled.
- Quiz System có thể expose stable submission data cho future course progress, certificate, report hoặc learning analytics features, nhưng những features define eligibility và business rules của họ trong separate specs.
- Backend sẽ expose REST API dưới `API_PREFIX`, và frontend CRA sẽ gọi backend bằng `REACT_APP_API_BASE_URL`.
- Local dev mặc định dùng frontend CRA origin khớp `FRONTEND_ORIGIN` và backend API origin khớp cấu hình env example.
- Quiz không hỗ trợ randomized question pools trong MVP này; tất cả learner nhận cùng bộ câu hỏi cho cùng một quiz attempt.
- Không có anti-cheating, proctoring hoặc browser lockdown trong MVP này.

## 6. OPEN QUESTIONS (Các câu hỏi còn bỏ ngỏ)

- API contract chính xác cho Quiz System sẽ dùng các route dự kiến nào? Ví dụ: `GET /courses/:courseId/quizzes`, `GET /quizzes/:quizId`, `POST /quizzes/:quizId/start`, `POST /quizzes/:quizId/submit`, `GET /quizzes/:quizId/result`, `GET /quizzes/:quizId/history`.
- Quiz submission có cần hỗ trợ draft/save-in-progress để learner có thể tạm dừng và tiếp tục sau không, hay chỉ support submit một lần liên tục?
- Khi timed quiz hết giờ, backend có tự động submit những answers đã được learner chọn (nếu có) hay đánh dấu submission là failed và không chấm điểm?
- Nếu learner có multiple submissions, submission history có cần phân biệt "attempt number" (lần thử thứ mấy) hay chỉ đơn thuần là danh sách chronological?
- Quiz result view có cần hỗ trợ phân trang cho quiz có nhiều câu hỏi, hay trả về tất cả per-question review data trong một response?
- Quy tắc retake limits, cooldown giữa các lần làm lại quiz, và best-score behavior có thuộc MVP này không hay sẽ được định nghĩa trong later spec?
- Quiz `passing_score` có cần hỗ trợ absolute score (ví dụ đạt ít nhất 5 điểm) thay vì percentage threshold không? Hiện tại giả định là percentage.
- Quiz attempt có cần ghi lại `ip_address`, `user_agent` hoặc các metadata khác cho audit không?

## 7. IMPLEMENTATION ALIGNMENT NOTES (Cập nhật sau triển khai)

- (Sẽ được cập nhật sau khi triển khai)