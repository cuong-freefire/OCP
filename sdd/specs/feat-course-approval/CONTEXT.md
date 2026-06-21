# CONTEXT.md — Feature: Course Approval & Operations (Member E)

# Người viết: Antigravity | Ngày: 2026-06-21

## 1. PROBLEM STATEMENT

Hệ thống OCP cần đảm bảo chất lượng giảng dạy bằng cách kiểm duyệt mọi khóa học mới hoặc các bản cập nhật nội dung từ Mentor trước khi cho phép học viên đăng ký. Quy trình này đòi hỏi Manager có thể review toàn bộ nội dung giáo trình một cách trực quan, phê duyệt hoặc từ chối kèm lý do. Ngoài ra, Manager cần có các công cụ vận hành để vô hiệu hóa (disable) hoặc ngừng xuất bản (unpublish) các khóa học vi phạm chính sách của nền tảng.

## 2. DOMAIN KNOWLEDGE

- **Course Review & Snapshot Restoration (Lỗi E1.1):** Khi Mentor gửi duyệt khóa học, hệ thống tạo ra một bản ghi trong `course_revisions` lưu trữ snapshot dưới dạng JSON chứa toàn bộ thông tin khóa học và curriculum (sections, lessons, quizzes, questions). Manager sẽ duyệt nội dung trực tiếp trên snapshot này để đảm bảo tính bất biến (Mentor không thể sửa đổi nội dung đang duyệt). Khi Approve, hệ thống phục hồi (restore) curriculum từ JSON vào các bảng cơ sở dữ liệu thực tế trong một database transaction cô lập để tránh lỗi dữ liệu bài giảng bị đứt gãy.
- **Prevent Self-Approval (Lỗi E2.3):** Nếu Manager đồng thời là Mentor của một khóa học, họ không được phép tự duyệt khóa học của chính mình nhằm đảm bảo tính khách quan và an toàn hệ thống.
- **Superseded Revisions:** Khi một revision mới được publish, tất cả các revision trước đó của khóa học đó phải được chuyển sang trạng thái `superseded` để lưu trữ lịch sử và tránh nhầm lẫn trong tương lai.
- **Disable (Archive) vs Unpublish:**
  - **Disable (status = 'archived'):** Sử dụng khi khóa học vi phạm chính sách hoặc cần ngừng kinh doanh. Khóa học sẽ không xuất hiện trên catalog và không thể đăng ký mua mới, nhưng các học viên đã mua trước đó vẫn có thể tiếp tục học tập.
  - **Unpublish (status = 'draft'):** Manager trả khóa học về trạng thái nháp để Mentor cập nhật lại nội dung.

## 3. STAKEHOLDERS

- **Manager:** Người duyệt khóa học, thực hiện Approve/Reject revisions, Disable/Unpublish khóa học vi phạm, và quản lý các danh mục (Category).
- **Mentor (Member B):** Tạo khóa học, gửi yêu cầu duyệt và nhận các nhận xét reject để sửa đổi.
- **Learner (Member C, D):** Bị ảnh hưởng trực tiếp bởi trạng thái của khóa học (chỉ học được khóa đã publish, không mua được khóa đã archived).

## 4. CONSTRAINTS

- **Database Ownership:** Module này sở hữu bảng `course_reviews` và `review_comments`. Đọc và cập nhật các bảng `courses`, `course_revisions`, `course_sections`, `lessons`, `quizzes`, `quiz_questions` thuộc Member B thông qua các quy tắc transaction nghiêm ngặt.
- **Auth & Access Control:** Mọi API kiểm duyệt và vận hành yêu cầu role `MANAGER` với cookie JWT httpOnly hợp lệ và kiểm tra khớp `role_version` để chống các rủi ro thay đổi phân quyền (E2.2).
- **Mandatory Reject Comment:** Khi từ chối duyệt (Reject), bắt buộc nhập nhận xét (comment) tối thiểu 10 ký tự.

## 5. ASSUMPTIONS

- Các module khác đã hoàn thành việc xây dựng middleware xác thực và cung cấp API kiểm tra quyền sở hữu khóa học (`canEditCourse`).
- Hệ thống hỗ trợ khôi phục các tệp asset video/document qua các URL Cloudinary được lưu trữ trong snapshot.

## 6. OPEN QUESTIONS

1. Khi Manager disable (archive) khóa học, Mentor có được phép gửi yêu cầu duyệt lại cho khóa học đó không, hay khóa học đó bị đóng vĩnh viễn?
2. Có nên triển khai màn hình quản lý danh mục (Category) độc lập cho Manager hay không, hay chỉ cần lưu trường danh mục dưới dạng văn bản (text)?
