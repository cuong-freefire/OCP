# TASKS.md — Payment & Order Processing Implementation Tasks

**Version:** 1.1.0  
**Owner:** TienTD (Member 3)  
**Based on:** PLAN.md v1.0.0, SPEC.md v1.1.0  
**Date:** 2026-06-21  
**Total Estimated Time:** 25 hours (~3 working days)

---

## Task Breakdown Table

| ID | Task Name | Files to Create/Edit | Est. Time | Dependencies | SPEC Refs | Done Criteria |
|---|---|---|---|---|---|---|
| **T001** | Create Prisma schema for payment tables | `prisma/schema.prisma` (edit) | 2h | None | SPEC §5 (Data Model) | Tables `orders`, `payments` defined với correct fields, constraints, indexes (enrollments table owned by feat-enrollment) |
| **T002** | Run Prisma migration | Terminal command | 0.5h | T001 | SPEC §5 | Migration file generated, DB tables created successfully |
| **T003** | Create VNPAY helper utilities | `backend/src/utils/vnpay.helper.js` (create) | 2h | None | SPEC §3 (Event-driven - IPN), §4 (Security) | Functions `generateVNPayCheckoutUrl()` và `verifyVNPaySignature()` với HMAC-SHA512, pass unit tests |
| **T004** | Create OrderRepository | `backend/src/repositories/order.repository.js` (create) | 2h | T002 | SPEC §5 (Data Model - orders) | Methods: `createOrder`, `findPendingOrder`, `updateOrderStatus` implemented với Prisma |
| **T005** | Create PaymentRepository | `backend/src/repositories/payment.repository.js` (create) | 3h | T002 | SPEC §5 (Data Model - payments), §4 (Idempotency) | Methods: `createPayment`, `findPaymentById`, `findPaymentByOrderIdWithLock`, `updatePayment`, `expirePayment` with SELECT FOR UPDATE |
| **T006** | Unit test Repository layer | `backend/tests/repositories/payment.repository.test.js`, `order.repository.test.js` (create) | 2h | T004, T005 | Repository functions | Mock Prisma, test all methods với success/failure cases, coverage ≥ 80% |
| **T007** | Create PaymentService - createPaymentOrder | `backend/src/services/payment.service.js` (create) | 3h | T004, T005, T003 | SPEC §3 (Event-driven - create), §3 (State-driven - reuse URL) | Function handles pending order check, reuse URL logic, snapshot price, generate VNPAY URL |
| **T008** | Create PaymentService - getPaymentStatus | `backend/src/services/payment.service.js` (edit) | 1h | T007 | SPEC §3 (Event-driven) | Function returns payment status với authorization check |
| **T009** | Create PaymentService - processVNPayCallback | `backend/src/services/payment.service.js` (edit) | 4h | T007, T005, feat-enrollment:T003, feat-enrollment:T006 | SPEC §3 (Event-driven - IPN), §3 (Unwanted), §4 (Idempotency, Data Integrity), §6 (Error Handling) | Transaction logic với all checks: idempotency, expiration, amount validation, course re-validation, enrollment creation (via EnrollmentService), rollback on failure |
| **T010** | Unit test Service layer | `backend/tests/services/payment.service.test.js` (create) | 3h | T007, T008, T009 | All Service functions | Mock repositories & EnrollmentService, test all service methods including edge cases (expired, duplicate, failed), coverage ≥ 80% |
| **T011** | Create validateCreatePayment middleware | `backend/src/middlewares/validateCreatePayment.middleware.js` (create) | 1.5h | None | SPEC §3 (Event-driven), §4 (Security) | Zod schema validates courseId, rejects amount/userId from body, pass validation tests |
| **T012** | Create validateVNPaySignature middleware | `backend/src/middlewares/validateVNPaySignature.middleware.js` (create) | 2h | T003 | SPEC §3 (Event-driven - IPN), §4 (Security), §6 (Error Handling) | Middleware verifies vnp_SecureHash, logs security event on failure, returns 400 for invalid signature |
| **T013** | Create PaymentController | `backend/src/controllers/payment.controller.js` (create) | 2h | T007, T008, T009 | SPEC §3 (Event-driven) | Methods: `createPayment`, `getPaymentStatus`, `handleVNPayCallback` call services and return proper responses |
| **T014** | Create EnrollmentController | `backend/src/controllers/enrollment.controller.js` (create) | 1.5h | feat-enrollment:T006 | SPEC §3 (Event-driven - enrollment check) | Methods: `checkEnrollment`, `getMyCourses` implemented (uses EnrollmentService from feat-enrollment) |
| **T015** | Unit test Controller and Middleware | `backend/tests/controllers/payment.controller.test.js`, `enrollment.controller.test.js`, `backend/tests/middlewares/*.test.js` (create) | 3h | T011, T012, T013, T014 | Controller và Middleware logic | Mock services, test request/response handling, test middleware validation logic |
| **T016** | Create payment routes | `backend/src/routes/payment.routes.js` (create) | 1h | T011, T012, T013 | SPEC §3 (Event-driven) | Routes: `POST /payments/create`, `GET /payments/:paymentId`, `POST /payments/vnpay/callback` registered với correct middlewares |
| **T017** | Create enrollment routes | `backend/src/routes/enrollment.routes.js` (create) | 1h | T014 | SPEC §3 (Event-driven - enrollment) | Routes: `GET /enrollments/check`, `GET /enrollments/my-courses` registered với authMiddleware |
| **T018** | Register routes in main app | `backend/src/app.js` or `backend/src/index.js` (edit) | 0.5h | T016, T017 | SPEC §3 | Payment và enrollment routes mounted on Express app |
| **T019** | Integration test - POST /payments/create | `backend/tests/integration/payment.api.test.js` (create) | 2h | T018 | SPEC §7 (Acceptance Criteria - Scenario 1, 2) | Test with supertest, verify order creation, VNPAY URL generation, reuse URL for pending orders |
| **T020** | Integration test - POST /payments/vnpay/callback | `backend/tests/integration/payment.api.test.js` (edit) | 3h | T018 | SPEC §7 (Acceptance Criteria - Scenario 1, 3), §6 (Error Handling) | Test success callback, idempotency, late IPN (expired), amount validation, enrollment creation, rollback scenario |
| **T021** | Integration test - GET /enrollments/check | `backend/tests/integration/enrollment.api.test.js` (create) | 1.5h | T018 | SPEC §3 (Event-driven - enrollment check) | Test enrollment status check for active/cancelled/not enrolled users |
| **T022** | Verify all SPEC acceptance criteria | All test files (review) | 1h | T019, T020, T021 | SPEC §7 (All 3 scenarios) | All acceptance criteria pass: payment success, pending order reuse, late IPN handling |
| **T023** | Add enrollment success event emission | `backend/src/services/payment.service.js` (edit) | 1h | T009 | share_context.md §3.3 (Enrollment Success Event) | After enrollment creation, emit event hoặc call EmailService với payload: userId, courseId, enrollmentId, enrolledAt, paymentAmount, status |

