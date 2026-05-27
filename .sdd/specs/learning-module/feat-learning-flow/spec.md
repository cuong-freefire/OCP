# Feature Specification - Learning Flow

## Feature Information

| Field          | Value               |
| -------------- | ------------------- |
| Feature Name   | Learning Flow       |
| Module         | Learning + Progress |
| Feature Folder | feat-learning-flow  |
| Primary Actor  | Learner             |
| Related Actors | Admin               |
| Priority       | MVP                 |
| Status         | Draft               |

---

# 1. Overview

The Learning Flow feature handles the learner learning experience after successful course enrollment.

This feature allows learners to:

* Access enrolled courses
* View course structure
* Watch lessons
* Track lesson progress
* Track course progress
* Continue learning from the latest unfinished lesson
* Follow sequential lesson unlocking if enabled

The backend is responsible for validating course access and learning permissions. Frontend must not determine access rights independently.

---

# 2. Objectives

* Ensure only enrolled learners can access paid course content
* Provide structured learning navigation
* Track lesson and course completion progress
* Support sequential lesson unlocking
* Provide learning continuity via Continue Learning feature

---

# 3. Dependencies

## Required Modules

### Course Module

Required for:

* Course information
* Section information
* Lesson metadata
* Lesson ordering

### Enrollment & Access Module

Required for:

* Enrollment validation
* Course access checking

Contract:

```ts
canAccessCourse(userId, courseId): boolean
```

### Authentication Module

Required for:

* JWT authentication
* Learner identity

---

# 4. Business Rules

## Access Rules

### BR-01

Learner must be authenticated before accessing any learning API.

### BR-02

Paid course lessons must validate enrollment access before returning full lesson content.

### BR-03

Free preview lessons may be accessible without enrollment if `isPreview = true`.

### BR-04

Frontend must not unlock lessons manually without backend validation.

---

## Progress Rules

### BR-05

Lesson progress is tracked per learner per lesson.

### BR-06

A lesson is considered completed when learner explicitly marks it as completed.

### BR-07

Course progress percentage is calculated based on completed lessons.

### BR-08

Progress must belong only to the currently authenticated learner.

---

## Sequential Learning Rules

### BR-09

If sequential learning is enabled:

* Next lesson remains locked until previous lesson is completed.

### BR-10

First lesson of the course is unlocked by default.

### BR-11

Learner cannot manually bypass locked lessons.

---

# 5. Learning Dashboard

## Description

Displays enrolled courses and learning status for the current learner.

---

## Functional Requirements

### LF-DASH-01

System must return all enrolled courses of the learner.

### LF-DASH-02

Dashboard must display:

* Course title
* Thumbnail
* Progress percentage
* Current lesson
* Last accessed lesson

### LF-DASH-03

Courses must be sorted by latest learning activity.

### LF-DASH-04

Dashboard must display lesson statuses:

* COMPLETED
* IN_PROGRESS
* LOCKED
* NOT_STARTED

### LF-DASH-05

Continue Learning button must redirect learner to:

* latest unfinished unlocked lesson

---

## API

### GET `/learning/courses/:courseId`

### Authentication

Required (JWT)

### Response Example

```json
{
  "courseId": "course_001",
  "title": "Spring Boot Fundamentals",
  "progressPercentage": 45,
  "currentLessonId": "lesson_005",
  "sections": [
    {
      "sectionId": "section_001",
      "title": "Introduction",
      "lessons": [
        {
          "lessonId": "lesson_001",
          "title": "Welcome",
          "status": "COMPLETED"
        }
      ]
    }
  ]
}
```

---

# 6. Watch Lesson

## Description

Allows learner to access lesson content.

---

## Functional Requirements

### LF-LESSON-01

System must validate learner access before returning lesson content.

### LF-LESSON-02

If learner does not have access:

* backend returns HTTP 403.

### LF-LESSON-03

Lesson response may contain:

* title
* content
* videoUrl
* attachments if supported later

### LF-LESSON-04

Locked lessons must not return full content.

### LF-LESSON-05

Lesson metadata may still be returned for UI display.

---

## API

### GET `/learning/lessons/:lessonId`

### Authentication

Required (JWT)

---

## Response Example

