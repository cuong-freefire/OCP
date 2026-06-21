SPEC.md — Course Catalog (Danh mục khóa học)
Version: 1.1.0 (APPROVED) | Owner: TienTD (Member 3) | Status: Locked for Implementation
1. Context & Goal
Business Context: Hiện tại người dùng (Guest/Learner) không có nơi để tìm kiếm và xem thông tin các khóa học, dẫn đến việc không thể phát sinh luồng mua hàng và doanh thu
.
Goal: Cung cấp API công khai để hiển thị danh sách và chi tiết các khóa học đã qua kiểm duyệt (published), làm tiền đề cho luồng thanh toán
.
2. Actors & Roles
Guest: Người dùng chưa đăng nhập, có quyền xem danh sách và chi tiết khóa học cơ bản
.
Learner: Người dùng đã đăng nhập, xem danh mục để chọn mua khóa học
.
System: Tự động lọc dữ liệu dựa trên trạng thái khóa học và trạng thái người sở hữu (Mentor)
.
3. Functional Requirements (EARS Notation)
Ubiquitous (Luôn áp dụng):
THE hệ thống SHALL chỉ hiển thị các khóa học có status = 'published'
.
THE hệ thống SHALL hiển thị giá khóa học (price) dưới dạng số nguyên BIGINT (đơn vị VNĐ) để tránh sai số làm tròn
.
Event-driven (Theo sự kiện):
WHEN người dùng gọi GET /courses, THE hệ thống SHALL trả về danh sách các khóa học đã xuất bản, hỗ trợ phân trang
.
WHEN người dùng gọi GET /courses/:courseId, THE hệ thống SHALL trả về thông tin chi tiết khóa học bao gồm: tiêu đề, mô tả, ảnh đại diện, giá, tên Mentor và cấu trúc khóa học (Section titles, Lesson titles)
.
Unwanted (Trường hợp không mong muốn):
WHERE khóa học có trạng thái là draft, pending_review, rejected hoặc archived, THE hệ thống SHALL NOT hiển thị trong Catalog
.
WHERE Mentor sở hữu khóa học có trạng thái users.status = 'blocked', THE hệ thống SHALL NOT hiển thị khóa học đó trong Catalog
.
WHERE không tìm thấy courseId, THE hệ thống SHALL trả về mã lỗi HTTP 404.
4. Non-functional Requirements
Performance: API GET /courses SHALL có thời gian phản hồi (p95) < 500ms tại Backend
.
Pagination: THE hệ thống SHALL giới hạn max_page_size tối đa là 100 bản ghi mỗi request để chống tấn công DoS
.
Security (IDOR Prevention): THE hệ thống SHALL thực hiện filter status = 'published' tại tầng Database query (Repository layer) để ngăn chặn IDOR attack, đảm bảo client không thể truy cập các khóa học chưa duyệt thông qua việc đoán UUID
.
Auth: API lấy danh sách và chi tiết khóa học SHALL NOT yêu cầu JWT (cho phép Guest truy cập)
.
5. Data Model
Sử dụng các bảng dữ liệu liên quan để trả về thông tin Catalog:
Table courses (Member 2 sở hữu): Lấy id, title, description, price, thumbnail, status, mentor_id
.
Relations:
INNER JOIN với bảng users (Member 1 sở hữu) để lấy tên Mentor. Nếu Mentor bị blocked, khóa học sẽ bị filter khỏi kết quả
.
LEFT JOIN với bảng course_sections và lessons (Member 2 sở hữu) để lấy tiêu đề cấu trúc học tập. Sử dụng LEFT JOIN để đảm bảo các khóa học mới được duyệt (chưa có section) vẫn hiển thị được với mảng rỗng []
.
6. Error Handling
WHERE dữ liệu đầu vào phân trang (page, limit) không hợp lệ, THE hệ thống SHALL sử dụng giá trị mặc định (page=1, limit=20) và trả về HTTP 200 với danh sách khóa học. Response SHOULD bao gồm metadata cảnh báo về việc áp dụng giá trị mặc định
.
WHERE kết nối Database bị timeout, THE hệ thống SHALL trả về lỗi HTTP 503 kèm theo request_id để trace log.
7. Acceptance Criteria (Given-When-Then)
Scenario: Hiển thị danh sách khóa học thành công
Given: Database có 5 khóa học published và 2 khóa học draft.
When: Guest thực hiện gọi GET /courses.
Then: Hệ thống trả về đúng 5 khóa học có trạng thái published, mã HTTP 200.
Scenario: Chặn hiển thị khóa học của Mentor bị khóa
Given: Khóa học A có status = 'published' nhưng Mentor sở hữu có status = 'blocked'.
When: Người dùng thực hiện gọi GET /courses.
Then: Khóa học A không xuất hiện trong danh sách trả về.
Scenario: Xử lý phân trang không hợp lệ
Given: Người dùng gọi GET /courses?limit=abc.
When: Hệ thống nhận request.
Then: Hệ thống trả về danh sách khóa học với limit=20 (mặc định), mã HTTP 200 và có thông tin cảnh báo trong metadata.
8. Out of Scope
Content Access: TUYỆT ĐỐI KHÔNG trả về nội dung bài học (content), link video/tài liệu (lesson_assets), hoặc câu hỏi quiz (thuộc về Member 4)
.
Analytics: Không hiển thị số lượng học viên đã đăng ký hoặc điểm đánh giá trung bình trong giai đoạn MVP này
.
Search/Filter: Các tính năng tìm kiếm theo từ khóa hoặc lọc theo danh mục (Category) nâng cao chưa thực hiện trong bản này
.