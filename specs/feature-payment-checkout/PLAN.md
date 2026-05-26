# PLAN.md - Feature Payment Checkout (Tạo yêu cầu thanh toán VNPAY)

# Generated: 2026-05-26 | Status: DRAFT - Awaiting human approval

Nguồn tham chiếu chính: `SPEC.md` trong thư mục hiện tại. Kế hoạch này chỉ mô tả cách implement, chưa viết code.

## 1. ARCHITECTURAL APPROACH

Triển khai theo kiến trúc phân lớp của dự án: Route/Middleware -> Controller -> Service -> Repository/External Module Contracts. Business logic checkout nằm trong service; controller chỉ nhận request, gọi service và trả response; repository là nơi duy nhất của Payment module tương tác với Prisma/MySQL.

Các pattern sẽ dùng:

| Pattern | Cách dùng | Lý do chọn |
| --- | --- | --- |
| Service Layer | `PaymentCheckoutService` chứa toàn bộ rule từ SPEC: auth context, course check, enrollment check, pending reuse, expire, create payment, build VNPAY URL | Giữ business logic tập trung, dễ test theo Acceptance Criteria |
| Repository Pattern | `PaymentRepository` thao tác bảng `payments`; `PaymentEventRepository` thao tác audit/event nếu có | Tách data access khỏi service; phù hợp rule dự án không gọi Prisma trực tiếp trong service |
| Adapter/Port | `CourseReader` và `EnrollmentReader` là interface gọi Course Module/Enrollment Module | Tránh Payment module query trực tiếp bảng `courses` hoặc `enrollments`; giữ ranh giới module |
| Unit of Work / Transaction Script | Payment create/reuse/expire chạy trong transaction MySQL/Prisma | Đảm bảo atomic cho `payment`, `checkout_url`, trạng thái `EXPIRED/PENDING` |
| State Machine Guard | Các transition hợp lệ lấy từ SPEC §3.1-§3.4 | Chặn transition ngoài scope như `PENDING -> SUCCESS`, `PENDING -> enrollment_created` |
| Builder | `VnpayUrlBuilder` build params, sort params, ký HMAC-SHA512, trả URL | Tách logic gateway khỏi checkout service; dễ unit test chữ ký |
| Idempotency by Active Pending | Reuse `PENDING` còn hạn cho cùng `userId + courseId` | Chống double click/double request, khớp invariant tối đa 1 active pending |
| Error Mapping | Custom error -> response `{ success, message, code, details }` | Đồng bộ API contract, không leak stack trace/secret/JWT |

Quyết định kiến trúc quan trọng:

- Auth phải đi qua middleware đọc JWT từ httpOnly Cookie/`req.cookies`; không dùng `Authorization: Bearer`.
- Payment module chỉ lấy course info/price qua Course Module contract, không query bảng `courses`.
- Enrollment check đi qua Enrollment Module contract, không tự suy luận quyền học từ payment `PENDING`.
- VNPAY checkout không gọi network API; chỉ tạo signed redirect URL.
- MySQL không có partial unique index kiểu PostgreSQL, nên chống duplicate active pending bằng transaction lock/application lock trong repository/service.

## 2. COMPONENTS

