# SPEC.md - Feature Payment Checkout (Tạo yêu cầu thanh toán VNPAY)

# Phiên bản: 1.0.0 | Người phụ trách: CuongLH | Trạng thái: REVIEW_READY

# Độ sâu Spec: Formal Spec / Mức 3

Lý do chọn Mức 3: Checkout liên quan trực tiếp đến tiền và bảo mật. Nếu implement sai có thể dẫn đến sai số tiền thanh toán, tạo thanh toán trùng, mở khóa khóa học sai, hoặc tạo dữ liệu payment không thể đối soát.

## Quyết Định Đã Chốt Trong Spec

- URL thanh toán VNPAY hết hạn sau 15 phút tính từ thời điểm tạo payment attempt.
- MVP không hỗ trợ coupon/voucher. Số tiền thanh toán luôn là giá gốc của khóa học lấy qua Course Module contract.
- Backend chỉ cho phép 1 payment attempt `PENDING` còn hiệu lực cho cùng một cặp `userId + courseId` tại một thời điểm.
- Nếu learner checkout lại khi đã có payment `PENDING` chưa hết hạn, hệ thống trả lại payment URL của attempt hiện tại, không tạo bản ghi mới.
- Payment checkout chỉ tạo/trả về payment `PENDING`. Việc verify VNPAY, cập nhật `SUCCESS/FAILED`, tạo `enrollment`, gửi email enrollment success thuộc feature webhook/enrollment riêng.

## 1. Context & Goal (Bối Cảnh & Mục Tiêu)

Học viên muốn mua một khóa học trả phí trên OCP thông qua cổng thanh toán VNPAY. Frontend chỉ được gửi `courseId`; mọi thông tin quan trọng như giá tiền, payment reference, trạng thái payment và VNPAY signed URL phải do backend `ocp-api` quyết định.

Mục tiêu của feature này là:

- Xác thực learner bằng JWT được lưu trong httpOnly Cookie theo chuẩn auth của dự án.
- Kiểm tra khóa học tồn tại, đang active và là Paid Course.
- Kiểm tra learner chưa có `enrollment` hợp lệ cho khóa học.
- Tạo hoặc tái sử dụng một payment attempt `PENDING` an toàn.
- Sinh VNPAY payment URL đã ký bằng HMAC-SHA512 tại backend.
- Đảm bảo không tạo duplicate active pending payment.
- Đảm bảo checkout không unlock khóa học.

Chỉ số thành công:

- 100% request hợp lệ trả về VNPAY URL đã ký.
- 0 trường hợp amount lấy từ frontend.
- 0 trường hợp có hơn 1 active `PENDING` cho cùng `userId + courseId`.

## 2. Actors & Roles (Tác Nhân & Vai Trò)

| Tác nhân | Mô tả | Quyền trong feature này |
| --- | --- | --- |
| Learner | User đã đăng nhập bằng JWT hợp lệ trong httpOnly Cookie | Tạo request thanh toán cho Paid Course mình chưa enroll |
| Frontend | UI client của OCP | Gửi `courseId`, nhận `vnpayPaymentUrl`, redirect learner sang VNPAY; không tự gắn `Authorization` header |
| Backend `ocp-api` | Nguồn quyết định nghiệp vụ checkout | Validate request, lấy giá từ DB, tạo payment, sinh URL VNPAY |
| Course Module | Module do Member 2 phụ trách | Cung cấp course info/status/price theo `courseId` |
| Enrollment Module | Module do Member 3 phụ trách | Cung cấp check learner đã enroll hay chưa |
| VNPAY | Cổng thanh toán bên thứ ba | Nhận payment URL đã ký và xử lý thanh toán |

Tác nhân không có quyền trong feature này:

- Guest: không được tạo payment.
- Admin/Mentor: không dùng flow checkout learner nếu role không phải Learner.
- Frontend: không được gửi hoặc quyết định `amount`, `price`, `status`, `paymentRef`, `userId`.
- Frontend: không được tự gắn `Authorization: Bearer <token>`; browser chỉ gửi auth cookie theo cấu hình credentials của client.

## 3. Formal State Model (Mô Hình Trạng Thái Chính Thức)

### 3.1 State Diagram (ASCII)

State diagram này là source of truth trực quan cho vòng đời payment attempt trong feature checkout.