---

## Cross-Feature Dependencies

**This feature REUSES components from feat-enrollment (Member 3):**

| Component | Provided By | Used In Tasks |
|---|---|---|
| `EnrollmentRepository` | feat-enrollment:T003 | T009 (PaymentService callback) |
| `EnrollmentService` | feat-enrollment:T006 | T009 (PaymentService callback), T014 (EnrollmentController) |

**Implementation Note:** feat-enrollment MUST be implemented first to provide the enrollment infrastructure. Payment module will import and use these components without recreating them.

---

## Implementation Phases

### Phase 1: Foundation (Database & Utils)
**Duration:** 4.5 hours  
**Tasks:** T001, T002, T003

**Goal:** Setup database schema và VNPAY utilities

**Deliverables:**
- Prisma schema với 2 tables (orders, payments) - enrollments owned by feat-enrollment
- DB migration successful
- VNPAY helper functions with unit tests

---

### Phase 2: Repository Layer
**Duration:** 7 hours  
**Tasks:** T004, T005, T006

**Goal:** Create payment-specific data access layer với Prisma

**Deliverables:**
- OrderRepository, PaymentRepository (EnrollmentRepository reused from feat-enrollment)
- Unit tests với coverage ≥ 80%
- SELECT FOR UPDATE implemented in PaymentRepository

**Note:** EnrollmentRepository và EnrollmentService sẽ được import từ feat-enrollment module.

---

### Phase 3: Service Layer
**Duration:** 11 hours  
**Tasks:** T007, T008, T009, T010

**Goal:** Implement payment business logic

**Deliverables:**
- PaymentService với 3 methods (create, getStatus, processCallback)
- Transaction logic với idempotency, validation, rollback
- Integration với EnrollmentService từ feat-enrollment
- Unit tests với mock repositories và mock EnrollmentService

---

### Phase 4: Controller, Middleware & Routes
**Duration:** 9 hours  
**Tasks:** T011, T012, T013, T014, T015, T016, T017, T018

**Goal:** HTTP layer implementation

**Deliverables:**
- 2 middlewares: validateCreatePayment, validateVNPaySignature
- 2 controllers: PaymentController, EnrollmentController (using EnrollmentService)
- 2 route files registered in app
- Unit tests for controllers và middlewares

---

### Phase 5: Integration Testing & Event Emission
**Duration:** 7.5 hours  
**Tasks:** T019, T020, T021, T022, T023

**Goal:** End-to-end testing và event integration

**Deliverables:**
- Integration tests với supertest
- All SPEC acceptance criteria verified
- Enrollment success event emission implemented

---

## Task Dependencies Graph

