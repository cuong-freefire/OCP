# PLAN.md — Payment & Order Processing

__Version:__ 1.0.0\
__Owner:__ TienTD (Member 3)\
__Based on:__ SPEC.md v1.1.0\
__Date:__ 2026-06-20

---

## 1. ARCHITECTURAL APPROACH

### 1.1 Overall Strategy

__Pattern__: Transaction Script + Repository Pattern + Event-Driven (partial)

__Rationale__:

- __Transaction Script__: Payment flow là sequential business logic phức tạp (validate → create order → call VNPAY → handle callback → create enrollment). Transaction Script pattern phù hợp hơn Domain Model vì logic không có nhiều variation.
- __Repository Pattern__: Tách biệt Prisma access khỏi business logic, dễ test và maintain. Service layer không import Prisma trực tiếp (theo CLAUDE.md).
- __Event-Driven (partial)__: Sau khi enrollment thành công, emit event để Member A send email confirmation. Không dùng full message queue trong MVP, chỉ dùng in-memory event emitter hoặc direct service call.

### 1.2 Key Design Patterns

__1. Idempotency Pattern với Database Lock__

- Sử dụng `SELECT ... FOR UPDATE` trên `payments` table khi xử lý VNPAY IPN callback.
- Lock row theo `vnpay_transaction_id` để ngăn race condition khi nhận duplicate callbacks.
- Nếu transaction đã SUCCESS, trả về idempotent response mà không re-process.

__2. Snapshot Pattern cho Price__

- Snapshot `courses.price` vào `orders.total_price` tại thời điểm tạo order.
- Validate `vnp_Amount` từ VNPAY khớp với `orders.total_price` trong IPN callback để chống price tampering.

__3. State Machine cho Payment Status__

- Payment states: `PENDING → SUCCESS | EXPIRED | FAILED`
- Order states: `pending → paid | failed | cancelled`
- Chỉ `payment.status = SUCCESS` mới trigger enrollment creation.

__4. Two-Phase Commit (Database Transaction)__

- Wrap `update payment` + `create enrollment` trong 1 database transaction.
- Nếu enrollment creation fail, rollback payment về PENDING và log error cho admin.

__5. VNPAY Signature Verification__

- Validate `vnp_SecureHash` từ IPN callback trước khi process.
- Sử dụng HMAC-SHA512 với secret key từ env variable.
- Log security event nếu signature invalid.

---

## 2. COMPONENTS

### 2.1 Routes Layer

__File__: `backend/src/routes/payment.routes.js`

__Responsibilities__: Define HTTP endpoints và attach middlewares

__Endpoints__:

- `POST /payments/create` → `authMiddleware` → `validateCreatePayment` → `PaymentController.createPayment`
- `GET /payments/:paymentId` → `authMiddleware` → `PaymentController.getPaymentStatus`
- `POST /payments/vnpay/callback` → `validateVNPaySignature` → `PaymentController.handleVNPayCallback`
- `GET /enrollments/check` → `authMiddleware` → `EnrollmentController.checkEnrollment`
- `GET /enrollments/my-courses` → `authMiddleware` → `EnrollmentController.getMyCourses`

---

### 2.2 Middleware Layer

__File 1__: `backend/src/middlewares/validateCreatePayment.middleware.js`

__Responsibility__: Validate request body cho POST /payments/create

__Input__: `req.body = { courseId }`

__Output__: `next()` or throw ValidationError

__Logic__:

- Validate `courseId` là valid UUID bằng Zod
- KHÔNG accept `amount` hoặc `userId` từ frontend (security constraint)

---

__File 2__: `backend/src/middlewares/validateVNPaySignature.middleware.js`

__Responsibility__: Verify VNPAY signature trước khi xử lý callback

__Input__: `req.query = { vnp_*, vnp_SecureHash }`

__Output__: `next()` or return HTTP 400 với error log

__Logic__:

- Extract all `vnp_*` params từ query string (trừ `vnp_SecureHash`)
- Sort params alphabetically và build signing string: `key1=value1&key2=value2`
- Compute HMAC-SHA512 với secret key từ `process.env.VNPAY_HASH_SECRET`
- So sánh computed hash với `vnp_SecureHash`
- Nếu không khớp: log security event, return HTTP 400

---

### 2.3 Controller Layer

__File__: `backend/src/controllers/payment.controller.js`

__Class__: `PaymentController`

__Methods__:

__1. createPayment(req, res, next)__

- __Input__: `req.user.id` (từ JWT), `req.body.courseId`

- __Output__: `{ success: true, data: { orderId, paymentId, checkoutUrl, expiresAt } }`