```text
SƠ ĐỒ TRẠNG THÁI BẮT BUỘC:


  [none] ──(initiate checkout)──► [pending_payment]
                                      │
                                      ├─(duplicate before expires_at)
                                      │     reuse checkout_url, không tạo row mới
                                      │
                                      ├─(expires_at passed + retry)──► [expired]
                                      │                                  │
                                      │                                  └─(new checkout)──► [pending_payment]
                                      │                                                       payment_ref mới
                                      │
                                      └─X─► [success/failed/enrollment_created]
                                             không thuộc checkout


LEGEND:
  ---> transition hợp lệ trong feature checkout
  -X-> transition bị cấm trong feature checkout
  ...> transition thuộc feature khác, không thuộc checkout


                         duplicate checkout trước expires_at
                       +-------------------------------------+
                       |                                     |
                       v                                     |
[none] ---> request checkout hợp lệ ---> [pending_payment] --+
                                            |
                                            | expires_at đã qua
                                            | và learner checkout lại
                                            v
                                        [expired]
                                            |
                                            | request checkout hợp lệ mới
                                            v
                                      [pending_payment]
                                      (payment_ref mới)


OUT OF SCOPE:
  [pending_payment] ...> [success]
  [pending_payment] ...> [failed]
  [success]         ...> [enrollment_created]


INVALID IN CHECKOUT:
  [pending_payment] -X-> [success]
  [pending_payment] -X-> [failed]
  [pending_payment] -X-> [enrollment_created]
  [pending_payment] -X-> [amount_changed]
  [pending_payment] -X-> [course_changed]
  [pending_payment] -X-> [user_changed]
  [pending_payment] -X-> [payment_ref_changed]
```

### 3.2 Valid Transitions (Chuyển Trạng Thái Hợp Lệ)

THE system SHALL chỉ implement các transition sau trong checkout:

1. `none -> pending_payment`: Khi learner gửi request hợp lệ và chưa có active pending payment cho `userId + courseId`.
2. `pending_payment -> pending_payment`: Khi learner gửi duplicate checkout trước `expires_at`; hệ thống trả lại attempt hiện tại, không tạo payment mới.
3. `pending_payment -> expired`: Khi active pending payment đã quá `expires_at` và learner bắt đầu checkout lại; hệ thống cập nhật attempt cũ thành `EXPIRED` trong transaction.
4. `expired -> pending_payment`: Sau khi expire attempt cũ, hệ thống tạo attempt mới với `paymentRef` mới.

### 3.3 Invalid Transitions (Chuyển Trạng Thái Bị Cấm)

THE system SHALL NOT implement các transition sau trong feature checkout:

- `pending_payment -> success`
- `pending_payment -> failed`
- `pending_payment -> enrollment_created`
- `pending_payment -> amount_changed`
- `pending_payment -> course_changed`
- `pending_payment -> user_changed`
- `pending_payment -> payment_ref_changed`
- `pending_payment -> pending_payment` bằng cách tạo row mới khi attempt cũ chưa hết hạn

`SUCCESS` và `FAILED` chỉ được cập nhật bởi feature `feature-payment-webhook` sau khi verify chữ ký/hash VNPAY và đối soát amount/paymentRef.

### 3.4 Invariants (Bất Biến)

THE system SHALL đảm bảo các bất biến sau:

1. `amount` của payment attempt được snapshot từ course price tại thời điểm tạo và SHALL NOT thay đổi sau khi payment được tạo.
2. `paymentRef`/`vnp_TxnRef` là duy nhất toàn hệ thống và SHALL NOT thay đổi sau khi tạo.
3. Tại mọi thời điểm chỉ có tối đa 1 active payment attempt với `status = PENDING` và `expires_at > now()` cho cùng `user_id + course_id`.
4. Frontend SHALL NOT quyết định amount, status, paymentRef, userId hoặc course access.
5. Pending payment SHALL NOT cấp quyền học. Course access chỉ dựa vào `enrollment` hợp lệ.
6. VNPAY URL SHALL được ký tại backend bằng HMAC-SHA512 với VNPAY Secret Key.
7. VNPAY Secret Key SHALL NOT xuất hiện trong response, client bundle, log, database metadata, hoặc error message.
8. Mỗi transition tạo/reuse/expire payment attempt SHALL có structured operational log tối thiểu: `event_type`, `payment_id`, `user_id`, `course_id`, `timestamp`.
9. Trong MVP, audit DB event SHOULD được tạo nếu bảng `payment_events`/`audit_logs` đã sẵn sàng, nhưng lỗi ghi audit DB event SHALL NOT làm rollback payment đã tạo hợp lệ.
10. Checkout SHALL NOT tạo `enrollment`; việc tạo enrollment chỉ thuộc feature webhook/enrollment sau khi payment thành công đã được verify.

## 4. Functional Requirements (Yêu Cầu Chức Năng - EARS)

### 4.1 Ubiquitous Requirements (Luôn Áp Dụng)

THE system SHALL expose endpoint `POST /payments/create` cho checkout Paid Course.

