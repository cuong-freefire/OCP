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
  - Drill-down xem số liệu chi tiết của từng khóa học (Metrics Detail) thông qua các API nội bộ.
  - Xem báo cáo chi tiết hệ thống: doanh thu, ghi danh, danh sách khóa học.
- **Admin**:
  - Xem Dashboard hệ thống tổng quan (Macro stats: doanh thu toàn sàn, số lượng học viên, số lượng mentor, tổng số khóa học).
  - Xem báo cáo hệ thống chi tiết (Báo cáo doanh thu, Báo cáo ghi danh, Báo cáo khóa học).

---

## 3. Functional Requirements (EARS Notation)

### Manager Dashboard & Course Metrics

- **WHEN** Manager hoặc Admin yêu cầu dashboard bằng GET `/manager/dashboard`, **THE hệ thống SHALL** trả về:
  1. Tổng doanh thu hệ thống (đồng, kiểu `BIGINT`).
  2. Tổng số học viên hoạt động (active enrollments).
  3. Đánh giá trung bình (average rating) của toàn bộ khóa học.
  4. Danh sách 5 khóa học bán chạy nhất (revenue & enrollment counts).
- **WHEN** Manager truy vấn số liệu chi tiết của một khóa học (Metrics Detail), **THE hệ thống SHALL** gọi các endpoint nội bộ của các phân hệ khác (bằng token dịch vụ hoặc JWT phân quyền MANAGER/ADMIN):
  1. `GET /internal/courses/:courseId/stats` (Member C) để lấy số active enrollments và doanh thu tích lũy.
  2. `GET /internal/courses/:courseId/rating-stats` (Member D) để lấy rating trung bình và danh sách phản hồi ẩn danh.
  *(Ghi chú: Frontend của Manager sẽ gọi trực tiếp các API này để hiển thị dữ liệu chi tiết, không tạo API mới đầu cuối của Member E để tuân thủ Modular Monolith E4.1).*

### Admin & Manager Reports (Báo cáo Hệ thống)

- **WHEN** Admin hoặc Manager yêu cầu xem báo cáo doanh thu bằng GET `/admin/reports/revenue`, **THE hệ thống SHALL** trả về danh sách doanh thu phân bổ theo từng khóa học và theo thời gian (hỗ trợ query filters: `startDate`, `endDate`, `courseId`).
- **WHEN** Admin hoặc Manager yêu cầu xem báo cáo ghi danh bằng GET `/admin/reports/enrollments`, **THE hệ thống SHALL** trả về danh sách số lượt ghi danh mới theo thời gian và theo khóa học.
- **WHEN** Admin hoặc Manager yêu cầu xem báo cáo danh sách khóa học bằng GET `/admin/reports/courses`, **THE hệ thống SHALL** trả về danh sách toàn bộ khóa học kèm theo trạng thái (`published`, `rejected`, `draft`, `archived`), số lượt học viên đăng ký, tổng doanh thu mang lại và thông tin Mentor sở hữu.
*(Ghi chú: Các API này được gán nhãn `/admin/reports/*` theo API Catalog nhưng chấp nhận truy cập từ cả tài khoản có role ADMIN hoặc MANAGER để phục vụ báo cáo vận hành).*

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

### Thống kê Báo cáo Doanh thu Hệ thống
- **Given** Một Admin hoặc Manager đã đăng nhập hợp lệ.
- **When** Gọi GET `/admin/reports/revenue` với filter ngày.
- **Then** Hệ thống trả về danh sách doanh thu phân bổ chính xác dạng `BIGINT` cho các giao dịch thành công trong khoảng thời gian yêu cầu.

---

## 8. Out of Scope

- Không hỗ trợ tải xuống (export) báo cáo dạng file Excel, PDF, CSV trong Sprint này (chỉ hiển thị trên giao diện Web).
- Không xây dựng biểu đồ dự báo doanh thu tự động bằng AI hoặc các mô hình phân tích nâng cao.
- **API Dashboard riêng cho Admin**: Admin Dashboard sẽ tái sử dụng giao diện và dữ liệu tổng hợp từ Manager Dashboard (`GET /manager/dashboard`) và các báo cáo hệ thống, không phát triển API `GET /admin/dashboard` riêng biệt để tuân thủ 66 APIs chuẩn.
- **Báo cáo Mentor Performance độc lập**: Dữ liệu hiệu suất Mentor được tích hợp trực tiếp trong báo cáo danh sách khóa học và doanh thu, không tách thành API riêng.
