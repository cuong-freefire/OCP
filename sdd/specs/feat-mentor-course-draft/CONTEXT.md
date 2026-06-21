# CONTEXT.md - feat-mentor-course-draft

## 1. PROBLEM STATEMENT

Mentor cần một khu vực Course Studio để tạo và quản lý khóa học của chính mình trước khi xây dựng curriculum chi tiết và gửi Manager duyệt. Feature `feat-mentor-course-draft` giải quyết phần nền tảng đầu tiên của Member B: tạo khóa học ở trạng thái `draft`, xem danh sách khóa học của Mentor hiện tại, xem chi tiết khóa học, chỉnh sửa metadata khi khóa học còn được phép sửa, và soft delete/archive khóa học theo API final của team.

Nếu không có feature này, các feature sau của Member B như `feat-curriculum-builder`, `feat-lesson-assets-upload`, `feat-quiz-authoring`, `feat-course-reorder`, và `feat-submit-course-review` sẽ không có `courseId` hợp lệ để thao tác.

Feature này phải đảm bảo Mentor chỉ thao tác được với course do mình sở hữu. Mentor không được gửi `mentorId` từ frontend để giả mạo ownership. Backend phải lấy Mentor identity từ JWT thông qua `req.user.id`.

## 2. DOMAIN KNOWLEDGE

**Mentor Course Studio** là khu vực cho Mentor tạo và quản lý khóa học của mình. Trong scope feature này, Studio chỉ xử lý metadata course, chưa xử lý sections, lessons, quizzes, reorder hoặc submit review.

**Draft Course** là khóa học mới tạo, chưa được public ra catalog và chưa được Manager duyệt. Course ở trạng thái `draft` có thể được Mentor owner chỉnh sửa.

**Rejected Course** là khóa học đã bị Manager reject ở vòng review trước đó. Theo rule final của team, Mentor được phép chỉnh sửa course ở trạng thái `rejected` để sửa lỗi trước khi submit lại ở feature khác.

**Published Course** là khóa học đã được Manager publish. Theo lỗi E1.2, course đã `published` bị khóa chỉnh sửa metadata qua `PUT /mentor/courses/:courseId` để tránh ảnh hưởng dữ liệu đã bán/enroll.

**Archived Course** là course bị soft delete/archive. API `DELETE /mentor/courses/:courseId` không hard delete record khỏi database, mà cập nhật trạng thái course sang `archived`.

**Price BIGINT** nghĩa là giá tiền lưu bằng số nguyên đơn vị đồng, không dùng decimal. Payload tạo/sửa course phải validate price là số nguyên lớn hơn 0 theo quyết định final 100% paid courses.

## 3. STAKEHOLDERS

**Mentor** là actor chính. Mentor tạo course draft, xem course của mình, sửa metadata course khi status cho phép, và archive course nếu cần.

**Manager** không dùng API trong feature này, nhưng sẽ review course metadata ở feature/phân hệ khác. Dữ liệu course được tạo ở feature này là đầu vào cho review flow.

**Learner** không dùng API trong feature này. Learner chỉ thấy course khi course đã được publish qua module khác.

**Member A** cung cấp `AUTH_MIDDLEWARE`, JWT, role check và `req.user.id`.

**Member B** sở hữu feature này và bảng `courses`.

**Member C/D/E** không được implement trong feature này. Các module này chỉ phụ thuộc gián tiếp vào course đã được tạo ở đây.

## 4. CONSTRAINTS

* Chỉ viết scope cho `feat-mentor-course-draft`.
* Chỉ dùng các API thuộc feature này:

  * `POST /mentor/courses`
  * `GET /mentor/courses`
  * `GET /mentor/courses/:courseId`
  * `PUT /mentor/courses/:courseId`
  * `DELETE /mentor/courses/:courseId`
* Chỉ thao tác bảng `courses`.
* Không tạo migration mới trong feature spec này.
* Không thêm bảng mới.
* Không thêm API mới.
* Không xử lý section, lesson, quiz, asset, reorder, submit review, publish/reject, payment, enrollment, learning hoặc rating.
* API phải dùng `AUTH_MIDDLEWARE` từ Member A.
* API phải yêu cầu role `MENTOR`.
* Backend phải lấy `mentor_id` từ `req.user.id`.
* Backend không được nhận hoặc tin `mentorId`, `mentor_id`, `userId` từ request body/query.
* Mọi request body phải validate bằng Zod.
* Error response không được leak stack trace, secret, JWT, cookie hoặc query nội bộ.
* `PUT /mentor/courses/:courseId` phải áp dụng E1.2:

  * Nếu `course.status = published` thì trả lỗi `COURSE_LOCKED_PUBLISHED`.
  * Chỉ cho sửa nếu `course.status` thuộc `draft` hoặc `rejected`.
* `DELETE /mentor/courses/:courseId` là soft delete/archive, không hard delete.

## 5. ASSUMPTIONS

* `courses.status` có các trạng thái chính: `draft`, `pending_review`, `rejected`, `published`, `archived`.
* Course mới tạo mặc định có `status = draft`.
* `title` và `price` là field bắt buộc khi tạo course.
* `price` phải là số nguyên lớn hơn 0, lưu bằng BIGINT theo đơn vị đồng.
* `description`, `thumbnail`, `category`, `level` là metadata course; nếu được gửi lên thì phải validate theo schema, nhưng feature này không tự tạo bảng category.
* Thumbnail trong feature này chỉ được xử lý như URL/string metadata. Cách upload thumbnail không nằm trong scope feature này.
* API list course nên có pagination mặc định để tránh response quá lớn.
* Soft delete course dùng `status = archived`, không thêm `deleted_at` nếu database final không quy định.
* Các course đã archived không được hiển thị trong public catalog; public catalog thuộc Member C.

## 6. OPEN QUESTIONS

* Có cần chặn archive course đang `pending_review` không, hay chỉ cho archive khi course ở `draft` hoặc `rejected`?
* Response list course nên dùng pagination kiểu `page/pageSize` hay `limit/offset` để đồng bộ với frontend?
* Khi course đã `archived`, Mentor có được restore lại thành `draft` không? Nếu có thì restore sẽ là feature riêng hay thuộc Manager/Admin?

