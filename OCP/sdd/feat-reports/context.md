# CONTEXT.md — Reports & Analytics

# Người viết: @Tiến | Ngày: 2026-05-27

## 1. PROBLEM STATEMENT

Dữ liệu vận hành của OCP nằm rải rác ở nhiều module: Auth quản lý user, Course/Catalog quản lý khóa học, Payment/Enrollment quản lý doanh thu và ghi danh, Learning/Mentor Review quản lý tiến độ và kết quả chấm bài. Admin cần một dashboard tập trung để xem nhanh tình hình kinh doanh và vận hành mà không phải truy cập từng module riêng.

Pain chính là aggregation nặng và dễ lỗi dây chuyền: nếu một nguồn dữ liệu chậm hoặc timeout, toàn bộ dashboard không được phép crash. Reports phải giúp Admin nhìn được dữ liệu còn lại, đồng thời báo rõ phần nào đang gián đoạn.

## 2. DOMAIN KNOWLEDGE

- **Data Aggregation**: Gom dữ liệu từ nhiều nguồn độc lập thành một response phục vụ dashboard/report.
- **Graceful Degradation**: Khi một adapter lỗi hoặc timeout, dashboard vẫn trả dữ liệu phần khác kèm `warnings[]`.
- **SUCCESS Payment**: Chỉ payment/order trạng thái `SUCCESS` được tính vào revenue.
- **Read-only Report**: Reports chỉ đọc và tổng hợp, không thay đổi trạng thái dữ liệu nguồn.
- **P95 Latency**: 95% request dashboard phải phản hồi dưới ngưỡng performance đã chốt.
- **Cache TTL**: Dữ liệu report có thể stale trong thời gian ngắn nếu Team Lead duyệt cache.

## 3. STAKEHOLDERS

- **Admin**: Người xem dashboard, revenue report, course/user stats và mentor performance.
- **System/Operations**: Cần report ổn định, không tạo tải quá mức lên DB hoặc module khác.
- **Payment module owner**: Cung cấp dữ liệu revenue hợp lệ.
- **Auth module owner**: Cung cấp user counts/growth.
- **Course/Enrollment/Learning module owners**: Cung cấp course, enrollment, progress và submission stats.
- **Product Owner/Team Lead**: Chốt KPI, range thời gian mặc định, cache và export.

## 4. CONSTRAINTS (ràng buộc không thể thay đổi)

- **Security**: Chỉ Admin được xem report; mọi API `/admin/dashboard` và `/admin/reports/*` phải kiểm tra `role === ADMIN`.
- **Performance**: Dashboard API phải hướng tới P95 < 800ms trong điều kiện adapter bình thường.
- **Read-only**: Reports không được mutate dữ liệu ở bất kỳ module nào.
- **Resilience**: Mỗi adapter phải có timeout và lỗi adapter phải được map thành warning thay vì crash toàn bộ dashboard.
- **Boundary**: Reports không tự định nghĩa logic payment hợp lệ ngoài contract của Payment module.
- **Validation**: Query params như `startDate`, `endDate`, `granularity` phải validate trước khi xử lý.

## 5. ASSUMPTIONS (giả định — cần confirm)

- Range mặc định khi Admin mở dashboard là 30 ngày gần nhất.
- Query range tối đa là 12 tháng để bảo vệ performance.
- Redis cache TTL 10 phút được chấp nhận cho MVP nếu cần tối ưu tải.
- Export Excel/PDF không nằm trong MVP trừ khi Product Owner yêu cầu rõ.
- Conversion rate được tính từ Payment/Enrollment contract, không tự suy đoán từ view count.

## 6. OPEN QUESTIONS (câu hỏi chưa có câu trả lời)

1. Dashboard mặc định dùng 7 ngày, 30 ngày hay tháng hiện tại?
2. Revenue có cần trừ refund/chargeback hay chỉ sum `SUCCESS`?
3. Conversion rate định nghĩa là payment/enrollment, enrollment/user hay công thức khác?
4. Redis cache có bắt buộc trong MVP không?
5. Export Excel/PDF có nằm trong scope sprint này không?
