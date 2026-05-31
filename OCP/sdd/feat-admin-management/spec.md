# SPEC.md — Admin Management

# Người viết: @Tiến | Version: 1.0.0-draft | Status: DRAFT — Awaiting human approval | Ngày: 2026-05-27

## 1. Context & Goal

Admin Management cung cấp các API quản trị để Admin kiểm soát vòng đời user, quyền Mentor và phân công Mentor vào Course. Mục tiêu là cho phép thao tác vận hành nhanh nhưng vẫn bảo vệ dữ liệu payment, enrollment và quyền chấm bài.

## 2. Actors & Roles

- **Admin**: Actor duy nhất được phép gọi API `/admin/*`.
- **Mentor**: User có role `MENTOR`, có thể được Admin gán hoặc thu hồi quyền chấm Course.
- **Learner/User**: Tài khoản chịu tác động bởi block, unblock hoặc delete.
- **System**: Auth, Payment và Enrollment modules cung cấp dữ liệu xác thực, role, payment và enrollment.

## 3. Functional Requirements (EARS Notation)

| ID | Requirement |
| --- | --- |
| FR-ADM-001 | THE system SHALL provide Admin APIs to list, search and view detail of Users and Mentors. |
| FR-ADM-002 | WHEN Admin updates a User status to `BLOCKED`, THE system SHALL disable login for that User through the Auth module. |
| FR-ADM-003 | WHEN Admin updates a blocked User status to `ACTIVE`, THE system SHALL allow that User to authenticate again if other Auth checks pass. |
| FR-ADM-004 | WHERE Admin requests hard delete for a User with `SUCCESS` payment or active enrollment, THE system SHALL reject the request and preserve all User data. |
| FR-ADM-005 | WHEN Admin promotes or creates a Mentor account, THE system SHALL ensure the target User has role `MENTOR`. |
| FR-ADM-006 | WHEN Admin assigns a Mentor to a Course, THE system SHALL create one `mentor_assignments` record with status `ACTIVE`. |
| FR-ADM-007 | WHERE an `ACTIVE` assignment already exists for the same Mentor and Course, THE system SHALL prevent duplicate assignment and return HTTP 409 Conflict. |
| FR-ADM-008 | WHERE Admin revokes an assignment while the Course still has `PENDING` final project submissions for that Mentor, THE system SHALL reject the revoke request and keep the assignment unchanged. |
| FR-ADM-009 | WHERE the caller is not authenticated as `ADMIN`, THE system SHALL reject the request before executing business logic. |

## 4. Non-functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-ADM-001 | THE system SHALL authenticate all `/admin/*` requests using JWT from `httpOnly Cookie`; Bearer-only requests SHALL NOT be accepted. |
| NFR-ADM-002 | THE system SHALL validate all request bodies with Zod strict schemas before controller execution. |
| NFR-ADM-003 | THE system SHALL execute user status changes, hard delete and assignment mutation inside a database transaction. |
| NFR-ADM-004 | THE system SHALL write audit logs for every write operation with actorId, action, targetId, timestamp and request metadata. |
| NFR-ADM-005 | THE system SHALL enforce duplicate assignment prevention at database level, not only in service code. |

## 5. Data Model

### `users` (owned by Auth module)

- `id`: BIGINT/UUID primary key.
- `email`: unique login identifier.
- `role`: `ADMIN`, `MENTOR`, `LEARNER`.
- `status`: expected values `ACTIVE`, `BLOCKED`.

### `mentor_assignments`

- `id`: BIGINT/UUID primary key.
- `mentor_id`: FK/logical reference to `users.id`.
- `course_id`: FK/logical reference to `courses.id`.
- `status`: `ACTIVE` or `DISABLED`.
- `created_at`: timestamp.
- `updated_at`: timestamp.
- Constraint: unique active assignment per `(mentor_id, course_id)`.

## 6. Error Handling

| Scenario | HTTP | Code |
| --- | --- | --- |
| Missing or invalid JWT cookie | 401 | `UNAUTHENTICATED` |
| Caller is not Admin | 403 | `FORBIDDEN` |
| Zod validation fails | 400 | `VALIDATION_ERROR` |
| Target user, mentor, course or assignment not found | 404 | `NOT_FOUND` |
| Hard delete blocked by payment/enrollment | 409 | `USER_HAS_TRANSACTION` |
| Duplicate active Mentor/Course assignment | 409 | `DUPLICATE_ASSIGNMENT` |
| Revoke blocked by pending submissions | 409 | `PENDING_SUBMISSIONS_EXIST` |
| Payment/Enrollment reader unavailable | 503 | `DEPENDENCY_UNAVAILABLE` |

## 7. Acceptance Criteria (Given-When-Then)

### AC-ADM-001 — Chặn gán trùng Mentor

- **Given** Mentor X đã có assignment `ACTIVE` với Course Y.
- **When** Admin gọi API gán Mentor X vào Course Y lần nữa.
- **Then** THE system SHALL trả HTTP 409 và DB không xuất hiện bản ghi `ACTIVE` thứ hai.

### AC-ADM-002 — Bảo vệ hard delete user đã có giao dịch

- **Given** User A đã có payment `SUCCESS` hoặc active enrollment.
- **When** Admin yêu cầu hard delete User A.
- **Then** THE system SHALL trả HTTP 409, giữ nguyên dữ liệu user và chỉ cho phép block bằng soft delete.

### AC-ADM-003 — Chặn non-admin

- **Given** Learner hoặc Mentor có JWT hợp lệ.
- **When** caller gọi bất kỳ API `/admin/*`.
- **Then** THE system SHALL trả HTTP 403 và không gọi service/repository.

### AC-ADM-004 — Chặn revoke khi còn pending submissions

- **Given** Mentor M có assignment `ACTIVE` với Course C và còn submission `PENDING`.
- **When** Admin revoke assignment đó.
- **Then** THE system SHALL trả HTTP 409 và assignment vẫn giữ `ACTIVE`.

### AC-ADM-005 — Block user làm mất quyền login

- **Given** User A đang `ACTIVE`.
- **When** Admin block User A thành `BLOCKED`.
- **Then** THE system SHALL ghi status mới và lần login kế tiếp của User A bị từ chối.

## 8. Out of Scope

- Không xử lý learner nộp bài hoặc mentor chấm bài.
- Không tạo JWT, hash password hoặc thay đổi Auth core flow.
- Không tạo/sửa Course.
- Không quyết định chính sách resubmit final project.
