SPEC.md — Payment & Order Processing
Version: 1.1.0 (APPROVED) | Owner: TienTD (Member 3) | Status: Locked for Implementation
1. Context & Goal
Business Context: Hệ thống hiện thiếu cơ chế thanh toán, khiến Learner không thể mua quyền truy cập khóa học và nền tảng không phát sinh doanh thu.
Goal: Xây dựng luồng thanh toán tích hợp VNPAY an toàn, xử lý đơn hàng chính xác bằng tiền tệ BIGINT và tự động ghi danh (Enrollment) khi giao dịch thành công.
2. Actors & Roles
Learner: Người thực hiện thanh toán mua khóa học.
System (Member 3): Chịu trách nhiệm quản lý đơn hàng, xác thực chữ ký VNPAY và ghi danh học viên.
VNPAY Gateway: Cổng thanh toán bên thứ ba xử lý giao dịch thực tế.
3. Functional Requirements (EARS Notation)
Ubiquitous (Luôn áp dụng):
THE hệ thống SHALL sử dụng kiểu dữ liệu BIGINT cho mọi tính toán số tiền (đơn vị đồng) để triệt tiêu lỗi làm tròn.
THE hệ thống SHALL lấy giá khóa học trực tiếp từ bảng courses và thực hiện "snapshot price" vào bảng orders tại thời điểm tạo đơn.
Event-driven (Theo sự kiện):
WHEN Learner gọi POST /payments/create (#35), THE hệ thống SHALL tạo một bản ghi orders (status: 'pending') và sinh URL thanh toán VNPAY có hiệu lực trong 15 phút.
WHEN nhận IPN callback từ VNPAY (#37), THE hệ thống SHALL thực hiện xác thực chữ ký vnp_SecureHash và validate rằng vnp_Amount khớp với orders.total_price (snapshot) trước khi cập nhật payment.status = SUCCESS.
WHEN giao dịch thanh toán được xác nhận thành công, THE hệ thống SHALL tạo một bản ghi trong bảng enrollments với status = 'active' cho cặp (userId, courseId).
State-driven (Theo trạng thái):
WHILE một đơn hàng đang ở trạng thái PENDING cho cùng một cặp userId + courseId VÀ chưa hết hạn (expires_at > now), THE hệ thống SHALL trả về URL thanh toán hiện có (reuse) thay vì tạo đơn hàng mới.
WHERE đơn hàng PENDING đã hết hạn (expires_at <= now), THE hệ thống SHALL tự động chuyển trạng thái đơn cũ thành EXPIRED và cho phép tạo đơn hàng mới.
Unwanted (Trường hợp không mong muốn):
WHERE chữ ký VNPAY không hợp lệ, THE hệ thống SHALL từ chối xử lý và ghi log security event.
WHERE nhận IPN thành công (vnp_ResponseCode=00) nhưng đơn hàng đã ở trạng thái EXPIRED, THE hệ thống SHALL: Trả về HTTP 200 cho VNPAY, Log warning, KHÔNG tạo enrollment và tạo ticket yêu cầu hoàn tiền thủ công (manual refund).
WHERE trong lúc thanh toán mà khóa học bị chuyển sang trạng thái archived hoặc rejected, THE hệ thống SHALL từ chối tạo enrollment mới tại bước callback và yêu cầu hoàn tiền thủ công.
4. Non-functional Requirements
Idempotency: Hệ thống SHALL đảm bảo một giao dịch VNPAY (qua vnpay_transaction_id) chỉ được xử lý đúng một lần duy nhất bằng kỹ thuật SELECT FOR UPDATE.
Security: Tuyệt đối KHÔNG nhận số tiền (amount) hoặc userId từ frontend; userId phải lấy từ JWT cookie.
Data Integrity: Thực hiện toàn bộ logic cập nhật thanh toán và tạo enrollment trong một Database Transaction.
5. Data Model
Sở hữu bởi Member 3:

Table orders: id, user_id, course_id, total_price (BIGINT), status ('pending','paid','failed','cancelled').
Table payments: id, order_id, vnpay_transaction_id (UNIQUE), amount (BIGINT), status ('PENDING','EXPIRED','SUCCESS','FAILED'), expires_at.
Table enrollments: id, user_id, course_id, status ('active','cancelled'). Ràng buộc UNIQUE (user_id, course_id).

Payment State Transitions:
```
[created] ──► [PENDING] ──────────────────────────┐
                 │                                │
        (vnpay_url expires 15m)            (vnpay failure)
                 ▼                                ▼
            [EXPIRED]                         [FAILED]
                 │                                │
                 └───────────┬────────────────────┘
                             ▼
                        [CANCELLED]

[PENDING] ──► [SUCCESS] ──► [Enrollment: active]
```
6. Error Handling
WHERE payment thành công (SUCCESS) nhưng tạo enrollment thất bại, THE hệ thống SHALL rollback toàn bộ giao dịch (payment quay về PENDING), log error kèm order_id để Admin xử lý thủ công.
WHERE nhận duplicate IPN callback (ID giao dịch đã xử lý), THE hệ thống SHALL trả về phản hồi Idempotent cho VNPAY với body: { "RspCode": "00", "Message": "Confirm Success" }.
WHERE vnp_ResponseCode khác 00, THE hệ thống SHALL cập nhật trạng thái payment thành FAILED.
7. Acceptance Criteria
Scenario: Thanh toán thành công
Given: Learner mua khóa học A giá 250.000đ.
When: VNPAY gửi callback thành công với đúng SecureHash và đúng số tiền.
Then: orders.status là 'paid', có enrollments 'active', Learner có quyền học.

Scenario: Xử lý đơn hàng đang chờ (Reuse)
Given: Learner có đơn hàng A đang PENDING và còn hạn.
When: Learner nhấn mua lại khóa học A.
Then: Hệ thống trả về URL thanh toán của đơn hàng cũ, không tạo thêm bản ghi mới.

Scenario: IPN muộn cho đơn đã hết hạn
Given: Đơn hàng A đã chuyển sang EXPIRED.
When: VNPAY gửi callback thành công.
Then: Không có enrollment nào được tạo, hệ thống báo xác nhận cho VNPAY và ghi log yêu cầu refund.
8. Out of Scope
Refund: Không hỗ trợ hoàn tiền tự động qua API (xử lý thủ công qua Admin).
Coupons: Không hỗ trợ mã giảm giá trong giai đoạn MVP.
Analytics: Báo cáo doanh thu chi tiết (thuộc về Sprint 3 - Member 5).
