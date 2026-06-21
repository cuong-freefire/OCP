# TASKS.md — Enrollment Management Implementation Tasks

**Version:** 1.0.0  
**Owner:** TienTD (Member 3)  
**Based on:** PLAN.md v1.0.0, SPEC.md v1.1.0  
**Date:** 2026-06-20  
**Total Estimated Time:** 28 hours (~3.5 working days)

---

## Task Breakdown Table

| ID | Task Name | Files to Create/Edit | Est. Time | Dependencies | SPEC Refs | Done Criteria |
|---|---|---|---|---|---|---|
| **T001** | Create Prisma schema for enrollments table | `prisma/schema.prisma` (edit) | 1.5h | None | SPEC §5 (Data Model) | Table `enrollments` defined với fields, UNIQUE constraint, composite index, FK RESTRICT |
| **T002** | Run Prisma migration | Terminal command | 0.5h | T001 | SPEC §5 | Migration file generated, DB table created, indexes verified |
| **T003** | Create EnrollmentRepository | `backend/src/repositories/enrollment.repository.js` (create) | 3h | T002 | SPEC §5, §4 (Concurrency Control) | Methods: `createEnrollment`, `findEnrollment`, `findEnrollmentById`, `updateEnrollmentStatus`, `getUserEnrollmentsWithCourses` implemented với Prisma |
| **T004** | Implement SELECT FOR UPDATE in Repository | `backend/src/repositories/enrollment.repository.js` (edit) | 2h | T003 | SPEC §4 (Concurrency Control) | `findEnrollment({ lock: true })` uses `prisma.$queryRaw` với `SELECT ... FOR UPDATE`, tested với concurrent requests |
| **T005** | Unit test EnrollmentRepository | `backend/tests/repositories/enrollment.repository.test.js` (create) | 3h | T003, T004 | All Repository methods | Mock Prisma, test all methods với success/failure cases, coverage ≥ 80% |
| **T006** | Create EnrollmentService - canAccessCourse | `backend/src/services/enrollment.service.js` (create) | 3h | T003, T004 | SPEC §3 (Access Contract), §3 (Ubiquitous - blocked user check) | Method `canAccessCourse(userId, courseId, userRole)` implemented với 5-step logic: role bypass, user.status check, mentor ownership, enrollment check |
| **T007** | Create EnrollmentService - handlePaymentSuccess | `backend/src/services/enrollment.service.js` (edit) | 4h | T006, T004 | SPEC §3 (Event-driven), §3 (State-driven - re-enrollment), §4 (Data Integrity) | Event handler với transaction, SELECT FOR UPDATE, idempotency (active check), re-enrollment (UPDATE cancelled→active), UNIQUE error handling |
| **T008** | Create EnrollmentService - getMyEnrollments | `backend/src/services/enrollment.service.js` (edit) | 1.5h | T006 | SPEC §3 (API Contracts) | Method calls repository, returns enrollments với course details (title, thumbnail) |
| **T009** | Create EnrollmentService - cancelEnrollment | `backend/src/services/enrollment.service.js` (edit) | 1.5h | T006 | SPEC §3 (API Contracts) | Method finds enrollment by ID, throws 404 if not found, updates status to 'cancelled', NO notification sent (silent cancel) |
| **T010** | Unit test EnrollmentService | `backend/tests/services/enrollment.service.test.js` (create) | 4h | T006, T007, T008, T009 | All Service methods | Mock repositories, test canAccessCourse (all role types, blocked user), handlePaymentSuccess (idempotent, re-enrollment), getMyEnrollments, cancelEnrollment, coverage ≥ 80% |
| **T011** | Create EnrollmentController | `backend/src/controllers/enrollment.controller.js` (create) | 2h | T008, T009 | SPEC §3 (API Contracts) | Methods: `getMyEnrollments` (extract userId từ req.user), `cancelEnrollment` (extract enrollmentId từ params), format responses theo SPEC §3 |
| **T012** | Unit test EnrollmentController | `backend/tests/controllers/enrollment.controller.test.js` (create) | 2h | T011 | Controller logic | Mock service, test request/response handling, verify response format matches SPEC §3 |
| **T013** | Create enrollment routes | `backend/src/routes/enrollment.routes.js` (create) | 1h | T011 | SPEC §3 (API #39, #44) | Routes: `GET /my-courses` (authMiddleware), `DELETE /:id` (authMiddleware + roleMiddleware['ADMIN']) registered |
| **T014** | Register routes in main app | `backend/src/app.js` or `backend/src/index.js` (edit) | 0.5h | T013 | SPEC §3 | Enrollment routes mounted on `/api/enrollments` |
| **T015** | Create enrollment event listener | `backend/src/events/enrollment.listener.js` (create) | 1.5h | T007 | SPEC §3 (Event-driven) | Event listener registered on `payment.success`, calls `enrollmentService.handlePaymentSuccess()`, error logging, no crash on error |
| **T016** | Register event listener in app | `backend/src/app.js` or `backend/src/server.js` (edit) | 0.5h | T015 | SPEC §3 | Event listener initialized, verify event emitter setup |
| **T017** | Integration test - API GET /enrollments/my-courses | `backend/tests/integration/enrollment.api.test.js` (create) | 2h | T014 | SPEC §3 (API #39), §7 (Acceptance Criteria) | Test với supertest, verify JWT required, returns enrollments với course details, archived courses visible |
| **T018** | Integration test - API DELETE /admin/enrollments/:id | `backend/tests/integration/enrollment.api.test.js` (edit) | 2h | T014 | SPEC §3 (API #44), §7 (Acceptance Criteria) | Test admin role required, success response, 404 for not found, verify silent cancel (no notification) |
| **T019** | Integration test - handlePaymentSuccess event | `backend/tests/integration/enrollment.event.test.js` (create) | 3h | T016 | SPEC §3 (Event-driven), §7 (Acceptance - Idempotent) | Emit fake payment.success event, verify enrollment created with status='active', test idempotency (duplicate event → no update), test re-enrollment (cancelled→active) |
| **T020** | Integration test - canAccessCourse contract | `backend/tests/integration/enrollment.contract.test.js` (create) | 2h | T006 | SPEC §3 (Access Contract), §7 (Acceptance - Blocked User, Archived Course) | Test all role bypasses (ADMIN, MANAGER, MENTOR ownership), test blocked user returns false, test archived course access, verify < 50ms response time |
| **T021** | Performance test - canAccessCourse with load | `backend/tests/performance/enrollment.performance.test.js` (create) | 2h | T020 | SPEC §4 (Performance < 50ms) | Load test với 1000 concurrent calls, verify p95 < 50ms, verify composite index usage với EXPLAIN |
| **T022** | Verify SPEC acceptance criteria | All test files (review) | 1h | T017, T018, T019, T020 | SPEC §7 (All 3 scenarios) | All acceptance criteria pass: Idempotent payment processing, Archived course access, Blocked user denied |

---

## Implementation Phases

### Phase 1: Foundation (Database & Repository)
**Duration:** 8 hours  
**Tasks:** T001, T002, T003, T004, T005

**Goal:** Setup database schema và data access layer với pessimistic locking

**Deliverables:**
- Prisma schema với enrollments table (UNIQUE constraint, composite index, FK RESTRICT)
- DB migration successful
- EnrollmentRepository với SELECT FOR UPDATE support
- Unit tests với coverage ≥ 80%

---

### Phase 2: Service Layer
**Duration:** 14 hours  
**Tasks:** T006, T007, T008, T009, T010

**Goal:** Implement business logic với security checks, idempotency, event handling

**Deliverables:**
- canAccessCourse() contract cho Member D (5-step logic: role bypass, blocked user check, mentor ownership, enrollment check)
- handlePaymentSuccess() event handler (transaction, lock, idempotency, re-enrollment)
- getMyEnrollments() và cancelEnrollment() API logic
- Unit tests với mock repositories, coverage ≥ 80%

---

### Phase 3: API & Event Integration
**Duration:** 5.5 hours  
**Tasks:** T011, T012, T013, T014, T015, T016

**Goal:** HTTP layer và event listener setup

**Deliverables:**
- EnrollmentController với 2 API handlers
- enrollment.routes.js với authMiddleware + roleMiddleware
- enrollment.listener.js registered on payment.success event
- Unit tests for controller

---

### Phase 4: Integration & Performance Testing
**Duration:** 11 hours  
**Tasks:** T017, T018, T019, T020, T021, T022

**Goal:** End-to-end testing và performance validation

**Deliverables:**
- API integration tests với supertest (JWT, admin role, response format)
- Event integration test (idempotency, re-enrollment)
- Contract test: verify canAccessCourse() với all role types và edge cases
- Performance test: verify < 50ms với 1000 concurrent calls
- All SPEC acceptance criteria verified

---

## Task Dependencies Graph

```
T001 (Prisma schema)
  └─> T002 (Migration)
        └─> T003 (EnrollmentRepository)
              ├─> T004 (SELECT FOR UPDATE)
              │     └─> T005 (Repository tests)
              │           └─> T006 (Service - canAccessCourse)
              │                 ├─> T007 (Service - handlePaymentSuccess)
              │                 ├─> T008 (Service - getMyEnrollments)
              │                 └─> T009 (Service - cancelEnrollment)
              │                       └─> T010 (Service tests)
              │                             ├─> T011 (Controller)
              │                             │     └─> T012 (Controller tests)
              │                             │           └─> T013 (Routes)
              │                             │                 └─> T014 (Register routes)
              │                             │                       ├─> T017 (API test - GET)
              │                             │                       └─> T018 (API test - DELETE)
              │                             └─> T015 (Event listener)
              │                                   └─> T016 (Register listener)
              │                                         └─> T019 (Event test)
              │
              └─> T020 (Contract test)
                    └─> T021 (Performance test)
                          └─> T022 (Verify acceptance criteria)
```

---

## SPEC Section References

| SPEC Section | Tasks Implementing |
|---|---|
| §3 - Ubiquitous (unique enrollment, blocked user check) | T001, T006, T010, T020 |
| §3 - Event-driven (payment success event) | T007, T015, T016, T019 |
| §3 - State-driven (re-enrollment cancelled→active) | T007, T010, T019 |
| §3 - Access Contract (canAccessCourse) | T006, T010, T020, T021 |
| §4 - Performance (< 50ms) | T004, T006, T021 |
| §4 - Data Integrity (transaction) | T007, T010, T019 |
| §4 - Concurrency Control (SELECT FOR UPDATE) | T004, T005, T007, T010 |
| §5 - API Contracts (API #39, #44) | T008, T009, T011, T013, T017, T018 |
| §6 - Data Model (enrollments table) | T001, T002, T003 |
| §7 - Error Handling (UNIQUE constraint, 401, 404) | T007, T009, T010, T011, T018 |
| §8 - Acceptance Criteria (3 scenarios) | T017, T018, T019, T020, T022 |

---

## Critical Success Factors

Mỗi task được coi là **DONE** khi:

1. ✅ Code tuân thủ layered architecture (Route → Middleware → Controller → Service → Repository)
2. ✅ Service không import Prisma trực tiếp (chỉ Repository import Prisma)
3. ✅ SELECT FOR UPDATE implemented correctly trong Repository (T004)
4. ✅ canAccessCourse() ALWAYS check user.status trước enrollment.status (Security Layer 1)
5. ✅ handlePaymentSuccess() implement idempotency (active enrollment → no-op)
6. ✅ Re-enrollment logic: UPDATE cancelled→active (KHÔNG INSERT mới)
7. ✅ Admin cancel enrollment: silent cancel (NO email notification)
8. ✅ Archived course: enrollment vẫn active (bảo vệ quyền lợi user)
9. ✅ Unit tests pass với coverage ≥ 80%
10. ✅ Integration tests verify tất cả SPEC acceptance criteria
11. ✅ Performance test verify p95 < 50ms cho canAccessCourse()
12. ✅ Không có console.log, debug statements, hoặc commented code
13. ✅ Error responses theo format: `{ success, message, code, details }`

---

## Parallel Work Opportunities

Các tasks sau có thể làm song song để tăng tốc:

1. **T005 + T006**: Repository tests và Service canAccessCourse() có thể làm đồng thời (mock Prisma cho service)
2. **T011 + T015**: Controller và Event listener có thể làm parallel
3. **T017 + T018**: API integration tests có thể làm đồng thời
4. **T019 + T020**: Event test và Contract test có thể parallel

**Recommended Sequence for 2 developers:**
- **Developer A**: T001 → T002 → T003 → T004 → T005 → T006 → T007 → T010 → T015 → T016 → T019 → T021
- **Developer B**: Wait for T005 → T008 → T009 → T011 → T012 → T013 → T014 → T017 → T018 → T020 → T022

---

## Risk Mitigation During Implementation

**During T004 (SELECT FOR UPDATE):**
- ⚠️ Verify `SELECT ... FOR UPDATE` syntax với Prisma `$queryRaw`
- ⚠️ Test lock behavior: 2 concurrent requests, verify 1 waits cho 1 kia release lock
- ⚠️ Handle connection timeout nếu lock hold quá lâu

**During T007 (handlePaymentSuccess):**
- ⚠️ Test idempotency: duplicate event không tạo error
- ⚠️ Test re-enrollment: cancelled enrollment được UPDATE lên active (không INSERT)
- ⚠️ Test UNIQUE constraint error: catch P2002, log và return success
- ⚠️ Verify transaction rollback khi có error

**During T006 (canAccessCourse):**
- ⚠️ Security critical: ALWAYS check user.status TRƯỚC enrollment.status
- ⚠️ Test blocked user với active enrollment → must return false
- ⚠️ Verify archived/deleted course → enrollment vẫn cho access
- ⚠️ Test mentor ownership: mentor_id === userId → bypass

**During T009 (cancelEnrollment):**
- ⚠️ Confirm NO email notification sent (silent cancel theo SPEC §5)
- ⚠️ Test 404 response khi enrollment not found
- ⚠️ Verify admin role enforcement (roleMiddleware test)

**During T021 (Performance test):**
- ⚠️ Verify composite index `(user_id, course_id)` được sử dụng (EXPLAIN query)
- ⚠️ Test với 1000 concurrent requests, measure p95 latency
- ⚠️ Nếu > 50ms, consider caching strategy (Redis với TTL 60s)

---

## Notes

- **All tasks ≤ 4h**: Task lớn nhất là T007 (4h) và T010 (4h) cho complex logic
- **Sequential dependencies**: Repository → Service → Controller → Routes → Tests
- **SPEC coverage**: Mọi requirement trong SPEC.md được map vào ít nhất 1 task
- **3 critical notes từ review**:
  1. Silent cancel (T009): NO notification
  2. Archived course access (T006, T020): enrollment active → vẫn học được
  3. Re-enrollment (T007, T019): UPDATE thay vì INSERT

---

## Integration với Cross-Module Dependencies

### Contract Exported TO Member D (Learning):
**Task T006** tạo `canAccessCourse(userId, courseId, userRole)` contract.

Member D sẽ inject EnrollmentService via constructor:
```javascript
// Member D code
class LessonService {
  constructor(enrollmentService) {
    this.enrollmentService = enrollmentService;
  }
  
  async getLesson(userId, lessonId) {
    const lesson = await this.lessonRepository.findLesson(lessonId);
    const hasAccess = await this.enrollmentService.canAccessCourse(
      userId, 
      lesson.courseId, 
      req.user.role
    );
    if (!hasAccess) throw new Error('Access denied');
    return lesson;
  }
}
```

### Contract Consumed FROM Other Modules:
**Task T006** cần inject:
- `userRepository` (từ Member A) - để check user.status
- `courseRepository` (từ Member B) - để check mentor_id

**Task T007** lắng nghe event từ Payment Module (Member 3):
```javascript
// Payment Module emits
eventEmitter.emit('payment.success', {
  userId: 'uuid',
  courseId: 'uuid',
  paymentId: 'uuid',
  timestamp: '2026-06-20T10:00:00Z'
});
```

---

## Next Steps After Completion

1. ✅ Answer PLAN.md Section 6 questions (Q1-Q6) với stakeholders
2. ✅ Setup event emitter infrastructure với Payment Module
3. ✅ Coordinate với Member D để integrate canAccessCourse() contract
4. ✅ Deploy to staging environment
5. ✅ Perform manual testing với real enrollment flow
6. ✅ Load testing: verify p95 response time < 50ms
7. ✅ Security audit: blocked user check, IDOR prevention
8. ✅ Code review với team lead
9. ✅ User acceptance testing (UAT)

---

**End of TASKS.md**
