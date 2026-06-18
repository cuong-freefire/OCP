# TASKS.md — Reports & Analytics

# Generated: 2026-05-27 | Total: 16 tasks, ~42h

| ID | Task | Files | Est | Deps | Spec Refs | Done When |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Implement report query schema | `backend/src/middlewares/reports.schema.ts`, `backend/tests/reports/reports.schema.test.ts` | 2h | - | FR-RPT-007, NFR-RPT-005, AC-RPT-004 | Valid query passes; invalid dates and range overflow return validation errors. |
| T002 | Implement report DTOs and warnings | `backend/src/utils/report.types.ts`, `backend/src/utils/report.mapper.ts` | 2h | - | FR-RPT-001, FR-RPT-005, §6 | DashboardDTO and WarningDTO include nullable sections, `generatedAt` and source codes. |
| T003 | Implement timeout wrapper | `backend/src/utils/timeout-wrapper.ts`, `backend/tests/reports/timeout-wrapper.test.ts` | 2h | - | FR-RPT-005, NFR-RPT-004 | Slow promise rejects with timeout error; fast promise resolves unchanged. |
| T004 | Implement payment report adapter | `backend/src/services/payment-report.adapter.ts`, `backend/tests/reports/payment-report.adapter.test.ts` | 3h | T003 | FR-RPT-002, AC-RPT-003 | Adapter aggregates only `SUCCESS` transactions and maps timeout to adapter failure. |
| T005 | Implement user report adapter | `backend/src/services/user-report.adapter.ts`, `backend/tests/reports/user-report.adapter.test.ts` | 2h | T003 | FR-RPT-001 | Adapter returns total users, byRole and growth DTO or null on failure. |
| T006 | Implement course report adapter | `backend/src/services/course-report.adapter.ts`, `backend/tests/reports/course-report.adapter.test.ts` | 2h | T003 | FR-RPT-001 | Adapter returns course totals/top courses DTO or null on failure. |
| T007 | Implement enrollment report adapter | `backend/src/services/enrollment-report.adapter.ts`, `backend/tests/reports/enrollment-report.adapter.test.ts` | 2h | T003 | FR-RPT-001 | Adapter returns enrollment stats and conversion inputs or null on failure. |
| T008 | Implement review report adapter | `backend/src/services/review-report.adapter.ts`, `backend/tests/reports/review-report.adapter.test.ts` | 3h | T003 | FR-RPT-004 | Adapter returns PASS/FAIL, pending submissions and mentor performance stats. |
| T009 | Implement dashboard service aggregator | `backend/src/services/dashboard.service.ts`, `backend/tests/reports/dashboard.service.test.ts` | 4h | T002,T004,T005,T006,T007,T008 | FR-RPT-001, FR-RPT-005, NFR-RPT-003, AC-RPT-001 | Service uses parallel all-settled flow; adapter failures produce partial data and warnings. |
| T010 | Wire report routes and middleware | `backend/src/api/reports.routes.ts`, `backend/src/api/index.ts` | 2h | T001,T009 | FR-RPT-006, NFR-RPT-005, AC-RPT-002 | Routes require Admin cookie auth; non-admin request fails before adapters run. |
| T011 | Implement report controller | `backend/src/controllers/report.controller.ts`, `backend/tests/reports/report.controller.test.ts` | 3h | T010 | §6, FR-RPT-001, FR-RPT-005 | Controller returns `{ success, data, warnings }` for full and partial responses. |
| T012 | Implement optional report cache | `backend/src/services/report-cache.service.ts`, `backend/tests/reports/report-cache.service.test.ts` | 3h | T009 | §5, NFR-RPT-001 | Cache hit returns cached DTO; Redis failure falls back to service without failing request. |
| T013 | Add service and adapter unit tests | `backend/tests/reports/*.test.ts` | 4h | T009,T012 | §7 | Timeout, partial data, all-success and all-failure cases pass. |
| T014 | Add API integration tests | `backend/tests/integration/reports.integration.test.ts` | 4h | T011 | AC-RPT-001, AC-RPT-002, AC-RPT-004, AC-RPT-005 | Dashboard auth, validation, graceful fallback and read-only scenarios pass end to end. |
| T015 | Add report performance checks | `backend/tests/performance/reports.k6.js`, `docs/reports-performance.md` | 4h | T011 | NFR-RPT-001, NFR-RPT-004 | Dashboard P95 target is measured; adapter timeout scenario still returns HTTP 200 partial data. |
| T016 | Write reports API documentation | `docs/api/reports.openapi.yaml`, `docs/reports.md` | 2h | T011 | §1-§8 | OpenAPI documents dashboard/revenue endpoints, query params, partial response and warnings. |