- __Logic__:

  - Gọi `PaymentService.createPaymentOrder(userId, courseId)`
  - Return checkout URL và expiration timestamp
  - Catch errors và pass to Express error handler

__2. getPaymentStatus(req, res, next)__

- __Input__: `req.params.paymentId`, `req.user.id`

- __Output__: `{ success: true, data: { paymentId, status, amount, expiresAt, orderId } }`

- __Logic__:

  - Gọi `PaymentService.getPaymentStatus(paymentId, userId)`
  - Verify payment belongs to current user
  - Return payment status cho frontend polling

__3. handleVNPayCallback(req, res, next)__

- __Input__: `req.query` (VNPAY IPN params đã validated signature)

- __Output__: `{ RspCode: "00", Message: "Confirm Success" }` (idempotent response)

- __Logic__:

  - Extract `vnp_TxnRef` (orderId), `vnp_TransactionNo`, `vnp_ResponseCode`, `vnp_Amount`
  - Gọi `PaymentService.processVNPayCallback(callbackData)`
  - Return idempotent response cho VNPAY (ngay cả khi có lỗi internal, vẫn return 200 để VNPAY stop retry)

---

__File__: `backend/src/controllers/enrollment.controller.js`

__Class__: `EnrollmentController`

__Methods__:

__1. checkEnrollment(req, res, next)__

- __Input__: `req.query.courseId`, `req.user.id`

- __Output__: `{ success: true, data: { enrolled: boolean, status: 'active'|'cancelled'|null } }`

- __Logic__:

  - Gọi `EnrollmentService.canAccessCourse(userId, courseId)`
  - Return enrollment status (contract cho Member D)

__2. getMyCourses(req, res, next)__

- __Input__: `req.user.id`

- __Output__: `{ success: true, data: { enrollments: [...] } }`

- __Logic__:

  - Gọi `EnrollmentService.getMyEnrollments(userId)`
  - Return danh sách courses user đã enroll

---

### 2.4 Service Layer

__File__: `backend/src/services/payment.service.js`

__Class__: `PaymentService`

__Dependencies__: `PaymentRepository`, `OrderRepository`, `EnrollmentRepository`, `CourseService` (Member B contract)

__Methods__:

__1. createPaymentOrder(userId, courseId)__

- __Business Logic__:

  1. Gọi `CourseService.getCoursePrice(courseId)` để get price + validate course status = 'published'
  2. Check existing PENDING order cho `(userId, courseId)` qua `OrderRepository.findPendingOrder(userId, courseId)`
  3. Nếu có PENDING order VÀ `payment.expires_at > now`: return existing checkout URL (reuse)
  4. Nếu có PENDING order VÀ `payment.expires_at <= now`: expire old payment (`PaymentRepository.expirePayment(paymentId)`)
  5. Tạo mới order: `OrderRepository.createOrder({ userId, courseId, total_price: snapshotPrice, status: 'pending' })`
  6. Tạo mới payment: `PaymentRepository.createPayment({ orderId, amount: snapshotPrice, status: 'PENDING', expires_at: now + 15min })`
  7. Generate VNPAY checkout URL với params: `vnp_TxnRef=orderId`, `vnp_Amount=amount*100`, `vnp_OrderInfo`, etc.
  8. Return `{ orderId, paymentId, checkoutUrl, expiresAt }`

__2. getPaymentStatus(paymentId, userId)__

- __Business Logic__:

  1. `PaymentRepository.findPaymentById(paymentId)`
  2. Verify payment.order.user_id === userId (authorization)
  3. Return payment details

__3. processVNPayCallback(callbackData)__

- __Business Logic__ (Database Transaction):

  1. Parse `vnp_TxnRef` → orderId, `vnp_TransactionNo` → transactionId, `vnp_ResponseCode` → responseCode, `vnp_Amount` → amount
  2. Start transaction
  3. `PaymentRepository.findPaymentByOrderIdWithLock(orderId)` → SELECT FOR UPDATE
  4. __Idempotency check__: Nếu `payment.vnpay_transaction_id === transactionId` VÀ `payment.status === 'SUCCESS'`: return early (idempotent)
  5. __Expiration check__: Nếu `payment.status === 'EXPIRED'`: log warning, tạo manual refund ticket, return (không tạo enrollment)
  6. __Amount validation__: Nếu `amount / 100 !== payment.amount`: log error, reject IPN
  7. __Response code check__: Nếu `responseCode !== '00'`: update payment.status = 'FAILED', commit transaction, return
  8. __Course re-validation__: Gọi `CourseService.getCourseStatus(courseId)`. Nếu course.status === 'archived' | 'rejected': log error, tạo manual refund ticket, return
  9. Update payment: `PaymentRepository.updatePayment(paymentId, { status: 'SUCCESS', vnpay_transaction_id: transactionId, paid_at: now })`
  10. Update order: `OrderRepository.updateOrderStatus(orderId, 'paid')`
  11. __Check duplicate enrollment__: `EnrollmentRepository.findEnrollment(userId, courseId)`. Nếu exist với status='active': skip enrollment creation (idempotent)
  12. Tạo enrollment: `EnrollmentRepository.createEnrollment({ userId, courseId, status: 'active' })`
  13. Commit transaction
  14. __Post-transaction__: Emit event hoặc gọi `EmailService.sendEnrollmentConfirmation(userId, courseId)` (async, không block response)

