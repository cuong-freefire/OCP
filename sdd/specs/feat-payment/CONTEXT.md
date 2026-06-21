CONTEXT.md — Payment & Order Processing
Người viết: TienTD (Member 3) | Ngày: 2026-06-20 Trạng thái: Pha 0 - Context Discovery (Đã hoàn thiện sau Review)
1. PROBLEM STATEMENT
Vấn đề: Sau khi người dùng đã xem danh mục khóa học (feat-catalog), hệ thống hiện chưa có cơ chế để người học (Learner) mua quyền truy cập vào nội dung trả phí.
Hậu quả: Nền tảng không thể phát sinh doanh thu, và người học không thể bắt đầu lộ trình học tập dù đã chọn được khóa học ưng ý.
Mục tiêu: Xây dựng luồng thanh toán tích hợp với cổng VNPAY để xử lý các giao dịch mua khóa học một cách an toàn, chính xác và tự động mở quyền học bài khi thanh toán thành công
.
2. DOMAIN KNOWLEDGE
"Order" (Đơn hàng): Một bản ghi ghi lại ý định mua một khóa học cụ thể của một người dùng tại một thời điểm nhất định với một mức giá "snapshot"
.
"VNPAY Gateway": Cổng thanh toán trung gian duy nhất được sử dụng trong giai đoạn này
.
"IPN (Instant Payment Notification)": Cơ chế callback server-to-server từ VNPAY để thông báo kết quả giao dịch. Đây là nguồn sự thật duy nhất để xác nhận trạng thái thanh toán. IPN KHÔNG sử dụng JWT authentication, xác thực dựa hoàn toàn vào VNPAY signature (vnp_SecureHash)
.
"Idempotency" (Tính nhất quán): Đảm bảo một giao dịch từ VNPAY (xác định qua vnpay_transaction_id) chỉ được xử lý đúng một lần duy nhất, tránh việc tạo ghi danh trùng lặp hoặc cập nhật sai doanh thu
.
"VND BIGINT": Toàn bộ số tiền được xử lý dưới dạng số nguyên (đơn vị đồng) để triệt tiêu lỗi làm tròn của số thập phân (VD: 250.000 VND lưu là 250000)
.
3. STAKEHOLDERS
Learner (Người học): Đối tượng thực hiện thanh toán để mua khóa học.
Mentor (Giảng viên): Bên nhận doanh thu (theo dõi qua báo cáo của Member 5).
System (Member 3): Chịu trách nhiệm quản lý ranh giới dữ liệu giữa Thanh toán và Ghi danh.
VNPAY: Bên thứ ba xử lý dòng tiền thực tế.
4. CONSTRAINTS (Ràng buộc)
C1. Cấm Frontend quyết định giá: Tuyệt đối không nhận số tiền (amount) từ phía frontend gửi lên. Giá phải được lấy trực tiếp từ bảng courses (nguồn sự thật của Member 2)
.
C2. Thời gian hết hạn: URL thanh toán VNPAY chỉ có hiệu lực trong vòng 15 phút kể từ khi khởi tạo
.
C3. Giới hạn thanh toán: Mỗi cặp userId + courseId chỉ được phép có duy nhất một đơn hàng ở trạng thái PENDING tại một thời điểm
.
C4. Ranh giới Module: Chỉ Member 3 mới có quyền ghi vào các bảng orders, payments, enrollments. Các module khác (như Learning - Member 4) phải gọi qua contract để kiểm tra quyền truy cập
.
C5. Idempotency Mechanism: Hệ thống PHẢI sử dụng vnpay_transaction_id (UNIQUE INDEX) kèm SELECT FOR UPDATE trên bảng payments để đảm bảo một giao dịch VNPAY chỉ được xử lý đúng một lần, tránh tạo duplicate enrollment hoặc double-charge
.
C6. Duplicate Enrollment Prevention: Trước khi xử lý IPN callback, hệ thống PHẢI kiểm tra sự tồn tại của enrollment với status='active' cho cặp (userId, courseId). UNIQUE constraint (user_id, course_id) trên bảng enrollments là chốt chặn cuối cùng
.
C7. VNPAY Signature Validation: Backend PHẢI validate vnp_SecureHash từ IPN callback trước khi cập nhật order/payment status để đảm bảo request không bị giả mạo. Secret key lưu trong env variable, KHÔNG log signature hoặc secret
.
C8. Payment Expiration Cleanup: Hệ thống cần có chiến lược xử lý payments ở trạng thái PENDING quá 15 phút (expires_at < now). Có thể dùng cron job để auto-expire hoặc check lazy khi user truy cập lại
.
5. ASSUMPTIONS (Giả định)
A1. Khóa học đang được mua đã ở trạng thái published và có giá tiền hợp lệ (> 0). Hệ thống CẦN re-validate course status và price trong IPN callback để xử lý trường hợp course bị archive/reject giữa chừng
.
A2. Người dùng đã được xác thực (Authenticated) và có ID hợp lệ lấy từ JWT cookie trước khi bắt đầu tạo checkout. Lưu ý: IPN callback KHÔNG yêu cầu JWT, chỉ validate VNPAY signature
.
A3. Hệ thống có API cho phép user/frontend kiểm tra trạng thái payment chủ động (GET /orders/:id hoặc /payments/:id) để xử lý trường hợp IPN callback bị delay do network
.
A4. VNPAY IPN response luôn đúng format và ổn định. Hệ thống PHẢI validate response schema trước khi process để tránh crash khi VNPAY update API
.
6. OPEN QUESTIONS (Câu hỏi cần làm rõ)
Q1. Chúng ta sẽ lưu trữ nhật ký sự kiện thanh toán (payment_events) vào một bảng riêng hay chỉ ghi vào cấu trúc logs hệ thống
?
Q2. Hệ thống có cần hỗ trợ quy trình hoàn tiền (Refund) tự động trong giai đoạn MVP này không, hay sẽ xử lý thủ công qua Admin
?
Q3. Trong trường hợp VNPAY gặp sự cố, hệ thống có cần cơ chế thông báo bảo trì thanh toán riêng cho người dùng không
?
Q4. Payment Expiration Strategy: Hệ thống sử dụng cron job để auto-expire pending payments (sau 15 phút) hay check lazy khi user quay lại? Nếu dùng cron, chạy mỗi bao lâu? (Đề xuất: mỗi 5 phút)
Q5. Duplicate Checkout Handling: Nếu user đã có PENDING order (chưa hết hạn) nhưng request checkout lại cho cùng course, hệ thống: A) Trả về existing checkout URL (reuse)? B) Expire old order và tạo order mới? C) Reject với error "You already have a pending payment"
?
Q6. Course Re-validation in IPN: Nếu trong lúc user thanh toán, course bị Manager archive, hệ thống: A) Tiếp tục tạo enrollment (user đã trả tiền)? B) Reject payment và refund manual? C) Tạo enrollment nhưng set status='cancelled'
?
Q7. Frontend Payment Status Check: Sau khi user thanh toán xong ở VNPAY → redirect về OCP, nếu IPN chưa đến (slow network), frontend có poll API /orders/:id/status để check không? Timeout bao lâu trước khi show error message
?
Q8. Failed Payment Retry Limit: User có thể retry payment bao nhiêu lần cho cùng course? Có rate limiting không? (Ví dụ: max 5 pending orders trong 1 giờ)
