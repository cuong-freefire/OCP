# Shared Context — Ngữ cảnh chia sẻ & hợp đồng giao tiếp

Dự án Online Course Platform (OCP) được chia thành nhiều phân hệ độc lập nhưng có liên kết nghiệp vụ chặt chẽ. Tài liệu này mô tả flow tổng thể, ownership dữ liệu và các contract giao tiếp giữa module để mỗi feature spec có cùng nền ngữ cảnh.

## 1. System Flow

1. `Guest` đăng ký, xác thực email và đăng nhập.
2. `Guest` hoặc `Learner` browse Course và xem Course Detail.
3. `Learner` mua Paid Course hoặc enroll Free Course.
4. Payment/Enrollment xác nhận thanh toán và tạo enrollment.
5. `Learner` học lesson, làm quiz và nộp final project.
6. `Mentor` review final project với kết quả `PASS` hoặc `FAIL` kèm feedback.
7. `Admin` quản lý user, mentor assignment, reports và vận hành hệ thống.

## 2. Module Ownership

| Member | Module | Trọng tâm | Owner Database Tables |
| --- | --- | --- | --- |
| AnhND | Auth, Email, Profile | Đăng nhập, JWT, xác thực email, hồ sơ người dùng | `users`, `refresh_tokens`, `email_verifications`, `password_reset_tokens` |
| Nam | Course Catalog, Content | Khóa học, category, section, lesson | `courses`, `categories`, `course_sections`, `lessons` |
| CuongLH | Payment, Enrollment | Thanh toán VNPAY, ghi danh, quyền truy cập khóa học | `orders`, `payments`, `enrollments` |
| Đức | Learning, Quiz, Project | Học bài, quiz tự chấm, nộp final project | `lesson_progress`, `course_progress`, `quizzes`, `quiz_submissions`, `project_submissions` |
| Tiến | Mentor, Admin, Reports | Quản trị, phân công Mentor, review, báo cáo | `mentor_assignments`, `project_reviews`, `mentor_feedbacks` |

## 3. Cross-Module Contracts

Các module không được truy cập tùy tiện vào dữ liệu nội bộ của nhau. Khi cần dữ liệu ngoài ownership, module phải dùng contract/adapter đã thống nhất.

### 3.1 Course Access Contract

`canAccessCourse(userId, courseId) -> boolean`

- **Provider**: Payment/Enrollment module.
- **Consumers**: Course Catalog, Learning.
- **Purpose**: Xác định Learner có quyền xem nội dung paid lesson, học lesson, làm quiz hoặc nộp project hay không.

### 3.2 Mentor Assignment Contract

`isMentorAssignedToCourse(mentorId, courseId) -> boolean`

- **Provider**: Admin/Mentor module.
- **Consumers**: Mentor Review, Learning nếu cần hỏi đáp Mentor trong tương lai.
- **Purpose**: Chặn Mentor xem hoặc chấm submission ngoài Course được phân công.

### 3.3 Enrollment Success Contract

`Event: Payment SUCCESS -> Enrollment CREATED`

- **Provider**: Payment/Enrollment module.
- **Consumers**: Auth/Email, Learning, Reports.
- **Purpose**: Gửi email ghi danh, unlock course learning dashboard và cập nhật dữ liệu báo cáo.

### 3.4 Report Reader Contracts

- `getRevenueSummary(startDate, endDate, granularity)`.
- `getUserStats(startDate, endDate)`.
- `getCourseStats(startDate, endDate)`.
- `getEnrollmentStats(startDate, endDate)`.
- `getReviewStats(startDate, endDate)`.

Reports module chỉ đọc aggregate data qua các contract này và không mutate dữ liệu nguồn.

## 4. Global Data Safety Rules

- Dữ liệu phát sinh payment/enrollment không được hard delete tùy tiện.
- Module nào sở hữu dữ liệu thì module đó quyết định schema và business meaning.
- Module ngoài chỉ được đọc qua contract đã thống nhất.
- Cross-module failure phải được map thành lỗi rõ ràng hoặc warning, không để crash dây chuyền.
