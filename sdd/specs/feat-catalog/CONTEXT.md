CONTEXT.md — Course Catalog (Danh mục khóa học)
Người viết: TienTD (Member 3) | Ngày: 2026-06-19 Trạng thái: Pha 0 - Context Discovery (Đã hoàn thiện sau Review)
1. PROBLEM STATEMENT
Người dùng (Guest/Learner) hiện không có giao diện để khám phá các nội dung đào tạo, dẫn đến việc không thể phát sinh luồng mua hàng và doanh thu
.
Mục tiêu: Cung cấp API và dữ liệu hiển thị danh sách/chi tiết khóa học một cách an toàn và hiệu quả.
2. DOMAIN KNOWLEDGE
DK1. Published Only: Chỉ hiển thị khóa học có status = 'published'
.
DK2. Snapshot Price: Giá hiển thị là giá gốc tại bảng courses, dùng để tạo đơn hàng
.
DK3. Course Outline: Chi tiết khóa học chỉ bao gồm tiêu đề Section/Lesson để người dùng xem lộ trình
.
DK4. Content Isolation: Catalog TUYỆT ĐỐI KHÔNG trả về nội dung bài học (content), link video (lesson_assets), hoặc câu hỏi quiz
.
3. STAKEHOLDERS
Guest/Learner: Đối tượng sử dụng Catalog để tìm kiếm và mua khóa học
.
Mentor: Chủ sở hữu nội dung hiển thị
.
Manager/Admin: Người phê duyệt trạng thái published
.
4. CONSTRAINTS (Ràng buộc)
C1. No Archived: Tuyệt đối không hiển thị khóa học có status = 'archived' (vì không được bán mới)
.
C2. Currency: Giá tiền (price) phải dùng kiểu BIGINT (đơn vị VNĐ) để tránh sai số
.
C3. Security: API chi tiết (GET /courses/:id) nếu cho phép Guest truy cập thì phải ẩn toàn bộ các trường dữ liệu nhạy cảm của học viên
.
C4. Pagination: API danh sách phải giới hạn max_page_size (ví dụ: 100) để chống tấn công DoS
.
5. ASSUMPTIONS (Giả định)
A1. Dữ liệu tại bảng courses luôn là nguồn sự thật cuối cùng cho Catalog
.
A2. Price Priority: Nếu có một bản sửa đổi (revision) đang chờ duyệt với giá mới, Catalog vẫn hiển thị giá cũ từ bảng courses cho đến khi revision được phê duyệt
.
6. OPEN QUESTIONS (Câu hỏi mở)
Q1. API GET /courses/:id có yêu cầu đăng nhập không hay mở công khai cho Guest?
Q2. Thông tin Mentor (tên, avatar) có cần hiển thị kèm trong chi tiết khóa học không? (Cần xác định contract với Member A)
.
Q3. Giá trị default_page_size mặc định là bao nhiêu (đề xuất: 20)?
.
