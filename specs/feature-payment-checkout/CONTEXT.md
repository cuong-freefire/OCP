# CONTEXT.md — Feature Payment Checkout (Tạo yêu cầu thanh toán)

# Người viết: CuongLH | Ngày: 26/05/2026

## 1. PROBLEM STATEMENT (Bài toán cần giải quyết)

Học viên muốn mua một khóa học trả phí (Paid Course) trên hệ thống OCP. Hệ thống cần một quy trình an toàn để khởi tạo đơn hàng, ghi nhận trạng thái chờ thanh toán và chuyển hướng người dùng đến cổng thanh toán VNPAY một cách bảo mật. Mục tiêu cốt lõi là ngăn chặn việc giả mạo số tiền hoặc quyền truy cập từ phía Frontend.

## 2. DOMAIN KNOWLEDGE (Kiến thức nghiệp vụ)

- **Paid Course:** Khóa học yêu cầu phải thanh toán và có bản ghi `enrollment` hợp lệ mới được truy cập nội dung bài học.
- **Order/Payment PENDING:** Trạng thái đơn hàng vừa được tạo, đang chờ người dùng thanh toán trên VNPAY. Ở trạng thái này, user chưa được cấp quyền học (chưa tạo `enrollment`).
- **VNPAY Payment URL:** VNPAY Payment URL được backend tạo bằng cách build các tham số thanh toán và ký/hash bằng Secret Key của VNPAY. Việc sinh URL này bắt buộc phải diễn ra tại Backend.

## 3. STAKEHOLDERS (Các bên liên quan)

- **Learner (Học viên):** Người thực hiện thao tác bấm mua khóa học.
- **System (Hệ thống OCP):** Cần ghi nhận chính xác đơn hàng nào đang chờ thanh toán để đối soát và xử lý callback sau này.
- **VNPAY:** Cổng thanh toán bên thứ ba tiếp nhận thông tin đơn hàng và xử lý giao dịch.

## 4. CONSTRAINTS (Ràng buộc không thể thay đổi)

- **Tech (Security):** Tuân thủ tuyệt đối ADR-005: Frontend chỉ gửi ID khóa học muốn mua. Mọi thao tác kiểm tra giá tiền, tạo Payment Request và sinh URL VNPAY phải thực hiện ở backend `ocp-api`.
- **Tech (Auth):** User phải được xác thực qua JWT trước khi tạo thanh toán.
- **Business:**
  - Không cho phép mua khóa học "Free" qua luồng này (Luồng Free sẽ có API riêng).
  - Backend phải kiểm tra xem user đã có `enrollment` (đã sở hữu khóa học) hay chưa. Nếu đã có, chặn không cho tạo thanh toán mới để tránh mất tiền oan.

## 5. ASSUMPTIONS (Giả định — cần confirm)

- **Nguồn lấy giá tiền:** Giả định rằng số tiền (Amount) gửi sang VNPAY sẽ được backend query trực tiếp từ bảng `courses` (do Nam quản lý) dựa trên `courseId`, tuyệt đối không lấy từ body request của Frontend.
- **Xử lý đơn trùng:** Giả định hệ thống cho phép nhiều order PENDING cho cùng một user và course. Khi xử lý callback/IPN ở feature khác, chỉ callback SUCCESS hợp lệ đầu tiên được dùng để cấp enrollment; các order còn lại không được cấp quyền học.

## 6. OPEN QUESTIONS (Câu hỏi chưa có câu trả lời)

1. Thời gian hết hạn (Expire) của một URL thanh toán VNPAY trong dự án này quy định là bao lâu (VD: 15 phút, 30 phút)?
2. Trong Phase MVP này, tính năng checkout có cần hỗ trợ áp dụng mã giảm giá (Coupon) không, hay mặc định luôn lấy đúng giá gốc của khóa học?

## 7. SCOPE BOUNDARY (Ranh giới phạm vi)

- CONTEXT này chỉ mô tả bối cảnh cho feature tạo yêu cầu thanh toán: kiểm tra điều kiện mua, tạo order PENDING và sinh VNPAY payment URL. Việc xử lý VNPAY return/IPN, cập nhật order SUCCESS/FAILED và tạo enrollment sẽ thuộc feature khác.