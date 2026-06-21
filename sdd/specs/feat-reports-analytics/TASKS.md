# Tasks: Platform Analytics & Reports (feat-reports-analytics)

| ID | Task | Files | Est | Deps | Spec Refs | Done When |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Định nghĩa các Zod schema cho query filters của báo cáo | `backend/src/validators/manager.validator.js` | 1h | - | Section 4 | Schema validate chính xác các filter `startDate`, `endDate`, `courseId` |
| T002 | Thiết lập contract tích hợp gọi chéo module qua DI (E4.4) | `backend/src/services/manager.service.js` | 3h | - | Section 4 & [share_context.md] | Service tiêm thành công các service provider của Member C và Member D |
| T003 | Implement logic tính toán metrics của một khóa học chi tiết | `backend/src/services/manager.service.js` | 3h | T002 | Section 3 | Hàm trả về doanh thu (BIGINT), active enrolls, avg rating của 1 khóa |
| T004 | Implement API Manager Dashboard tổng hợp số liệu | `backend/src/services/manager.service.js`, `backend/src/controllers/manager.controller.js` | 3h | T003 | Section 3 | API `/manager/dashboard` trả về đúng số liệu tổng hợp không leak PII |
| T005 | Implement các API báo cáo chi tiết cho Manager | `backend/src/services/manager.service.js`, `backend/src/controllers/manager.controller.js` | 3h | T001, T003 | Section 3 | Các API `/manager/reports/*` trả về dữ liệu doanh thu, course, mentor |
| T006 | Implement API Admin Dashboard & System Reports | `backend/src/services/manager.service.js`, `backend/src/controllers/manager.controller.js` | 2h | T002 | Section 3 | API `/admin/dashboard` và `/admin/reports/overview` trả về stats macro |
| T007 | Gắn Middleware bảo vệ quyền ADMIN/MANAGER và role_version | `backend/src/api/manager.routes.js` | 2h | T004-T006 | Section 4 | Chặn truy cập trái phép của các vai trò MENTOR, LEARNER |
| T008 | Viết integration tests cho dashboard và reports | `backend/tests/manager_reports.test.js` | 3h | T007 | Section 7 | Chạy node:test kiểm thử dữ liệu báo cáo trả về đầy đủ và chính xác |
| T009 | Xây dựng màn hình Manager Dashboard & Course Metrics Detail | `frontend/src/pages/manager/ManagerDashboard.jsx`, `frontend/src/pages/manager/CourseMetricsDetail.jsx` | 4h | T007 | Section 2.2 (Plan) | Giao diện hiển thị biểu đồ, chỉ số trực quan, glassmorphism đẹp mắt |
| T010 | Xây dựng màn hình Manager Reports & Admin Dashboard | `frontend/src/pages/manager/ManagerReports.jsx`, `frontend/src/pages/admin/AdminDashboard.jsx` | 4h | T007 | Section 2.2 (Plan) | Bảng báo cáo lọc mượt mà, Admin dashboard hiển thị đầy đủ số liệu |
