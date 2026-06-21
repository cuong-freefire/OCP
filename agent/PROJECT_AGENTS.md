# PROJECT_AGENTS.md — "Bách khoa toàn thư" dự án OCP

# Phiên bản: 1.0 | Trạng thái: ACTIVE | Công cụ: OpenAI Codex

## 1. TL;DR (Tóm tắt nhanh trong 60 giây)

> Dự án: OCP (Online Course Platform) — Nền tảng học lập trình trực tuyến lấy cảm hứng từ F8.
> Backend: NodeJS, MySQL, Prisma. Frontend: React + Bootstrap.
> **Mục tiêu 1:** Quản lý **Learning Path** (mở khóa bài học theo trình tự hoàn thành).
> **Mục tiêu 2:** Đảm bảo **toàn vẹn thanh toán** (không nộp tiền = không có quyền truy cập).
> **Mục tiêu 3:** **Hybrid Grading** (Auto-grading cho bài tập nhỏ; Mentor chấm Final Project).

## 2. KIẾN TRÚC HỆ THỐNG

### Các Service chính

| Service |       Trách nhiệm            | Port |    Repo/Path     |
|---------|------------------------------|------|------------------|
| ocp-web | Giao diện Frontend React     | 3000 |        /frontend |
| ocp-api | Backend NodeJS API (Monolith)| 4000 |         /backend |
|         |  xử lý toàn bộ logic         |      |                  |

### Flow đăng ký và Thanh toán

- Learner -> ocp-web -> ocp-api (verify JWT) -> Payment Gateway(VNPAY)
  -> ocp-api(Verify) -> MySQL (Unlock Course) -> Learner

### Flow Nộp bài và Chấm điểm cho các bài tập(Auto grading)

- Learner -> ocp-web (Submit) -> ocp-api (Grading Logic) -> MySQL(Store Result)
  -> ocp-web (Feedback/Unlock Next)

## 3. QUYẾT ĐỊNH KIẾN TRÚC QUAN TRỌNG (ADR)

### ADR-001: Dùng Backend Monolith `ocp-api`

Quyết định: Backend NodeJS `ocp-api` xử lý toàn bộ logic chính: auth, course, payment, enrollment, mentor, grading, comment, report.
Lý do: Dự án đang ở giai đoạn OCP/MVP, monolith dễ triển khai, dễ debug và phù hợp với team nhỏ.
Trade-off: Khi hệ thống lớn, backend có thể phình to. Cần chia code theo module nghiệp vụ ngay từ đầu.

### ADR-002: Backend là nguồn quyết định phân quyền

Quyết định: Mọi quyền truy cập phải được kiểm tra ở backend, không tin frontend.
Lý do: Frontend chỉ dùng để ẩn/hiện UI. Người dùng vẫn có thể gọi API trực tiếp nếu backend không kiểm tra quyền.
Rule: Admin quản trị hệ thống; Mentor chỉ thao tác trong course được gán; Learner chỉ học course có quyền truy cập; Guest chỉ xem nội dung public.

### ADR-003: Dùng RBAC cho 4 actor chính

Quyết định: Hệ thống dùng role-based access control cho `Admin`, `Mentor`, `Learner`, `Guest`.
Lý do: Các actor có phạm vi quyền khác nhau rõ ràng.
Trade-off: Mỗi API quan trọng phải khai báo và kiểm tra role tương ứng để tránh cấp quyền nhầm.

### ADR-004: Course access dựa trên Enrollment/Entitlement

Quyết định: Learner chỉ được học course khi có quyền học hợp lệ.
Lý do: Mục tiêu chính là toàn vẹn thanh toán: không thanh toán hoặc không enroll thì không được truy cập paid course.
Rule: Free course có thể enroll miễn phí; paid course/package chỉ unlock sau khi backend xác nhận quyền học.

### ADR-005: Tích hợp VNPAY qua Backend, không gọi trực tiếp từ Frontend

Quyết định: Frontend chỉ gửi yêu cầu mua; `ocp-api` tạo payment request, verify kết quả và unlock course.
Lý do: Nếu frontend tự quyết định thanh toán thành công thì dễ bị giả mạo.
Rule: Chỉ backend được cập nhật trạng thái payment/enrollment sau khi verify dữ liệu từ VNPAY.