- __Error Handling__:
  - Nếu `createEnrollment` fail (constraint violation): rollback transaction, log error với orderId, payment quay về PENDING

---

__File__: `backend/src/services/enrollment.service.js`

__Class__: `EnrollmentService`

__Dependencies__: `EnrollmentRepository`

__Methods__:

__1. canAccessCourse(userId, courseId)__

- __Business Logic__:

  1. `EnrollmentRepository.findEnrollment(userId, courseId)`
  2. Return `{ enrolled: !!enrollment, status: enrollment?.status || null }`
  3. Member D sẽ check `status === 'active'` trước khi serve lesson content

__2. getMyEnrollments(userId)__

- __Business Logic__:

  1. `EnrollmentRepository.findEnrollmentsByUserId(userId)`
  2. Return array of enrollments với course details

---

### 2.5 Repository Layer

__File__: `backend/src/repositories/order.repository.js`

__Class__: `OrderRepository`

__Dependencies__: `PrismaClient`

__Methods__:

__1. createOrder({ userId, courseId, total_price, status })__

- __Prisma Query__: `prisma.orders.create({ data: {...} })`
- Return created order

__2. findPendingOrder(userId, courseId)__

- __Prisma Query__: `prisma.orders.findFirst({ where: { user_id: userId, course_id: courseId, status: 'pending' }, include: { payments: true } })`
- Return order with payments relation

__3. updateOrderStatus(orderId, status)__

- __Prisma Query__: `prisma.orders.update({ where: { id: orderId }, data: { status } })`

---

__File__: `backend/src/repositories/payment.repository.js`

__Class__: `PaymentRepository`

__Methods__:

__1. createPayment({ orderId, amount, status, expires_at })__

- __Prisma Query__: `prisma.payments.create({ data: {...} })`

__2. findPaymentById(paymentId)__

- __Prisma Query__: `prisma.payments.findUnique({ where: { id: paymentId }, include: { order: true } })`

__3. findPaymentByOrderIdWithLock(orderId)__

- __Prisma Query__: `prisma.$queryRaw`SELECT * FROM payments WHERE order_id = ${orderId} FOR UPDATE``
- Return payment row với exclusive lock

__4. updatePayment(paymentId, data)__

- __Prisma Query__: `prisma.payments.update({ where: { id: paymentId }, data })`

__5. expirePayment(paymentId)__

- __Prisma Query__: `prisma.payments.update({ where: { id: paymentId }, data: { status: 'EXPIRED' } })`

---

__File__: `backend/src/repositories/enrollment.repository.js`

__Class__: `EnrollmentRepository`

__Methods__:

__1. createEnrollment({ userId, courseId, status })__

- __Prisma Query__: `prisma.enrollments.create({ data: { user_id: userId, course_id: courseId, status } })`
- UNIQUE constraint `(user_id, course_id)` sẽ throw error nếu duplicate

__2. findEnrollment(userId, courseId)__

- __Prisma Query__: `prisma.enrollments.findUnique({ where: { user_id_course_id: { user_id: userId, course_id: courseId } } })`

__3. findEnrollmentsByUserId(userId)__

- __Prisma Query__: `prisma.enrollments.findMany({ where: { user_id: userId }, include: { course: true } })`

---

### 2.6 Utility/Helper Layer

__File__: `backend/src/utils/vnpay.helper.js`

__Functions__:

__1. generateVNPayCheckoutUrl({ orderId, amount, orderInfo, ipAddr })__

- Build VNPAY params object với `vnp_TmnCode`, `vnp_TxnRef`, `vnp_Amount`, `vnp_CreateDate`, etc.
- Sort params alphabetically
- Generate `vnp_SecureHash` với HMAC-SHA512
- Return full checkout URL: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_*...`

__2. verifyVNPaySignature(params, receivedHash)__

- Sort params (exclude `vnp_SecureHash`)
- Compute expected hash
- Return boolean (match or not)

---

## 3. DATA FLOW

### 3.1 Payment Creation Flow (POST /payments/create)

```javascript
User (Frontend)
  │
  │ POST /payments/create { courseId }
  ▼
