# SPEC.md — Mentor Review System

# Người viết: @Tiến | Version: 1.0.0-draft | Status: DRAFT — Awaiting human approval | Ngày: 2026-05-27

## 1. Context & Goal

Mentor Review System cung cấp API để Mentor xem hàng đợi Final Project, xem chi tiết submission và gửi kết quả PASS/FAIL kèm feedback. Mục tiêu là bảo đảm Mentor chỉ chấm đúng Course được phân công và dữ liệu review được ghi nhận nguyên tử.

## 2. Actors & Roles

- **Mentor**: Actor duy nhất được phép gọi API `/mentor/*`.
- **Learner**: Người sở hữu submission và nhận kết quả review.
- **Admin**: Người phân công Mentor và theo dõi báo cáo.
- **System**: Learning module cung cấp submission; Admin Management cung cấp assignment.

## 3. Functional Requirements (EARS Notation)

| ID | Requirement |
| --- | --- |
| FR-MRV-001 | WHILE Mentor views Review Queue, THE system SHALL show only `PENDING` submissions from Courses where that Mentor has an `ACTIVE` assignment. |
| FR-MRV-002 | WHEN Mentor requests submission detail, THE system SHALL verify assignment before returning any submission data. |
| FR-MRV-003 | WHEN Mentor submits a review with result `PASS` or `FAIL` and valid feedback, THE system SHALL create a `project_reviews` record, create a `mentor_feedbacks` record and update the submission status to `REVIEWED`. |
| FR-MRV-004 | WHERE the submitted result is not `PASS` or `FAIL`, THE system SHALL reject the request with HTTP 400. |
| FR-MRV-005 | WHERE feedback is missing or shorter than 10 characters, THE system SHALL reject the request with HTTP 400. |
| FR-MRV-006 | WHERE Mentor is not assigned to the submission Course, THE system SHALL reject the request with HTTP 403. |
| FR-MRV-007 | WHERE the submission is already `REVIEWED`, THE system SHALL reject a new review with HTTP 409. |
| FR-MRV-008 | WHERE any write step fails during review submission, THE system SHALL rollback all review and feedback writes and keep the submission unchanged. |

## 4. Non-functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-MRV-001 | THE system SHALL authenticate all `/mentor/*` requests using JWT from `httpOnly Cookie`. |
| NFR-MRV-002 | THE system SHALL require `role === MENTOR` before controller execution. |
| NFR-MRV-003 | THE system SHALL validate request body and params with Zod strict schemas. |
| NFR-MRV-004 | THE system SHALL complete `GET /mentor/reviews/queue` with P95 latency below 300ms for 1000 pending submissions. |
| NFR-MRV-005 | THE system SHALL NOT log full feedback content; logs may store feedback length/hash only. |
| NFR-MRV-006 | THE system SHALL use database transaction or unit-of-work for atomic review commit. |

## 5. Data Model

### `project_reviews`

- `id`: BIGINT/UUID primary key.
- `submission_id`: reference to `project_submissions.id`.
- `mentor_id`: reference to `users.id`.
- `course_id`: reference to `courses.id`.
- `result`: `PASS` or `FAIL`.
- `reviewed_at`: timestamp.
- Constraint: unique `submission_id` for MVP to ensure one final review per submission.

### `mentor_feedbacks`

- `id`: BIGINT/UUID primary key.
- `review_id`: reference to `project_reviews.id`.
- `feedback_content`: text, minimum 10 characters.
- `created_at`: timestamp.
- Constraint: `review_id` cascade delete or equivalent cleanup rule.

## 6. Error Handling

| Scenario | HTTP | Code |
| --- | --- | --- |
| Missing or invalid JWT cookie | 401 | `UNAUTHENTICATED` |
| Caller is not Mentor | 403 | `FORBIDDEN` |
| Result invalid or feedback invalid | 400 | `VALIDATION_ERROR` |
| Submission not found | 404 | `SUBMISSION_NOT_FOUND` |
| Mentor not assigned to Course | 403 | `MENTOR_NOT_ASSIGNED` |
| Submission already reviewed | 409 | `ALREADY_REVIEWED` |
| Learning/Admin contract unavailable | 503 | `DEPENDENCY_UNAVAILABLE` |
| Unexpected transaction failure | 500 | `INTERNAL_ERROR` |

## 7. Acceptance Criteria (Given-When-Then)

### AC-MRV-001 — Chỉ thấy đúng queue được phân công

- **Given** Mentor M được gán Course A nhưng không được gán Course B.
- **When** Mentor M gọi `GET /mentor/reviews/queue`.
- **Then** THE system SHALL chỉ trả submissions `PENDING` của Course A.

### AC-MRV-002 — Chặn chấm sai quyền

- **Given** Mentor M không có assignment `ACTIVE` với Course B.
- **When** Mentor M gửi review cho submission thuộc Course B.
- **Then** THE system SHALL trả HTTP 403 và không tạo review/feedback.

### AC-MRV-003 — Rollback khi feedback lưu thất bại

- **Given** Mentor M gửi review hợp lệ cho submission `PENDING`.
- **When** bước lưu `mentor_feedbacks` thất bại.
- **Then** THE system SHALL rollback transaction, không lưu `project_reviews`, và submission vẫn giữ `PENDING`.

### AC-MRV-004 — Chặn review trùng

- **Given** Submission S đã có kết quả review final.
- **When** Mentor bất kỳ gửi review mới cho Submission S.
- **Then** THE system SHALL trả HTTP 409 và không thay đổi kết quả hiện có.

### AC-MRV-005 — Validate feedback bắt buộc

- **Given** Mentor M có assignment hợp lệ.
- **When** Mentor M gửi result hợp lệ nhưng feedback ngắn hơn 10 ký tự.
- **Then** THE system SHALL trả HTTP 400 và không ghi dữ liệu review.

## 8. Out of Scope

- Không xây dựng UI cho Learner nộp bài.
- Không xử lý resubmit policy sau khi FAIL.
- Không cấp quyền Mentor hoặc tạo assignment; việc này thuộc Admin Management.
- Không tạo/sửa Course hoặc lesson.
- Không cung cấp chức năng edit review sau khi submit trong MVP.
