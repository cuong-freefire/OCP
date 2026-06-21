# TASKS.md - Quiz Submission Implementation Tasks

**Version:** 1.0  
**Feature:** Quiz Submission & Auto-grading  
**Owner:** Member D  
**Created:** 2026-06-18  
**Status:** Ready for Implementation

---

## Task Overview

Total: 5 tasks, Estimated: 13 hours

---

### T001: Create Quiz Validator

**Tên**: Zod schema for quiz submission request body

**Files**:
- `backend/src/validators/quiz.validator.js` (new)

**Est. Time**: 1.5h

**Description**:
```javascript
const submitQuizSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptions: z.array(z.union([z.string(), z.number()]))
  })).min(1, 'At least one answer required')
});
```

---

### T002: Extend Repository - Quiz & Submission

**Tên**: Add quiz question loading and submission creation

**Files**:
- `backend/src/repositories/learning.repository.js` (update)

**Est. Time**: 2.5h

**Description**:
Add functions:
1. `findQuizWithQuestions(quizId)`: SELECT quiz + quiz_questions with correct_answer
2. `createSubmission(data)`: INSERT into quiz_submissions

---

### T003: Implement QuizService

**Tên**: Quiz service with auto-grade logic + DI

**Files**:
- `backend/src/services/quiz.service.js` (new)

**Est. Time**: 4h

**Dependencies**: T001, T002

**Description**:
```javascript
class QuizService {
  constructor(enrollmentService, repository) {
    this.enrollmentService = enrollmentService;
    this.repository = repository;
  }
  
  async submitQuiz(userId, quizId, answers) {
    const quiz = await this.repository.findQuizWithQuestions(quizId);
    if (!quiz) throw new NotFoundError('QUIZ_NOT_FOUND');
    
    const courseId = quiz.lesson.section.courseId;
    const canAccess = await this.enrollmentService.canAccessCourse(userId, courseId, 'LEARNER');
    if (!canAccess) throw new ForbiddenError('NOT_ENROLLED');
    
    // Auto-grade
    let correctCount = 0;
    for (const question of quiz.questions) {
      const answer = answers.find(a => a.questionId === question.id);
      if (!answer) continue; // Skipped questions are wrong
      const isCorrect = this.checkAnswer(answer.selectedOptions, question.correctAnswer);
      if (isCorrect) correctCount++;
    }
    
    const totalQuestions = quiz.questions.length;
    const score = (correctCount / totalQuestions) * 100;
    const passed = score >= quiz.passScore;
    
    const submission = await this.repository.createSubmission({
      userId, quizId, answersJson: answers, score, passed
    });
    
    return { submissionId: submission.id, score, passed, totalQuestions, correctAnswers: correctCount };
  }
  
  checkAnswer(selected, correct) {
    const sortStr = (arr) => [...arr].sort().join(',');
    return sortStr(selected) === sortStr(correct);
  }
}
```

---

### T004: Implement Controller & Route

**Tên**: Quiz submit controller + route

**Files**:
- `backend/src/controllers/quiz.controller.js` (new)
- `backend/src/api/learning.routes.js` (update)

**Est. Time**: 2h

**Dependencies**: T003

**Description**:
- Controller: `submitQuiz(req, res, next)` → call quizService.submitQuiz()
- Route: `POST /quizzes/:quizId/submit` → authMiddleware → requireRole(LEARNER) → validateSubmitQuiz → submitQuiz

---

### T005: Unit & Integration Tests

**Tên**: Tests for quiz submission

**Files**:
- `backend/tests/unit/services/quiz.service.test.js` (new)
- `backend/tests/integration/quiz.test.js` (new)

**Est. Time**: 3h

**Dependencies**: T004

**Description**:
Unit tests: auto-grade logic (exact match, partial match, wrong answer, empty answer)
Integration tests: submit success, not enrolled, quiz not found, invalid body

---

## SUMMARY

| ID | Task | Est. Time |
|----|------|-----------|
| T001 | Quiz Validator | 1.5h |
| T002 | Repository Extension | 2.5h |
| T003 | QuizService with DI | 4h |
| T004 | Controller & Route | 2h |
| T005 | Tests | 3h |
| **Total** | | **13h** |

---

**Status**: Ready. Depends on EnrollmentService from Member C.