authMiddleware (verify JWT, extract userId)
  │
  ▼
validateCreatePayment (validate courseId, reject amount/userId từ body)
  │
  ▼
PaymentController.createPayment
  │
  │ call PaymentService.createPaymentOrder(userId, courseId)
  ▼
PaymentService
  │
  │ 1. Get course price từ Member B (CourseService)
  │ 2. Check existing PENDING order
  │ 3. Reuse URL (nếu chưa hết hạn) hoặc expire old payment
  │ 4. Create new order (snapshot price)
  │ 5. Create new payment (PENDING, expires_at = now + 15min)
  │ 6. Generate VNPAY checkout URL
  ▼
OrderRepository + PaymentRepository (Prisma → MySQL)
  │
  ▼
Return { orderId, paymentId, checkoutUrl, expiresAt }
  │
  ▼
Frontend redirect user to VNPAY
```

---

### 3.2 VNPAY IPN Callback Flow (POST /payments/vnpay/callback)

```javascript
VNPAY Server
  │
  │ POST /payments/vnpay/callback?vnp_*=...&vnp_SecureHash=...
  ▼
validateVNPaySignature (verify HMAC-SHA512)
  │
  │ (nếu fail → return 400, log security event)
  ▼
PaymentController.handleVNPayCallback
  │
  │ call PaymentService.processVNPayCallback(callbackData)
  ▼
PaymentService
  │
  │ START TRANSACTION
  │ 1. Find payment WITH LOCK (SELECT FOR UPDATE)
  │ 2. Idempotency check (vnpay_transaction_id + status)
  │ 3. Expiration check (nếu EXPIRED → log + manual refund ticket)
  │ 4. Amount validation (vnp_Amount === payment.amount)
  │ 5. Course re-validation (check archived/rejected)
  │ 6. Update payment.status = SUCCESS, vnpay_transaction_id, paid_at
  │ 7. Update order.status = 'paid'
  │ 8. Check duplicate enrollment (nếu exist → skip)
  │ 9. Create enrollment (status = 'active')
  │ COMMIT TRANSACTION
  │
  │ (nếu enrollment creation fail → ROLLBACK, log error)
  ▼
PaymentRepository, OrderRepository, EnrollmentRepository (Prisma → MySQL)
  │
  ▼
Post-transaction: EmailService.sendEnrollmentConfirmation (async)
  │
  ▼
Return { RspCode: "00", Message: "Confirm Success" } to VNPAY
```

---

### 3.3 Check Enrollment Flow (GET /enrollments/check?courseId=...)

```javascript
User (Frontend) hoặc Member D (Internal)
  │
  │ GET /enrollments/check?courseId=xxx
  ▼
authMiddleware (verify JWT, extract userId)
  │
  ▼
EnrollmentController.checkEnrollment
  │
  │ call EnrollmentService.canAccessCourse(userId, courseId)
  ▼
EnrollmentService
  │
  │ call EnrollmentRepository.findEnrollment(userId, courseId)
  ▼
EnrollmentRepository (Prisma → MySQL)
  │
  ▼
