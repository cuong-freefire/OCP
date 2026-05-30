# Feature Implementation Plan: Authentication & Authorization

## Objective

Implement a secure authentication and authorization mechanism for the Online Courses Platform (OCP).

The implementation must support:

* User Registration
* User Login
* User Logout
* Change Password
* Password Recovery (Future Phase)
* Role-Based Access Control

---

# Technical Architecture

The feature follows the standard layered architecture:

Controller
→ Service
→ Repository
→ Database

Business logic must reside in the Service layer.

---

# Database Design

## Table: users

Purpose:

Store user account information.

Suggested Fields:

* user_id
* full_name
* email
* password_hash
* status
* created_at
* updated_at

---

## Table: roles

Purpose:

Store available system roles.

Suggested Records:

* ADMIN
* MENTOR
* LEARNER

Suggested Fields:

* role_id
* role_name
* description

---

## Table: user_roles

Purpose:

Associate users with roles.

Suggested Fields:

* user_id
* role_id

---

# Entity Design

## User Entity

Responsibilities:

* Represent system users
* Store authentication data
* Maintain account status

Relationships:

* Many-to-Many with Role

---

## Role Entity

Responsibilities:

* Represent authorization roles

Relationships:

* Many-to-Many with User

---

# Repository Layer

## UserRepository

Required Operations:

* Find by email
* Check email existence
* Save user
* Find by ID

---

## RoleRepository

Required Operations:

* Find role by name
* Find role by ID

---

# Service Layer

## AuthService

Responsibilities:

### Register User

Input:

* Full Name
* Email
* Password

Validation:

* Email uniqueness
* Password confirmation

Output:

* Created account

---

### Login User

Input:

* Email
* Password

Output:

* Authenticated user

---

### Change Password

Input:

* Current password
* New password

Validation:

* Current password verification

Output:

* Updated password

---

## UserService

Responsibilities:

* User retrieval
* User profile operations
* User account management

---

# Security Design

## Authentication Mechanism

Phase 1:

* Form Login
* Session-Based Authentication

---

## Authorization Mechanism

Role-Based Access Control (RBAC)

Roles:

* ADMIN
* MENTOR
* LEARNER

---

## Access Rules

Public Endpoints:

* /
* /login
* /register
* /forgot-password

Authenticated Endpoints:

* /profile/**
* /courses/**

Admin Endpoints:

* /admin/**

Mentor Endpoints:

* /mentor/**

Learner Endpoints:

* /learner/**

---

## Password Handling

Requirements:

* Store hashed passwords only.
* Never store plain text passwords.
* Validate passwords securely.

---

# Controller Design

## AuthController

Endpoints:

GET /login

POST /login

GET /register

POST /register

POST /logout

GET /change-password

POST /change-password

---

# View Design

## login.html

Functions:

* Login form
* Validation messages
* Authentication errors

---

## register.html

Functions:

* Registration form
* Validation messages

---

## change-password.html

Functions:

* Password update form

---

# Validation Rules

## Registration

Full Name:

* Required

Email:

* Required
* Valid format
* Unique

Password:

* Required
* Minimum length requirement

Confirm Password:

* Must match password

---

## Login

Email:

* Required

Password:

* Required

---

# Error Handling

Authentication Errors:

* Invalid credentials
* Account inactive
* Account suspended

Registration Errors:

* Email already exists
* Validation failure

Password Errors:

* Incorrect current password
* Password mismatch

---

# Future Enhancements

Phase 2:

* Email Verification
* Forgot Password
* Reset Password

Phase 3:

* Remember Me
* OAuth2 Login
* Google Login

Phase 4:

* Multi-Factor Authentication (MFA)

---

# Deliverables

Backend:

* User Entity
* Role Entity
* UserRepository
* RoleRepository
* AuthService
* UserService
* Security Configuration
* AuthController

Frontend:

* login.html
* register.html
* change-password.html

Database:

* users
* roles
* user_roles