THE system SHALL require JWT hợp lệ được trích xuất từ httpOnly Cookie cho mọi request `POST /payments/create`.

THE system SHALL sử dụng auth middleware hiện có của dự án để đọc token từ `req.cookies` và verify JWT.

THE system SHALL NOT dùng `Authorization: Bearer <token>` trong request headers làm nguồn xác thực.

THE system SHALL lấy `userId` từ JWT trong httpOnly Cookie đã verify, không lấy `userId` từ request body.

THE system SHALL validate request body bằng Zod strict schema:

```ts
{
  courseId: string().uuid()
}
```

THE system SHALL reject unknown fields trong body, bao gồm nhưng không giới hạn: `price`, `amount`, `currency`, `status`, `paymentRef`, `userId`, `returnUrl`.

THE system SHALL lấy course info/price thông qua public contract của Course Module, ví dụ `courseService.getCourseById(courseId)` hoặc hàm tương đương do Member 2 cung cấp.

THE system SHALL NOT query trực tiếp bảng `courses` hoặc gọi trực tiếp Prisma/course repository từ payment checkout service.

THE system SHALL coi Course Module là source of truth cho `price`, `status`, `isPaid`, `deletedAt`.

THE system SHALL lưu payment amount bằng đơn vị tiền tệ business (`Decimal` VND). Khi build VNPAY param `vnp_Amount`, THE system SHALL gửi `amount * 100` theo quy ước VNPAY.

THE system SHALL generate `paymentRef` tại backend theo format duy nhất, ví dụ `PAY-{yyyyMMddHHmmss}-{random}` hoặc UUID-safe reference.

THE system SHALL set `expires_at = created_at + 15 minutes` cho mỗi payment attempt mới.

THE system SHALL dùng timezone UTC cho dữ liệu lưu DB và format theo cấu hình VNPAY khi build `vnp_CreateDate`/`vnp_ExpireDate`.

### 4.2 Event-Driven Requirements (Kích Hoạt Theo Sự Kiện)

WHEN Learner gửi `POST /payments/create` với JWT hợp lệ trong httpOnly Cookie và `courseId` hợp lệ, THE system SHALL thực hiện theo thứ tự:

1. Verify JWT từ httpOnly Cookie bằng auth middleware hiện có và xác định `userId`, `role`.
2. Validate body bằng Zod strict schema.
3. Kiểm tra role được phép checkout là `LEARNER`.
4. Lấy course theo `courseId` qua Course Module contract, không query trực tiếp database bảng `courses`.
5. Kiểm tra course tồn tại, chưa bị soft delete, `status = ACTIVE`.
6. Kiểm tra course là Paid Course và `price > 0`.
7. Kiểm tra learner chưa có `enrollment` hợp lệ với `courseId`.
8. Mở database transaction.
9. Lock/query payment attempts của `userId + courseId` để tránh race condition.
10. Nếu tồn tại active `PENDING` và `expires_at > now()`, THE system SHALL trả lại payment URL của attempt đó và không tạo row mới.
11. Nếu tồn tại `PENDING` đã hết hạn, THE system SHALL cập nhật attempt đó thành `EXPIRED`.
12. Tạo payment attempt mới với `status = PENDING`, `amount = course.price`, `currency = VND`, `provider = VNPAY`, `paymentRef` duy nhất, `expires_at`.
13. Build VNPAY params từ payment attempt vừa tạo.
14. Ký params bằng HMAC-SHA512 với VNPAY Secret Key.
15. Lưu `checkout_url` đã ký vào payment attempt để duplicate checkout có thể trả lại đúng URL hiện tại mà không rebuild.
16. Commit transaction.
17. Trả về HTTP 200 với payment payload và `vnpayPaymentUrl`.

WHEN duplicate checkout request xảy ra trong lúc request đầu tiên đang xử lý, THE system SHALL đảm bảo chỉ một active `PENDING` được tạo bằng database transaction và unique constraint/application lock.

WHEN duplicate checkout request xảy ra sau khi đã có active `PENDING` chưa hết hạn, THE system SHALL trả về HTTP 200 với existing `paymentId`, `paymentRef`, `expiresAt`, `vnpayPaymentUrl`, và `reused = true`.

WHEN active `PENDING` đã hết hạn và learner checkout lại, THE system SHALL đánh dấu attempt cũ là `EXPIRED`, tạo attempt mới với `paymentRef` mới, và trả về `reused = false`.

### 4.3 State-Driven Requirements (Theo Trạng Thái)