```json
{
  "lessonId": "lesson_005",
  "title": "REST API Basics",
  "videoUrl": "https://...",
  "content": "<html>...</html>",
  "isCompleted": false,
  "isLocked": false
}
```

---

## Error Responses

### 403 Forbidden

```json
{
  "message": "You do not have access to this lesson."
}
```

### 404 Not Found

```json
{
  "message": "Lesson not found."
}
```

---

# 7. Lesson Progress

## Description

Tracks lesson completion status.

---

## Functional Requirements

### LF-PROGRESS-01

Learner may mark a lesson as completed.

### LF-PROGRESS-02

System creates or updates lesson progress record.

### LF-PROGRESS-03

Completed lessons must update course progress percentage.

### LF-PROGRESS-04

Progress updates must belong only to authenticated learner.

### LF-PROGRESS-05

Learner cannot update another learner's progress.

---

## API

### PUT `/progress/lesson`

### Authentication

Required (JWT)

---

## Request Example

```json
{
  "lessonId": "lesson_005",
  "completed": true
}
```

---

## Response Example

```json
{
  "message": "Lesson progress updated successfully.",
  "courseProgress": 50
}
```

---

# 8. Course Progress

## Description

Provides overall course completion progress.

---

## Functional Requirements

### LF-COURSE-01

Course progress percentage is calculated as:

completed lessons / total lessons * 100

### LF-COURSE-02

Locked lessons are still counted in total lessons.

### LF-COURSE-03

Course completion occurs when all required lessons are completed.

---

## API

### GET `/progress/course/:courseId`

### Authentication

Required (JWT)

---

## Response Example

```json
{
  "courseId": "course_001",
  "completedLessons": 9,
  "totalLessons": 20,
  "progressPercentage": 45,
  "isCompleted": false
}
```

---

# 9. Database Requirements

## lesson_progress

| Field       | Type     |
| ----------- | -------- |
| id          | UUID     |
| userId      | UUID     |
| lessonId    | UUID     |
| completed   | boolean  |
| completedAt | datetime |
| createdAt   | datetime |
| updatedAt   | datetime |

---

## course_progress

| Field              | Type              |
| ------------------ | ----------------- |
| id                 | UUID              |
| userId             | UUID              |
| courseId           | UUID              |
| progressPercentage | number            |
| completedLessons   | number            |
| totalLessons       | number            |
| isCompleted        | boolean           |
| completedAt        | datetime nullable |
| createdAt          | datetime          |
| updatedAt          | datetime          |

---

# 10. Validation Rules

## Lesson Progress Validation

| Field     | Rule         |
| --------- | ------------ |
| lessonId  | Required     |
| completed | Boolean only |

---

# 11. Security Requirements

## SEC-01

All learning APIs require JWT authentication.

## SEC-02

Backend must validate enrollment before returning paid lesson content.

## SEC-03

Backend must verify lesson ownership for progress updates.

## SEC-04

Frontend must not determine lesson unlock logic independently.

---

# 12. Non-Functional Requirements

## Performance

* Learning dashboard response should support pagination if course count becomes large.

## Scalability

* Progress calculation should avoid excessive full-table scans.

## Maintainability

* Learning access logic should be centralized in service layer.

---

# 13. Edge Cases

## EC-01

Learner attempts to access lesson without enrollment.

Expected:

* Return 403 Forbidden.

---

## EC-02

Learner marks same lesson completed multiple times.

Expected:

* System updates existing progress only.

---

## EC-03

Lesson deleted or disabled during learning.

Expected:

* Lesson should not break dashboard response.

---

## EC-04

Course has no lessons.

Expected:

* Progress percentage returns 0.

---

# 14. Out of Scope

The following are not included in current feature scope:

* Real-time learning sync
* Video progress tracking by playback duration
* Note taking
* Bookmarking
* Discussion/comment system
* Certificate generation

---

# 15. Acceptance Criteria

## AC-01

Learner can access enrolled course lessons.

## AC-02

Learner without enrollment cannot access paid lessons.

## AC-03

Learner can update lesson progress.

## AC-04

Course progress percentage updates correctly.

## AC-05

Sequential lesson locking works correctly if enabled.

## AC-06

Continue Learning redirects to latest unlocked unfinished lesson.