| Component | Trách nhiệm | Interface input | Interface output |
| --- | --- | --- | --- |
| `payment.routes` | Khai báo `POST /payments/create`, gắn `authMiddleware`, `roleMiddleware`, validation middleware, controller | HTTP request | Chuyển request hợp lệ vào controller |
| `createPaymentSchema` | Zod strict schema cho body `{ courseId: uuid }`, reject unknown fields như `amount`, `price`, `paymentRef`, `userId` | Raw request body | Parsed `{ courseId }` hoặc `VALIDATION_ERROR` |
| `PaymentController` | Nhận `req.user` từ auth cookie middleware, parsed body, request metadata; gọi checkout service; format response | `userId`, `role`, `courseId`, `ip`, `requestId` | `{ success, message, data }` hoặc error response |
| `PaymentCheckoutService` | Orchestrate toàn bộ flow: course check, enrollment check, pending reuse/expire/create, VNPAY URL build, transaction, structured log | `CreatePaymentCommand` gồm `userId`, `role`, `courseId`, `ipAddress`, `requestId` | `PaymentCheckoutResult` gồm `paymentId`, `paymentRef`, `amount`, `status`, `expiresAt`, `reused`, `vnpayPaymentUrl` |
| `PaymentRepository` | Data access cho `payments`; query/lock theo `userId + courseId`; create payment; expire payment; persist `checkout_url` | Transaction client, payment query/create/update input | Payment row hoặc update result |
| `PaymentEventRepository` | Ghi `payment_events`/`audit_logs` nếu bảng audit đã sẵn sàng | Transaction client, event payload | Event row hoặc non-blocking failure log |
| `CourseReader` | Adapter gọi Course Module public contract, ví dụ `courseService.getCourseById(courseId)` | `courseId` | Course DTO: `id`, `status`, `deletedAt`, `isPaid`, `price`, `title` |
| `EnrollmentReader` | Adapter gọi Enrollment Module contract `hasValidEnrollment(userId, courseId)` | `userId`, `courseId` | Boolean `hasEnrollment` |
| `VnpayUrlBuilder` | Build VNPAY params, sort params, format dates, convert `amount * 100`, ký HMAC-SHA512 | Payment row, course title, request IP, VNPAY config | Full signed `vnpayPaymentUrl` |
| `PaymentRefGenerator` | Sinh `paymentRef` unique, khó đoán, dùng làm `vnp_TxnRef` | Current time, random source | String `PAY-...` hoặc UUID-safe ref |
| `PaymentConfigProvider` | Đọc và validate VNPAY config từ environment/server secret store | Runtime env | Config DTO: `vnp_TmnCode`, `vnp_HashSecret`, `vnp_Url`, `vnp_ReturnUrl`, mode |
| `PaymentError` / error mapper | Chuẩn hóa error code, HTTP status, user-safe message, sanitized details | Domain/application error | Response `{ success: false, message, code, details }` |
| `PaymentLogger` | Structured operational logs, không log JWT/cookie/VNPAY secret/raw signing secret | Event name + sanitized metadata | Log event |
| Prisma schema/migration for `payments` | Tạo/cập nhật bảng `payments`, unique `payment_ref`, index `(user_id, course_id, status)` | Prisma migration | DB schema cho payment checkout |
| Optional Prisma schema/migration for `payment_events` | Tạo bảng event/audit nếu team chốt làm trong MVP | Prisma migration | DB schema audit non-blocking |

Interface DTO đề xuất:

| DTO | Fields |
| --- | --- |
| `CreatePaymentCommand` | `userId`, `role`, `courseId`, `ipAddress`, `requestId` |
| `PaymentCheckoutResult` | `paymentId`, `paymentRef`, `courseId`, `amount`, `currency`, `status`, `provider`, `expiresAt`, `reused`, `vnpayPaymentUrl` |
| `CourseCheckoutInfo` | `id`, `status`, `deletedAt`, `isPaid`, `price`, `title` |
| `PaymentAttempt` | `id`, `paymentRef`, `userId`, `courseId`, `amount`, `currency`, `provider`, `status`, `checkoutUrl`, `expiresAt`, `createdAt`, `updatedAt` |

## 3. DATA FLOW

