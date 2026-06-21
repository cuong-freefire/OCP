# CONTEXT.md - feat-curriculum-builder

## 1. PROBLEM STATEMENT

Sau khi Mentor tạo được một draft course ở feature `feat-mentor-course-draft`, Mentor cần xây dựng cấu trúc nội dung học tập của khóa học. Cấu trúc này bao gồm các phần học/chương học (`course_sections`) và các bài học (`lessons`) bên trong từng section.

Feature `feat-curriculum-builder` giải quyết nhu cầu CRUD section và lesson cho course thuộc sở hữu của Mentor hiện tại. Đây là phần lõi của Mentor Course Studio, giúp Mentor tạo curriculum trước khi thêm lesson assets, quiz, reorder hoặc submit course đi review.

Nếu không có feature này, Mentor chỉ có course metadata nhưng chưa có nội dung học tập thực tế. Các feature sau như `feat-lesson-assets-upload`, `feat-quiz-authoring`, `feat-course-reorder`, và `feat-submit-course-review` đều phụ thuộc vào section/lesson được tạo ở feature này.

Feature này phải đảm bảo Mentor chỉ CRUD section/lesson thuộc course của mình. Backend phải kiểm tra ownership thông qua `course.mentor_id === req.user.id`, không được tin courseId/sectionId/lessonId từ frontend mà bỏ qua ownership validation.

## 2. DOMAIN KNOWLEDGE

**Curriculum** là cấu trúc nội dung khóa học, gồm nhiều section và lesson theo thứ tự.

**Course Section** là một phần/chương của khóa học. Ví dụ: “Giới thiệu React”, “Component & Props”, “State & Event”. Section thuộc trực tiếp một course.

**Lesson** là bài học nằm trong section. Lesson có thể là video hoặc document theo database final. Quiz authoring nằm ở feature riêng và không được viết lan vào feature này.

**Order Index** là thứ tự hiển thị của section hoặc lesson. Trong feature này có thể tạo section/lesson với `order_index`, nhưng API reorder tổng thể thuộc feature `feat-course-reorder`.

**Editable Course** là course Mentor được phép chỉnh sửa. Theo rule final của team, Mentor chỉ được chỉnh sửa course ở trạng thái `draft` hoặc `rejected`. Course `published` bị khóa chỉnh sửa theo lỗi E1.2.

**Ownership Validation** là kiểm tra course chứa section/lesson có `mentor_id` bằng `req.user.id`. Đây là rule bắt buộc cho mọi API protected của Member B.

## 3. STAKEHOLDERS

**Mentor** là actor chính. Mentor tạo, xem, sửa và xóa section/lesson trong course của mình.

**Manager** không gọi API trong feature này, nhưng sẽ review curriculum sau khi Mentor submit course ở feature khác.

**Learner** không gọi API trong feature này. Learner chỉ học lesson thông qua Member D sau khi course được published và có access hợp lệ.

**Member A** cung cấp `AUTH_MIDDLEWARE`, JWT, roleVersion và `req.user.id`.

**Member B** sở hữu feature này và các bảng `course_sections`, `lessons`.

**Member C/D/E** không được implement trong feature này. Các module này chỉ phụ thuộc gián tiếp vào curriculum sau khi course được publish/review.

## 4. CONSTRAINTS

* Chỉ viết scope cho `feat-curriculum-builder`.
* Chỉ dùng các API thuộc feature này:

  * `POST /mentor/courses/:courseId/sections`
  * `GET /mentor/sections/:sectionId`
  * `PUT /mentor/sections/:sectionId`
  * `DELETE /mentor/sections/:sectionId`
  * `POST /mentor/sections/:sectionId/lessons`
  * `GET /mentor/lessons/:lessonId`
  * `PUT /mentor/lessons/:lessonId`
  * `DELETE /mentor/lessons/:lessonId`
* Chỉ thao tác các bảng:

  * `courses`
  * `course_sections`
  * `lessons`
* Không tạo migration mới trong feature spec này.
* Không thêm bảng mới.
* Không thêm API mới.
* Không xử lý upload asset, quiz authoring, reorder, submit review, public catalog, payment, enrollment, learning, rating hoặc manager approval.
* API phải dùng `AUTH_MIDDLEWARE` từ Member A.
* API phải yêu cầu role `MENTOR`.
* Backend phải lấy Mentor identity từ `req.user.id`.
* Backend không được nhận hoặc tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Mọi request body phải validate bằng Zod.
* Mọi thao tác section/lesson phải validate ownership thông qua course owner.
* Không được cho Mentor sửa section/lesson nếu course đang `published`.
* Chỉ cho CRUD section/lesson nếu course status thuộc `draft` hoặc `rejected`.
* Không implement hard delete section hoặc lesson khi chưa có human confirm về hành vi DELETE final.
* `course_sections` và `lessons` có quan hệ phụ thuộc/cascade; xóa section có thể xóa lessons và dữ liệu curriculum phụ thuộc.
* DELETE section/lesson phải tuân theo `API_CATALOG.md` và `database.md` final; endpoint tồn tại không đồng nghĩa đã được phép tự chọn hard delete.
* Vì database final hiện không có `deleted_at` hoặc status soft-delete cho `course_sections`/`lessons`, implementation DELETE phải dừng để human confirm trước khi dùng hard delete hoặc cascade.
* Không được dùng delete cascade để reorder, cleanup, chuẩn hóa `order_index`, hoặc xử lý dữ liệu tạm.
* Reorder thuộc `feat-course-reorder`, không thuộc feature này.
* Error response không được leak stack trace, secret, JWT, cookie hoặc query nội bộ.

## 5. ASSUMPTIONS

* `course_sections` thuộc trực tiếp `courses` thông qua `course_id`.
* `lessons` thuộc trực tiếp `course_sections` thông qua `section_id`.
* `lessons.type` tuân theo database final, không tự thêm type ngoài tài liệu.
* Quiz authoring dùng bảng `quizzes` và `quiz_questions`, nằm ở feature `feat-quiz-authoring`, không nằm trong feature này.
* API final có endpoint DELETE section/lesson, nhưng database final không có `deleted_at` hoặc status soft-delete cho hai bảng này; đây là điểm bắt buộc human confirm trước implementation.
* Reorder toàn course thuộc feature `feat-course-reorder`. Feature này chỉ xử lý CRUD đơn lẻ.
* Nếu không gửi `order_index`, service có thể đặt `order_index` tiếp theo trong cùng course/section để tiện UX, miễn không tạo conflict với feature reorder.

## 6. OPEN QUESTIONS

* Human chọn hành vi final nào cho DELETE section: từ chối khi còn dữ liệu phụ thuộc, bổ sung contract soft-delete trong một thay đổi được duyệt riêng, hay cho phép hard delete/cascade có xác nhận rõ?
* Human chọn hành vi final nào cho DELETE lesson khi database final không có `deleted_at`/status soft-delete?
* Khi tạo section/lesson, `order_index` do frontend gửi hay backend tự tính thứ tự tiếp theo?
* Course ở trạng thái `pending_review` có được xem section/lesson bằng Mentor API không, dù không được sửa không?

