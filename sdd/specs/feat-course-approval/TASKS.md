# Tasks: Course Approval & Operations (feat-course-approval)

| ID | Task | Files | Est | Deps | Spec Refs | Done When |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Tạo Zod schema validate reject comment | `backend/src/validators/manager.validator.js` | 1h | - | Section 6 | Schema validate được comment reject (độ dài >= 10) |
| T002 | Xây dựng Repository thực thi thao tác lưu lịch sử duyệt | `backend/src/repositories/manager.repository.js` | 2h | - | Section 5 | Repository hỗ trợ ghi nhận `course_reviews` và `review_comments` |
| T003 | Implement API lấy danh sách revisions pending và chi tiết snapshot | `backend/src/services/manager.service.js`, `backend/src/controllers/manager.controller.js` | 3h | T002 | Section 3 | API trả về danh sách revisions pending và nội dung snapshot_data |
| T004 | Xây dựng logic ngăn chặn self-approval (E2.3) và restore curriculum (E1.1) | `backend/src/services/manager.service.js` | 4h | T002, T003 | Section 3 & 6 | Chặn tự duyệt bằng canEditCourse, restore curriculum trong transaction Serializable |
| T005 | Implement API Reject revision kèm comment bắt buộc | `backend/src/services/manager.service.js`, `backend/src/controllers/manager.controller.js` | 2h | T001, T002 | Section 3 & 6 | Reject revision chuyển status thành `rejected` và lưu comment thành công |
| T006 | Implement API Disable & Unpublish khóa học vận hành | `backend/src/services/manager.service.js`, `backend/src/controllers/manager.controller.js` | 2h | T002 | Section 3 | Cập nhật status khóa học thành `archived` và `draft` thành công |
| T007 | Gắn Middleware phân quyền MANAGER và kiểm tra role_version (E2.2) | `backend/src/api/manager.routes.js` | 2h | T003-T006 | Section 4 | Router chặn mọi request không phải Manager hoặc mismatch role_version |
| T008 | Viết tests cho quy trình duyệt và vận hành khóa học | `backend/tests/manager_approval.test.js` | 3h | T007 | Section 7 | Chạy node:test kiểm thử các kịch bản duyệt/reject/disable đều pass |
| T009 | Xây dựng giao diện Course Approval Queue & Review Detail | `frontend/src/pages/manager/CourseApprovalQueue.jsx`, `frontend/src/pages/manager/CourseReviewDetail.jsx` | 4h | T007 | Section 2.2 (Plan) | Màn hình hiển thị danh sách, review curriculum read-only, có nút Approve/Reject modal |
| T010 | Implement Repository và Service cho Admin User Management | `backend/src/repositories/manager.repository.js`, `backend/src/services/manager.service.js` | 3h | - | Section 3 | Thêm hàm findUsers, findUserById, updateUser, blockUser vào Service/Repo |
| T011 | Implement API Admin User Management (list, detail, block) | `backend/src/controllers/manager.controller.js`, `backend/src/api/admin.routes.js` | 2h | T010 | Section 3 | API `/admin/users` hỗ trợ list, get detail, update và block user thành công |
| T012 | Viết tests cho Admin User Management | `backend/tests/admin_users.test.js` | 2h | T011 | Section 7 | Chạy node:test kiểm thử các kịch bản Admin list/get/block user thành công |
| T013 | Xây dựng giao diện Admin User Management | `frontend/src/pages/admin/AdminUserManagement.jsx` | 3h | T011 | Section 2.2 (Plan) | Giao diện hiển thị danh sách user, lọc theo role/status, nút Block/Unblock |