1. Learner bấm mua Paid Course trên frontend.
2. Frontend gửi `POST /payments/create` với body `{ courseId }`.
3. Browser tự gửi httpOnly Cookie vì frontend API client bật `withCredentials: true`.
4. Backend auth middleware đọc JWT từ `req.cookies`, verify JWT và gắn `userId`, `role` vào request context.
5. Backend bỏ qua `Authorization` header. Nếu chỉ có Bearer token mà không có auth cookie hợp lệ, request bị reject `401 AUTH_REQUIRED`.
6. Validation middleware dùng Zod strict schema để parse `courseId` và reject unknown fields như `amount`, `price`, `paymentRef`, `userId`.
7. Controller lấy `userId`, `role`, `courseId`, `ipAddress`, `requestId` và gọi `PaymentCheckoutService`.
8. Service kiểm tra role phải là `LEARNER`.
9. Service gọi `CourseReader` để lấy course info/price qua Course Module contract.
10. Service reject nếu course không tồn tại/inactive/deleted bằng `COURSE_NOT_FOUND`.
11. Service reject nếu course free hoặc `price <= 0` bằng `FREE_COURSE_NOT_ALLOWED`.
12. Service gọi `EnrollmentReader.hasValidEnrollment(userId, courseId)`.
13. Service reject nếu learner đã enroll bằng `ALREADY_ENROLLED`.
14. Service mở transaction.
15. Repository lock/query payment attempts của `userId + courseId`.
16. Nếu có active `PENDING` và `expires_at > now()`, service reuse payment hiện tại, lấy `checkout_url`, ghi log `payment.checkout.reused`, commit transaction, trả response `reused = true`.
17. Nếu có `PENDING` đã hết hạn, service update status attempt cũ thành `EXPIRED`, ghi log `payment.checkout.expired`.
18. Nếu cần tạo attempt mới, service sinh `paymentRef`, snapshot `amount = course.price`, set `currency = VND`, `provider = VNPAY`, `status = PENDING`, `expires_at = now + 15 minutes`.
19. `VnpayUrlBuilder` build params, convert `vnp_Amount = amount * 100`, set `vnp_TxnRef = paymentRef`, format `vnp_CreateDate`/`vnp_ExpireDate`, sort params, ký HMAC-SHA512.
20. Repository lưu payment row cùng `checkout_url` trong transaction.
21. Nếu build/sign URL thất bại sau khi đã bắt đầu transaction, service rollback, không để lại `PENDING` rác, trả `PAYMENT_URL_GENERATION_FAILED`.
22. Nếu conflict do race condition, service query lại attempt:

- còn hạn: return existing URL với `reused = true`;
- hết hạn: retry transaction mới, mark `EXPIRED`, tạo attempt mới;
- không resolve được: trả `PAYMENT_CREATE_CONFLICT_UNRESOLVED`.

23. Service commit transaction.
24. Controller trả response thành công:

- `success = true`
- `message`
- `data.paymentId`
- `data.paymentRef`
- `data.vnpayPaymentUrl`
- `data.reused`

25. Frontend redirect learner sang `vnpayPaymentUrl`.
26. Checkout flow kết thúc ở `PENDING`. Không verify VNPAY, không cập nhật `SUCCESS/FAILED`, không tạo `enrollment`.

## 4. DEPENDENCIES

Thứ tự implement đề xuất:

1. Xác nhận contract hiện có: auth middleware đọc `req.cookies`, response helper, Course Module function, Enrollment Module function.
2. Thiết kế/confirm Prisma schema cho `payments` và optional `payment_events`.
3. Tạo migration/index: unique `payment_ref`, index `(user_id, course_id, status)`.
4. Implement/chuẩn hóa `PaymentConfigProvider` để validate VNPAY env.
5. Implement `PaymentRefGenerator`.
6. Implement `VnpayUrlBuilder` bằng Node `crypto` hoặc library hiện có trong dự án.
7. Implement `PaymentRepository` với transaction lock/application lock phù hợp MySQL.
8. Implement `PaymentEventRepository` hoặc fallback logger theo quyết định audit MVP.
9. Implement `CourseReader` adapter qua Course Module contract.
10. Implement `EnrollmentReader` adapter qua Enrollment Module contract.
11. Implement `createPaymentSchema` và validation middleware.
12. Implement `PaymentCheckoutService`.
13. Implement `PaymentController`.
14. Wire `payment.routes` vào app/router hiện có.
15. Viết automated tests theo AC-01 đến AC-15.
16. Chạy integration/concurrency tests cho duplicate checkout và expired pending.

External dependencies:

| Dependency | Mục đích | Ghi chú |
| --- | --- | --- |
| Existing auth middleware | Verify JWT từ httpOnly Cookie/`req.cookies` | Không dùng Bearer token |
| Existing role middleware | Chặn role không phải `LEARNER` | Có thể check trong service nếu route chưa có middleware |
| Zod | Strict request validation | Reject unknown fields |
| Prisma + MySQL | Payment persistence, transaction, row lock/raw SQL khi cần | MySQL không có partial unique index |
| Node `crypto` | HMAC-SHA512 signing | Tránh thêm dependency nếu không cần |
| Course Module contract | Lấy course info/price | Không query trực tiếp bảng `courses` |
| Enrollment Module contract | Check learner đã enroll chưa | Không unlock bằng payment `PENDING` |
| VNPAY config/env | Build signed payment URL | Cần sandbox/prod config rõ |
| Logger hiện có | Structured logs, redaction | Không log JWT/cookie/secret |

