# TASKS.md — Course Catalog Implementation Tasks

**Version:** 1.0.0  
**Owner:** TienTD (Member 3)  
**Based on:** PLAN.md v1.0.0, SPEC.md v1.1.0  
**Date:** 2026-06-19  
**Total Estimated Time:** 28 hours (~3.5 days)

---

## Task List

| ID | Task Name | Files to Create/Edit | Est. Time | Dependencies | SPEC Refs | Done Criteria |
|---|---|---|---|---|---|---|
| **T001** | Tạo Zod validation schemas | `backend/src/validators/catalog.validator.js` (create) | 1h | None | §6 | Có `paginationQuerySchema` và `courseIdParamSchema`, pass unit tests với valid/invalid inputs |
| **T002** | Tạo Repository - findPublishedCoursesWithPagination | `backend/src/repositories/catalog.repository.js` (create) | 2h | None | §3, §4, §5 | Function trả về published courses với pagination, filter blocked mentor, Prisma query đúng với WHERE clause |
| **T003** | Tạo Repository - countPublishedCourses | `backend/src/repositories/catalog.repository.js` (edit) | 1h | T002 | §3, §5 | Function trả về count chính xác, filter giống T002 (published + not blocked mentor) |
| **T004** | Tạo Repository - findCourseByIdWithDetails | `backend/src/repositories/catalog.repository.js` (edit) | 2h | T002 | §3, §5, §8 | Function trả về course với sections/lessons, LEFT JOIN, KHÔNG trả về content/assets/quizzes |
| **T005** | Unit test Repository layer | `backend/tests/repositories/catalog.repository.test.js` (create) | 2h | T002, T003, T004 | All | Mock Prisma client, test 3 functions với edge cases (empty, blocked mentor, draft), coverage ≥ 80% |
| **T006** | Tạo Service - getPublishedCourses | `backend/src/services/catalog.service.js` (create) | 2h | T002, T003 | §3, §6 | Function gọi repository, tính offset/totalPages, transform data, KHÔNG import Prisma trực tiếp |
| **T007** | Tạo Service - getCourseById | `backend/src/services/catalog.service.js` (edit) | 2h | T004 | §3, §6 | Function check published/blocked, throw NotFoundError nếu invalid, transform DTO, filter sensitive fields |
| **T008** | Unit test Service layer | `backend/tests/services/catalog.service.test.js` (create) | 2h | T006, T007 | All | Mock repository, test 2 functions, test error cases (not found, blocked mentor, draft course) |
| **T009** | Tạo validatePagination middleware | `backend/src/middlewares/validatePagination.middleware.js` (create) | 2h | T001 | §4, §6 | Middleware set `req.pagination` với defaults (page=1, limit=20), add warnings vào metadata, cap limit ở 100 |
| **T010** | Tạo Controller - getCourseList | `backend/src/controllers/catalog.controller.js` (create) | 1.5h | T006, T009 | §3, §6 | Handler gọi service, return response với pagination/metadata/warnings, catch errors và pass to next() |
| **T011** | Tạo Controller - getCourseDetail | `backend/src/controllers/catalog.controller.js` (edit) | 1.5h | T007 | §3, §6 | Handler gọi service, return response, handle 404 (not found) và 503 (timeout) errors |
| **T012** | Unit test Controller và Middleware | `backend/tests/controllers/catalog.controller.test.js`, `backend/tests/middlewares/validatePagination.test.js` (create) | 3h | T009, T010, T011 | All | Mock service, test request/response handling, test pagination validation với invalid inputs |
| **T013** | Tạo Routes và register vào app | `backend/src/api/catalog.routes.js` (create), `backend/src/api/index.js` (edit) | 1h | T009, T010, T011 | §3, §4 | Routes `GET /courses` (với middleware) và `GET /courses/:id` hoạt động, KHÔNG yêu cầu JWT auth |
| **T014** | Integration test - GET /courses | `backend/tests/integration/catalog.api.test.js` (create) | 2h | T013 | §7 | Test với supertest, seed data (published/draft/blocked), verify scenarios 1, 2, 3 trong SPEC §7 |
| **T015** | Integration test - GET /courses/:id | `backend/tests/integration/catalog.api.test.js` (edit) | 2h | T013 | §3, §7 | Test course detail, test 404 for draft/blocked/not found, verify sections/lessons trả về đúng structure |
| **T016** | Verify SPEC acceptance criteria | All test files (review) | 1h | T014, T015 | §7 | Tất cả 3 scenarios trong SPEC §7 pass, test coverage ≥ 80%, no failing tests |

---

## Implementation Phases

### Phase 1: Foundation (Repository Layer)
**Duration:** 8 hours  
**Tasks:** T001, T002, T003, T004, T005

**Goal:** Tạo data access layer với Prisma queries an toàn, filter published courses và blocked mentors.

**Deliverables:**
- `catalog.validator.js` với Zod schemas
- `catalog.repository.js` với 3 functions
- Unit tests cho repository với coverage ≥ 80%

---