State rules SHALL NOT được lặp lại ở mục này để tránh mâu thuẫn. Source of truth duy nhất cho state behavior là mục `3.1 State Diagram`, `3.2 Valid Transitions`, `3.3 Invalid Transitions`, và `3.4 Invariants`.

### 4.4 Optional Feature Requirements (Tính Năng Tùy Chọn)

WHERE VNPAY sandbox mode IS ENABLED, THE system SHALL dùng sandbox `vnp_Url`, sandbox `vnp_TmnCode`, sandbox `vnp_HashSecret`, và sandbox return/callback config.

WHERE VNPAY production mode IS ENABLED, THE system SHALL dùng production config từ environment/server secret store và SHALL NOT fallback sang sandbox secret.

WHERE coupon/voucher feature IS ENABLED trong phase tương lai, THE system SHALL có spec riêng cho pricing calculation. Trong MVP này coupon/voucher IS NOT ENABLED.

### 4.5 Unwanted Requirements (Lỗi & Tình Huống Không Mong Muốn)

WHERE request không có auth cookie chứa JWT, THE system SHALL trả về HTTP 401 với code `AUTH_REQUIRED` và SHALL NOT tạo payment.

WHERE JWT trong httpOnly Cookie hết hạn hoặc không hợp lệ, THE system SHALL trả về HTTP 401 với code `AUTH_INVALID` và SHALL NOT tạo payment.

WHERE JWT trong httpOnly Cookie hợp lệ nhưng role không phải `LEARNER`, THE system SHALL trả về HTTP 403 với code `ROLE_NOT_ALLOWED` và SHALL NOT tạo payment.

WHERE request chỉ có `Authorization: Bearer <token>` nhưng không có auth cookie hợp lệ, THE system SHALL trả về HTTP 401 với code `AUTH_REQUIRED` và SHALL NOT tạo payment.

WHERE request body không đúng schema hoặc có unknown fields, THE system SHALL trả về HTTP 400 với code `VALIDATION_ERROR` và SHALL NOT tạo payment.

WHERE `courseId` không tồn tại, course bị soft delete, hoặc course không public/active, THE system SHALL trả về HTTP 404 với code `COURSE_NOT_FOUND` và SHALL NOT tạo payment.

THE system SHALL intentionally return `COURSE_NOT_FOUND` cho course inactive/deleted để tránh tiết lộ sự tồn tại của course không còn khả dụng.

WHERE course là Free Course hoặc `price <= 0`, THE system SHALL trả về HTTP 400 với code `FREE_COURSE_NOT_ALLOWED` và SHALL NOT tạo payment.

WHERE Learner đã có `enrollment` hợp lệ cho course, THE system SHALL trả về HTTP 409 với code `ALREADY_ENROLLED` và SHALL NOT tạo payment.

WHERE Course Module không cung cấp được course info/price, THE system SHALL trả về HTTP 503 với code `COURSE_SERVICE_UNAVAILABLE` và SHALL NOT tạo payment.

WHERE VNPAY config thiếu `vnp_TmnCode`, `vnp_HashSecret`, `vnp_Url`, hoặc `vnp_ReturnUrl`, THE system SHALL trả về HTTP 500 với code `PAYMENT_CONFIG_ERROR`, log internal error, và SHALL NOT tạo payment.

WHERE build/sign VNPAY URL thất bại sau khi đã tạo payment object trong transaction, THE system SHALL rollback transaction để không để lại payment `PENDING` rác.

WHERE database unique constraint bị conflict do race condition, THE system SHALL query lại payment attempt theo `userId + courseId`.

WHERE conflict xảy ra và payment attempt tìm lại có `status = PENDING` và `expires_at > now()`, THE system SHALL trả về existing payment URL với `reused = true`.

WHERE conflict xảy ra nhưng payment attempt tìm lại đã hết hạn (`expires_at <= now()`), THE system SHALL retry flow trong transaction mới: mark attempt cũ là `EXPIRED`, tạo payment attempt mới với `paymentRef` mới, và trả về `reused = false`.

WHERE conflict xảy ra nhưng không tìm lại được payment attempt hợp lệ để reuse hoặc expire, THE system SHALL trả về HTTP 500 với code `PAYMENT_CREATE_CONFLICT_UNRESOLVED` và ghi structured log.

WHERE audit DB event thất bại trong MVP, THE system SHALL ghi structured operational log fallback với code `PAYMENT_AUDIT_LOG_FAILED` và SHALL NOT rollback payment nếu payment transaction chính hợp lệ.

## 5. Non-Functional Requirements (Yêu Cầu Phi Chức Năng)

### 5.1 Security (Bảo Mật)

