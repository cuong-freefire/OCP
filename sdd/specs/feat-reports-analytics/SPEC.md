# Feature Specification: Platform Analytics & Reports (Member E)

**Feature Branch**: `feat/reports-analytics`

**Created**: 2026-06-21

**Status**: Draft

---

## 1. Context & Goal

Cung cấp công cụ thống kê, tổng hợp dữ liệu toàn diện cho Manager và Admin để theo dõi sức khỏe và hiệu suất của nền tảng OCP. Dashboard và báo cáo phải đảm bảo an toàn thông tin (không expose PII) và tuân thủ chặt chẽ ranh giới dữ liệu của kiến trúc Modular Monolith (E4.1, E4.4).

---

## 2. Actors & Roles

- **Manager**:
  - Xem Dashboard tổng quan mọi khóa học.
  - Drill-down xem số liệu chi tiết của từng khóa học (Metrics Detail).
  - Xem báo cáo chi tiết: doanh thu, danh sách khóa học, hiệu suất của các Mentor.
- **Admin**:
  - Xem Dashboard hệ thống tổng quan (Macro stats: doanh thu toàn sàn, số lượng học viên, số lượng mentor, tổng số khóa học).
  - Xem báo cáo hệ thống chi tiết (Báo cáo doanh thu, Báo cáo ghi danh).

---

## 3. Functional Requirements (EARS Notation)

### Manager Dashboard & Course Metrics

- **WHEN** Manager yêu cầu dashboard bằng GET `/manager/dashboard`, **THE hệ thống SHALL** trả về:
  1. Tổng doanh thu hệ thống (đồng, kiểu `BIGINT`).
  2. Tổng số học viên hoạt động (active enrollments).
  3. Đánh giá trung bình (average rating) của toàn bộ khóa học.
  4. Danh sách 5 khóa học bán chạy nhất (revenue & enrollment counts).
- **WHEN** Manager click vào một khóa học cụ thể bằng GET `/manager/courses/:courseId/metrics`, **THE hệ thống SHALL** gọi các internal service để trả về:
  1. Lượt đăng ký hoạt động (active enrollments).
  2. Doanh thu tích lũy của khóa học đó.
  3. Rating trung bình và các nhận xét gần đây (đã ẩn danh thông tin PII của học viên).
  4. Tỷ lệ hoàn thành bài kiểm tra (quiz completion rate).

### Manager Reports

- **WHEN** Manager yêu cầu xem báo cáo doanh thu bằng GET `/manager/reports/revenue`, **THE hệ thống SHALL** trả về danh sách doanh thu phân bổ theo từng khóa học và theo thời gian (hỗ trợ query filters: `startDate`, `endDate`, `courseId`).
- **WHEN** Manager yêu cầu xem báo cáo danh sách khóa học bằng GET `/manager/reports/courses`, **THE hệ thống SHALL** trả về danh sách toàn bộ khóa học kèm theo trạng thái (`published`, `rejected`, `draft`, `archived`), số bài học, số section và số lượt học viên đăng ký.
- **WHEN** Manager yêu cầu xem báo cáo hiệu suất Mentor bằng GET `/manager/reports/mentors`, **THE hệ thống SHALL** trả về danh sách Mentor kèm theo tổng số khóa học đã tạo, tổng số học viên đăng ký và tổng doanh thu mang lại.

### Admin Dashboard & System Reports

- **WHEN** Admin yêu cầu dashboard hệ thống bằng GET `/admin/dashboard` hoặc GET `/admin/reports/overview`, **THE hệ thống SHALL** trả về số liệu vĩ mô:
  1. Tổng doanh thu toàn sàn (đồng, `BIGINT`).
  2. Tổng số tài khoản học viên (active learners).
  3. Tổng số tài khoản Mentor.
  4. Tổng số khóa học đã xuất bản.

---

## 4. Non-functional Requirements

- **Data Privacy**: Tuyệt đối không được trả về thông tin cá nhân định danh của học viên (như email, tên thật, số điện thoại) trong các API dashboard/reports. Chỉ hiển thị định danh UUID ẩn danh nếu cần thiết.
- **Precision**: Kiểu dữ liệu số tiền doanh thu và giá trị giao dịch phải là `BIGINT` (chống sai lệch số thập phân - E3.3).
- **Performance**: P95 thời gian phản hồi cho các API dashboard và reports phải < 500ms thông qua việc tối ưu hóa index và cache dữ liệu tổng hợp nếu cần thiết.
- **Security Check**: Middleware bắt buộc kiểm tra `role_version` trong JWT để thu hồi quyền ngay lập tức nếu tài khoản bị Admin block hoặc đổi quyền (E2.2).

---

## 5. Data Model

Báo cáo và Dashboard không sở hữu bảng cơ sở dữ liệu riêng, mà đọc dữ liệu tổng hợp thông qua các service của các module khác:
- **Member C Services:** Cung cấp stats doanh thu (`payments.amount`) và số lượt ghi danh (`enrollments.user_id`).
- **Member D Services:** Cung cấp stats đánh giá (`ratings.rating_value`), phản hồi (`feedbacks`) và điểm quiz (`quiz_submissions.passed`).
- **Member A Services:** Cung cấp thông tin danh sách users/mentors.

---

## 6. Error Handling

- **WHERE** User có role `MENTOR` hoặc `LEARNER` cố gắng gọi các API dashboard/reports của Manager/Admin, **THE hệ thống SHALL** chặn request và trả về HTTP 403 Forbidden.
- **WHERE** Dữ liệu thống kê từ các module liên kết bị lỗi hoặc không phản hồi, **THE hệ thống SHALL** trả về giá trị mặc định (ví dụ: `revenue = 0`, `avgRating = 0`) thay vì làm crash toàn bộ API của Dashboard.

---

## 7. Acceptance Criteria (Given-When-Then)

### Thống kê Dashboard cho Manager
- **Given** Một Manager đã đăng nhập hợp lệ.
- **When** Gọi GET `/manager/dashboard`.
- **Then** Hệ thống trả về tổng doanh thu dạng `BIGINT`, số active enrollments, trung bình rating và danh sách top khóa học chính xác, không leak thông tin PII.

### Thống kê Dashboard cho Admin
- **Given** Một Admin đã đăng nhập hợp lệ.
- **When** Gọi GET `/admin/dashboard`.
- **Then** Hệ thống trả về tổng doanh thu toàn sàn, tổng số học viên, mentor, khóa học thành công.

---

## 8. Out of Scope

- Không hỗ trợ tải xuống (export) báo cáo dạng file Excel, PDF, CSV trong Sprint này (chỉ hiển thị trên giao diện Web).
- Không xây dựng biểu đồ dự báo doanh thu tự động bằng AI hoặc các mô hình phân tích nâng cao.