Return { enrolled: boolean, status: 'active'|'cancelled'|null }
```

---

## 4. DEPENDENCIES

### 4.1 Implementation Order (Sequential)

__Phase 1: Foundation (Database & Utils)__

1. Prisma schema cho `orders`, `payments`, `enrollments` tables (nếu chưa có)
2. Prisma migration: `npx prisma migrate dev --name add_payment_tables`
3. `vnpay.helper.js` (signature generation & verification)

__Phase 2: Repository Layer__ 4. `OrderRepository` (createOrder, findPendingOrder, updateOrderStatus) 5. `PaymentRepository` (createPayment, findPaymentByOrderIdWithLock, updatePayment, expirePayment) 6. `EnrollmentRepository` (createEnrollment, findEnrollment, findEnrollmentsByUserId)

__Phase 3: Service Layer__ 7. `EnrollmentService` (canAccessCourse, getMyEnrollments) 8. `PaymentService` (createPaymentOrder, getPaymentStatus, processVNPayCallback)

__Phase 4: Controller & Middleware__ 9. `validateCreatePayment.middleware.js` 10. `validateVNPaySignature.middleware.js` 11. `PaymentController` (createPayment, getPaymentStatus, handleVNPayCallback) 12. `EnrollmentController` (checkEnrollment, getMyCourses)

__Phase 5: Routes & Integration__ 13. `payment.routes.js` (register all endpoints) 14. `enrollment.routes.js` (register enrollment endpoints) 15. Integration testing với mock VNPAY callback

---

### 4.2 External Dependencies

__NPM Packages__ (assume already installed):

- `express` (REST API framework)
- `@prisma/client` (ORM)
- `zod` (validation)
- `crypto` (built-in, cho HMAC-SHA512)
- `jsonwebtoken` (JWT authentication, assume already exist từ Member A)

__Environment Variables__ (cần add vào `.env`):

```env
VNPAY_TMN_CODE=your_terminal_code
VNPAY_HASH_SECRET=your_secret_key
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://yourdomain.com/payment/return
VNPAY_IPN_URL=https://yourdomain.com/api/payments/vnpay/callback
```

__Cross-Module Dependencies__:

- __Member B (Course Service)__: `CourseService.getCoursePrice(courseId)`, `CourseService.getCourseStatus(courseId)`
- __Member A (Email Service)__: `EmailService.sendEnrollmentConfirmation(userId, courseId)` (optional, async)

---

## 5. RISKS & MITIGATIONS

### Risk #1: Race Condition khi nhận duplicate IPN callbacks

__Probability__: Medium\
__Impact__: High (có thể tạo duplicate enrollment hoặc double-charge)

__Mitigation__:

- Sử dụng `SELECT ... FOR UPDATE` trên `payments` table trong transaction
- Idempotency check với `vnpay_transaction_id` + `status`
- UNIQUE constraint `(user_id, course_id)` trên `enrollments` table là safety net cuối cùng
- Test với concurrent requests để verify lock behavior

---

### Risk #2: Payment thành công nhưng enrollment creation fail

__Probability__: Low\
__Impact__: Critical (user trả tiền nhưng không có quyền học)

__Mitigation__:

- Wrap payment update + enrollment creation trong 1 database transaction
- Nếu enrollment fail: rollback payment về PENDING, log error với orderId
- Admin dashboard sẽ query payments với status=PENDING + paid_at != null để detect orphaned payments
- Manual retry mechanism: Admin có thể trigger lại enrollment creation từ dashboard (future enhancement)

---

### Risk #3: VNPAY IPN callback delay hoặc không đến

__Probability__: Low (VNPAY có retry mechanism)\
__Impact__: Medium (user không thấy enrollment ngay lập tức)

__Mitigation__:

- Frontend implement polling mechanism: sau khi redirect về từ VNPAY, poll `GET /payments/:paymentId` mỗi 3s trong 30s
- Nếu timeout: hiển thị message "Payment is being processed, please check your enrolled courses later"
- User có thể check lại trong "My Courses" page (`GET /enrollments/my-courses`)
- VNPAY sẽ retry IPN callback nhiều lần nếu không nhận được HTTP 200

---

## 6. QUESTIONS FOR HUMAN

Trước khi implement, cần xác nhận các điểm sau:

__Q1. VNPAY Configuration__

- VNPAY Terminal Code (`vnp_TmnCode`) và Hash Secret đã có chưa?
- Môi trường hiện tại dùng VNPAY Sandbox hay Production?
- IPN URL (`vnp_IPN_URL`) có cần whitelist IP không?

__Q2. Email Service Integration__

- Có sử dụng email service nào không (SendGrid, AWS SES, Nodemailer)?
- Enrollment confirmation email có template chưa?
- Email sending có cần queue (Bull, BullMQ) hay gọi trực tiếp?

__Q3. Payment Expiration Cleanup__

- Có cần implement cron job để auto-expire PENDING payments sau 15 phút không?
- Hay chỉ check lazy khi user request checkout lại?
- Nếu cần cron: sử dụng library nào (node-cron, bull-cron)?

__Q4. Manual Refund Workflow__

- Khi late IPN callback về cho expired payment, "tạo manual refund ticket" nghĩa là gì?
- Có cần tạo bảng `refund_requests` trong database không?
- Hay chỉ log vào file và admin xử lý offline?

__Q5. Course Service Contract__

- Member B có sẵn `CourseService.getCoursePrice(courseId)` và `CourseService.getCourseStatus(courseId)` chưa?
- Nếu chưa, cần tạo mới hay query trực tiếp từ `courses` table?

__Q6. Frontend Return URL__

- Sau khi thanh toán xong ở VNPAY, user redirect về URL nào?
- Có cần endpoint `GET /payments/return` để handle redirect không? (khác với IPN callback)
