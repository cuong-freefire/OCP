# SPEC.md — Reports & Analytics

# Người viết: @Tiến | Version: 1.0.0-draft | Status: DRAFT — Awaiting human approval | Ngày: 2026-05-27

## 1. Context & Goal

Reports & Analytics cung cấp dashboard và report APIs cho Admin để tổng hợp dữ liệu user, course, enrollment, revenue và mentor review. Mục tiêu là tạo một nguồn đọc tập trung, nhanh, read-only và chịu lỗi tốt khi một dependency bị timeout.

## 2. Actors & Roles

- **Admin**: Actor duy nhất được phép xem dashboard và reports.
- **System**: Các module Auth, Payment, Course, Enrollment, Learning và Mentor Review cung cấp dữ liệu nguồn.
- **Operations**: Theo dõi latency, warning rate và tình trạng dependency.

## 3. Functional Requirements (EARS Notation)

| ID | Requirement |
| --- | --- |
| FR-RPT-001 | THE system SHALL provide `GET /admin/dashboard` to return user, course, enrollment, revenue, review and pending submission summary in one response. |
| FR-RPT-002 | WHEN Admin requests revenue report, THE system SHALL aggregate only transactions marked `SUCCESS` by the Payment module contract. |
| FR-RPT-003 | WHILE Admin views course completion report, THE system SHALL use progress data from the Learning module contract. |
| FR-RPT-004 | WHEN Admin requests mentor performance report, THE system SHALL aggregate review counts, PASS/FAIL counts and pending submissions from Mentor Review/Learning data. |
| FR-RPT-005 | WHERE any report dependency times out or fails, THE system SHALL return HTTP 200 with partial data and a `warnings[]` entry for each failed source. |
| FR-RPT-006 | WHERE the caller is not authenticated as `ADMIN`, THE system SHALL reject the request before querying report data. |
| FR-RPT-007 | WHERE date range query is invalid or exceeds the configured maximum, THE system SHALL reject the request with HTTP 400. |
| FR-RPT-008 | WHERE export feature is approved and enabled by Product Owner, THE system SHALL provide Excel/PDF download links generated from the same report query. |

## 4. Non-functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-RPT-001 | THE system SHALL keep `GET /admin/dashboard` P95 latency below 800ms when dependencies respond normally. |
| NFR-RPT-002 | THE system SHALL perform report aggregation as read-only operations and SHALL NOT update source module data. |
| NFR-RPT-003 | THE system SHALL call independent adapters in parallel where possible. |
| NFR-RPT-004 | THE system SHALL use adapter timeout guards so a slow dependency cannot block the whole dashboard indefinitely. |
| NFR-RPT-005 | THE system SHALL validate query params with strict schema before service execution. |
| NFR-RPT-006 | THE system SHALL log adapter failure, timeout and dashboard latency with safe structured metadata. |

## 5. Data Model

Reports module does not own core business data. It reads aggregated data from:

- `users`: total users, users by role, new users.
- `courses`: total courses, course status/category stats.
- `orders`/`payments`: revenue from `SUCCESS` transactions.
- `enrollments`: enrollment count and conversion inputs.
- `course_progress`: completion rate.
- `project_submissions`: pending submissions.
- `project_reviews`: PASS/FAIL counts and mentor performance.

Optional cache:

- Cache key: `dashboard:{adminId}:{dateRangeHash}:{granularity}`.
- TTL: proposed 600 seconds.
- Cache failure must not fail the report request.

## 6. Error Handling

| Scenario | HTTP | Code |
| --- | --- | --- |
| Missing or invalid JWT cookie | 401 | `UNAUTHENTICATED` |
| Caller is not Admin | 403 | `FORBIDDEN` |
| Invalid query params or date range | 400 | `VALIDATION_ERROR` |
| One or more adapters timeout/fail | 200 | `PARTIAL_DATA` in `warnings[]` |
| All adapters timeout/fail | 200 | `PARTIAL_DATA` warnings, nullable data sections |
| Unexpected service failure outside adapter boundary | 500 | `INTERNAL_ERROR` |

## 7. Acceptance Criteria (Given-When-Then)

### AC-RPT-001 — Graceful fallback khi Payment timeout

- **Given** Admin gọi `GET /admin/dashboard` và Payment adapter timeout.
- **When** các adapters khác vẫn trả dữ liệu.
- **Then** THE system SHALL trả HTTP 200, `revenue: null`, có warning cho Payment, và user/course/review data vẫn hiển thị.

### AC-RPT-002 — Chỉ Admin được xem report

- **Given** Learner hoặc Mentor có JWT hợp lệ.
- **When** caller gọi `/admin/dashboard`.
- **Then** THE system SHALL trả HTTP 403 và không gọi adapters.

### AC-RPT-003 — Revenue chỉ tính SUCCESS

- **Given** Payment data có `SUCCESS`, `PENDING` và `FAILED`.
- **When** Admin gọi revenue report.
- **Then** THE system SHALL chỉ tính các giao dịch `SUCCESS`.

### AC-RPT-004 — Validate date range

- **Given** Admin truyền `endDate` trước `startDate` hoặc range vượt giới hạn.
- **When** request vào report endpoint.
- **Then** THE system SHALL trả HTTP 400 với `VALIDATION_ERROR`.

### AC-RPT-005 — Reports không mutate dữ liệu

- **Given** Admin gọi mọi report endpoint.
- **When** request xử lý thành công hoặc partial.
- **Then** THE system SHALL không tạo, sửa, xóa bản ghi ở module nguồn.

## 8. Out of Scope

- Không thay đổi logic payment/refund của Payment module.
- Không mutate user, course, enrollment, progress hoặc review data.
- Không xây dựng UI dashboard trong tài liệu này.
- Không implement Excel/PDF export trong MVP nếu Product Owner chưa approve.
- Không định nghĩa lại công thức KPI chưa được Team Lead chốt.
