SPEC.md — Enrollment Management
Version: 1.1.0 (APPROVED) | Owner: TienTD (Member 3) | Status: Locked for Implementation
1. Context & Goal
Business Context: Hệ thống cần một cơ chế chính xác để xác định quyền truy cập nội dung bài học. Đây là "nguồn sự thật" (Source of Truth) duy nhất cho module Learning (Member 4)
.
Goal: Quản lý vòng đời ghi danh, cung cấp hợp đồng canAccessCourse hiệu năng cao và đảm bảo tính nhất quán dữ liệu sau khi thanh toán thành công
.
2. Actors & Roles
Learner: Xem danh sách khóa học đã mua (#39), truy cập nội dung bài học nếu ghi danh active
.
Mentor: Được bypass kiểm tra ghi danh đối với các khóa học do chính mình sở hữu
.
Manager/Admin: Xem toàn bộ ghi danh (#43), hủy ghi danh (#44) và luôn được bypass kiểm tra quyền
.
System (Member 3): Tự động xử lý sự kiện thanh toán để mở quyền học bài
.
3. Functional Requirements (EARS Notation)
Ubiquitous (Luôn áp dụng):
THE hệ thống SHALL đảm bảo duy nhất một bản ghi ghi danh cho mỗi cặp userId + courseId
.
THE hệ thống SHALL luôn kiểm tra users.status; nếu người dùng bị blocked, hàm canAccessCourse SHALL trả về false bất kể trạng thái ghi danh
.
Event-driven (Theo sự kiện):
WHEN nhận được sự kiện thanh toán thành công (SUCCESS), THE hệ thống SHALL sử dụng SELECT FOR UPDATE để kiểm tra ghi danh
.
WHERE ghi danh chưa tồn tại, THE hệ thống SHALL tạo mới bản ghi với status = 'active'
.
WHERE ghi danh đã tồn tại với status = 'cancelled', THE hệ thống SHALL cập nhật trạng thái thành active
.
WHEN nhận duplicate event cho cùng một giao dịch, THE hệ thống SHALL phản hồi thành công (Idempotent) và KHÔNG thực hiện cập nhật nếu ghi danh đã ở trạng thái active
.
State-driven (Theo trạng thái):
WHERE khóa học bị lưu trữ (archived), xóa mềm (deleted_at) hoặc bị từ chối (rejected), THE hệ thống SHALL vẫn cho phép các Learner có ghi danh active truy cập bài học (bảo vệ quyền lợi người đã trả tiền)
.
Access Contract (#38 - canAccessCourse):
Signature: canAccessCourse(userId: string, courseId: string, userRole: string): Promise<boolean>
.
THE hệ thống SHALL trả về true NẾU:
Người dùng là ADMIN hoặc MANAGER
.
Người dùng là MENTOR sở hữu khóa học đó (kiểm tra qua courseOwnerId)
.
Người dùng là LEARNER có ghi danh status = 'active' và tài khoản không bị blocked
.
4. Non-functional Requirements
Performance: Hàm canAccessCourse SHALL có thời gian phản hồi < 50ms thông qua việc sử dụng Composite Index (user_id, course_id) và thực hiện JOIN với bảng users trong duy nhất một truy vấn
.
Data Integrity: Mọi thao tác tạo hoặc cập nhật trạng thái ghi danh SHALL được thực hiện trong một Database Transaction
.
Concurrency Control: Sử dụng kỹ thuật Row-level Lock (SELECT FOR UPDATE) khi xử lý sự kiện thanh toán để ngăn chặn Race Condition với luồng Admin hủy ghi danh thủ công
.
5. API Contracts
API #39 - GET /enrollments/my-courses
Response: { success: true, data: { enrollments: [{ enrollmentId, courseId, courseTitle, courseThumbnail, status, enrolledAt }] } }
.
API #44 - DELETE /admin/enrollments/:id
Success (200): { success: true, message: "Enrollment cancelled" }
.
Error (404): { success: false, message: "Enrollment not found", code: "ENROLLMENT_NOT_FOUND" }
.
Notification: KHÔNG gửi thông báo cho user (Silent Cancel)
.
6. Data Model
Sở hữu bởi Member 3
:
Table enrollments:
id (CHAR36): Primary Key.
user_id (CHAR36): Foreign Key (RESTRICT)
.
course_id (CHAR36): Foreign Key (RESTRICT)
.
status: ENUM('active', 'cancelled').
enrolled_at: DATETIME(3).
Index: UNIQUE (user_id, course_id), idx_enrollments_user_status (user_id, status)
.
7. Error Handling
WHERE phát hiện vi phạm ràng buộc UNIQUE khi tạo ghi danh đồng thời, THE hệ thống SHALL rollback giao dịch và báo lỗi logic thay vì để crash hệ thống
.
WHERE người dùng chưa đăng nhập gọi API #39, THE hệ thống SHALL trả về 401 Unauthorized (do Middleware xử lý)
.
8. Acceptance Criteria
Scenario: Idempotent Payment Processing
Given: Learner A đã thanh toán thành công và có enrollment 'active'.
When: Hệ thống nhận lại cùng một sự kiện "payment success" lần thứ hai.
Then: Không có câu lệnh UPDATE nào được thực thi, hệ thống trả về kết quả thành công ngay lập tức
.
Scenario: Quyền học khi khóa học bị Archive
Given: Khóa học B bị Mentor chuyển sang trạng thái archived.
When: Learner A (đã mua) gọi hàm canAccessCourse.
Then: Kết quả phải là true
.
Scenario: Blocked User Access
Given: Learner A có enrollment 'active' nhưng tài khoản bị Admin đặt status = 'blocked'.
When: Kiểm tra quyền qua hàm canAccessCourse.
Then: Kết quả phải là false
.
9. Out of Scope
Free Courses: MVP chỉ tập trung 100% vào khóa học trả phí
.
Expiry Date: Mọi ghi danh đều có hiệu lực vĩnh viễn (Lifetime Access)
.
Auto-Refund: Hủy ghi danh thủ công không tự động kích hoạt hoàn tiền qua cổng VNPAY
.