### ADR-006: Payment phải xử lý idempotent

Quyết định: Callback/return từ VNPAY phải được xử lý sao cho gọi nhiều lần vẫn không tạo dữ liệu trùng.
Lý do: Payment gateway có thể gửi lại callback hoặc user refresh lại trang kết quả.
Rule: Một giao dịch thành công chỉ được unlock course/enrollment một lần.

### ADR-007: Dùng MySQL làm database chính

Quyết định: MySQL lưu dữ liệu chính của hệ thống.
Lý do: Dữ liệu có quan hệ rõ ràng: user, role, course, lesson, enrollment, payment, comment, submission, grading.
Trade-off: Cần thiết kế index tốt cho các bảng lớn như payment, enrollment, comment, submission.

### ADR-008: Dùng Prisma cho CRUD nghiệp vụ thông thường

Quyết định: Prisma được dùng cho phần lớn CRUD như user, course, lesson, enrollment, mentor assignment.
Lý do: Prisma phù hợp với NodeJS + MySQL, giúp code rõ ràng và giảm lỗi query thủ công.
Trade-off: Với report hoặc query tổng hợp phức tạp, có thể dùng raw SQL có parameter để tối ưu và tránh SQL injection.

### ADR-009: Mentor được gán theo từng Course

Quyết định: Mentor không có quyền mặc định trên tất cả course, mà phải được Admin gán vào từng course cụ thể.
Lý do: Mentor chỉ support và chấm final project trong phạm vi course được giao.
Rule: API trả lời comment hoặc chấm bài của Mentor phải kiểm tra `mentor-course assignment`.

### ADR-010: Comment gắn với Lesson

Quyết định: Comment/Q&A được gắn với từng lesson trong course.
Lý do: Learner cần hỏi đúng ngữ cảnh bài học; Mentor cần trả lời theo lesson cụ thể.
Rule: Learner phải có quyền học course mới được comment; Mentor phải được gán vào course mới được trả lời.

### ADR-011: Dùng Hybrid Grading

Quyết định: Bài tập nhỏ có thể auto-grade; final project do Mentor chấm `pass/fail`.
Lý do: Auto-grading phù hợp với bài nhỏ có đáp án rõ; final project cần đánh giá thủ công.
Rule: Kết quả chấm phải lưu vào database và backend quyết định việc pass/fail hoặc unlock bước tiếp theo.

### ADR-012: Admin là người quản lý Mentor

Quyết định: Chỉ Admin được tạo tài khoản Mentor, quản lý Mentor và gán Mentor vào course.
Lý do: Mentor có quyền support và chấm bài, nên không cho user tự nâng quyền thành Mentor.
Trade-off: Quy trình phụ thuộc vào Admin nhưng giảm rủi ro cấp quyền sai.

### ADR-013: Report Management nằm trong `ocp-api` ở giai đoạn hiện tại

Quyết định: Các report cho Admin được xử lý trong backend `ocp-api`.
Lý do: Kiến trúc hiện tại là monolith, dữ liệu nằm trong MySQL nên làm report trong cùng backend là đơn giản và thực tế nhất.
Trade-off: Một số report như doanh thu, số learner theo course, tỷ lệ hoàn thành, số final project đã chấm có thể cần query nhiều bảng. Khi dữ liệu lớn, cần tối ưu index/query.

### ADR-014: Frontend React + Bootstrap chỉ chịu trách nhiệm UI

Quyết định: `ocp-web` dùng React + Bootstrap để xây giao diện cho Guest, Learner, Mentor, Admin.
Lý do: React phù hợp xây UI theo component; Bootstrap giúp dựng giao diện nhanh và thống nhất.
Rule: Frontend có thể route guard và ẩn/hiện nút theo role, nhưng không được là nơi quyết định quyền thật sự.

### ADR-015: Auth dùng JWT và password hash bằng bcrypt

Quyết định: Hệ thống dùng JWT để xác thực API; password phải được hash bằng `bcrypt` trước khi lưu database.
Lý do: JWT phù hợp với backend API stateless; `bcrypt` giúp bảo vệ password nếu database bị lộ.
Rule:

- Không lưu plain password.
- Không trả `password` hoặc `passwordHash` ra frontend.
- JWT phải chứa thông tin tối thiểu cần thiết như `userId` và `role`.
- Backend phải kiểm tra JWT ở các API cần đăng nhập.

### ADR-016: Final Project Submission dùng link Git hoặc link demo

Quyết định: Learner nộp final project bằng link Git repository hoặc link demo có chứa code/sản phẩm để Mentor kiểm tra.
Lý do: Final project thường cần Mentor xem cả source code và kết quả chạy thực tế. Dùng link giúp tránh phải xử lý upload file, giới hạn dung lượng và lưu trữ file trên server.
Rule:

- Backend phải kiểm tra learner có quyền học course trước khi nhận submission.
- Submission phải gắn với learner, course và final project tương ứng.
- Mentor chỉ được chấm submission thuộc course mình được Admin gán.
- Kết quả chấm lưu là `PASS` hoặc `FAIL`, kèm feedback nếu có.

## 4. PATTERNS ĐƯỢC SỬ DỤNG

### Request Validation Pattern

Tất cả request body/query/params quan trọng phải được validate bằng `Zod` trước khi vào service.

Rule:

- Không tin dữ liệu từ frontend.
- Validate ở middleware hoặc đầu controller trước khi gọi service.
- Request sai format trả về `VALIDATION_ERROR`.
- Không để dữ liệu chưa validate đi vào Prisma query hoặc business logic.

### Layered Architecture

Backend `ocp-api` chia logic theo các lớp rõ ràng:
  
- `routes/controllers`: Nhận request, gọi service, trả response.
- `services`: Xử lý business logic.
- `repositories`: Truy cập database qua Prisma.
- `middlewares`: Xử lý auth, RBAC, validate request.
- `prisma`: Schema, migration, database client.

Rule:

- Controller không viết business logic phức tạp.
- Service không gọi Prisma trực tiếp nếu đã có repository.
- Repository chỉ xử lý database query, không xử lý logic nghiệp vụ lớn.

### Repository Pattern

Tất cả thao tác database nên đi qua repository tương ứng.

Ví dụ:

- `userRepository`
- `courseRepository`
- `lessonRepository`
- `paymentRepository`
- `enrollmentRepository`
- `mentorAssignmentRepository`
- `submissionRepository`
- `commentRepository`
- `reportRepository`

Lý do:

- Dễ test service.
- Dễ đổi query mà không ảnh hưởng controller.
- Giữ Prisma query tập trung một chỗ.

### Service Pattern

Business logic nằm trong service.

Ví dụ:

- `authService`: login, register, verify token.
- `courseService`: tạo/sửa/xóa course, kiểm tra access.
- `paymentService`: tạo payment, verify VNPAY, unlock course.
- `mentorService`: gán mentor, kiểm tra mentor assignment.
- `gradingService`: xử lý auto-grade và mentor grading.
- `reportService`: tổng hợp dữ liệu cho Admin.

Rule:

- Payment unlock course phải nằm trong service, không đặt ở controller.
- Mentor chấm bài phải kiểm tra assignment trong service.
- Learner học lesson phải kiểm tra enrollment/access trong service.

### Middleware Pattern

Các middleware chính:

- `authMiddleware`: kiểm tra JWT.
- `roleMiddleware`: kiểm tra role Admin/Mentor/Learner.
- `courseAccessMiddleware` hoặc service check: kiểm tra learner có quyền học course.
- `mentorCourseMiddleware` hoặc service check: kiểm tra mentor có được gán vào course.

Rule:

- Frontend route guard chỉ hỗ trợ UX.
- Backend middleware/service mới là nơi quyết định quyền thật sự.

### Transaction Pattern

Các nghiệp vụ thay đổi nhiều bảng phải dùng transaction để đồng bộ, trong Prisma dùng `$transaction`.

Áp dụng cho:

- Payment thành công -> cập nhật payment status -> tạo enrollment.
- Admin xóa/disable course -> cập nhật course status và các dữ liệu liên quan nếu cần.
- Mentor chấm final project -> lưu grading result -> cập nhật submission status.

Lý do:

- Tránh trạng thái nửa vời, ví dụ payment thành công nhưng course chưa unlock.

