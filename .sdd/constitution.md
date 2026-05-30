# OCP Constitution

Version: 1.0
Project: Online Courses Platform (OCP)

---

# 1. Purpose

This constitution defines the mandatory architectural, development, security, and quality standards for the Online Courses Platform.

All specifications, plans, tasks, and implementations MUST comply with this document.

---

# 2. Core Principles

## 2.1 Business First

Business requirements take priority over technical preferences.

Every feature must clearly support a business goal.

---

## 2.2 Simplicity

Prefer simple and maintainable solutions over complex designs.

Avoid unnecessary abstractions and premature optimizations.

---

## 2.3 Consistency

All modules must follow consistent:

* Naming conventions
* Folder structures
* API design patterns
* Database design standards

---

## 2.4 Security By Default

All features must be designed with security considerations from the beginning.

Never add security as an afterthought.

---

# 3. Technology Stack

Backend:

* Java 21
* Spring Boot
* Spring Security
* Spring Data JPA / Hibernate

Frontend:

* Thymeleaf
* Bootstrap 5
* JavaScript

Database:

* SQL Server Management Studio

Build Tool:

* Maven

Version Control:

* Git
* GitHub

---

# 4. Architecture Rules

## 4.1 Layered Architecture

The system shall follow:

Controller
→ Service
→ Repository
→ Database

Controllers MUST NOT access repositories directly.

---

## 4.2 Business Logic

Business logic MUST reside inside Service classes.

Controllers should only:

* Receive requests
* Validate inputs
* Call services
* Return responses

---

## 4.3 Repository Layer

Repositories are responsible only for data access.

Repositories MUST NOT contain business logic.

---

# 5. Security Rules

## 5.1 Authentication

Authentication must be required for protected resources.

Anonymous users may only access public pages.

---

## 5.2 Authorization

Role-based access control must be enforced.

Roles:

* Admin
* Mentor
* Learner

Users may only access resources permitted by their role.

---

## 5.3 Password Storage

Passwords must be stored using BCrypt hashing.

Plain-text passwords are prohibited.

---

## 5.4 Input Validation

All user inputs must be validated on the server side.

Client-side validation is supplementary only.

---

# 6. Database Rules

## 6.1 Primary Keys

Every table must have a primary key.

---

## 6.2 Foreign Keys

Relationships must be enforced through foreign keys.

---

## 6.3 Audit Fields

Major entities should include:

* created_at
* updated_at

When applicable.

---

## 6.4 Soft Delete

Use soft delete for important business entities whenever possible.

---

## 6.5 Identity Columns

Numeric primary keys should use IDENTITY when appropriate.

---

## 6.6 Data Types

Use:

- NVARCHAR for text data
- DATETIME2 for timestamps
- DECIMAL for monetary values

Avoid:
- FLOAT for money
- TEXT and NTEXT

# 7. Coding Standards

## 7.1 Naming

Classes:

* PascalCase

Methods:

* camelCase

Variables:

* camelCase

Constants:

* UPPER_SNAKE_CASE

Database Tables:

* snake_case

Database Columns:

* snake_case

---

## 7.2 Clean Code

Methods should have a single responsibility.

Avoid duplicate logic.

Prefer readability over cleverness.

---

# 8. Testing Requirements

Critical business flows must have tests.

Examples:

* Registration
* Login
* Course Purchase
* Quiz Submission
* Project Submission
* Certificate Generation

---

# 9. Feature Development Process

Every feature must contain:

1. spec.md
2. context.md
3. plan.md
4. tasks.md

Implementation must follow:

Specification
→ Planning
→ Task Breakdown
→ Development
→ Testing

---

# 10. OCP Domain Rules

## Course Access

Only enrolled learners may access paid course content.

---

## Certificate

Certificates may only be generated when:

* Course completed
* Required quizzes passed
* Final project approved

---

## Project Submission

Mentors review submitted projects.

Approval is required before certificate issuance.

---

## Quiz Rules

Quiz scores are automatically calculated by the system.

Passing score is configurable.

---

# 11. Documentation Rules

Every major feature must include:

* Purpose
* Actors
* Business Rules
* Acceptance Criteria
* Dependencies

---

# 12. Future Scalability

The architecture should support future migration to:

* REST APIs
* React Frontend
* Microservices

without major redesign of business logic.
