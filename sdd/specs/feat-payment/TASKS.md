# TASKS.md — Payment & Order Processing Implementation Tasks

**Version:** 1.0.0  
**Owner:** TienTD (Member 3)  
**Based on:** PLAN.md v1.0.0, SPEC.md v1.1.0  
**Date:** 2026-06-20  
**Total Estimated Time:** 32 hours (~4 working days)

---

## Task Breakdown Table

| ID | Task Name | Files to Create/Edit | Est. Time | Dependencies | SPEC Refs | Done Criteria |
|---|---|---|---|---|---|---|
| **T001** | Create Prisma schema for payment tables | `prisma/schema.prisma` (edit) | 2h | None | SPEC §6 (Data Model) | Tables `orders`, `payments`, `enrollments` defined với correct fields, constraints, indexes |
| **T002** | Run Prisma migration | Terminal command | 0.5h | T001 | SPEC §6 | Migration file generated, DB tables created successfully |
| **T003** | Create VNPAY helper utilities | `backend/src/utils/vnpay.helper.js` (create) | 2h | None | SPEC §3 (Event-driven - IPN), §4 (Security) | Functions `generateVNPayCheckoutUrl()` và `verifyVNPaySignature()` với HMAC-SHA512, pass unit tests |
| **T004** | Create OrderRepository | `backend/src/repositories/order.repository.js` (create) | 2h | T002 | SPEC §6 (Data Model - orders) | Methods: `createOrder`, `findPendingOrder`, `updateOrderStatus` implemented với Prisma |
| **T005** | Create PaymentRepository | `backend/src/repositories/payment.repository.js` (create) | 3h | T002 | SPEC §6 (Data Model - payments), §4 (Idempotency) | Methods: `createPayment`, `findPaymentById`, `findPaymentByOrderIdWithLock`, `updatePayment`, `expirePayment` with SELECT FOR UPDATE |
| **T006** | Create EnrollmentRepository | `backend/src/repositories/enrollment.repository.js` (create) | 2h | T002 | SPEC §6 (Data Model - enrollments) | Methods: `createEnrollment`, `findEnrollment`, `findEnrollmentsByUserId` implemented |
| **T007** | Unit test Repository layer | `backend/tests/repositories/payment.repository.test.js`, `order.repository.test.js`, `enrollment.repository.test.js` (create) | 3h | T004, T005, T006 | All Repository functions | Mock Prisma, test all methods với success/failure cases, coverage ≥ 80% |
| **T008** | Create EnrollmentService | `backend/src/services/enrollment.service.js` (create) | 2h | T006 | SPEC §3 (Event-driven - enrollment), SPEC §6 | Methods: `canAccessCourse`, `getMyEnrollments` implemented, no Prisma import |
| **T009** | Create PaymentService - createPaymentOrder | `backend/src/services/payment.service.js` (create) | 3h | T004, T005, T003 | SPEC §3 (Event-driven - create), §3 (State-driven - reuse URL) | Function handles pending order check, reuse URL logic, snapshot price, generate VNPAY URL |
| **T010** | Create PaymentService - getPaymentStatus | `backend/src/services/payment.service.js` (edit) | 1h | T009 | SPEC §3 (Event-driven) | Function returns payment status với authorization check |
| **T011** | Create PaymentService - processVNPayCallback | `backend/src/services/payment.service.js` (edit) | 4h | T009, T005, T006, T008 | SPEC §3 (Event-driven - IPN), §3 (Unwanted), §4 (Idempotency, Data Integrity), §7 (Error Handling) | Transaction logic với all checks: idempotency, expiration, amount validation, course re-validation, enrollment creation, rollback on failure |
| **T012** | Unit test Service layer | `backend/tests/services/payment.service.test.js`, `enrollment.service.test.js` (create) | 4h | T008, T009, T010, T011 | All Service functions | Mock repositories, test all service methods including edge cases (expired, duplicate, failed), coverage ≥ 80% |
| **T013** | Create validateCreatePayment middleware | `backend/src/middlewares/validateCreatePayment.middleware.js` (create) | 1.5h | None | SPEC §3 (Event-driven), §4 (Security) | Zod schema validates courseId, rejects amount/userId from body, pass validation tests |
| **T014** | Create validateVNPaySignature middleware | `backend/src/middlewares/validateVNPaySignature.middleware.js` (create) | 2h | T003 | SPEC §3 (Event-driven - IPN), §4 (Security), §7 (Error Handling) | Middleware verifies vnp_SecureHash, logs security event on failure, returns 400 for invalid signature |
| **T015** | Create PaymentController | `backend/src/controllers/payment.controller.js` (create) | 2h | T009, T010, T011 | SPEC §3 (Event-driven) | Methods: `createPayment`, `getPaymentStatus`, `handleVNPayCallback` call services and return proper responses |
| **T016** | Create EnrollmentController | `backend/src/controllers/enrollment.controller.js` (create) | 1.5h | T008 | SPEC §3 (Event-driven - enrollment check) | Methods: `checkEnrollment`, `getMyCourses` implemented |
| **T017** | Unit test Controller and Middleware | `backend/tests/controllers/payment.controller.test.js`, `enrollment.controller.test.js`, `backend/tests/middlewares/*.test.js` (create) | 3h | T013, T014, T015, T016 | Controller và Middleware logic | Mock services, test request/response handling, test middleware validation logic |
| **T018** | Create payment routes | `backend/src/routes/payment.routes.js` (create) | 1h | T013, T014, T015 | SPEC §3 (Event-driven) | Routes: `POST /payments/create`, `GET /payments/:paymentId`, `POST /payments/vnpay/callback` registered với correct middlewares |
| **T019** | Create enrollment routes | `backend/src/routes/enrollment.routes.js` (create) | 1h | T016 | SPEC §3 (Event-driven - enrollment) | Routes: `GET /enrollments/check`, `GET /enrollments/my-courses` registered với authMiddleware |
| **T020** | Register routes in main app | `backend/src/app.js` or `backend/src/index.js` (edit) | 0.5h | T018, T019 | SPEC §3 | Payment và enrollment routes mounted on Express app |
| **T021** | Integration test - POST /payments/create | `backend/tests/integration/payment.api.test.js` (create) | 2h | T020 | SPEC §8 (Acceptance Criteria - Scenario 1, 2) | Test with supertest, verify order creation, VNPAY URL generation, reuse URL for pending orders |
| **T022** | Integration test - POST /payments/vnpay/callback | `backend/tests/integration/payment.api.test.js` (edit) | 3h | T020 | SPEC §8 (Acceptance Criteria - Scenario 1, 3), §7 (Error Handling) | Test success callback, idempotency, late IPN (expired), amount validation, enrollment creation, rollback scenario |
| **T023** | Integration test - GET /enrollments/check | `backend/tests/integration/enrollment.api.test.js` (create) | 1.5h | T020 | SPEC §3 (Event-driven - enrollment check) | Test enrollment status check for active/cancelled/not enrolled users |
| **T024** | Verify all SPEC acceptance criteria | All test files (review) | 1h | T021, T022, T023 | SPEC §8 (All 3 scenarios) | All acceptance criteria pass: payment success, pending order reuse, late IPN handling |
| **T025** | Add enrollment success event emission | `backend/src/services/payment.service.js` (edit) | 1h | T011 | share_context.md §3.3 (Enrollment Success Event) | After enrollment creation, emit event hoặc call EmailService với payload: userId, courseId, enrollmentId, enrolledAt, paymentAmount, status |