- THE system SHALL sign VNPAY params bằng HMAC-SHA512 ở backend.
- THE system SHALL sort VNPAY params theo đúng quy định VNPAY trước khi hash.
- THE system SHALL NOT log VNPAY Hash Secret, raw signing data kèm secret, hoặc bearer token.
- THE system SHALL NOT đọc hoặc chấp nhận bearer token trong `Authorization` header làm nguồn xác thực checkout.
- THE system SHALL NOT log giá trị JWT trong cookie hoặc toàn bộ `Cookie` header.
- THE system SHALL dùng HTTPS URL cho return/callback trong production.
- THE system SHALL reject client-supplied `amount`, `price`, `paymentRef`, `status`, `userId`.
- THE system SHALL đảm bảo `paymentRef` khó đoán để tránh enumeration.
- THE system SHALL NOT unlock paid content dựa trên query params từ VNPAY return URL khi chưa qua webhook/verification flow.

### 5.2 Performance (Hiệu Năng)

- API `POST /payments/create` SHALL phản hồi dưới 500ms P95 trong điều kiện Payment DB và Course Module bình thường.
- Checkout SHALL NOT gọi network API của VNPAY; feature này chỉ build signed redirect URL.
- Transaction tạo/reuse payment SHOULD hoàn tất dưới 2 giây. Nếu vượt timeout, hệ thống trả về 503/500 theo nguyên nhân lỗi và rollback.

### 5.3 Reliability & Idempotency (Độ Tin Cậy & Chống Xử Lý Trùng)

- Duplicate click/request trong vòng 15 phút SHALL reuse active pending payment.
- Concurrent requests cho cùng `userId + courseId` SHALL NOT tạo hơn một active pending attempt.
- Payment creation và `checkout_url` SHALL atomic trong một transaction.
- Audit DB event SHOULD được ghi trong cùng transaction nếu bảng audit đã sẵn sàng. Trong MVP, lỗi audit DB event SHALL NOT chặn checkout.
- `paymentRef` SHALL có unique constraint trong database.

### 5.4 Observability (Log & Theo Dõi)

THE system SHALL ghi structured log cho các event:

- `payment.checkout.created`
- `payment.checkout.reused`
- `payment.checkout.expired`
- `payment.checkout.rejected`
- `payment.checkout.failed`

Log metadata được phép gồm: `paymentId`, `paymentRef`, `userId`, `courseId`, `status`, `errorCode`, `requestId`. Log SHALL NOT gồm VNPAY secret hoặc JWT.

## 6. API Contract (Hợp Đồng API)

### 6.1 Create Payment (Tạo Payment)

Endpoint:

`POST /payments/create`

Headers:

```http
Content-Type: application/json
Cookie: <httpOnly auth cookie chứa JWT, browser tự gửi khi FE bật withCredentials>
```

Frontend SHALL gọi API qua Axios/client cấu hình `withCredentials: true` để browser tự gửi httpOnly Cookie.

Frontend SHALL NOT tự gắn `Authorization: Bearer <token>` vào headers.

Backend SHALL NOT dùng `Authorization` header làm nguồn xác thực cho endpoint này.

Request body:

```json
{
  "courseId": "b8f4a2a4-0c53-4ddf-9c9b-7cbbd7ed8a11"
}
```

Response thành công: `200 OK`

```json
{
  "success": true,
  "message": "Payment checkout created successfully",
  "data": {
    "paymentId": "2e2cbe4d-6b5f-4c27-8f3e-44a6f1c4df10",
    "paymentRef": "PAY-20260526103000-8F3E44",
    "courseId": "b8f4a2a4-0c53-4ddf-9c9b-7cbbd7ed8a11",
    "amount": "499000",
    "currency": "VND",
    "status": "PENDING",
    "provider": "VNPAY",
    "expiresAt": "2026-05-26T03:45:00.000Z",
    "reused": false,
    "vnpayPaymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...&vnp_SecureHash=..."
  }
}
```

Format response lỗi SHALL tuân thủ mục `8.1 Error Response Format`.

### 6.2 Required VNPAY Params (Tham Số VNPAY Bắt Buộc)

THE system SHALL build VNPAY URL với tối thiểu các tham số:

- `vnp_Version`
- `vnp_Command = pay`
- `vnp_TmnCode`
- `vnp_Amount = amount * 100`
- `vnp_CurrCode = VND`
- `vnp_TxnRef = paymentRef`
- `vnp_OrderInfo`
- `vnp_OrderType`
- `vnp_ReturnUrl`
- `vnp_IpAddr`
- `vnp_CreateDate`
- `vnp_ExpireDate`
- `vnp_SecureHashType` nếu integration VNPAY hiện tại yêu cầu
- `vnp_SecureHash`