## 5. RISKS & MITIGATIONS

| Rủi ro | Xác suất | Impact | Cách giảm thiểu |
| --- | --- | --- | --- |
| Race condition tạo nhiều active `PENDING` cho cùng `userId + courseId` | High | High: double payment, khó đối soát | Dùng transaction lock/application lock; query rows theo `user_id + course_id`; test concurrent requests; retry conflict theo SPEC |
| Implement sai auth bằng Bearer header thay vì httpOnly Cookie | Med | High: lệch kiến trúc bảo mật dự án | Route bắt buộc auth middleware đọc `req.cookies`; test AC-01 với Bearer-only request phải fail; DoD kiểm tra `withCredentials` |
| Ký VNPAY sai do sort params/date/amount format sai | Med | High: user không thanh toán được hoặc callback không đối soát được | Tách `VnpayUrlBuilder`; unit test deterministic cho `vnp_Amount = amount * 100`, `vnp_TxnRef`, sorted params, HMAC-SHA512 |
| Vi phạm ranh giới module bằng cách query trực tiếp bảng `courses` | Med | Med/High: coupling, sai ownership Member 2 | Chỉ dùng `CourseReader` adapter; code review rule: Payment service không import Prisma course repository; test/mock Course Module contract |
| MySQL/Prisma row lock khó implement sạch | Med | High: race condition còn tồn tại | Isolate lock logic trong `PaymentRepository`; dùng transaction + raw SQL `SELECT ... FOR UPDATE` nếu Prisma API không đủ; document fallback application lock |
| Secret/JWT bị log ra khi lỗi VNPAY hoặc auth | Low | High: security incident | Centralized logger redaction; không log raw `Cookie`, JWT, VNPAY secret, raw signing payload; test/log review AC-15 |
| `checkout_url` lưu full URL có thể chứa thông tin nhạy cảm hoặc hết hạn | Med | Med | Chỉ lưu URL đã ký cần reuse trong 15 phút; không log full URL nếu chứa secure hash; expire pending rõ ràng |
| Course price thay đổi sau khi tạo payment | Med | Med | Snapshot `amount` từ Course Module tại thời điểm tạo; invariant amount immutable; webhook sau này đối soát theo snapshot |

## 6. QUESTIONS FOR HUMAN

1. Auth cookie tên chính xác là gì, và auth middleware hiện tại expose user context vào `req.user`, `req.auth`, hay field khác?
2. Course Module contract chính thức là hàm nào: `courseService.getCourseById(courseId)` hay tên khác? Return shape có `isPaid`, `status`, `deletedAt`, `price`, `title` không?
3. Enrollment Module contract chính thức là hàm nào cho `hasValidEnrollment(userId, courseId)`? Enrollment hợp lệ dựa trên status nào?
4. Bảng hiện tại là `orders`, `payments`, hay cả hai? Feature checkout nên persist vào bảng nào để khớp schema hiện có?
5. Team có muốn tạo bảng `payment_events`/`audit_logs` trong MVP không, hay chỉ structured operational log?
6. `paymentRef` format chốt là `PAY-{yyyyMMddHHmmss}-{random}` hay UUID/ULID?
7. VNPAY config env names chính thức là gì: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`, `VNPAY_RETURN_URL`, hay tên khác?
8. `vnp_OrderType` và format `vnp_OrderInfo` trong dự án nên chốt như thế nào?
9. IP address dùng cho `vnp_IpAddr` lấy từ `req.ip`, `x-forwarded-for`, hay helper hiện có sau proxy?
10. Có cho phép Admin/Mentor mua course bằng checkout learner không, hay strict chỉ role `LEARNER` như SPEC?
11. Transaction lock trong MySQL/Prisma có được phép dùng raw SQL `SELECT ... FOR UPDATE` trong repository không?
12. Có cần rate limit endpoint `POST /payments/create` để giảm spam checkout không? SPEC chưa yêu cầu.
