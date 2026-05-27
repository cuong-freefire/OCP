# Feature Plan - Learning Flow

## Feature Information

| Field          | Value               |
| -------------- | ------------------- |
| Feature Name   | Learning Flow       |
| Module         | Learning + Progress |
| Feature Folder | feat-learning-flow  |
| Priority       | MVP                 |
| Status         | Planning            |

---

# 1. Implementation Overview

The Learning Flow feature will provide the core learner experience after successful course enrollment.

The implementation focuses on:

* secure lesson access
* learning dashboard
* progress tracking
* sequential lesson unlocking
* scalable learning structure

The feature must integrate tightly with:

* Authentication Module
* Course Module
* Enrollment & Access Module

The backend is responsible for enforcing all learning permissions and access validation.

---

# 2. Technical Objectives

## OBJ-01

Provide secure backend-controlled lesson access.

## OBJ-02

Support scalable course structures with sections and lessons.

## OBJ-03

Track learner progress reliably.

## OBJ-04

Support sequential learning paths.

## OBJ-05

Provide reusable learning contracts for future modules.

---

# 3. Proposed Architecture

## High-Level Architecture

```text id="emfqsd"
Frontend
    ↓
Learning Controller
    ↓
Learning Service
    ↓
Access Validation Service
    ↓
Course / Enrollment Modules
    ↓
Database
```

---

# 4. Main Components

## 4.1 Learning Controller

Responsibilities:

* Receive learning API requests
* Validate authentication
* Forward requests to services
* Return standardized responses

Endpoints:

* GET /learning/courses/:courseId
* GET /learning/lessons/:lessonId

---

## 4.2 Progress Controller

Responsibilities:

* Handle lesson progress updates
* Return course progress information

Endpoints:

* PUT /progress/lesson
* GET /progress/course/:courseId

---

## 4.3 Learning Service

Responsibilities:

* Build learning dashboard
* Retrieve lesson content
* Validate learning state
* Handle lesson unlock logic

---

## 4.4 Progress Service

Responsibilities:

* Update lesson progress
* Calculate course progress
* Determine completion state

---

## 4.5 Access Validation Service

Responsibilities:

* Verify learner enrollment
* Check lesson accessibility
* Prevent unauthorized access

Shared Contract:

```ts id="1f8do6"
canAccessCourse(userId, courseId): boolean
```

---

# 5. Data Flow Plan

## Lesson Access Flow

```text id="xvlmfx"
Learner Request Lesson
    ↓
JWT Validation
    ↓
Find Lesson
    ↓
Find Course
    ↓
Check Enrollment Access
    ↓
Check Lesson Unlock Status
    ↓
Return Lesson Content
```

---

## Lesson Completion Flow

```text id="nq8lkq"
Learner Marks Lesson Completed
    ↓
Validate Ownership
    ↓
Update lesson_progress
    ↓
Recalculate course_progress
    ↓
Unlock Next Lesson
    ↓
Return Updated Progress
```

---

# 6. Database Planning

---

## 6.1 lesson_progress

Purpose:
Track completion state for each lesson per learner.

Key Relationships:

* userId → users
* lessonId → lessons

Constraints:

* Unique(userId, lessonId)

---

## 6.2 course_progress

Purpose:
Track overall learner progress for a course.

Key Relationships:

* userId → users
* courseId → courses

Constraints:

* Unique(userId, courseId)

---

# 7. Sequential Learning Strategy

## Proposed Logic

### Rule 1

First lesson is unlocked automatically.

### Rule 2

Next lesson unlocks only after previous lesson completion.

### Rule 3

Locked lessons cannot return full lesson content.

---

## Unlock Validation Process

```text id="zhbwpx"
Request Lesson
    ↓
Get Previous Lesson
    ↓
Check Previous Completion
    ↓
Unlocked?
    ↓
YES → Return Content
NO  → Return Locked State
```

---

# 8. Progress Calculation Strategy

## Lesson Completion

A lesson becomes completed when:

* learner explicitly marks lesson completed

---

## Course Progress Formula

Course progress percentage:

completed lessons / total lessons × 100

---

# 9. API Planning

---

## 9.1 Learning Dashboard

### GET `/learning/courses/:courseId`

