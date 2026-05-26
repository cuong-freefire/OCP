# CONTEXT.md — Feature Payment Webhook & Enrollment (Xử lý IPN VNPAY & Ghi danh)

# Người viết: Member 3 - CuongLH | Ngày: 2026-05-26

## 1. PROBLEM STATEMENT (Bài toán cần giải quyết)

Sau khi người dùng thao tác trên cổng thanh toán VNPAY, VNPAY sẽ gửi một request (IPN Webhook) về backend của hệ thống OCP để thông báo kết quả giao dịch. Hệ thống cần tiếp nhận an toàn webhook này, xác minh tính toàn vẹn của dữ liệu để chống giả mạo, cập nhật trạng thái đơn hàng (từ PENDING sang SUCCESS hoặc FAILED) và tự động cấp quyền học (tạo enrollment) cho người dùng nếu thanh toán thành công.

## 2. DOMAIN KNOWLEDGE (Kiến thức nghiệp vụ)

* **IPN (Instant Payment Notification):** Cơ chế server-to-server mà VNPAY dùng để báo kết quả thanh toán độc lập với việc người dùng có tắt trình duyệt hay không.
* **Idempotency (Tính lũy đẳng):** VNPAY có thể gửi IPN nhiều lần cho cùng một giao dịch (do retry hoặc mạng lag). Hệ thống phải đảm bảo dù nhận nhiều lần, quyền học (enrollment) chỉ được cấp đúng 1 lần.
* **Enrollment:** Bản ghi trong Database cấp quyền cho Learner truy cập vào nội dung khóa học trả phí sau khi thanh toán thành công.

## 3. STAKEHOLDERS (Các bên liên quan)

* **VNPAY System:** Hệ thống gửi Webhook IPN và nhận phản hồi xác nhận từ OCP.
* **OCp-API (Backend):** Xử lý Webhook, kiểm tra bảo mật, cập nhật Database.
* **Learner:** Nhận được quyền truy cập khóa học và email xác nhận sau khi tiến trình hoàn tất.
* **EmailService (thuộc Module Auth/Email):** Cung cấp API/Contract nội bộ để hệ thống tự động gọi trigger gửi email "Enrollment Success".

## 4. CONSTRAINTS (Ràng buộc không thể thay đổi)

* **Tech (Security):** BẮT BUỘC verify chữ ký (Secure Hash) của VNPAY bằng thuật toán HMAC-SHA512. Nếu chữ ký sai, từ chối xử lý ngay lập tức.
* **Tech (Transaction):** Việc cập nhật `payment status = SUCCESS` và tạo bản ghi `enrollment` BẮT BUỘC phải nằm trong cùng một Database Transaction (`$transaction` của Prisma). Tuyệt đối tránh tình trạng thanh toán thành công nhưng khóa học chưa được mở.
* **Tech (Idempotency):** Chỉ xử lý cấp quyền học khi payment đang ở trạng thái `PENDING`. Nếu đã là `SUCCESS`, hệ thống trả về mã thành công cho VNPAY nhưng không tạo thêm bản ghi enrollment trùng lặp.

## 5. ASSUMPTIONS (Giả định — cần confirm)

* **Giả định về Service Contract:** Giả định rằng Module Auth/Email đã chuẩn bị sẵn một internal public interface (ví dụ: `emailService.sendEnrollmentSuccess(email, courseName)`) để Payment Module gọi chéo sang sau khi cấp quyền học thành công.

## 6. OPEN QUESTIONS (Câu hỏi chưa có câu trả lời)

1. Theo tài liệu tích hợp của VNPAY, mã HTTP Status và định dạng JSON cụ thể mà VNPAY yêu cầu backend phải trả về sau khi nhận IPN là gì (để VNPAY biết backend đã nhận thành công)?
2. Nếu tiến trình Transaction (Update Payment + Tạo Enrollment) thành công, nhưng bước gọi hàm từ `EmailService` bị lỗi (do server mail chết), chúng ta có cho phép catch lỗi email và vẫn giữ nguyên trạng thái SUCCESS của giao dịch không?