---

## Implementation Phases

### Phase 1: Foundation (Database & Utils)
**Duration:** 4.5 hours  
**Tasks:** T001, T002, T003

**Goal:** Setup database schema và VNPAY utilities

**Deliverables:**
- Prisma schema với 3 tables (orders, payments, enrollments)
- DB migration successful
- VNPAY helper functions with unit tests

---

### Phase 2: Repository Layer
**Duration:** 10 hours  
**Tasks:** T004, T005, T006, T007

**Goal:** Create data access layer với Prisma

**Deliverables:**
- OrderRepository, PaymentRepository, EnrollmentRepository
- Unit tests với coverage ≥ 80%
- SELECT FOR UPDATE implemented in PaymentRepository

---

### Phase 3: Service Layer
**Duration:** 14 hours  
**Tasks:** T008, T009, T010, T011, T012

**Goal:** Implement business logic

**Deliverables:**
- EnrollmentService với canAccessCourse contract
- PaymentService với 3 methods (create, getStatus, processCallback)
- Transaction logic với idempotency, validation, rollback
- Unit tests với mock repositories

---

### Phase 4: Controller, Middleware & Routes
**Duration:** 11.5 hours  
**Tasks:** T013, T014, T015, T016, T017, T018, T019, T020

**Goal:** HTTP layer implementation

**Deliverables:**
- 2 middlewares: validateCreatePayment, validateVNPaySignature
- 2 controllers: PaymentController, EnrollmentController
- 2 route files registered in app
- Unit tests for controllers và middlewares

---

### Phase 5: Integration Testing & Event Emission
**Duration:** 8.5 hours  
**Tasks:** T021, T022, T023, T024, T025

**Goal:** End-to-end testing và event integration

**Deliverables:**
- Integration tests với supertest
- All SPEC acceptance criteria verified
- Enrollment success event emission implemented

---

## Task Dependencies Graph

