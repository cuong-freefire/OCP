# TASKS.md — Admin Management

# Generated: 2026-05-27 | Total: 13 tasks, ~38h

| ID | Task | Files | Est | Deps | Spec Refs | Done When |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Tạo migration mentor assignments | `backend/prisma/schema.prisma`, `backend/prisma/migrations/*_mentor_assignments/` | 2h | - | §5, FR-ADM-006, FR-ADM-007 | Migration runs and duplicate active `(mentor_id, course_id)` is rejected by DB. |
| T002 | Implement admin validation schemas | `backend/src/middlewares/admin.schema.ts`, `backend/tests/admin/admin.schema.test.ts` | 2h | - | §4, §6, NFR-ADM-002 | Valid bodies pass; invalid status, invalid ids and unknown fields return validation errors. |
| T003 | Implement admin DTOs and errors | `backend/src/utils/admin.types.ts`, `backend/src/utils/admin.errors.ts`, `backend/src/utils/admin-error.mapper.ts` | 2h | - | §6 | Error codes map to expected HTTP statuses without stack traces. |
| T004 | Define payment and enrollment readers | `backend/src/services/payment-reader.contract.ts`, `backend/src/services/enrollment-reader.contract.ts`, `backend/tests/admin/mock-readers.ts` | 2h | T003 | FR-ADM-004, §4 | Ports and mocks compile; timeout/unavailable cases can be simulated in tests. |
| T005 | Implement user repository | `backend/src/repositories/user.repository.ts`, `backend/tests/admin/user.repository.test.ts` | 3h | T001 | §5, FR-ADM-002, FR-ADM-003 | Find, status update and hard delete operations work inside transaction tests. |
| T006 | Implement mentor assignment repository | `backend/src/repositories/mentor-assignment.repository.ts`, `backend/tests/admin/mentor-assignment.repository.test.ts` | 3h | T001 | §5, FR-ADM-006, FR-ADM-007, FR-ADM-008 | Create/find/disable assignment works; duplicate insert maps to conflict. |
| T007 | Implement user lifecycle service | `backend/src/services/admin-user.service.ts`, `backend/tests/admin/admin-user.service.test.ts` | 4h | T003,T004,T005 | FR-ADM-002, FR-ADM-003, FR-ADM-004, AC-ADM-002, AC-ADM-005 | Block/unblock/delete rules pass; hard delete with payment/enrollment returns 409. |
| T008 | Implement mentor assignment service | `backend/src/services/admin-mentor.service.ts`, `backend/tests/admin/admin-mentor.service.test.ts` | 4h | T003,T006 | FR-ADM-005, FR-ADM-006, FR-ADM-007, FR-ADM-008, AC-ADM-001, AC-ADM-004 | Assign/revoke/list rules pass; duplicate and pending-submission cases return 409. |
| T009 | Wire admin routes and middleware | `backend/src/api/admin.routes.ts`, `backend/src/api/index.ts` | 3h | T002,T007,T008 | FR-ADM-001, FR-ADM-009, NFR-ADM-001 | All admin routes require cookie auth and ADMIN role; Bearer-only request fails. |
| T010 | Implement admin controller | `backend/src/controllers/admin.controller.ts`, `backend/tests/admin/admin.controller.test.ts` | 3h | T009 | §6, FR-ADM-001 | Controller returns stable success/error body for all service outcomes. |
| T011 | Add service unit tests | `backend/tests/admin/admin-user.service.test.ts`, `backend/tests/admin/admin-mentor.service.test.ts` | 4h | T007,T008 | §7 | AC-ADM-001 to AC-ADM-005 pass with mocked repositories/adapters. |
| T012 | Add API integration tests | `backend/tests/integration/admin.integration.test.ts` | 4h | T010 | §7, NFR-ADM-001, NFR-ADM-002 | Non-admin, validation, duplicate assignment, hard delete and revoke scenarios pass end to end. |
| T013 | Write admin API documentation | `docs/api/admin.openapi.yaml`, `docs/admin-management.md` | 2h | T010 | §1-§8 | OpenAPI documents endpoints, schemas, auth scheme, success examples and error examples. |
