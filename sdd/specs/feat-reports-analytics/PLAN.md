# Implementation Plan: Platform Analytics & Reports (feat-reports-analytics)

**Version:** 1.0.0 | **Owner:** Member E | **Status:** DRAFT  
**Generated:** 2026-06-21 | **From:** SPEC.md v1.0.0

---

## 1. ARCHITECTURAL APPROACH

### Design Philosophy
- **Modular Monolith Encapsulation (E4.1):** Member E sẽ không thực hiện query trực tiếp vào bảng của module khác. Thay vào đó, Member E Service sẽ sử dụng Dependency Injection để tiêm (inject) các Exported Service của Member C (Payment & Enrollment) và Member D (Learning Experience) để nhận thông tin thống kê tổng hợp.
- **Service-to-Service Contracts:**
  - `PaymentService` cung cấp hàm `getCoursePaymentStats(courseId)` và `getTotalRevenue()`.
  - `LearningService` cung cấp hàm `getCourseRatingStats(courseId)` và `getQuizSubmissionsStats(courseId)`.
  - `UserService` cung cấp hàm `getUserCountsByRole()`.
- **Financial Precision (E3.3):** Mọi phép cộng dồn doanh thu được tính toán bằng kiểu dữ liệu `BIGINT` ở tầng database/repository của Payment và trả về dưới dạng chuỗi hoặc số nguyên lớn để Express controller trả về cho Client.

---

## 2. COMPONENTS

### Backend Components

#### A. Service Integrations (`backend/src/services/manager.service.js`)
- `getManagerDashboardStats()`: Tổng hợp số liệu tổng quan từ `PaymentService`, `LearningService` và `UserService`.
- `getRevenueReport(filters)`: Thống kê doanh thu theo bộ lọc thời gian và khóa học (đọc từ `PaymentService`).
- `getEnrollmentsReport(filters)`: Thống kê lượt ghi danh theo thời gian (đọc từ `EnrollmentService`).
- `getCoursesReport(filters)`: Tổng hợp trạng thái và số liệu của các khóa học (gọi `CourseService` kết hợp stats).

#### B. Controller & Routes (`backend/src/controllers/manager.controller.js`, `backend/src/api/manager.routes.js`)
- Maps các API chuẩn theo Catalog:
  - `GET /manager/dashboard` (chấp nhận MANAGER/ADMIN) -> `getManagerDashboardStats`
  - `GET /admin/reports/revenue` (chấp nhận MANAGER/ADMIN) -> `getRevenueReport`
  - `GET /admin/reports/enrollments` (chấp nhận MANAGER/ADMIN) -> `getEnrollmentsReport`
  - `GET /admin/reports/courses` (chấp nhận MANAGER/ADMIN) -> `getCoursesReport`
- Đăng ký middleware xác thực phân quyền MANAGER / ADMIN và check `role_version` (E2.2).

### Frontend Components

- **ManagerDashboard.jsx:** UI hiển thị biểu đồ doanh thu, số học viên, danh sách khóa học bán chạy. Giao diện thiết kế theo style glassmorphism thời thượng. Tái sử dụng cho cả giao diện Admin Dashboard tổng quan.
- **CourseMetricsDetail.jsx:** UI chi tiết số liệu của một khóa học cụ thể. Frontend gọi trực tiếp các API `/internal/courses/:courseId/stats` và `/internal/courses/:courseId/rating-stats` (các API này chấp nhận role MANAGER/ADMIN).
- **AdminReports.jsx:** Trang lọc và hiển thị báo cáo dạng bảng chuyên nghiệp cho 3 loại báo cáo (Doanh thu, Ghi danh, Khóa học) hỗ trợ phân trang và lọc theo khoảng thời gian.

---

## 3. DATA FLOW

### Quy trình tổng hợp dữ liệu báo cáo

```
Manager / Admin
  │
  ├─► GET /manager/dashboard  (có JWT cookie)
  │
  ▼
manager.controller.getDashboard
  │
  ▼
manager.service.getManagerDashboardStats
  │
  ├─► Gọi PaymentService.getTotalRevenue()  ──► Trả về doanh thu dạng BIGINT
  ├─► Gọi EnrollmentService.getActiveCount() ──► Trả về số active learners
  ├─► Gọi LearningService.getPlatformRatings() ──► Trả về avg rating & feedback count
  │
  ▼
Tổng hợp kết quả ──► Trả về JSON cho Client (đã ẩn danh PII)
```

---

## 4. DEPENDENCIES

- **Member C Services (`PaymentService`, `EnrollmentService`):** Cung cấp các hàm thống kê tài chính và lượt ghi danh.
- **Member D Services (`LearningService`):** Cung cấp các hàm thống kê rating, feedback, và quiz completion.
- **Member A Services (`UserService`):** Cung cấp các hàm thống kê số lượng tài khoản theo vai trò.

---

## 5. RISKS & MITIGATIONS

### Risk: Nghẽn database khi tổng hợp báo cáo thời gian thực (MEDIUM)
- **Scenario:** Khi hệ thống có hàng triệu bản ghi payment/enrollment, việc thực hiện query COUNT và SUM thời gian thực trên mỗi lượt load dashboard có thể làm chậm database.
- **Mitigation:**
  - Thiết kế các câu lệnh query tối ưu sử dụng đúng các index đã được định nghĩa (`idx_payments_status_date`, `idx_enrollments_user_status`).
  - Trong tương lai, có thể áp dụng cơ chế caching (Redis) hoặc bảng thống kê tổng hợp cập nhật định kỳ (materialized views).

---

## 6. QUESTIONS FOR HUMAN

1. Chúng ta có cần lọc doanh thu theo các cổng thanh toán khác ngoài VNPAY không?
   - *Đề xuất:* Hiện tại hệ thống chỉ hỗ trợ thanh toán qua VNPAY, nên báo cáo doanh thu sẽ mặc định lấy toàn bộ giao dịch VNPAY thành công.
