# Feature: Quiz Submission & Auto-grading (Nộp bài & Chấm tự động)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Mức độ:** Detailed (Risk: High) | **Inherits:** CLAUDE.md, share_context.md, AUTH_MIDDLEWARE, EnrollmentService

---

## 1. Context & Goal

Cho phép Learner nộp bài quiz và nhận kết quả chấm tự động. Đây là tính năng cốt lõi để đánh giá kiến thức của learner sau mỗi bài học. Yêu cầu bảo mật cao: chỉ learner có enrollment active mới được submit, sử dụng Dependency Injection (E4.4) để gọi EnrollmentService từ Member C.

---

## 2. Actors & Roles

- **Learner**: Người dùng có enrollment active. Submit quiz, xem kết quả tự động.
- **Mentor/Manager/Admin**: Không submit quiz (chỉ xem submissions qua các API khác).

---

## 3. Functional Requirements (EARS Notation)

### 3.1 Nộp bài quiz (POST /quizzes/:quizId/submit)

- **WHEN** Learner gửi POST `/quizzes/:quizId/submit` với answers hợp lệ, **THE hệ thống SHALL**:
  1. Xác thực User qua `authMiddleware` (yêu cầu role LEARNER).
  2. Validate request body: `answers` là JSON array, mỗi phần tử có `questionId` (UUID) và `selectedOptions` (array).
  3. Truy vấn quiz + lesson + section + course để lấy courseId cho access check.
  4. Gọi `this.enrollmentService.canAccessCourse(userId, courseId, 'LEARNER')` qua DI.
  5. Nếu không có quyền → throw `ForbiddenError('NOT_ENROLLED')`.
  6. Truy vấn `quiz_questions` của quiz (bao gồm `correct_answer`).
  7. Thực hiện auto-grade:
     - Với mỗi câu trả lời, so sánh `selectedOptions` với `correct_answer`.
     - Tính score = (số câu đúng / tổng số câu) * 100.
     - passed = score >= quiz.pass_score.
  8. Lưu submission vào bảng `quiz_submissions` với answers_json, score, passed.
  9. Trả về HTTP 201 với kết quả: { submissionId, score, passed, totalQuestions, correctAnswers }.

### 3.2 Xem lịch sử nộp bài (GET /quizzes/:quizId/submissions)

- Đã được định nghĩa trong feat-learning-lessons (SPEC Section 3.3).

---

## 4. Non-functional Requirements

- **Security (E4.4 - DI)**: `EnrollmentService` injected qua constructor. TUYỆT ĐỐI KHÔNG dùng HTTP fetch().
- **Security (No correct_answer leak)**: API submit KHÔNG trả về `correct_answer` trong response. Chỉ trả về score và passed.
- **Performance**: Auto-grade < 100ms cho quiz có 20 câu hỏi.
- **Data Integrity**: answers_json lưu đầy đủ câu trả lời của learner (không lưu riêng câu đúng/sai).
- **Idempotency**: Cùng learner submit cùng quiz nhiều lần → tạo nhiều submissions (không idempotent - mỗi lần là một attempt mới).

---

## 5. Data Model (Tóm tắt từ DATABASE.md)

Bảng thuộc Member D:

- `quiz_submissions`: id, user_id, quiz_id, answers_json (JSON), score (DECIMAL), passed (BOOLEAN), submitted_at

Bảng thuộc Member B (READ ONLY):

- `quizzes`: id, lesson_id, title, pass_score
- `quiz_questions`: id, quiz_id, question, options_json, correct_answer (JSON), order_index

---

## 6. Error Handling (EARS Unwanted Patterns)

- **WHERE** Learner không có enrollment active, **THE hệ thống SHALL** trả về HTTP 403 Forbidden với code `NOT_ENROLLED`.
- **WHERE** quiz không tồn tại, **THE hệ thống SHALL** trả về HTTP 404 Not Found với code `QUIZ_NOT_FOUND`.
- **WHERE** request body `answers` không phải JSON array hoặc thiếu `questionId`/`selectedOptions`, **THE hệ thống SHALL** trả về HTTP 400 Bad Request.
- **WHERE** `answers` chứa `questionId` không thuộc quiz này, **THE hệ thống SHALL** trả về HTTP 400 Bad Request với code `INVALID_QUESTION_ID`.
- **WHERE** EnrollmentService throw error, **THE hệ thống SHALL** trả về HTTP 503 Service Unavailable với code `ACCESS_CHECK_FAILED`.
- **WHERE** Learner gửi answers với `selectedOptions` rỗng, **THE hệ thống SHALL** coi là câu trả lời sai (không throw error).

---

## 7. Acceptance Criteria

- [ ] POST `/quizzes/:quizId/submit`: Learner có enrollment active submit quiz → nhận score + passed.
- [ ] POST `/quizzes/:quizId/submit`: Learner không có enrollment active → HTTP 403 `NOT_ENROLLED`.
- [ ] POST `/quizzes/:quizId/submit`: Quiz không tồn tại → HTTP 404 `QUIZ_NOT_FOUND`.
- [ ] Auto-grade tính đúng score: 5/10 câu đúng → score = 50.
- [ ] passed = true khi score >= quiz.pass_score.
- [ ] answers_json lưu đầy đủ trong DB.
- [ ] DI pattern: EnrollmentService injected, không HTTP fetch.
- [ ] Không trả về correct_answer trong response.

---

## 8. Out of Scope

- Không có quiz timer/time limit.
- Không có review answers sau submit (chỉ xem score).
- Không có certificate dựa trên quiz.
- Không có randomize questions (luôn cố định thứ tự).
- Không có multiple quiz attempts limit (không giới hạn số lần submit).
- Không có quiz analytics cho Mentor (sẽ ở spec riêng).