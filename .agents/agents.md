# Version: 1.0 | Updated: | Project: Online Courses Platform (OCP)

## 1. PROJECT OVERVIEW

Name: Online Courses Platform (OCP)

Type: Web Application

Domain: E-Learning / Course Management

Stage: Development

Bạn là một Senior Software Engineer trong dự án OCP.

Mục tiêu chính:
Xây dựng nền tảng học trực tuyến cho phép Mentor tạo và quản lý khóa học, Learner đăng ký và học tập, Admin quản trị hệ thống, theo dõi doanh thu, chứng chỉ, tiến độ học tập và chất lượng nội dung.

Đọc trước:

1. `README.md` — project setup và hướng dẫn chạy hệ thống
2. `specs/*` — product requirements và feature specifications
3. File này — operational rules dành cho AI agent

---

## 2. TECH STACK (STRICT — do not deviate)

Backend:

* Spring Boot
* Java 21
* Spring MVC
* Spring Security
* Spring Data JPA / Hibernate

Frontend:

* Thymeleaf
* HTML5
* CSS3
* Bootstrap 5
* JavaScript

Database:

* SQL Server

Testing:

* JUnit 5
* Mockito

Build Tool:

* Maven

---

## 3. ARCHITECTURE PRINCIPLES

Follow layered architecture:

Controller → Service → Repository → Entity

Rules:

* Controllers handle HTTP requests only
* Business logic belongs in Services
* Database access belongs in Repositories
* Entities represent database models
* DTOs are used for request/response transfer when appropriate
* Use constructor injection
* No business logic inside Controllers
* No direct EntityManager usage unless absolutely required

---

## 4. FILE NAMING & STRUCTURE

Java Classes:

* PascalCase
* Example: `CourseService.java`

Controllers:

* `CourseController.java`
* `EnrollmentController.java`

Services:

* `CourseService.java`
* `PaymentService.java`

Repositories:

* `CourseRepository.java`
* `UserRepository.java`

Entities:

* `Course.java`
* `Order.java`

Database Tables:

* snake_case
* Example:

  * `courses`
  * `course_sections`
  * `course_lessons`
  * `course_enrollments`

Specifications:

* `specs/[feature-name]/`

---

## 5. DOMAIN MODEL

Primary Roles:

### Admin

Responsible for:

* User management
* Mentor approval
* Course approval
* Coupon management
* Category management
* Revenue monitoring
* System configuration

### Mentor

Responsible for:

* Creating courses
* Managing course content
* Creating quizzes
* Reviewing final projects
* Answering learner questions
* Approving certificate eligibility

### Learner

Responsible for:

* Browsing courses
* Purchasing courses
* Learning content
* Taking quizzes
* Submitting projects
* Earning certificates

---

## 6. ALLOWED OPERATIONS

### Allowed

* Read and modify Backend code
* Read and modify Frontend code
* Create new Controllers, Services, Repositories, DTOs
* Create tests
* Create feature specifications
* Run Maven build and tests

### Forbidden

* Never commit secrets
* Never modify production credentials
* Never bypass authentication
* Never bypass authorization checks
* Never disable validation
* Never remove audit/history records without approval
* Never hardcode IDs or role names

---

## 7. FORBIDDEN PATTERNS

### Security

NEVER:

* Store passwords in plain text
* Store secrets in source control
* Expose internal exceptions to users
* Disable Spring Security protections

Passwords must always be:

* BCrypt hashed

### Data Access

NEVER:

* Put SQL in Controllers
* Put business logic in Repositories
* Duplicate business logic across Services

### Code Quality

NEVER:

* Leave commented-out code
* Leave TODOs in completed tasks
* Use magic numbers without explanation
* Create God Classes

---

## 8. OCP DOMAIN RULES

### Course Rules

1. Course must belong to exactly one Mentor
2. Course must belong to one Category
3. Course cannot be published without required information
4. Course content changes after publication may require re-approval

### Enrollment Rules

1. Learner must purchase course before enrollment (unless free course)
2. Learner can only access enrolled courses
3. Enrollment history must be preserved

### Learning Progress Rules

1. Progress percentage must be between 0 and 100
2. Lesson completion contributes to progress
3. Progress must be recalculated consistently

### Quiz Rules

1. Quiz score must be stored
2. Quiz attempts must be tracked
3. Passing score must be validated

### Final Project Rules

1. Learner submits project
2. Mentor reviews project
3. Project status:

   * Pending
   * Approved
   * Rejected
4. Review history should be preserved

### Certificate Rules

Certificate can only be issued when:

* Course completed
* Required quizzes passed
* Final project approved (if required)

Certificates must remain verifiable after issuance.

### Payment Rules

1. Orders must have payment status tracking
2. Enrollment only occurs after successful payment
3. Revenue data must remain auditable

---

## 9. CODE & QUALITY RULES

Java Standards:

* Use constructor injection
* Prefer immutable DTOs where practical
* Validate inputs
* Use meaningful method names

Testing:

* Unit tests required for new business logic
* Cover happy path and failure path
* Mock external dependencies

Documentation:

* Update related specifications
* Update API documentation if applicable

Comments:

* Explain WHY
* Avoid explaining obvious code

---

## 10. ERROR HANDLING

Always:

* Validate user input
* Return meaningful error messages
* Use centralized exception handling
* Use proper HTTP status codes

If requirements are unclear:

* Ask for clarification
* Do not assume business rules

---

## 11. DEFINITION OF DONE

* [ ] Feature implemented
* [ ] Code compiles successfully
* [ ] Unit tests added
* [ ] Existing tests pass
* [ ] Validation implemented
* [ ] Authorization verified
* [ ] No TODO comments
* [ ] Documentation updated
* [ ] Specification updated if needed

---

## 12. GIT CONVENTIONS

### Branch Naming

* feat/[feature-name]
* fix/[bug-name]
* refactor/[module-name]
* spec/[feature-name]
* chore/[task-name]

### Commit Format

[type](scope): description

Examples:

feat(course): add course approval workflow

fix(payment): prevent duplicate enrollment

refactor(user): simplify registration service

### Pull Requests

* One feature per PR
* Keep PRs reasonably sized
* Require review before merge
* Never commit directly to main

---

## 13. CURRENT PROJECT CONTEXT

Main Modules:

* Authentication & Authorization
* Course Management
* Course Purchase & Payment
* Learning Progress Tracking
* Quiz Management
* Final Project Submission & Review
* Certificate Management
* Course Q&A
* Mentor Management
* Admin Management
* Coupon Management
* Order Management

Current Architecture:

Spring Boot + Thymeleaf + Hibernate + SQL Server

Roles:

* Admin
* Mentor
* Learner

---

## 14. AGENT BEHAVIOR RULES

Always:

* Read related code before editing
* Analyze impact before changing entities or database models
* Preserve existing architecture patterns
* Reuse existing services when possible
* Keep changes consistent with project conventions

When uncertain:

* Ask questions before implementing

When making large changes:

* Explain assumptions
* Explain risks
* Explain affected modules

Never:

* Invent requirements not present in specs
* Change architecture without justification
* Bypass validation or authorization checks
* Break backward compatibility without warning
