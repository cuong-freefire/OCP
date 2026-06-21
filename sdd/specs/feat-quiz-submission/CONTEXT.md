# Context: Quiz Submission & Auto-grading (feat-quiz-submission)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Feature ID:** feat-quiz-submission | **Inherits:** CLAUDE.md, share_context.md, DATABASE.md

## 1. Feature Overview

Tính năng này cho phép Learner nộp bài quiz và nhận kết quả chấm tự động (auto-grade). Quiz là một phần của bài học trong khóa học.

## 2. Related Business Requirements

- Learner chỉ được submit quiz khi có enrollment active (kiểm tra qua EnrollmentService từ Member C)
- Sử dụng DI pattern (E4.4) - gọi `EnrollmentService.canAccessCourse()` qua constructor injection, KHÔNG HTTP fetch()
- Auto-grade so sánh answers_json với `quiz_questions.correct_answer` (JSON array)
- Learner có thể submit quiz nhiều lần (không giới hạn số lần trong MVP)
- Chỉ câu hỏi có đáp án rõ ràng (correct_answer NOT NULL) mới được chấm
- Quiz không cấp certificate - chỉ là công cụ kiểm tra kiến thức

## 3. Related Tasks

| ID | Task | Dependencies |
|----|------|-------------|
| T061 | POST /quizzes/:quizId/submit (auto-grade, DI injection - E4.4) | T044 (EnrollmentService từ Member C) |
| T061 | GET /quizzes/:quizId/submissions (đã cover trong feat-learning-lessons) | - |

## 4. Critical Fix - E4.4: Dependency Injection

```javascript
// ĐÚNG: DI pattern
class QuizService {
  constructor(enrollmentService) {
    this.enrollmentService = enrollmentService; // Injected from Member C
  }
  
  async submitQuiz(userId, courseId, quizId, answers) {
    const canAccess = await this.enrollmentService.canAccessCourse(
      userId, courseId, 'LEARNER'
    );
    if (!canAccess) throw new ForbiddenError('NOT_ENROLLED');
    // Auto-grade logic...
  }
}
```

## 5. Module Ownership

- **Member D (Learning):** Owns `quiz_submissions` table
- **Member C (Payment/Enrollment):** Provides `EnrollmentService` via DI
- **Member A (Auth):** Provides AUTH_MIDDLEWARE
- **Member B (Mentor):** Owns `quizzes`, `quiz_questions` tables (READ ONLY for Member D)

## 6. Constraints & Business Rules

- answers_json phải là JSON array (các câu trả lời của learner)
- correct_answer là JSON array (không expose cho learner trước khi submit)
- Auto-grade dùng exact match trên từng câu hỏi
- Submission được lưu với tất cả answers (không lưu riêng câu đúng/sai)
- score = (số câu đúng / tổng số câu) * 100
- passed = score >= quiz.pass_score