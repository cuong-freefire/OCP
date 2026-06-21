# CONTEXT.md - feat-lesson-assets-upload

## 1. PROBLEM STATEMENT

Sau khi Mentor tạo được course, section và lesson trong `feat-curriculum-builder`, Mentor cần khả năng upload tài nguyên học tập cho lesson, ví dụ video hoặc document. Tuy nhiên, backend không nên nhận file upload trực tiếp vì file media có dung lượng lớn, dễ gây tải nặng server và phức tạp về lưu trữ.

Feature `feat-lesson-assets-upload` giải quyết phần cấp Cloudinary upload signature cho Mentor. Frontend sẽ dùng signature này để upload trực tiếp lên Cloudinary. Backend chỉ chịu trách nhiệm xác thực Mentor, kiểm tra lesson ownership, kiểm tra course status còn editable, tạo signed upload parameters an toàn, và không expose Cloudinary secret ra frontend.

Đây là feature nhỏ nhưng quan trọng về security. Nếu thiếu ownership validation, Mentor A có thể xin upload signature cho lesson thuộc course của Mentor B. Vì vậy feature này phải áp dụng lỗi E2.1 Lesson Ownership Validation.

## 2. DOMAIN KNOWLEDGE

**Lesson Asset** là tài nguyên gắn với lesson, ví dụ video hoặc document. Database final của Member B có bảng `lesson_assets` để lưu metadata asset như `lesson_id`, `cloudinary_public_id`, `asset_type`, `created_at`.

**Cloudinary Upload Signature** là chữ ký do backend tạo bằng Cloudinary API secret. Frontend dùng signature này để upload trực tiếp lên Cloudinary mà không biết API secret.

**Signed Upload Flow** là luồng trong đó backend cấp chữ ký, frontend upload file trực tiếp lên Cloudinary, sau đó metadata asset có thể được lưu theo contract/module liên quan. Feature này chỉ viết scope cho endpoint cấp signature, không nhận multipart file và không upload file qua backend.

**Ownership Validation** là kiểm tra lesson thuộc section, section thuộc course, và `course.mentor_id === req.user.id`.

**Editable Course** là course đang ở trạng thái Mentor được phép chỉnh sửa. Theo rule của Member B, các thao tác làm thay đổi nội dung lesson chỉ được thực hiện khi course status thuộc `draft` hoặc `rejected`. Course `published` bị khóa chỉnh sửa theo E1.2.

## 3. STAKEHOLDERS

**Mentor** là actor chính. Mentor yêu cầu upload signature cho lesson thuộc course của mình.

**Member A** cung cấp `AUTH_MIDDLEWARE`, JWT, roleVersion và `req.user.id`.

**Member B** sở hữu feature này, bảng `lesson_assets`, và các bảng liên quan để check ownership: `courses`, `course_sections`, `lessons`.

**Cloudinary** là external storage provider. Backend tạo signature, frontend upload trực tiếp lên Cloudinary.

**Manager** không gọi API trong feature này, nhưng Manager có thể review lesson/asset ở module approval sau khi course được submit.

**Learner** không gọi API trong feature này. Learner access asset thuộc Member D/C flow sau khi course published và có enrollment/access.

## 4. CONSTRAINTS

* Chỉ viết scope cho `feat-lesson-assets-upload`.
* Chỉ dùng API thuộc feature này:

  * `GET /mentor/lessons/:lessonId/upload-signature`
* Không thêm API mới.
* Không tạo migration mới.
* Không sửa database.
* Không thêm bảng mới.
* Không xử lý upload file trực tiếp qua backend.
* Không xử lý multipart/form-data.
* Không xử lý learner signed URL download/view.
* Không xử lý public catalog, payment, enrollment, learning, quiz submission, manager publish/reject hoặc admin management.
* Endpoint phải dùng `AUTH_MIDDLEWARE` từ Member A.
* Endpoint phải yêu cầu role `MENTOR`.
* Backend phải lấy Mentor identity từ `req.user.id`.
* Backend không được nhận hoặc tin `mentorId`, `mentor_id`, hoặc `userId` từ request body/query.
* Phải validate `lessonId` và query params bằng Zod.
* Phải kiểm tra lesson tồn tại.
* Phải kiểm tra lesson thuộc course của Mentor hiện tại.
* Phải kiểm tra course status còn editable trước khi cấp signature.
* Phải áp dụng E2.1 Lesson Ownership Validation.
* Không được expose Cloudinary API secret.
* Error response không được leak stack trace, Cloudinary secret, JWT, cookie hoặc query nội bộ.

## 5. ASSUMPTIONS

* `lessons` thuộc `course_sections` thông qua `section_id`.
* `course_sections` thuộc `courses` thông qua `course_id`.
* Ownership được kiểm tra bằng chain: `lesson -> section -> course -> mentor_id`.
* Course chỉ được upload/update asset khi status thuộc `draft` hoặc `rejected`.
* `asset_type` tuân theo database final, ví dụ `video` hoặc `document`.
* Cloudinary credentials được lưu trong environment variables và không trả về frontend.
* Response upload signature có thời hạn ngắn thông qua timestamp.
* Frontend chịu trách nhiệm upload file trực tiếp lên Cloudinary bằng signed params.
* Feature này không tạo hoặc update `lesson_assets` record nếu API final không quy định endpoint lưu asset metadata.
* Nếu cần lưu metadata asset sau upload, việc đó phải nằm trong API final hoặc feature khác, không tự thêm endpoint trong feature này.

## 6. OPEN QUESTIONS

* Endpoint này có cần nhận query `assetType=video|document` để sinh signature theo đúng resource type không?
* Sau khi frontend upload Cloudinary thành công, metadata `cloudinary_public_id` sẽ được lưu qua endpoint nào nếu API final chưa có endpoint riêng?
* Có cần giới hạn dung lượng hoặc định dạng file ngay trong signed upload params không?
* Upload signature có nên hết hạn sau bao nhiêu giây để cân bằng bảo mật và trải nghiệm Mentor?

