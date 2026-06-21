# CONTEXT.md — Feature: Platform Analytics & Reports (Member E)

# Người viết: Antigravity | Ngày: 2026-06-21

## 1. PROBLEM STATEMENT

Hệ thống OCP cần cung cấp cái nhìn tổng quan và chi tiết về hiệu suất hoạt động của nền tảng (doanh thu, lượt ghi danh, chất lượng khóa học và phản hồi từ học viên) cho Manager và Admin. Manager cần theo dõi các số liệu này để tối ưu hóa nội dung khóa học và đánh giá hiệu suất của các Mentor. Admin cần theo dõi số liệu vĩ mô toàn hệ thống để quản trị tài chính và vận hành chung.

## 2. DOMAIN KNOWLEDGE

- **Modular Monolith Data Boundaries (Lỗi E4.1):** Để đảm bảo tính đóng gói dữ liệu và hiệu năng của hệ thống, Module Analytics & Reports không được phép query trực tiếp database của các module khác (như bảng `payments`, `enrollments` của Member C hoặc bảng `ratings`, `feedbacks` của Member D). Mọi dữ liệu tổng hợp phải được truy xuất thông qua các contract service được định nghĩa rõ ràng.
- **Service-to-Service Authorization:** Các API nội bộ giữa các module (ví dụ: `/internal/courses/:courseId/stats` và `/internal/courses/:courseId/rating-stats`) yêu cầu xác thực bằng `SERVICE_TOKEN` dưới dạng Bearer token để đảm bảo an toàn, hoặc phải chạy trực tiếp qua các service logic được import qua Dependency Injection (DI).
- **Financial Precision (Lỗi E3.3):** Mọi trường liên quan đến tiền tệ (doanh thu, tổng tiền) bắt buộc phải sử dụng kiểu dữ liệu `BIGINT` (lưu trữ theo đơn vị đồng) để tránh sai lệch làm tròn số thập phân.
- **No Learner PII:** Các báo cáo và dashboard chỉ trả về dữ liệu tổng hợp (aggregate data: counts, sums, averages). Tuyệt đối không được đính kèm thông tin cá nhân định danh (PII) của học viên trong kết quả trả về để bảo vệ quyền riêng tư.

## 3. STAKEHOLDERS

- **Manager:** Theo dõi dashboard tổng quan, drill-down số liệu của từng khóa học, và xuất các báo cáo doanh thu, chất lượng khóa học, hiệu suất của Mentor.
- **Admin:** Xem dashboard hệ thống tổng quan để quản lý doanh thu toàn sàn và số lượng người dùng.
- **Member C & D (Providers):** Cung cấp các thống kê thô cho Member E thông qua các contract service.

## 4. CONSTRAINTS

- **Data Access Restrictions:** Tuyệt đối không import Prisma của các module khác hoặc query trực tiếp bảng không sở hữu. Chỉ sử dụng các API/Service contract được cung cấp [share_context.md].
- **Auth Security:** Yêu cầu token hợp lệ (Manager hoặc Admin JWT) thông qua cookie httpOnly và kiểm tra `role_version` trên mọi endpoint (E2.2).

## 5. ASSUMPTIONS

- Các module Payment (Member C) và Learning (Member D) đã triển khai sẵn các endpoint thống kê nội bộ `/internal/*` hoặc các service tương ứng trả về tổng doanh thu, số enrollment hoạt động, rating trung bình và feedback count.

## 6. OPEN QUESTIONS

1. Biểu đồ doanh thu trên dashboard nên hiển thị theo chu kỳ thời gian nào (hàng ngày, hàng tuần, hàng tháng)?
2. Có cần hỗ trợ xuất báo cáo ra file Excel/CSV ngay trong Sprint này không?
   - *Đề xuất:* MVP chỉ hiển thị dữ liệu trực quan trên giao diện bảng của Web App, tính năng xuất file sẽ được đưa vào Out of Scope.
