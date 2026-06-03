# CONTEXT.md — Admin Management

# Người viết: @Tiến | Ngày: 2026-05-27

## 1. PROBLEM STATEMENT

Hệ thống OCP thiếu một cơ chế quản trị trung tâm để kiểm soát vòng đời tài khoản, quyền Mentor và phân công Mentor theo khóa học. Khi phát hiện tài khoản vi phạm, Admin chưa có luồng chuẩn để block/unblock hoặc hard delete an toàn. Khi một user cần trở thành Mentor, hệ thống chưa có cơ chế chính thức để Admin cấp quyền và theo dõi phân công. Khi nhiều Admin thao tác đồng thời, cùng một Mentor có thể bị gán trùng vào cùng một khóa học, gây sai lệch hàng đợi chấm bài.

Pain chính là thiếu quyền kiểm soát an toàn ở tầng vận hành: Admin cần thao tác nhanh nhưng không được làm mất dữ liệu học tập, thanh toán hoặc phá vỡ quyền chấm bài.

## 2. DOMAIN KNOWLEDGE

- **Soft Delete**: Không xóa vật lý user. Hệ thống chỉ đổi trạng thái tài khoản sang `BLOCKED` để user không thể đăng nhập nhưng dữ liệu lịch sử vẫn còn.
- **Hard Delete**: Xóa vật lý user khỏi database. Chỉ được phép với tài khoản chưa phát sinh payment thành công và chưa có enrollment.
- **Mentor Assignment**: Bản ghi trong `mentor_assignments` xác nhận một Mentor được Admin phân công cho một Course cụ thể.
- **Assignment Status**: `ACTIVE` nghĩa là Mentor đang có quyền chấm bài cho Course. `DISABLED` nghĩa là phân công đã bị thu hồi.
- **Cross-module Reader**: Admin module không sở hữu dữ liệu payment/enrollment, nên phải gọi contract/adapter để kiểm tra trước khi hard delete.
- **Audit Trail**: Mọi thao tác quản trị làm thay đổi dữ liệu cần ghi lại actor, action, target và timestamp.

## 3. STAKEHOLDERS

- **Admin**: Người thao tác block/unblock user, promote Mentor và phân công Mentor vào Course.
- **Mentor**: Người nhận hoặc mất quyền chấm bài khi assignment được tạo hoặc thu hồi.
- **Learner**: Người bị ảnh hưởng khi tài khoản bị block/unblock hoặc bị từ chối hard delete vì còn lịch sử học/thanh toán.
- **Auth module owner**: Cung cấp schema và behavior của `users`, `role`, `status`, JWT cookie.
- **Payment/Enrollment module owners**: Cung cấp reader contract để xác định user đã phát sinh giao dịch hoặc enrollment hay chưa.
- **Team Lead/Product Owner**: Chốt chính sách hard delete, revoke assignment và audit log.

## 4. CONSTRAINTS (ràng buộc không thể thay đổi)

- **Security**: Mọi API `/admin/*` phải xác thực JWT từ `httpOnly Cookie` và kiểm tra `role === ADMIN`.
- **Data Safety**: Không được hard delete user đã có payment `SUCCESS` hoặc active enrollment.
- **Integrity**: Không cho phép một Mentor có hơn một assignment `ACTIVE` cho cùng một Course.
- **Validation**: Mọi request body phải dùng Zod strict schema và reject unknown fields.
- **Cross-module Boundary**: Admin module không query trực tiếp bảng `payments` hoặc `enrollments` của module khác.
- **Transaction**: Các thao tác thay đổi user status, hard delete hoặc assignment phải chạy trong database transaction.

## 5. ASSUMPTIONS (giả định — cần confirm)

- Khi block một Mentor đang có assignment, các submission `PENDING` liên quan sẽ không bị xóa; chính sách xử lý sẽ do Team Lead xác nhận.
- Một Mentor có thể được gán vào nhiều Course cùng lúc nếu không có giới hạn workload được Product Owner đưa ra.
- `PaymentReader.hasSuccessfulPayment(userId)` và `EnrollmentReader.hasActiveEnrollment(userId)` có thể trả kết quả đồng bộ đủ tin cậy cho quyết định hard delete.
- Audit log có thể bắt đầu bằng structured logger; bảng `admin_audit_logs` chỉ tạo nếu Team Lead yêu cầu lưu lâu dài trong DB.

## 6. OPEN QUESTIONS (câu hỏi chưa có câu trả lời)

1. Trạng thái user dùng column nào: `status`, `is_blocked` hay `deleted_at`?
2. Hard delete chỉ cần ADMIN hay cần SUPER_ADMIN?
3. Khi revoke assignment mà còn pending submissions thì giữ nguyên, chuyển `UNASSIGNED`, hay chặn revoke?
4. Có cần bảng `admin_audit_logs` riêng hay structured logger là đủ cho MVP?
5. Cross-module reader timeout sẽ fail đóng request hay cho phép retry thủ công?
