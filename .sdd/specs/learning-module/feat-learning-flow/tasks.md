# Feature Tasks - Learning Flow

## Feature Information

| Field          | Value               |
| -------------- | ------------------- |
| Feature Name   | Learning Flow       |
| Module         | Learning + Progress |
| Feature Folder | feat-learning-flow  |
| Priority       | MVP                 |
| Status         | Todo                |

---

# 1. Database Tasks

## 1.1 lesson_progress Table

* [ ] Create `lesson_progress` table
* [ ] Add `id` as UUID primary key
* [ ] Add `userId` foreign key
* [ ] Add `lessonId` foreign key
* [ ] Add `completed` boolean field
* [ ] Add `completedAt` field
* [ ] Add `createdAt`
* [ ] Add `updatedAt`
* [ ] Add unique constraint `(userId, lessonId)`
* [ ] Add indexes for:

  * `userId`
  * `lessonId`

---

## 1.2 course_progress Table

* [ ] Create `course_progress` table
* [ ] Add `id` as UUID primary key
* [ ] Add `userId` foreign key
* [ ] Add `courseId` foreign key
* [ ] Add `progressPercentage`
* [ ] Add `completedLessons`
* [ ] Add `totalLessons`
* [ ] Add `isCompleted`
* [ ] Add `completedAt`
* [ ] Add `createdAt`
* [ ] Add `updatedAt`
* [ ] Add unique constraint `(userId, courseId)`
* [ ] Add indexes for:

  * `userId`
  * `courseId`

---

# 2. Backend Structure Tasks

## 2.1 Module Setup

* [ ] Create learning module
* [ ] Create progress module
* [ ] Configure module exports/imports
* [ ] Setup dependency injection

---

## 2.2 Controller Setup

* [ ] Create `LearningController`
* [ ] Create `ProgressController`
* [ ] Register routes
* [ ] Setup authentication guards

---

## 2.3 Service Setup

* [ ] Create `LearningService`
* [ ] Create `ProgressService`
* [ ] Create `AccessValidationService`
* [ ] Setup service dependencies

---

## 2.4 Repository/Data Access Setup

* [ ] Create lesson progress repository
* [ ] Create course progress repository
* [ ] Setup course queries
* [ ] Setup lesson queries
* [ ] Setup enrollment access queries

---

# 3. Learning Dashboard Tasks

## 3.1 Dashboard API

* [ ] Implement `GET /learning/courses/:courseId`
* [ ] Validate JWT authentication
* [ ] Validate enrollment access
* [ ] Fetch course structure
* [ ] Fetch learner progress
* [ ] Return sections and lessons
* [ ] Return lesson states:

  * COMPLETED
  * IN_PROGRESS
  * LOCKED
  * NOT_STARTED

---

## 3.2 Continue Learning

* [ ] Implement continue learning logic
* [ ] Find latest unfinished lesson
* [ ] Validate lesson unlock state
* [ ] Return current lesson information

---

# 4. Lesson Access Tasks

## 4.1 Watch Lesson API

* [ ] Implement `GET /learning/lessons/:lessonId`
* [ ] Validate JWT authentication
* [ ] Validate lesson existence
* [ ] Validate course access
* [ ] Validate lesson unlock state
* [ ] Return lesson content
* [ ] Return locked lesson state if needed

---

## 4.2 Lesson Content Protection

* [ ] Prevent unauthorized paid lesson access
* [ ] Hide locked lesson content
* [ ] Support preview lesson access
* [ ] Prevent frontend-only access validation

---

# 5. Progress Tracking Tasks

## 5.1 Lesson Progress API

* [ ] Implement `PUT /progress/lesson`
* [ ] Validate request body
* [ ] Validate lesson existence
* [ ] Validate learner ownership
* [ ] Create/update lesson progress
* [ ] Update completedAt timestamp
* [ ] Prevent duplicate progress records

---

## 5.2 Course Progress Calculation

* [ ] Implement course progress calculation
* [ ] Count completed lessons
* [ ] Count total lessons
* [ ] Calculate percentage
* [ ] Update course_progress table
* [ ] Update course completion state

---

## 5.3 Course Progress API

* [ ] Implement `GET /progress/course/:courseId`
* [ ] Validate JWT authentication
* [ ] Validate learner enrollment
* [ ] Return course progress summary

---

# 6. Sequential Learning Tasks

## 6.1 Lesson Order Logic