Purpose:
Return:

* sections
* lessons
* progress
* learning state

Authentication:
Required

Dependencies:

* course module
* enrollment module
* progress module

---

## 9.2 Watch Lesson

### GET `/learning/lessons/:lessonId`

Purpose:
Return lesson content securely.

Authentication:
Required

Validation:

* lesson exists
* learner has access
* lesson unlocked

---

## 9.3 Update Lesson Progress

### PUT `/progress/lesson`

Purpose:
Update learner lesson completion state.

Authentication:
Required

Validation:

* lesson ownership
* lesson exists

---

## 9.4 Get Course Progress

### GET `/progress/course/:courseId`

Purpose:
Return:

* completed lessons
* total lessons
* completion percentage

Authentication:
Required

---

# 10. Validation Plan

## Authentication Validation

All APIs require valid JWT.

---

## Access Validation

Paid lessons require valid enrollment.

---

## Ownership Validation

Learners may only update their own progress.

---

## Sequential Validation

Locked lessons cannot be accessed.

---

# 11. Error Handling Plan

## Standard Error Response

```json id="lp9g6x"
{
  "message": "Error message",
  "statusCode": 403
}
```

---

## Planned Error Cases

| Case                 | Status |
| -------------------- | ------ |
| Unauthorized         | 401    |
| No Enrollment Access | 403    |
| Lesson Locked        | 403    |
| Lesson Not Found     | 404    |
| Invalid Request      | 400    |

---

# 12. Security Plan

## SEC-PLAN-01

Never trust frontend lesson visibility logic.

## SEC-PLAN-02

All lesson access validation occurs server-side.

## SEC-PLAN-03

JWT payload contains minimal information only.

## SEC-PLAN-04

Progress ownership must always match authenticated learner.

---

# 13. Scalability Considerations

## Dashboard Optimization

Large courses may require:

* lazy loading
* pagination
* partial lesson retrieval

---

## Progress Calculation Optimization

Avoid recalculating entire course progress unnecessarily.

Potential future optimization:

* incremental updates
* cached progress summaries

---

## Future Expansion Support

Architecture should support:

* quiz integration
* project submission integration
* certificates
* analytics
* learning recommendations

---

# 14. Integration Planning

## Integration With Course Module

Required Data:

* course
* section
* lesson
* lesson order

---

## Integration With Enrollment Module

Required Contract:

```ts id="iq8aqg"
canAccessCourse(userId, courseId): boolean
```

---

## Integration With Quiz Module

Future Use:

* unlock quizzes after lesson completion
* quiz eligibility validation

---

## Integration With Final Project Module

Future Use:

* project eligibility validation
* completion requirement checks

---

# 15. Risks & Mitigation

---

## Risk-01 Unauthorized Content Exposure

Cause:
Missing access validation.

Mitigation:
Centralized access service.

---

## Risk-02 Incorrect Progress State

Cause:
Lesson counts change after progress stored.

Mitigation:
Recalculate dynamically when needed.

---

## Risk-03 Sequential Unlock Bugs

Cause:
Incorrect lesson ordering.

Mitigation:
Strict lesson order validation.

---

## Risk-04 Performance Degradation

Cause:
Large course structures.

Mitigation:
Pagination and optimized queries.

---

# 16. Development Phases

---

## Phase 1 - Foundation

* Create progress tables
* Setup controllers/services
* Setup authentication guards

---

## Phase 2 - Learning APIs

* Implement learning dashboard
* Implement lesson access APIs

---

## Phase 3 - Progress System

* Implement lesson progress update
* Implement course progress calculation

---

## Phase 4 - Sequential Learning

* Implement unlock logic
* Implement locked lesson handling

---

## Phase 5 - Testing & Validation

* Access validation testing
* Sequential flow testing
* Progress calculation testing

---

# 17. Acceptance Plan

Feature is considered implementation-ready when:

* APIs are finalized
* Access rules are stable
* Database structure is approved
* Sequential learning rules are approved
* Integration contracts are agreed across modules

Feature is considered complete when:

* learners can access enrolled lessons
* progress updates correctly
* locked lessons behave correctly
* unauthorized access is blocked
* dashboard reflects real learning state