```
T001 (Prisma schema)
  ├─> T002 (Migration)
  │     ├─> T004 (OrderRepository)
  │     ├─> T005 (PaymentRepository)
  │     └─> T006 (EnrollmentRepository)
  │           ├─> T007 (Repo tests)
  │           ├─> T008 (EnrollmentService)
  │           └─> T009 (PaymentService - create)
  │                 ├─> T010 (PaymentService - getStatus)
  │                 └─> T011 (PaymentService - callback)
  │                       ├─> T012 (Service tests)
  │                       ├─> T015 (PaymentController)
  │                       └─> T025 (Event emission)
  │
T003 (VNPAY helper)
  ├─> T009 (PaymentService - uses helper)
  └─> T014 (Signature middleware)

T013 (validateCreatePayment)
T014 (Signature middleware)
T015 (PaymentController)
  └─> T018 (Payment routes)

T008 (EnrollmentService)
  └─> T016 (EnrollmentController)
        └─> T019 (Enrollment routes)

T018, T019
  └─> T020 (Register routes)
        ├─> T021 (Integration test - create)
        ├─> T022 (Integration test - callback)
        └─> T023 (Integration test - enrollment)
              └─> T024 (Verify acceptance criteria)
```

---

## SPEC Section References

| SPEC Section | Tasks Implementing |
|---|---|
| §3 - Ubiquitous (BIGINT, snapshot price) | T001, T004, T005, T009 |
| §3 - Event-driven (create payment, IPN, enrollment) | T009, T010, T011, T015, T016, T018, T019 |
| §3 - State-driven (reuse URL) | T009, T021 |
| §3 - Unwanted (signature invalid, expired, archived course) | T011, T014, T022 |
| §4 - Non-functional (Idempotency, Security, Data Integrity) | T005, T011, T013, T014 |
| §5 - State Diagram | T011 (state transitions) |
| §6 - Data Model | T001, T004, T005, T006 |
| §7 - Error Handling | T011, T014, T022 |
| §8 - Acceptance Criteria | T021, T022, T023, T024 |

---

## Critical Success Factors

Mỗi task được coi là **DONE** khi:

1. ✅ Code tuân thủ layered architecture (Route → Middleware → Controller → Service → Repository)
2. ✅ Service không import Prisma trực tiếp
3. ✅ Payment callback sử dụng database transaction với SELECT FOR UPDATE
4. ✅ Idempotency check với vnpay_transaction_id implemented
5. ✅ Amount validation (vnp_Amount === orders.total_price) trong IPN callback
6. ✅ Enrollment creation failure triggers transaction rollback
7. ✅ Unit tests pass với coverage ≥ 80%
8. ✅ Integration tests verify tất cả SPEC acceptance criteria
9. ✅ Không có console.log, debug statements, hoặc commented code
10. ✅ Error responses theo format: `{ success, message, code, details }`

---

## Parallel Work Opportunities

Các tasks sau có thể làm song song để tăng tốc:

1. **T003 + T004/T005/T006**: VNPAY helper và Repositories có thể làm đồng thời
2. **T013 + T008**: validateCreatePayment middleware và EnrollmentService independent
3. **T014 + T016**: validateVNPaySignature và EnrollmentController có thể parallel
4. **T021 + T023**: Integration tests cho payment và enrollment có thể làm đồng thời

**Recommended Sequence for 2 developers:**
- **Developer A**: T001 → T002 → T004 → T005 → T006 → T007 → T009 → T010 → T011 → T012 → T015 → T018 → T021 → T022
- **Developer B**: T003 → T013 → T014 → T008 → T016 → T017 → T019 → T023 → T025 (wait for T011)

---

## Risk Mitigation During Implementation

**During T005 (PaymentRepository)**:
- ⚠️ Verify `SELECT FOR UPDATE` syntax với Prisma `$queryRaw`
- ⚠️ Test lock behavior với concurrent requests

**During T011 (processVNPayCallback)**:
- ⚠️ Test rollback scenario khi enrollment creation fail
- ⚠️ Verify idempotency với duplicate callbacks
- ⚠️ Test late IPN với expired payment

**During T021-T022 (Integration Tests)**:
- ⚠️ Seed data cleanup sau mỗi test
- ⚠️ Mock VNPAY signature validation hoặc dùng test secret key
- ⚠️ Test với real database (không mock Prisma ở integration level)

**During T025 (Event Emission)**:
- ⚠️ Verify event payload theo đúng contract trong share_context.md §3.3
- ⚠️ Handle email service failure gracefully (async, không block response)

---

## Notes

- **All tasks ≤ 4h**: Task lớn nhất là T011 (4h) cho complex callback logic
- **Sequential dependencies**: Repository → Service → Controller → Routes → Integration Tests
- **SPEC coverage**: Mọi requirement trong SPEC.md được map vào ít nhất 1 task
- **Event emission**: T025 là task cuối để integrate với Member A (Email Service)

---

## Next Steps After Completion

1. ✅ Answer PLAN.md Section 6 questions (Q1-Q6) với stakeholders
2. ✅ Setup VNPAY sandbox credentials trong `.env`
3. ✅ Deploy to staging environment
4. ✅ Perform manual testing với real VNPAY flow
5. ✅ Load testing: verify p95 response time và concurrent callback handling
6. ✅ Security audit: IDOR prevention, signature validation
7. ✅ Code review với team lead
8. ✅ User acceptance testing (UAT)

---

**End of TASKS.md**