### Idempotency Pattern cho Payment

VNPAY callback/return có thể bị gọi nhiều lần.

Rule:

- Mỗi `transactionId` hoặc `paymentRef` chỉ xử lý thành công một lần.
- Nếu payment đã `SUCCESS`, không tạo enrollment trùng.
- Không unlock course nếu verify từ VNPAY thất bại.

### Frontend Component Pattern

Frontend `ocp-web` dùng React component theo role và chức năng.

Gợi ý chia:

- `components/common`
- `components/course`
- `components/admin`
- `components/mentor`
- `components/learner`
- `pages`
- `services` hoặc `api`
- `hooks`
- `routes`

Rule:

- API call nên gom vào `services/api`, không viết rải rác trong component.
- Component chỉ xử lý UI state, không tự quyết định quyền nghiệp vụ.

## 5. ERROR HANDLING

### Backend Error Handling

Backend trả lỗi theo format thống nhất.

Format đề xuất:

{
  "success": false,
  "message": "Course not found",
  "code": "COURSE_NOT_FOUND"
}

Các nhóm lỗi chính:

- `AUTH_REQUIRED`: Chưa đăng nhập.
- `FORBIDDEN`: Không có quyền.
- `COURSE_NOT_FOUND`: Không tìm thấy khóa học.
- `PAYMENT_FAILED`: Thanh toán thất bại.
- `PAYMENT_INVALID`: Dữ liệu thanh toán không hợp lệ.
- `ENROLLMENT_REQUIRED`: Learner chưa có quyền học course.
- `MENTOR_NOT_ASSIGNED`: Mentor chưa được gán vào course.
- `SUBMISSION_NOT_FOUND`: Không tìm thấy bài nộp.
- `VALIDATION_ERROR`: Dữ liệu request không hợp lệ.

Rule:

- Không throw lỗi raw ra response.
- Không trả stack trace cho frontend.
- Log lỗi kỹ ở backend, trả message ngắn gọn cho client.

## 6. NHỮNG GÌ KHÔNG NÊN LÀM

### Không để Frontend quyết định quyền truy cập

Sai:

- Ẩn nút học ở frontend rồi cho rằng user không thể học.
- Cho frontend gửi `isPaid: true` hoặc `role: Admin`.

Đúng:

- Backend kiểm tra JWT, role, enrollment, mentor assignment.

### Không unlock course chỉ vì frontend báo thanh toán thành công

Sai:

- Frontend nhận redirect từ VNPAY rồi tự gọi API unlock course.

Đúng:

- Backend verify kết quả từ VNPAY trước.
- Chỉ backend cập nhật payment/enrollment.

### Không cho Mentor thao tác ngoài course được gán

Sai:

- Mentor có role `Mentor` là được chấm mọi final project.

Đúng:

- Mentor phải được Admin assign vào course đó.

### Không xóa cứng dữ liệu quan trọng

Không nên xóa cứng:

- User
- Course
- Payment
- Enrollment
- Submission
- Grading result

Nên dùng:

- `status`
- `isDeleted`
- `deletedAt`

Lý do:

- Cần giữ lịch sử học tập, thanh toán và report.

### Không viết query report tùy tiện trong controller

Report có thể cần join nhiều bảng và aggregate dữ liệu.

Rule:

- Query report nằm trong `reportRepository` hoặc `reportService`.
- Nếu dùng raw SQL thì phải parameterized.

## 7. FILE STRUCTURE QUAN TRỌNG

### Backend `/backend`

