# CONTEXT.md - feat-course-reorder

## 1. PROBLEM STATEMENT

Sau khi Mentor tạo course, section, lesson, asset và quiz authoring ở các feature trước, Mentor cần khả năng sắp xếp lại thứ tự hiển thị của curriculum. Việc reorder giúp Mentor thay đổi trình tự học tập mà không phải xóa và tạo lại section/lesson.

Feature `feat-course-reorder` giải quyết API reorder cho course của Mentor thông qua endpoint `PUT /mentor/courses/:courseId/reorder`.

Đây là feature có rủi ro dữ liệu cao vì tài liệu final của team đánh dấu lỗi E3.2 là critical: khi reorder, tuyệt đối không được dùng `deleteMany` rồi `create` lại vì có thể kích hoạt cascade delete và làm mất `sections`, `lessons`, `quizzes`, `lesson_assets`. Thay vào đó, backend phải dùng transaction và update loop từng record `order_index`.

Feature này chỉ xử lý thay đổi thứ tự section/lesson. Feature này không tạo, sửa nội dung, xóa section/lesson, upload asset, tạo quiz, submit review hoặc publish course.

## 2. DOMAIN KNOWLEDGE

**Course Reorder** là hành động thay đổi thứ tự của curriculum trong một course. Reorder có thể bao gồm thứ tự section trong course và thứ tự lesson trong từng section.

**order_index** là giá trị số nguyên dùng để xác định thứ tự hiển thị của section hoặc lesson. Section có `order_index` trong phạm vi course. Lesson có `order_index` trong phạm vi section.

**Cascade Delete Risk** là rủi ro xảy ra nếu backend reorder bằng cách xóa tất cả section/lesson cũ rồi tạo lại. Vì các bảng `quizzes`, `quiz_questions`, `lesson_assets` phụ thuộc vào lesson, thao tác xóa có thể làm mất dữ liệu liên quan.

**Safe Update Loop** là cách reorder bằng cách update từng record hiện có trong transaction, chỉ thay đổi `order_index` và tuyệt đối không xóa record.

**Ownership Validation** là kiểm tra course có `mentor_id === req.user.id`. Mentor chỉ được reorder curriculum của course do mình sở hữu.

**Editable Course** là course có status cho phép Mentor chỉnh sửa. Theo rule Member B, thao tác ghi chỉ được thực hiện khi course status thuộc `draft` hoặc `rejected`. Course `published` bị khóa chỉnh sửa theo E1.2.

## 3. STAKEHOLDERS

**Mentor** là actor chính. Mentor sắp xếp lại curriculum trong course của mình.

**Member A** cung cấp `AUTH_MIDDLEWARE`, JWT, roleVersion và `req.user.id`.

**Member B** sở hữu feature này và các bảng liên quan: `courses`, `course_sections`, `lessons`, đồng thời phải bảo vệ dữ liệu phụ thuộc như `quizzes`, `quiz_questions`, `lesson_assets`.

**Member D** có thể dùng curriculum order sau khi course được published để hiển thị learning flow, nhưng không gọi API feature này.

**Manager** không gọi API trong feature này, nhưng sẽ review curriculum đã được reorder sau khi Mentor submit course ở feature/phân hệ khác.

**Learner** không gọi API trong feature này.

## 4. CONSTRAINTS

* Chỉ viết scope cho `feat-course-reorder`.
* Chỉ dùng API thuộc feature này:

  * `PUT /mentor/courses/:courseId/reorder`
* Không thêm API mới.
* Không tạo migration mới.
* Không sửa database.
* Không thêm bảng mới.
* Không tạo/sửa/xóa course metadata.
* Không tạo/sửa/xóa section content.
* Không tạo/sửa/xóa lesson content.
* Không upload asset.
* Không tạo/sửa/xóa quiz hoặc quiz question.
* Không submit course review.
* Không xử lý Manager publish/reject.
* Endpoint phải dùng `AUTH_MIDDLEWARE` từ Member A.
* Endpoint phải yêu cầu role `MENTOR`.
* Backend phải lấy Mentor identity từ `req.user.id`.
* Backend không được nhận hoặc tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Request body phải validate bằng Zod.
* Phải kiểm tra course tồn tại.
* Phải kiểm tra course thuộc Mentor hiện tại.
* Phải kiểm tra course status thuộc `draft` hoặc `rejected` trước khi reorder.
* Nếu course `published`, phải trả `COURSE_LOCKED_PUBLISHED`.
* Nếu course status không editable, phải trả `COURSE_STATUS_NOT_EDITABLE`.
* Phải áp dụng E3.2: tuyệt đối không dùng `deleteMany`, `delete`, rồi `create` lại để reorder.
* Phải dùng database transaction.
* Phải update loop từng record `order_index`.
* Nếu bất kỳ section/lesson nào trong payload không thuộc course hiện tại, toàn bộ transaction phải rollback.
* Error response không được leak stack trace, secret, JWT, cookie hoặc query nội bộ.

## 5. ASSUMPTIONS

* `course_sections` thuộc `courses` thông qua `course_id`.
* `lessons` thuộc `course_sections` thông qua `section_id`.
* Payload reorder sẽ chứa danh sách section và/hoặc lesson id cùng thứ tự mới.
* Section reorder chỉ thay đổi `course_sections.order_index`.
* Lesson reorder chỉ thay đổi `lessons.order_index` và chỉ trong section hợp lệ thuộc course hiện tại.
* Feature này không di chuyển lesson sang section khác nếu API final không quy định rõ. Nếu cần move lesson between sections, phải xác nhận human trước.
* `order_index` nên được chuẩn hóa thành số nguyên dương bắt đầu từ 1.
* Transaction nên dùng isolation level phù hợp để tránh race condition khi nhiều request reorder cùng lúc.
* Response sau reorder có thể trả curriculum order mới hoặc success message theo response convention của project.

## 6. OPEN QUESTIONS

* Payload reorder final dùng format nào: `{ sections: [...], lessons: [...] }` hay một cây nested `{ sections: [{ id, lessons: [...] }] }`?
* API reorder có cho phép chuyển lesson từ section này sang section khác không, hay chỉ đổi thứ tự lesson trong cùng section?
* Nếu payload thiếu một số section/lesson hiện có, backend giữ nguyên các item bị thiếu hay trả validation error?
* Có cần khóa optimistic concurrency bằng `updated_at` hoặc version để tránh hai Mentor tab reorder cùng lúc không?

