# Online Courses Platform (OCP)

## Overview

Online Courses Platform (OCP) is a web-based learning management system that allows learners to purchase courses, study lessons, complete quizzes, submit projects, and receive certificates upon successful completion.

The system supports three primary roles:

* Admin
* Mentor
* Learner

---

## Features

### Authentication & Authorization

* User Registration
* User Login
* Forgot Password
* Role-Based Access Control

### Course Management

* Browse Courses
* View Course Details
* Course Categories
* Course Enrollment

### Learning Flow

* View Lessons
* Track Learning Progress
* Mark Lessons as Completed

### Quiz System

* Take Quiz
* Automatic Scoring
* Quiz Attempt History

### Project Submission

* Submit Final Projects
* Mentor Review
* Project Approval / Rejection

### Certificate Management

* Generate Certificates
* Download Certificates
* Completion Verification

### Payment & Orders

* Purchase Courses
* Order Management
* Coupon Support

### Course Q&A

* Ask Questions
* Mentor Responses
* Discussion Tracking

---

## System Roles

### Admin

Responsibilities:

* Manage Users
* Manage Courses
* Manage Categories
* Manage Coupons
* Monitor System Activities

### Mentor

Responsibilities:

* Create and Manage Courses
* Manage Lessons
* Create Quizzes
* Review Projects
* Support Learners

### Learner

Responsibilities:

* Purchase Courses
* Learn Course Content
* Complete Quizzes
* Submit Projects
* Earn Certificates

---

## Technology Stack

### Backend

* Java 21
* Spring Boot
* Spring Security
* Spring Data JPA (Hibernate)

### Frontend

* Thymeleaf
* Bootstrap 5
* JavaScript

### Database

* Microsoft SQL Server

### Build Tool

* Maven

### Version Control

* Git
* GitHub

---

## Project Architecture

The project follows a layered architecture:

Controller
→ Service
→ Repository
→ Database

Business logic resides in the Service layer.

Repositories are responsible only for data access.

---

## Database Strategy

The project follows a Database-First approach.

Key principles:

* Database schema is the source of truth.
* Entities reflect the database structure.
* Foreign key constraints are enforced in the database.
* JPA mappings align with the SQL Server schema.

---

## Project Structure

```text
src/
├── controller/
├── service/
├── repository/
├── entity/
├── dto/
├── config/
├── security/
└── resources/

.sdd/
├── constitution.md
├── shared-context.md
├── constraints/
├── skills/
├── specs/
└── agents/
```

## Development Process

Each feature follows Specification-Driven Development (SDD):

1. Create Specification
2. Define Context
3. Create Implementation Plan
4. Break Down Tasks
5. Implement
6. Test
7. Review

Feature documentation is located in:

```text
.sdd/specs/
```

---

## Business Rules

### Course Access

Only enrolled learners can access paid course content.

### Certificate Issuance

Certificates are issued only when:

* All required lessons are completed.
* Required quizzes are passed.
* Final project is approved (if applicable).

### Project Review

Projects must be reviewed by mentors before approval.

---

## Future Enhancements

* REST API Support
* React Frontend
* Mobile Application
* AI Learning Assistant
* Recommendation System
* Real-time Notifications

---

## License

Academic Project – Educational Use Only
