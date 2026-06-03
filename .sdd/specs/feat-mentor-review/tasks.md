# TASKS.md — Mentor Review System

# Generated: 2026-05-27 | Total: 16 tasks, ~41.5h

| ID | Task | Files | Est | Deps | Spec Refs | Done When |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Tạo migration project reviews | `backend/prisma/schema.prisma`, `backend/prisma/migrations/*_project_reviews/` | 2h | - | §5, FR-MRV-003, FR-MRV-007 | Migration runs; unique `submission_id` prevents second final review. |
| T002 | Tạo migration mentor feedbacks | `backend/prisma/schema.prisma`, `backend/prisma/migrations/*_mentor_feedbacks/` | 2h | T001 | §5, FR-MRV-003, FR-MRV-008 | Feedback table links to review; delete/rollback behavior leaves no orphan rows. |
| T003 | Implement submit review schema | `backend/src/middlewares/mentor-review.schema.ts`, `backend/tests/mentor-review/mentor-review.schema.test.ts` | 1.5h | - | FR-MRV-004, FR-MRV-005, NFR-MRV-003 | Invalid result, short feedback and unknown fields fail; valid body passes. |
| T004 | Implement review DTOs and errors | `backend/src/utils/review.types.ts`, `backend/src/utils/review.errors.ts`, `backend/src/utils/review-error.mapper.ts` | 2h | - | §6 | Domain errors map to 400/401/403/404/409/503 without internal details. |
| T005 | Implement assignment guard | `backend/src/services/assignment-guard.service.ts`, `backend/tests/mentor-review/assignment-guard.service.test.ts` | 2h | T004 | FR-MRV-001, FR-MRV-002, FR-MRV-006 | Assigned Mentor passes; unassigned or disabled assignment throws 403. |
| T006 | Define submission reader contract | `backend/src/services/submission-reader.contract.ts`, `backend/tests/mentor-review/mock-submission-reader.ts` | 2h | T004 | FR-MRV-002, FR-MRV-007 | Port and mock compile; not-found and timeout cases are testable. |
| T007 | Define submission updater contract | `backend/src/services/submission-updater.contract.ts`, `backend/tests/mentor-review/mock-submission-updater.ts` | 2h | T004 | FR-MRV-003, FR-MRV-008 | Port and mock compile; updater failure can trigger rollback tests. |
| T008 | Implement review repositories | `backend/src/repositories/project-review.repository.ts`, `backend/src/repositories/mentor-feedback.repository.ts` | 3h | T001,T002,T004 | §5, FR-MRV-003, FR-MRV-007 | Insert/find review and feedback work in transaction; duplicate review maps to conflict. |
| T009 | Implement submit review service | `backend/src/services/review.service.ts`, `backend/tests/mentor-review/review.service.submit.test.ts` | 4h | T003,T005,T006,T007,T008 | FR-MRV-003, FR-MRV-006, FR-MRV-007, FR-MRV-008 | Valid review commits; unauthorized, reviewed and updater-fail scenarios pass. |
| T010 | Implement review queue service | `backend/src/services/review.service.ts`, `backend/tests/mentor-review/review.service.queue.test.ts` | 3h | T005,T006 | FR-MRV-001, NFR-MRV-004 | Queue returns only assigned `PENDING` submissions and handles empty result. |
| T011 | Implement submission detail service | `backend/src/services/review.service.ts`, `backend/tests/mentor-review/review.service.detail.test.ts` | 3h | T005,T006 | FR-MRV-002, FR-MRV-006 | Detail endpoint returns submission only after assignment check; unassigned Mentor gets 403. |
| T012 | Wire mentor review routes | `backend/src/api/mentor-review.routes.ts`, `backend/src/api/index.ts` | 2h | T003,T009,T010,T011 | NFR-MRV-001, NFR-MRV-002 | Queue/detail/review routes require cookie auth and Mentor role. |
| T013 | Implement review controller | `backend/src/controllers/review.controller.ts`, `backend/tests/mentor-review/review.controller.test.ts` | 3h | T012 | §6, FR-MRV-001, FR-MRV-002, FR-MRV-003 | Controller returns stable success/error body and adds audit metadata. |
| T014 | Add review service unit tests | `backend/tests/mentor-review/review.service.test.ts` | 4h | T009,T010,T011 | §7 | AC-MRV-001 to AC-MRV-005 pass with mocked guards/adapters/repositories. |
| T015 | Add integration and rollback tests | `backend/tests/integration/mentor-review.integration.test.ts` | 4h | T013 | §7, NFR-MRV-006 | End-to-end auth, assignment, duplicate review and rollback scenarios pass. |
| T016 | Write mentor review API docs | `docs/api/mentor-review.openapi.yaml`, `docs/mentor-review.md` | 2h | T013 | §1-§8 | OpenAPI includes queue/detail/review endpoints, schemas, auth and error examples. |
