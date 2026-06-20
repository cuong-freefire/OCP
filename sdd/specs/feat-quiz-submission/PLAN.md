# Implementation Plan: Quiz Submission & Auto-grading (feat-quiz-submission)

**Version:** 1.0.0 | **Owner:** Member D | **Status:** DRAFT  
**Generated:** 2026-06-18 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy

- **Backend as Source of Truth**: Quiz validation and auto-grade happen entirely on backend (trust the backend)
- **DI Pattern (E4.4)**: `EnrollmentService` injected into `QuizService` via constructor - NEVER HTTP fetch
- **Exact-match Grading**: Compare `selectedOptions` arrays with `correct_answer` arrays (JSON equality)
- **Immutable correct_answer**: Only repository reads `quiz_questions.correct_answer` - never exposed to frontend

### Key Patterns

1. **Auto-grade Algorithm**: For each question, sort both arrays → JSON stringify compare
2. **Multiple Attempts**: Each submit creates new `quiz_submissions` record (no update)
3. **No correct_answer Leak**: Service layer strips `correct_answer` from all quiz responses

---

## 2. COMPONENTS

### Backend Module Structure

#### A. Controller

- **POST `/quizzes/:quizId/submit`**: Validate body → call QuizService.submitQuiz() → return score

#### B. Service (`quiz.service.js`)

- **constructor(enrollmentService)**: DI from Member C
- **submitQuiz(userId, quizId, answers)**: Access check → load questions → auto-grade → save submission → return result

#### C. Repository (extend learning.repository.js)

- **findQuizWithQuestions(quizId)**: SELECT quiz + quiz_questions (include correct_answer for grading)
- **createSubmission({ userId, quizId, answersJson, score, passed })**: INSERT quiz_submissions

---

## 3. DATA FLOW

```
Learner: POST /quizzes/:quizId/submit { answers: [{ questionId, selectedOptions }] }
  ↓
authMiddleware(requireRole=LEARNER) → validate body
  ↓
QuizService.submitQuiz(userId, quizId, answers):
  - Load quiz + questions (with correct_answer)
  - Get courseId from quiz → lesson → section → course
  - Call this.enrollmentService.canAccessCourse(userId, courseId, 'LEARNER')
  - For each question:
    - Find matching answer by questionId
    - Sort + JSON.stringify compare selectedOptions vs correct_answer
    - Count correct answers
  - score = (correctCount / totalQuestions) * 100
  - passed = score >= quiz.pass_score
  - Save submission
  - Return { submissionId, score, passed, totalQuestions, correctAnswers }
  ↓
Controller: HTTP 201 with result (NO correct_answer)
```

---

## 4. DEPENDENCIES

| Package | Purpose |
|---------|---------|
| `zod` | Request validation (answers array schema) |

Implementation order: Validator → Repository → Service → Controller → Route

---

## 5. RISKS

### Risk: correct_answer exposed via API (HIGH)

**Mitigation**: Repository returns full question data for grading, but service NEVER includes `correct_answer` in controller response. Separate DTO/strip function.

---

## Sign-Off

**Plan Owner:** Member D (Learning Module)  
**Next Step:** Human approval → implement tasks.md