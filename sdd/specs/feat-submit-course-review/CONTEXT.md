# CONTEXT.md - feat-submit-course-review

## 1. PROBLEM STATEMENT

Sau khi Mentor tạo course draft, xây dựng curriculum, thêm lesson assets, tạo quiz/questions và sắp xếp lại nội dung, Mentor cần gửi course cho Manager review. Feature `feat-submit-course-review` giải quyết bước cuối trong luồng Mentor Course Studio: submit course đang ở trạng thái `draft` hoặc `rejected` để tạo bản review snapshot trong `course_revisions`.

Điểm quan trọng của feature này là Manager không review dữ liệu live đang thay đổi trực tiếp. Khi Mentor submit, hệ thống phải tạo snapshot đầy đủ của course tại thời điểm submit, bao gồm course metadata, sections, lessons, lesson assets, quizzes và quiz questions. Snapshot này được lưu vào `course_revisions.snapshot_data` để Member E dùng trong Manager Approval flow.

Feature này cũng export hàm `canEditCourse(userId, courseId)` cho Member E. Hàm này giúp kiểm tra course có thuộc Mentor đó không và course có đang ở status cho phép edit/submit hay không.

Feature này không xử lý Manager publish/reject. Manager publish/reject thuộc Member E.

## 2. DOMAIN KNOWLEDGE

**Submit Review** là hành động Mentor gửi course cho Manager xem xét. Sau khi submit, course/revision chuyển sang trạng thái `pending_review`.

**Course Revision** là bản snapshot của course tại thời điểm submit. Trong database final, bảng `course_revisions` lưu `course_id`, `revision_num`, `status`, `reject_comment`, `snapshot_data`, `created_at`.

**snapshot_data** là dữ liệu JSON chứa toàn bộ nội dung cần Manager review, bao gồm metadata course, danh sách sections, lessons, lesson assets, quizzes và quiz questions.

**Rejected Course** là course đã bị Manager reject trước đó. Mentor được phép chỉnh sửa course ở status `rejected` và submit lại.

**Published Course Lock** là rule E1.2/E1.4: course đã `published` không được submit lại trực tiếp qua feature này.

**canEditCourse(userId, courseId)** là integration contract do Member B export cho Member E. Hàm này trả true khi course thuộc `userId` và course status thuộc `draft` hoặc `rejected`.

**Manager Approval** là phần của Member E. Member E dùng snapshot từ `course_revisions` để publish hoặc reject. Feature này chỉ tạo pending review snapshot, không approve/publish/reject.

## 3. STAKEHOLDERS

**Mentor** là actor chính. Mentor submit course của mình cho Manager review.

**Member A** cung cấp `AUTH_MIDDLEWARE`, JWT, roleVersion và `req.user.id`.

**Member B** sở hữu feature này, bảng `course_revisions`, và export `canEditCourse()`.

**Member E** phụ thuộc vào feature này để lấy pending review/revision và thực hiện publish/reject.

**Manager** không gọi API trong feature này, nhưng là người dùng downstream của dữ liệu revision được tạo.

**Learner** không gọi API trong feature này và không thấy course đang pending review.

**Member C/D** không được implement trong feature này.

## 4. CONSTRAINTS

* Chỉ viết scope cho `feat-submit-course-review`.
* Chỉ dùng API thuộc feature này:

  * `POST /mentor/courses/:courseId/submit-review`
* Export integration contract:

  * `canEditCourse(userId, courseId)`
* Không thêm API mới.
* Không tạo migration mới.
* Không sửa database.
* Không thêm bảng mới.
* Không xử lý Manager publish/reject.
* Không xử lý public catalog.
* Không xử lý payment/enrollment.
* Không xử lý learner learning flow.
* Không xử lý learner quiz submission.
* Không xử lý rating/feedback.
* Không xử lý Admin user management.
* Endpoint phải dùng `AUTH_MIDDLEWARE` từ Member A.
* Endpoint phải yêu cầu role `MENTOR`.
* Backend phải lấy Mentor identity từ `req.user.id`.
* Backend không được nhận hoặc tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Chỉ cho submit nếu course tồn tại, thuộc Mentor hiện tại, và status thuộc `draft` hoặc `rejected`.
* Không cho submit course có status `published`.
* Không cho submit course có status `pending_review`.
* Không cho submit course có status `archived`.
* Submit phải tạo `course_revisions` record với status `pending_review`.
* Submit phải tạo `snapshot_data` đầy đủ curriculum.
* Error response không được leak stack trace, secret, JWT, cookie hoặc query nội bộ.

## 5. ASSUMPTIONS

* Course mới được tạo ở feature `feat-mentor-course-draft`.
* Curriculum, lesson assets, quiz và quiz questions đã được tạo ở các feature trước.
* `course_revisions.snapshot_data` lưu dạng JSON.
* `revision_num` tăng dần theo từng course.
* Sau submit, course status được chuyển sang `pending_review` theo contract final của team.
* Nếu course đang `rejected`, Mentor submit lại sẽ tạo `course_revisions` record mới với `revision_num` tăng dần để giữ lịch sử.
* Submit thành công phải update `course.status = pending_review` trong cùng transaction tạo revision.
* Nếu tạo revision hoặc update course status thất bại, transaction rollback toàn bộ.
* `reject_comment` được Member E ghi khi reject, không được feature này tự tạo.
* Manager publish/reject sẽ dùng revision pending review do feature này tạo.
* `canEditCourse()` chỉ kiểm tra quyền sở hữu và status editable, không thực hiện publish/reject.

## 6. OPEN QUESTIONS

* Có cần yêu cầu course phải có ít nhất 1 section và 1 lesson trước khi submit review không?
* Có cần yêu cầu quiz/question hợp lệ trước khi submit không, hay Manager sẽ reject nếu nội dung thiếu?
* Snapshot không có quiz hoặc asset có được xem là hợp lệ để submit không?