### Phase 2: Business Logic (Service Layer)
**Duration:** 6 hours  
**Tasks:** T006, T007, T008

**Goal:** Implement business rules, orchestration logic, và data transformation.

**Deliverables:**
- `catalog.service.js` với 2 functions
- Service không import Prisma trực tiếp
- Unit tests cho service với mock repository

---

### Phase 3: Request Handling (Controller + Middleware)
**Duration:** 8 hours  
**Tasks:** T009, T010, T011, T012

**Goal:** Xử lý HTTP requests, validate inputs, return responses, handle errors.

**Deliverables:**
- `validatePagination.middleware.js`
- `catalog.controller.js` với 2 handlers
- Unit tests cho controller và middleware

---

### Phase 4: API Exposure (Routes + Integration Tests)
**Duration:** 5 hours  
**Tasks:** T013, T014, T015

**Goal:** Expose endpoints, integrate với Express app, verify end-to-end flow.

**Deliverables:**
- `catalog.routes.js` registered vào app
- Integration tests với supertest
- All HTTP endpoints hoạt động

---

### Phase 5: Verification
**Duration:** 1 hour  
**Tasks:** T016

**Goal:** Verify tất cả acceptance criteria trong SPEC pass.

**Deliverables:**
- All SPEC §7 scenarios pass
- Test coverage report ≥ 80%
- No console.log, no debug statements

---

## Parallel Work Opportunities

Các tasks sau có thể làm song song để tăng tốc độ:

1. **T001 + T002**: Zod schemas và Repository có thể làm đồng thời (không phụ thuộc nhau)
2. **T009**: Middleware có thể bắt đầu sau T001, không cần đợi T002-T008
3. **T005 + T006**: Repository tests và Service implementation có thể overlap một phần

**Recommended Sequence for 2 developers:**
- Developer A: T001 → T002 → T003 → T004 → T005
- Developer B: T001 → T009 → (wait for T006) → T010 → T011 → T012

---

## SPEC Section References

| SPEC Section | Tasks Implementing |
|---|---|
| §3 - Functional Requirements (Ubiquitous) | T002, T003, T006 |
| §3 - Functional Requirements (Event-driven) | T004, T006, T007, T010, T011 |
| §3 - Functional Requirements (Unwanted) | T002, T004, T007, T015 |
| §4 - Non-functional Requirements (Performance) | (Verified in T016 load test) |
| §4 - Non-functional Requirements (Pagination) | T009 |
| §4 - Non-functional Requirements (Security) | T002, T004 |
| §4 - Non-functional Requirements (Auth) | T013 |
| §5 - Data Model | T002, T003, T004 |
| §6 - Error Handling | T001, T006, T007, T009, T010, T011 |
| §7 - Acceptance Criteria | T014, T015, T016 |
| §8 - Out of Scope | T004 (verify NOT returning content/assets) |

---

## Critical Success Factors

Mỗi task được coi là **DONE** khi:

1. ✅ Code tuân thủ layered architecture (CLAUDE.md)
2. ✅ Không import Prisma trong service/controller
3. ✅ Filter `status='published'` và `users.status!='blocked'` tại repository
4. ✅ Unit tests pass với coverage ≥ 80%
5. ✅ Không có console.log, debug statements, hoặc commented code
6. ✅ Error handling đầy đủ (404, 503, validation errors)
7. ✅ Response structure theo format đã định nghĩa trong PLAN.md

---

## Risk Mitigation During Implementation

**During T002-T004 (Repository)**:
- ⚠️ Verify Prisma query generates correct SQL với EXPLAIN
- ⚠️ Test với data lớn (50+ sections, 10+ lessons/section) để catch N+1 issues

**During T006-T007 (Service)**:
- ⚠️ Mock repository đúng cách để test isolation
- ⚠️ Verify service KHÔNG import `@prisma/client`

**During T009-T011 (Controller/Middleware)**:
- ⚠️ Test pagination edge cases: page=0, limit=-1, limit=999, page=abc
- ⚠️ Verify warnings được add vào metadata khi dùng defaults

**During T014-T015 (Integration Tests)**:
- ⚠️ Seed data cleanup sau mỗi test để tránh pollution
- ⚠️ Test với real database (không mock Prisma ở integration level)

---

## Notes

- **No task > 4h**: Tất cả tasks được chia nhỏ theo yêu cầu
- **Sequential dependencies**: Mỗi phase build trên phase trước đó
- **SPEC coverage**: Mọi requirement trong SPEC.md được map vào ít nhất 1 task
- **Testable done criteria**: Tất cả done criteria có thể verify bằng automated tests

---

## Next Steps After Completion

1. ✅ Get answers for PLAN.md section 6 questions (Q1-Q6)
2. ✅ Run performance test (p95 < 500ms với 100 concurrent users)
3. ✅ Security audit: Verify IDOR attack bị chặn
4. ✅ Code review với team lead
5. ✅ Deploy to staging environment
6. ✅ User acceptance testing (UAT)

---

**End of TASKS.md**