```
feat-enrollment (PREREQUISITE)
  ├─> T003 (EnrollmentRepository)
  └─> T006 (EnrollmentService)
        │
        └─────────────────────┐
                              │
T001 (Prisma schema)          │
  ├─> T002 (Migration)        │
  │     ├─> T004 (OrderRepository)
  │     └─> T005 (PaymentRepository)
  │           └─> T006 (Repo tests)
  │                 └─> T007 (PaymentService - create)
  │                       ├─> T008 (PaymentService - getStatus)
  │                       └─> T009 (PaymentService - callback) ◄─┘
  │                             ├─> T010 (Service tests)
  │                             ├─> T013 (PaymentController)
  │                             └─> T023 (Event emission)
  │
T003 (VNPAY helper)
  ├─> T007 (PaymentService - uses helper)
  └─> T012 (Signature middleware)

T011 (validateCreatePayment)
T012 (Signature middleware)
T013 (PaymentController)
  └─> T016 (Payment routes)

feat-enrollment:T006 (EnrollmentService)
  └─> T014 (EnrollmentController)
        └─> T017 (Enrollment routes)

T016, T017
  └─> T018 (Register routes)
        ├─> T019 (Integration test - create)
        ├─> T020 (Integration test - callback)
        └─> T021 (Integration test - enrollment)
              └─> T022 (Verify acceptance criteria)
```

---

## SPEC Section References

| SPEC Section | Tasks Implementing |
|---|---|
| §3 - Ubiquitous (BIGINT, snapshot price) | T001, T004, T005, T007 |
| §3 - Event-driven (create payment, IPN, enrollment) | T007, T008, T009, T013, T014, T016, T017 |
| §3 - State-driven (reuse URL) | T007, T019 |
| §3 - Unwanted (signature invalid, expired, archived course) | T009, T012, T020 |
| §4 - Non-functional (Idempotency, Security, Data Integrity) | T005, T009, T011, T012 |
| §5 - Data Model | T001, T004, T005 |
| §6 - Error Handling | T009, T012, T020 |
| §7 - Acceptance Criteria | T019, T020, T021, T022 |

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
11. ✅ EnrollmentRepository và EnrollmentService được import từ feat-enrollment (KHÔNG tạo lại)

---

## Parallel Work Opportunities

Các tasks sau có thể làm song song để tăng tốc:

1. **T003 + T004/T005**: VNPAY helper và Repositories có thể làm đồng thời
2. **T011 + T007**: validateCreatePayment middleware và PaymentService - createPaymentOrder independent
3. **T012 + T014**: validateVNPaySignature và EnrollmentController có thể parallel
4. **T019 + T021**: Integration tests cho payment và enrollment có thể làm đồng thời

**Recommended Sequence for 1 developer (sau khi feat-enrollment hoàn thành):**
- T001 → T002 → T004 → T005 → T006 → T003 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023

---

## Risk Mitigation During Implementation

**During T005 (PaymentRepository)**:
- ⚠️ Verify `SELECT FOR UPDATE` syntax với Prisma `$queryRaw`
- ⚠️ Test lock behavior với concurrent requests

**During T009 (processVNPayCallback)**:
- ⚠️ Test rollback scenario khi enrollment creation fail
- ⚠️ Verify idempotency với duplicate callbacks
- ⚠️ Test late IPN với expired payment
- ⚠️ Ensure EnrollmentService từ feat-enrollment đã implemented đầy đủ

**During T019-T020 (Integration Tests)**:
- ⚠️ Seed data cleanup sau mỗi test
- ⚠️ Mock VNPAY signature validation hoặc dùng test secret key
- ⚠️ Test với real database (không mock Prisma ở integration level)

**During T023 (Event Emission)**:
- ⚠️ Verify event payload theo đúng contract trong share_context.md §3.3
- ⚠️ Handle email service failure gracefully (async, không block response)

---

## Notes

- **All tasks ≤ 4h**: Task lớn nhất là T009 (4h) cho complex callback logic
- **Sequential dependencies**: Repository → Service → Controller → Routes → Integration Tests
- **SPEC coverage**: Mọi requirement trong SPEC.md được map vào ít nhất 1 task
- **Event emission**: T023 là task cuối để integrate với Member A (Email Service)
- **Cross-feature reuse**: EnrollmentRepository và EnrollmentService được reuse từ feat-enrollment để tránh duplicate code

---

## Integration với Cross-Module Dependencies

### Contract Consumed FROM feat-enrollment:

**T009 và T014** cần inject EnrollmentService từ feat-enrollment:

```javascript
// PaymentService (T009)
const EnrollmentService = require('../../enrollment/services/enrollment.service');

class PaymentService {
  constructor(orderRepo, paymentRepo, enrollmentService) {
    this.enrollmentService = enrollmentService; // from feat-enrollment
  }
  
  async processVNPayCallback(vnpayData) {
    // ... validation logic ...
    
    // Use EnrollmentService to create enrollment
    await this.enrollmentService.handlePaymentSuccess({
      userId: order.user_id,
      courseId: order.course_id,
      paymentId: payment.id
    });
  }
}
```

---

## Next Steps After Completion

1. ✅ Verify feat-enrollment is fully implemented and tested
2. ✅ Setup VNPAY sandbox credentials trong `.env`
3. ✅ Deploy to staging environment
4. ✅ Perform manual testing với real VNPAY flow
5. ✅ Load testing: verify p95 response time và concurrent callback handling
6. ✅ Security audit: IDOR prevention, signature validation
7. ✅ Code review với team lead
8. ✅ User acceptance testing (UAT)

---

**End of TASKS.md**
