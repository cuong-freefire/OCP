# CONTEXT.md — Mentor Review System

# Người viết: @Tiến | Ngày: 2026-05-27

## 1. PROBLEM STATEMENT

Sau khi Learner hoàn thành khóa học và nộp Final Project, hệ thống cần một hàng đợi chấm bài để Mentor xem submission, đánh giá PASS/FAIL và gửi feedback. Pain chính là bảo mật và tính toàn vẹn dữ liệu: Mentor không được xem hoặc chấm bài của Course mà họ không được phân công, và khi lưu kết quả review thì không được có trạng thái nửa vời như có review nhưng không có feedback hoặc submission chưa đổi trạng thái.

Nếu không có cơ chế này, Learner không nhận được kết quả cuối khóa một cách đáng tin cậy, Admin không đo được hiệu suất Mentor, và hệ thống có nguy cơ cho phép chấm sai quyền.

## 2. DOMAIN KNOWLEDGE

- **Final Project Submission**: Bản ghi Learner nộp bài cuối khóa, thường gồm URL Git/demo/text và trạng thái ban đầu `PENDING`.
- **Review Queue**: Danh sách submission `PENDING` thuộc các Course mà Mentor đang có assignment `ACTIVE`.
- **Review Result**: Kết quả cuối cùng của Mentor, chỉ hợp lệ khi là `PASS` hoặc `FAIL`.
- **Feedback**: Nhận xét bắt buộc đi kèm review, tối thiểu 10 ký tự.
- **Assignment Guard**: Contract kiểm tra `mentor_assignments` để đảm bảo Mentor được phân công vào Course trước khi xem/chấm.
- **Atomic Review**: Lưu `project_reviews`, lưu `mentor_feedbacks` và update submission status phải thành công cùng nhau; fail một bước thì rollback toàn bộ.

## 3. STAKEHOLDERS

- **Mentor**: Người xem queue, đọc submission và gửi kết quả review.
- **Learner**: Người nhận kết quả PASS/FAIL và feedback.
- **Admin**: Người giám sát tiến độ chấm bài qua Reports.
- **Learning module owner**: Sở hữu `project_submissions` và contract đọc/cập nhật submission.
- **Admin Management module owner**: Sở hữu `mentor_assignments` và assignment contract.

## 4. CONSTRAINTS (ràng buộc không thể thay đổi)

- **Authorization**: Mọi API `/mentor/*` phải xác thực JWT và kiểm tra `role === MENTOR`.
- **Assignment**: Mentor chỉ được xem/chấm submission thuộc Course có assignment `ACTIVE`.
- **Validation**: Result chỉ nhận `PASS` hoặc `FAIL`; feedback phải có tối thiểu 10 ký tự.
- **Transaction**: Lưu review, lưu feedback và update submission status phải nằm trong một transaction hoặc unit-of-work tương đương.
- **Immutability**: MVP không cho phép sửa review sau khi submit.
- **Boundary**: Mentor Review không sở hữu luồng Learner nộp bài hoặc resubmit.

## 5. ASSUMPTIONS (giả định — cần confirm)

- Submission chỉ chứa URL/text, không lưu file lớn trực tiếp trong Mentor Review module.
- MVP coi một submission chỉ có một kết quả final; Mentor khác sẽ bị chặn nếu submission đã `REVIEWED`.
- `SubmissionReader.getSubmissionInfo(submissionId)` trả được `courseId`, `learnerId`, `status` và metadata cần thiết.
- `SubmissionUpdater.markAsReviewed(submissionId, result)` throw lỗi khi update thất bại để transaction rollback được.
- Feedback tối đa 5000 ký tự là đủ cho MVP.

## 6. OPEN QUESTIONS (câu hỏi chưa có câu trả lời)

1. Learner có được resubmit sau khi bị `FAIL` không? Nếu có, tối đa bao nhiêu lần?
2. Có cần cho Mentor sửa review sau khi submit nếu nhập nhầm không?
3. Assignment Guard nên query trực tiếp DB chung hay gọi contract/service của Admin Management?
4. `project_reviews.submission_id` có được tạo FK vật lý tới bảng của Learning module không, hay chỉ dùng logical reference?
5. Review Queue có cần pagination ngay trong MVP không?