THE system SHALL dùng `paymentRef` làm order reference duy nhất gửi sang VNPAY để đối soát về sau.

## 7. Data Model (Mô Hình Dữ Liệu)

### 7.1 Bảng `payments`

| Field | Type | Bắt buộc | Quy tắc |
| --- | --- | --- | --- |
| `id` | UUID | Có | Primary key |
| `payment_ref` | String | Có | Unique, gửi sang VNPAY dưới dạng `vnp_TxnRef` |
| `user_id` | UUID | Có | Lấy từ JWT |
| `course_id` | UUID | Có | Lấy từ request `courseId` sau validation |
| `amount` | Decimal | Có | Snapshot từ course price |
| `currency` | Enum | Có | `VND` trong MVP |
| `provider` | Enum | Có | `VNPAY` |
| `status` | Enum | Có | `PENDING`, `EXPIRED`; `SUCCESS/FAILED` dành cho webhook feature |
| `checkout_url` | Text | Có | Full VNPAY URL đã ký, dùng để reuse active `PENDING` payment |
| `expires_at` | Timestamp UTC | Có | `created_at + 15 minutes` |
| `created_at` | Timestamp UTC | Có | Server time |
| `updated_at` | Timestamp UTC | Có | Server time |

Constraints/indexes bắt buộc cho MySQL + Prisma:

- Unique index trên `payment_ref`.
- Index trên `(user_id, course_id, status)`.
- MySQL không hỗ trợ partial unique index kiểu PostgreSQL cho điều kiện `WHERE status = 'PENDING'`.
- THE system SHALL enforce one active pending attempt bằng transaction lock/application lock trong service layer.
- Implementation khuyến nghị: query các payment rows của `user_id + course_id` trong transaction với row-level lock (`SELECT ... FOR UPDATE` hoặc cơ chế tương đương qua Prisma/raw SQL khi cần), expire pending cũ nếu quá hạn, rồi mới tạo/reuse payment.
- Nếu team muốn enforce ở DB-level trong phase sau, MAY dùng generated column như `active_pending_key` và unique index có điều kiện mô phỏng theo khả năng MySQL.

### 7.2 Bảng `payment_events` hoặc `audit_logs`

| Field | Type | Bắt buộc | Quy tắc |
| --- | --- | --- | --- |
| `id` | UUID | Có | Primary key |
| `payment_id` | UUID | Có | References `payments.id` |
| `event_type` | String | Có | `CREATED`, `REUSED`, `EXPIRED`, `REJECTED`, `FAILED` |
| `actor_user_id` | UUID | Không | Learner id nếu có |
| `metadata` | JSON | Không | Không chứa secret |
| `created_at` | Timestamp UTC | Có | Server time |

### 7.3 External Data Dependencies (Dữ Liệu Phụ Thuộc Từ Module Khác)

Course Module phải cung cấp:

- `id`
- `status`
- `deletedAt`
- `isPaid` hoặc paid/free marker tương đương
- `price`
- `title` hoặc safe course name cho `vnp_OrderInfo`

Enrollment Module phải cung cấp:

- `hasValidEnrollment(userId, courseId) -> boolean`

## 8. Error Handling (Xử Lý Lỗi)

Mục này chỉ định nghĩa format response lỗi và nguyên tắc chung. Source of truth cho từng điều kiện lỗi là mục `4.5 Unwanted Requirements`; không copy lại bảng điều kiện lỗi ở đây để tránh mâu thuẫn khi spec thay đổi.

### 8.1 Error Response Format

Mọi response lỗi SHALL dùng format:

```json
{
  "success": false,
  "message": "User-safe error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

`message` SHALL an toàn cho user và SHALL NOT chứa stack trace, secret, SQL, JWT, cookie value, VNPAY raw secret data, hoặc raw signing payload.

`details` MAY chứa field validation errors đã sanitize. `details` SHALL NOT chứa dữ liệu nhạy cảm.

### 8.2 Error Code Registry

Các error code hợp lệ trong feature này:

- `AUTH_REQUIRED`
- `AUTH_INVALID`
- `ROLE_NOT_ALLOWED`
- `VALIDATION_ERROR`
- `COURSE_NOT_FOUND`
- `FREE_COURSE_NOT_ALLOWED`
- `ALREADY_ENROLLED`
- `COURSE_SERVICE_UNAVAILABLE`
- `PAYMENT_CONFIG_ERROR`
- `PAYMENT_URL_GENERATION_FAILED`
- `PAYMENT_CREATE_FAILED`
- `PAYMENT_CREATE_CONFLICT_UNRESOLVED`

Internal-only log code:

- `PAYMENT_AUDIT_LOG_FAILED`

THE system SHALL NOT trả error code nằm ngoài registry này cho endpoint `POST /payments/create` nếu chưa cập nhật spec.

## 9. Acceptance Criteria (Tiêu Chí Nghiệm Thu)

### AC-01 Thiếu Auth Cookie Hoặc Chỉ Có Bearer Header

CHO TRƯỚC request `POST /payments/create` không có auth cookie chứa JWT  
HOẶC request chỉ có `Authorization: Bearer <token>` nhưng không có auth cookie hợp lệ  
KHI learner/client gửi request với `courseId` hợp lệ  
THÌ system SHALL trả về 401 `AUTH_REQUIRED`  
VÀ không có payment row nào được tạo.

### AC-02 JWT Hết Hạn Hoặc Không Hợp Lệ

CHO TRƯỚC request `POST /payments/create` có auth cookie chứa JWT hết hạn hoặc JWT không hợp lệ  
KHI learner/client gửi request với `courseId` hợp lệ  
THÌ system SHALL trả về 401 `AUTH_INVALID`  
VÀ không có payment row nào được tạo.

### AC-03 Body Không Hợp Lệ

CHO TRƯỚC request body thiếu `courseId` hoặc `courseId` không phải UUID  
KHI client gửi request  
THÌ system SHALL trả về 400 `VALIDATION_ERROR`  
VÀ không có payment row nào được tạo.

### AC-04 Frontend Giả Mạo Amount

CHO TRƯỚC request body có `courseId` hợp lệ và có field `amount` hoặc `price` do frontend gửi lên  
KHI client gửi request  
THÌ system SHALL trả về 400 `VALIDATION_ERROR`  
VÀ system SHALL NOT dùng amount do client gửi lên.

### AC-05 Course Không Tồn Tại

CHO TRƯỚC learner đã đăng nhập  
VÀ `courseId` không tồn tại hoặc course bị soft delete/inactive  
KHI learner tạo payment  
THÌ system SHALL trả về 404 `COURSE_NOT_FOUND`  
VÀ không có payment row nào được tạo.

### AC-06 Free Course Bị Từ Chối

CHO TRƯỚC learner đã đăng nhập  
VÀ course tồn tại nhưng là Free Course hoặc `price <= 0`  
KHI learner tạo payment  
THÌ system SHALL trả về 400 `FREE_COURSE_NOT_ALLOWED`  
VÀ không có payment row nào được tạo.

### AC-07 Learner Đã Enroll

CHO TRƯỚC learner đã có enrollment hợp lệ cho paid course  
KHI learner tạo payment cho course đó  
THÌ system SHALL trả về 409 `ALREADY_ENROLLED`  
VÀ không có payment row mới nào được tạo.

### AC-08 Checkout Hợp Lệ Tạo Payment Mới

CHO TRƯỚC learner đã đăng nhập  
VÀ course tồn tại, active, paid, price = 499000 VND  
VÀ learner chưa enroll  
VÀ không có active pending payment cho `userId + courseId`  
KHI learner tạo payment  
THÌ system SHALL tạo đúng một payment row với `status = PENDING`  
VÀ `amount = 499000` lấy qua Course Module contract  
VÀ `currency = VND`  
VÀ có `paymentRef` duy nhất  
VÀ `expires_at = created_at + 15 minutes`  
VÀ response SHALL gồm `success = true`, `message`, `data.paymentId`, `data.paymentRef`, `data.vnpayPaymentUrl`.

### AC-09 Amount Và Chữ Ký VNPAY Đúng

CHO TRƯỚC checkout hợp lệ với DB price = 499000 VND  
KHI system build VNPAY URL  
THÌ `vnp_Amount` SHALL bằng `49900000`  
VÀ `vnp_TxnRef` SHALL bằng stored `payment_ref`  
VÀ `vnp_SecureHash` SHALL được backend tạo bằng HMAC-SHA512 trên danh sách params đã sort.

### AC-10 Checkout Trùng Trước Khi Hết Hạn

CHO TRƯỚC learner đã có active `PENDING` payment cho cùng course  
VÀ `expires_at > now()`  
KHI learner gửi lại `POST /payments/create`  
THÌ system SHALL trả về HTTP 200 với `paymentId` và `paymentRef` hiện tại  
VÀ `reused = true`  
VÀ không có payment row mới nào được tạo.

### AC-11 Checkout Lại Sau Khi Pending Hết Hạn

CHO TRƯỚC learner có payment `PENDING` cho cùng course  
VÀ `expires_at <= now()`  
KHI learner gửi lại `POST /payments/create`  
THÌ system SHALL đánh dấu payment cũ là `EXPIRED`  
VÀ tạo payment `PENDING` mới với `paymentRef` mới  
VÀ trả về `reused = false`.

### AC-12 Request Đồng Thời

CHO TRƯỚC hai request checkout giống nhau cho cùng `userId + courseId` đến gần như cùng lúc  
KHI system xử lý đồng thời  
THÌ tại mọi thời điểm chỉ tồn tại tối đa một active `PENDING` payment  
VÀ request thứ hai SHALL trả về active payment hiện tại hoặc retry/query sau unique conflict.

### AC-13 Lỗi Sinh VNPAY URL

CHO TRƯỚC request hợp lệ về mặt nghiệp vụ  
VÀ thao tác build/sign VNPAY URL thất bại  
KHI system xử lý lỗi  
THÌ system SHALL rollback transaction  
VÀ không còn payment `PENDING` rác  
VÀ response SHALL là 500 `PAYMENT_URL_GENERATION_FAILED`.

### AC-14 Pending Không Unlock Course

CHO TRƯỚC learner có payment `PENDING` cho paid course  
KHI Course Access Contract `canAccessCourse(userId, courseId)` được kiểm tra  
THÌ kết quả SHALL là `false` trừ khi đã có enrollment từ một payment thành công đã verify.

### AC-15 Log Không Lộ Secret

CHO TRƯỚC bất kỳ checkout thành công hoặc thất bại  
KHI system ghi log  
THÌ log SHALL NOT chứa VNPAY Hash Secret, JWT, hoặc raw sensitive signing secret.

## 10. Out of Scope (Ngoài Phạm Vi)

Feature checkout SHALL NOT implement:

- Xử lý VNPAY return URL.
- Verify VNPAY IPN/callback.
- Cập nhật payment sang `SUCCESS` hoặc `FAILED`.
- Tạo `enrollment`.
- Gửi enrollment success email.
- Payment history page/API.
- Refund, cancellation sau payment, chargeback, reconciliation report.
- Coupon/voucher/discount pricing.
- Free course enrollment flow.
- Admin revenue report.
- Course access UI ngoài việc trả checkout URL.

Các hạng mục trên thuộc spec riêng: `feature-payment-webhook`, `feature-enrollment`, `feature-payment-history`, `feature-free-enrollment`, và reporting/admin specs.

## 11. Definition of Done (Định Nghĩa Hoàn Thành)

Feature chỉ được coi là hoàn thành khi:

- Tất cả Acceptance Criteria từ AC-01 đến AC-15 đều pass.
- Có ít nhất 1 automated test cho mỗi Acceptance Criteria.
- Auth test SHALL chứng minh backend lấy JWT từ httpOnly Cookie/`req.cookies`, không lấy từ `Authorization` header.
- Frontend API client SHALL bật `withCredentials: true` khi gọi checkout.
- Request validation dùng Zod strict schema và reject unknown fields.
- Mọi rejected request SHALL NOT tạo payment row.
- Checkout hợp lệ SHALL lưu `checkout_url` đã ký để reuse active `PENDING`.
- Concurrent checkout test chứng minh tối đa 1 active `PENDING` cho cùng `userId + courseId`.
- `paymentRef` có unique constraint trong MySQL/Prisma schema.
- Logic chống duplicate active pending được enforce bằng transaction lock/application lock phù hợp MySQL.
- Không có `enrollment` nào được tạo bởi checkout.
- Pending payment không unlock paid course.
- Response thành công tuân thủ format `{ success, message, data }`.
- Response lỗi tuân thủ format `{ success, message, code, details }`.
- Logs không chứa VNPAY Hash Secret, JWT, stack trace, SQL raw error, hoặc secret signing data.

## 12. Test Mapping (Ánh Xạ Test)

| Acceptance Criteria | Nhóm test đề xuất |
| --- | --- |
| AC-01 | Auth guard: thiếu auth cookie và bỏ qua `Authorization: Bearer` |
| AC-02 | Auth guard: JWT trong auth cookie hết hạn/không hợp lệ |
| AC-03 | Zod validation: missing/invalid `courseId` |
| AC-04 | Zod strict validation: reject client-supplied `amount`/`price` |
| AC-05 | Course lookup: not found/inactive/deleted returns 404 |
| AC-06 | Free course guard |
| AC-07 | Already enrolled guard |
| AC-08 | Happy path create payment |
| AC-09 | VNPAY amount and signature generation |
| AC-10 | Duplicate checkout before expiry reuses payment |
| AC-11 | Expired pending creates new payment |
| AC-12 | Concurrent checkout race condition |
| AC-13 | VNPAY URL generation rollback |
| AC-14 | Course access remains locked while payment pending |
| AC-15 | Secret redaction in logs |