/backend
  /src
    /api            # Entry points của API. Chỉ định nghĩa endpoint và map tới Controller tương ứng.
    /controllers    # Nhận Request, Validate Input, gọi Service, trả Response. TỐI KỴ: Không viết business logic hoặc gọi DB ở đây.
    /services       # Chứa TOÀN BỘ Business Logic (Core). TỐI KỴ: Không gọi trực tiếp Prisma, bắt buộc phải qua Repository.
    /repositories   # Data Access Layer. NƠI DUY NHẤT trong dự án được phép import Prisma và tương tác với MySQL.
    /middlewares    # Cổng gác chặn request: Xử lý xác thực (JWT Auth), phân quyền (RBAC) và Global Error Catching. Xử lý auth, role, global error.
                      Auth dùng JWT lưu trong httpOnly Cookie, KHÔNG dùng server session.
    /utils          # Hàm tiện ích dùng chung (format data, response builder, custom API error). Không chứa logic nghiệp vụ.
    /config         # Nơi khởi tạo biến môi trường (env) và cấu hình 3rd-party (VNPAY, Cloudinary, Nodemailer...).
  /prisma
    schema.prisma   # Nguồn sự thật duy nhất (Source of Truth) cho Data Model. Agent KHÔNG tự ý sửa nếu chưa được human cho phép.
    /migrations     # Lịch sử thay đổi DB. Agent TUYỆT ĐỐI KHÔNG xóa hoặc sửa code các file migration cũ.

Rule:

- Database access đi qua repository.
- Business logic nằm trong service.
- Controller chỉ nhận request và trả response.
- Middleware xử lý auth, role và error chung.
- Auth dùng JWT trong httpOnly Cookie, không dùng server session.
- Backend đọc token từ req.cookies, FE không được tự lưu token trong localStorage/sessionStorage.
- FE request phải bật withCredentials để browser tự gửi cookie.

### Frontend `/frontend`

/frontend
  /src
    /api         # NƠI DUY NHẤT cấu hình Axios Client và Interceptor. Mọi request phải qua đây để tự động xử lý JWT/Cookie và Refresh Token.
    /components  # UI Components dùng chung (Button, Card, CourseItem). TỐI KỴ: Đây là Dumb Components, TUYỆT ĐỐI KHÔNG gọi API trực tiếp tại đây.
    /pages       # Các màn hình chính (HomePage, CourseDetail). Nơi lắp ráp components và gọi hooks để lấy data.
    /routes      # Cổng gác URL: Định nghĩa mapping giữa Path và Page. NƠI DUY NHẤT bọc Protected/Private Routes để phân quyền UI.
    /layouts     # Bố cục khung của app (Header, Sidebar, Footer). Các Pages sẽ được render bên trong Layout này.
    /hooks       # Chứa TOÀN BỘ frontend business logic & data fetching (useAuth, useCourse). Giữ cho UI components luôn sạch sẽ.
    /utils       # Các hàm tiện ích thuần túy (pure functions) như formatDate, formatCurrency. Không chứa React Hook hay State.

Rule:

- Page gọi API thông qua `api/*`.
- Component không gọi endpoint trực tiếp nếu logic dùng lại nhiều nơi.
- Role-based UI chỉ để cải thiện trải nghiệm, không thay thế backend permission.
- Dùng withCredentials: true để browser tự gửi httpOnly Cookie.
- Không lưu JWT trong localStorage/sessionStorage, KHÔNG tự gắn Authorization header khi dùng Cookie.

## 8. TESTING ƯU TIÊN

Ưu tiên test các luồng có rủi ro cao:

1. Payment

- Thanh toán thành công thì tạo enrollment.
- Callback gọi lại nhiều lần không tạo enrollment trùng.
- Payment verify fail thì không unlock course.

1. Course Access

- Learner chưa mua không xem được paid lesson.
- Learner đã enroll xem được lesson.
- Guest không truy cập API cần đăng nhập.

1. Mentor Permission

- Mentor được gán course thì trả lời comment/chấm bài được.
- Mentor không được gán course thì bị chặn.

1. Grading

- Final project lưu đúng trạng thái `PASS` hoặc `FAIL`.
- Learner thấy kết quả chấm của mình.
- Mentor không chấm được submission ngoài course được gán.

1. Admin

- Admin tạo/sửa course.
- Admin tạo mentor.
- Admin gán mentor vào course.
- Admin xem report.

## 9. LESSONS LEARNED

- Payment unlock course phải verify từ VNPAY ở backend, không tin frontend redirect.
- Mentor có role `Mentor` chưa đủ; mọi thao tác mentor phải kiểm tra course assignment.
- Course access phải kiểm tra bằng enrollment/access record, không chỉ check `isPaid` ở frontend.

## 10. CURRENT SPRINT NOTES

- Focus: TBD
- Blocked: TBD
- Next: TBD
