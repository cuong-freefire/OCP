CONTEXT.md — Enrollment Management
Người viết: TienTD (Member 3) | Ngày: 2026-06-20 Trạng thái: Pha 0 - Context Discovery (FINALIZED)
1. PROBLEM STATEMENT
Vấn đề: Hệ thống cần một cơ chế chính xác để xác định người dùng nào có quyền truy cập vào nội dung bài học và thực hiện các hoạt động học tập (quiz, rating).
Hậu quả: Nếu không có module Enrollment, module Learning (Member 4) sẽ không thể xác định việc mở khóa nội dung, dẫn đến rủi ro thất thoát tài sản số.
Mục tiêu: Xây dựng hệ thống quản lý ghi danh làm "nguồn sự thật" duy nhất cho quyền truy cập, cung cấp contract canAccessCourse để các module khác sử dụng.
2. DOMAIN KNOWLEDGE
"Enrollment" (Ghi danh): Bản ghi kết nối userId và courseId, đại diện cho quyền sở hữu nội dung.
"Active Status": Cho phép người dùng truy cập toàn bộ tài nguyên học tập, làm bài kiểm tra và đánh giá.
"Cancelled Status": Trạng thái thu hồi quyền truy cập (soft cancel) phục vụ đối soát, không thực hiện hard delete.
"Access Contract" (canAccessCourse): Giao diện lập trình cung cấp cho Member 4 kiểm tra quyền truy cập qua DI (Dependency Injection).
3. STAKEHOLDERS
Learner: Người mua và học khóa học.
Member 4 (Learning): Bên tiêu thụ (consumer) chính của contract kiểm tra quyền.
Admin/Manager: Quản lý ghi danh toàn hệ thống và thực hiện hủy ghi danh (API #44).
System (Member 3): Duy trì tính nhất quán giữa Thanh toán và Ghi danh.
4. CONSTRAINTS (Ràng buộc)
C1. Uniqueness: Mỗi cặp userId + courseId chỉ được phép có duy nhất MỘT bản ghi ghi danh để tránh vi phạm ràng buộc dữ liệu.
C2. Module Boundary: Member 4 tuyệt đối không được query trực tiếp bảng enrollments, phải gọi qua EnrollmentService.
C3. Role-based Bypass (Revised):
MANAGER/ADMIN: Luôn được bypass kiểm tra ghi danh cho mọi khóa học (phục vụ kiểm duyệt/audit).
MENTOR: Chỉ được bypass cho khóa học do chính mình sở hữu. Nếu học khóa của người khác, phải mua như Learner.
C4. Data Integrity: Không hard delete dữ liệu ghi danh đã phát sinh.
C5. User Status Check (Security Layer 1): Hàm canAccessCourse() PHẢI kiểm tra users.status. Nếu người dùng bị blocked, trả về false ngay lập tức bất kể trạng thái ghi danh.
C6. Archived Course Access: Khóa học bị archived sẽ không bán mới, nhưng người đã có ghi danh active vẫn được học tiếp để bảo vệ quyền lợi người tiêu dùng.
5. ASSUMPTIONS (Giả định)
A1. Auth context: Người dùng luôn được xác thực qua JWT trước khi hệ thống kiểm tra quyền ghi danh (Middleware handle).
A2. Automated trigger: Bản ghi ghi danh được tạo tự động ngay sau khi có tín hiệu thanh toán thành công (SUCCESS) từ feat-payment.
A3. Snapshots: Dữ liệu học tập và tiến độ thuộc về Member 4, module Enrollment chỉ quan tâm đến quyền truy cập tổng thể.
A4. Re-enrollment Strategy: Nếu người dùng mua lại một khóa học đã bị cancelled, hệ thống sẽ UPDATE bản ghi cũ lên active thay vì tạo mới để tránh vi phạm ràng buộc UNIQUE.
6. OPEN QUESTIONS (Đã giải quyết)
Q1. Free Course Scope: MVP hiện tại chỉ tập trung vào khóa học trả phí (100% paid). Các luồng cho khóa học miễn phí (free courses) sẽ được xem xét ở các giai đoạn sau.
Q2. Expiry: Ghi danh trong MVP là vĩnh viễn (lifetime access) cho các khóa học đã mua thành công.
Q3. Refund Sync: Khi Admin hủy ghi danh thủ công, quy trình hoàn tiền sẽ được xử lý riêng biệt (Out of scope cho API tự động).