* [ ] Retrieve ordered lessons
* [ ] Determine previous lesson
* [ ] Determine next lesson
* [ ] Validate unlock conditions

---

## 6.2 Locked Lesson Handling

* [ ] Prevent access to locked lessons
* [ ] Return locked lesson metadata only
* [ ] Prevent bypass through direct API calls

---

## 6.3 Unlock Next Lesson

* [ ] Unlock next lesson after completion
* [ ] Update dashboard lesson states
* [ ] Handle edge case for last lesson

---

# 7. Validation Tasks

## 7.1 Request Validation

* [ ] Validate lessonId format
* [ ] Validate courseId format
* [ ] Validate progress request body
* [ ] Reject invalid requests

---

## 7.2 Authentication Validation

* [ ] Validate JWT for all APIs
* [ ] Reject unauthorized requests
* [ ] Extract learner identity securely

---

## 7.3 Access Validation

* [ ] Validate enrollment access
* [ ] Validate lesson ownership
* [ ] Validate sequential unlock rules

---

# 8. Error Handling Tasks

## 8.1 Standard Error Responses

* [ ] Implement consistent error response format
* [ ] Handle 400 Bad Request
* [ ] Handle 401 Unauthorized
* [ ] Handle 403 Forbidden
* [ ] Handle 404 Not Found
* [ ] Handle 500 Internal Server Error

---

## 8.2 Edge Case Handling

* [ ] Handle deleted lessons
* [ ] Handle disabled courses
* [ ] Handle empty courses
* [ ] Handle missing progress records
* [ ] Handle invalid lesson ordering

---

# 9. Security Tasks

## 9.1 Access Security

* [ ] Validate all lesson access server-side
* [ ] Prevent unauthorized content exposure
* [ ] Prevent cross-user progress access
* [ ] Prevent lesson unlock bypass

---

## 9.2 Data Security

* [ ] Return minimal required data only
* [ ] Prevent sensitive data leakage
* [ ] Validate ownership before updates

---

# 10. Integration Tasks

## 10.1 Course Module Integration

* [ ] Integrate course structure retrieval
* [ ] Integrate lesson ordering
* [ ] Integrate preview lesson logic

---

## 10.2 Enrollment Module Integration

* [ ] Integrate access validation contract
* [ ] Validate learner enrollment
* [ ] Handle enrollment edge cases

---

## 10.3 Future Quiz Integration Preparation

* [ ] Prepare lesson completion hooks
* [ ] Prepare quiz unlock support

---

## 10.4 Future Final Project Integration Preparation

* [ ] Prepare course completion checks
* [ ] Prepare project eligibility checks

---

# 11. Testing Tasks

## 11.1 Unit Tests

* [ ] Test lesson unlock logic
* [ ] Test course progress calculation
* [ ] Test continue learning logic
* [ ] Test access validation logic

---

## 11.2 Integration Tests

* [ ] Test learning dashboard flow
* [ ] Test lesson access flow
* [ ] Test progress update flow
* [ ] Test sequential learning flow

---

## 11.3 Security Tests

* [ ] Test unauthorized lesson access
* [ ] Test locked lesson bypass attempts
* [ ] Test cross-user progress modification
* [ ] Test invalid JWT access

---

# 12. Performance Tasks

## 12.1 Query Optimization

* [ ] Optimize lesson retrieval queries
* [ ] Optimize progress queries
* [ ] Add required indexes
* [ ] Avoid unnecessary recalculation

---

## 12.2 Scalability Preparation

* [ ] Prepare dashboard pagination support
* [ ] Prepare lazy loading support
* [ ] Avoid N+1 query problems

---

# 13. Documentation Tasks

* [ ] Document API request/response examples
* [ ] Document lesson unlock rules
* [ ] Document progress calculation logic
* [ ] Document integration contracts
* [ ] Document error response format

---

# 14. Final Acceptance Checklist

## Functional

* [ ] Learner can access enrolled course lessons
* [ ] Learner cannot access locked lessons
* [ ] Learner cannot access paid lessons without enrollment
* [ ] Lesson progress updates correctly
* [ ] Course progress updates correctly
* [ ] Continue Learning works correctly

---

## Security

* [ ] All APIs require JWT
* [ ] Backend validates enrollment access
* [ ] Backend validates lesson ownership
* [ ] Frontend cannot bypass lesson locking

---

## Technical

* [ ] APIs follow standardized response format
* [ ] Database constraints work correctly
* [ ] No duplicate progress records
* [ ] Sequential lesson logic behaves correctly
