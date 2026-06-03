## 1. PROBLEM STATEMENT (Tuyên bố bài toán)

Tính năng `feat-auth` cần thiết lập nền tảng xác thực, phiên làm việc và nhận diện người dùng cho OCP theo nguyên tắc backend là nguồn dữ liệu chuẩn duy nhất cho danh tính, vai trò, trạng thái tài khoản và session validity. Tính năng này là nền để các module Course, Payment, Enrollment, Learning, Mentor, Admin và Report sử dụng identity đáng tin cậy mà không tự xử lý JWT, email hoặc quyền truy cập.

Người dùng cần có các luồng xác thực chính: đăng ký học viên bằng `fullName`, `email`, `password`; xác thực email bằng OTP; đăng nhập bằng email/mật khẩu nội bộ; đăng nhập hoặc liên kết tài khoản bằng Google OAuth; duy trì phiên bằng JWT trong Cookie httpOnly; refresh/logout session; khôi phục mật khẩu bằng OTP email cho tài khoản nội bộ; thiết lập mật khẩu nội bộ đầu tiên trong ứng dụng cho người dùng chỉ có tài khoản Google; đọc thông tin người dùng hiện tại và hồ sơ cá nhân cơ bản; và được phân quyền dựa trên role từ backend.

Tính năng phải ngăn các triển khai sai hợp đồng bảo mật của OCP: không dùng `Authorization: Bearer <token>`, không lưu JWT trong `localStorage` hoặc `sessionStorage`, không để frontend quyết định `role`, `userId`, `account status`, payment/access state hoặc quyền truy cập, không lưu raw Google OAuth token, không yêu cầu người dùng nhập/dán thông tin OAuth thô, và không mở rộng đăng ký sang upload avatar/profile image.

Đầu ra của pha này chỉ là tài liệu bối cảnh tại `.sdd/specs/001-auth/context.md`. Không triển khai code, không tạo endpoint, không sửa Prisma schema, không tạo migration, không tạo UI, và không triển khai các module ngoài Auth.

## 2. DOMAIN KNOWLEDGE (Kiến thức chuyên môn / Nghiệp vụ)

- OCP là nền tảng khóa học trực tuyến. Auth bảo đảm mỗi request cần bảo vệ đều có identity, role và account status đáng tin cậy từ backend trước khi các module nghiệp vụ xử lý quyền học, thanh toán, học tập, chấm bài hoặc quản trị.
- Backend sử dụng NodeJS, JavaScript ESM, Express-style REST API, Prisma và MySQL. Frontend sử dụng React JSX, Bootstrap và Create React App (`react-scripts`).
- Backend phải theo kiến trúc `Route -> Middleware -> Controller -> Service -> Repository -> Prisma/MySQL`. Controller chỉ nhận request và trả response; service chứa business logic; repository là tầng duy nhất thao tác Prisma/MySQL.
- Auth + Email + Profile thuộc sở hữu module Member 1 - AnhND. Module khác phải dùng Auth/User contract, không tự xử lý JWT/email và không query trực tiếp bảng Auth khi không thuộc phạm vi sở hữu.
- Các bảng Auth/User cốt lõi theo thiết kế database gồm:
  - `roles`: lưu role như `ADMIN`, `LEARNER`, `MENTOR`; public registration phải lấy role từ `roles.code = "LEARNER"`.
  - `users`: lưu `name`, `email`, `avatar_url`, `password_hash`, `email_verified`, `status`, `deleted_at` và các trường hồ sơ cơ bản; không bao giờ trả `password_hash` về frontend.
  - `oauth_accounts`: ánh xạ Google identity bằng `provider = GOOGLE` và `provider_user_id = Google sub`.
  - `refresh_tokens`: lưu refresh token đã hash, phục vụ rotation/revocation; không lưu raw refresh token.
  - `email_verifications`: lưu OTP xác thực email ở dạng hash/proof cùng expiry, failed attempts, lock state và resend metadata.
  - `password_reset_tokens`: lưu OTP reset mật khẩu ở dạng hash/proof cùng expiry, failed attempts, lock state và resend metadata.
- Public learner registration nhận `fullName`, `email`, `password`; `fullName` map vào `users.name`; backend tự gán role `LEARNER`; frontend không gửi role. User local mới bắt đầu ở trạng thái chờ xác thực và không nhận session cho đến khi verify OTP thành công.
- Khi email OTP verify thành công, backend chuyển user sang `email_verified = true`, `status = active` và cấp `ocp_access_token` + `ocp_refresh_token` để người dùng đăng nhập ngay.
- Local login chỉ hợp lệ với user có `password_hash`, không bị `blocked`, chưa bị soft-delete, và có account state phù hợp. Mật khẩu nội bộ phải được hash bằng bcrypt.
- Google OAuth không thay thế bảng `users`. Backend verify Google token, sau đó tạo/link record trong `oauth_accounts`. Google-only user có thể có `users.password_hash = NULL`.
- Public forgot/reset password chỉ dành cho tài khoản local đã tồn tại và đã có `password_hash`. Google-only user không được tạo mật khẩu đầu tiên qua public reset; họ phải đăng nhập Google rồi dùng in-app set-password flow.
- Frontend Auth chỉ hỗ trợ UX và gửi request kèm cookie bằng `withCredentials: true`. Frontend guard không phải authorization thật; backend middleware/service phải kiểm tra session, role và account status.
- Payment provider và identity provider là hai khái niệm độc lập: `payments.provider = VNPAY`, còn `oauth_accounts.provider = GOOGLE`.
- Registration không nhận profile image/avatar, không upload ảnh, và có thể để `users.avatar_url = NULL`. Upload/cập nhật file ảnh hồ sơ qua `public/images` thuộc profile update feature sau, không thuộc `feat-auth`.

## 3. STAKEHOLDERS (Các bên liên quan)

- Guest: truy cập đăng ký, đăng nhập, Google login và forgot password, nhưng không có quyền gọi API protected nếu chưa có session hợp lệ.
- Learner: đăng ký tài khoản, xác thực email, đăng nhập, duy trì phiên, khôi phục mật khẩu và đọc hồ sơ cá nhân cơ bản.
- Google-only user: đăng nhập hoặc liên kết Google OAuth, sau đó có thể thiết lập mật khẩu nội bộ đầu tiên trong ứng dụng khi đã đăng nhập.
- Admin, Mentor và Learner role consumers: các vai trò và module phía sau cần role/session đáng tin cậy từ backend để phân quyền.
- Backend Auth service: chịu trách nhiệm verify identity, hash/verify password và OTP, issue/refresh/revoke cookies, kiểm tra account status, chuẩn hóa lỗi và không leak sensitive data.
- Frontend Auth UI/API client: cung cấp màn hình và trạng thái UX theo `frontend/DESIGN.md`, gọi API qua `frontend/src/api`, dùng `REACT_APP_API_BASE_URL` và `withCredentials: true`.
- SMTP/Nodemailer provider: gửi OTP xác thực email và reset mật khẩu; thiếu SMTP config không được báo thành công giả.
- Google OAuth provider: cung cấp identity claims sau khi backend verify; raw Google tokens không được lưu database hoặc logs.
- Future modules: Course, Payment, Enrollment, Learning, Mentor, Admin và Report dùng Auth/User contract thay vì tự suy luận identity từ frontend.

## 4. CONSTRAINTS (Các ràng buộc)

- Stack cố định: backend NodeJS + JavaScript ESM + Express-style REST API; frontend React + JSX + Bootstrap + CRA `react-scripts`; MySQL; Prisma; JWT trong httpOnly Cookie; bcrypt; Zod; npm.
- Không chuyển sang TypeScript, CommonJS, Vite/Next.js, ORM/database khác, Bearer-token auth hoặc provider thanh toán khác cho MVP.
- JWT chỉ được lưu trong Cookie httpOnly. Backend đọc token từ `req.cookies`. Frontend gửi request kèm cookie bằng `withCredentials: true`.
- Cookie auth MVP dùng `sameSite = "lax"`, `secure = false` ở local dev, `secure = true` ở production, và không set cookie `domain` mặc định trừ khi cấu hình deploy yêu cầu.
- Cookie names theo env contract là `ocp_access_token` và `ocp_refresh_token`, tương ứng `COOKIE_ACCESS_NAME` và `COOKIE_REFRESH_NAME`.
- Refresh token rotation/revocation nằm trong scope Auth MVP. Database chỉ lưu refresh token đã hash trong `refresh_tokens`.
- Access token expiry và refresh token expiry phải lấy từ `JWT_ACCESS_EXPIRES_IN` và `JWT_REFRESH_EXPIRES_IN`.
- CORS phải allow chính xác `FRONTEND_ORIGIN` và `credentials: true`; không dùng wildcard origin khi gửi cookie.
- MVP same-site chưa bắt buộc CSRF token. Nếu deployment cần cross-site cookie hoặc `SameSite=None`, phải bổ sung CSRF protection trước khi implement endpoint state-changing.
- Registration bắt buộc nhận `fullName`, `email`, `password`; `fullName` map vào `users.name`; backend tự gán role `LEARNER` từ `roles.code = "LEARNER"`; frontend không được gửi hoặc quyết định `role`.
- Registration không nhận `image`, `avatar`, `avatarUrl`, profile picture upload hoặc bất kỳ file upload nào; `users.avatar_url` có thể để `NULL`.
- Local password dùng bcrypt và trường `users.password_hash`. Không log password/password hash và không trả password hash qua API.
- Đăng ký tài khoản nội bộ cần xác thực email bằng OTP 6 chữ số. Không gửi token/link thô trực tiếp cho người dùng.
- Email verification OTP hết hạn sau 10 phút, cho phép thử sai tối đa 5 lần, resend cooldown 60 giây. Khi resend, OTP cũ chưa dùng phải bị vô hiệu hóa và chỉ OTP mới nhất còn hiệu lực.
- Khi xác thực email bằng OTP thành công, backend phải chuyển user sang `active`/`email_verified` và cấp cookie `ocp_access_token` + `ocp_refresh_token`.
- Reset password dùng OTP email 6 chữ số, không dùng reset token/link cho người dùng. Reset OTP hết hạn sau 10 phút, cho phép thử sai tối đa 5 lần, resend cooldown 60 giây. Khi resend, OTP cũ chưa dùng phải bị vô hiệu hóa và chỉ OTP mới nhất còn hiệu lực.
- Backend phải kiểm tra email tồn tại và là tài khoản local có `password_hash` trước khi tạo/gửi reset OTP. Không tạo reset OTP cho email không tồn tại hoặc Google-only user. Public forgot-password response phải dùng thông báo chung để tránh dò email đã đăng ký.
- Nodemailer SMTP là cơ chế gửi email Auth. Ứng dụng có thể khởi động khi thiếu SMTP config, nhưng thao tác gửi email đăng ký/khôi phục mật khẩu phải fail safely, không silently succeed.
- Google OAuth phải được backend verify trước khi tạo/link user. Không tin `email`, `name`, `avatar`, `providerUserId`, `role`, `userId`, `account status` hoặc quyền truy cập do frontend gửi.
- Google OAuth map qua `oauth_accounts.provider = GOOGLE` và `oauth_accounts.provider_user_id = Google sub`; lookup chính theo `provider + provider_user_id`, không lấy email làm định danh chính.
- Nếu Google verified email trùng user OCP hiện có và policy cho phép, backend link OAuth account vào user hiện có, không tạo user trùng email.
- Không lưu Google `id_token`, `access_token` hoặc `refresh_token` vào database hoặc logs. `oauth_accounts.metadata` nếu dùng phải là payload đã sanitize, không chứa token/secret.
- Giao diện đăng nhập Google không được yêu cầu người dùng nhập/dán thông tin OAuth thô. Nếu thiếu cấu hình Google backend, frontend phải hiển thị trạng thái an toàn là "chưa được cấu hình".
- User `blocked` hoặc có `deleted_at` phải bị từ chối khi local login và Google login. Backend là nơi quyết định account status.
- API error response phải thống nhất theo `{ success, message, code, details }` hoặc response helper tương đương. Không trả raw stack trace, Prisma/SQL raw error, secret, JWT, cookie value, password, OTP hoặc OAuth token.
- Request body/query/params quan trọng phải validate bằng Zod hoặc validator đã duyệt.
- Frontend API calls phải đi qua `frontend/src/api`; không tự gắn `Authorization: Bearer <token>`; không dùng `localStorage` hoặc `sessionStorage` để lưu JWT.
- Auth frontend phải bám `frontend/DESIGN.md` về bố cục, visual style, component style, UI states và UX. Các màn hình Auth không được tự tạo hướng thiết kế trái với design system.
- Frontend design constraints cần tôn trọng hệ màu primary indigo `#1b1938`, white canvas, warm ink `#292827`, deep-teal CTA band, spacing 8px, rounded rectangle buttons, input radius theo design token, mobile behavior dưới 768px và touch target tối thiểu 44px.
- Frontend dùng CRA env contract: `REACT_APP_API_BASE_URL`; không dùng `VITE_*`, `REACT_API_URL` hoặc biến khác cho cùng ý nghĩa.
- Backend env contract phải dùng đúng tên trong `backend/.env.example`: `PORT`, `API_PREFIX`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `AUTH_SECRET`, `COOKIE_ACCESS_NAME`, `COOKIE_REFRESH_NAME`, `COOKIE_SAME_SITE`, `COOKIE_SECURE`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `EMAIL_OTP_EXPIRES_MINUTES`, `EMAIL_OTP_MAX_FAILED_ATTEMPTS`, `EMAIL_OTP_RESEND_COOLDOWN_SECONDS`, `RESET_OTP_EXPIRES_MINUTES`, `RESET_OTP_MAX_FAILED_ATTEMPTS`, `RESET_OTP_RESEND_COOLDOWN_SECONDS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`.
- Frontend env contract phải dùng đúng tên trong `frontend/.env.example`: `PORT` và `REACT_APP_API_BASE_URL`.
- Không đọc/in giá trị thật trong `.env`, credentials, secrets, private keys hoặc API keys. Chỉ dùng `.env.example` làm hợp đồng tên biến.
- Tests sau này phải dùng setup đã duyệt: backend `node:test` + `assert` + `supertest`; frontend `node:test` cho API client/source-rule checks nhẹ. Không tự thêm test framework khác nếu chưa có approval.
- Phạm vi ngoài `feat-auth`: payment checkout, VNPAY verification, enrollment, course CRUD/content, learning progress, quiz/final project, mentor grading, admin/report dashboards, profile update và profile image upload.

## 5. ASSUMPTIONS (Các giả định)

- `.sdd/specs/001-auth/context.md` là artifact Pha 0 cho workflow Auth; `spec.md`, `plan.md` và `tasks.md` sẽ được tạo hoặc cập nhật sau dựa trên context này.
- Role `LEARNER` sẽ tồn tại trong bảng `roles` trước khi public registration chạy, thông qua seed/migration hoặc quy trình khởi tạo được spec/plan xác định.
- Backend sẽ expose REST API dưới `API_PREFIX`, và frontend CRA sẽ gọi backend bằng `REACT_APP_API_BASE_URL`.
- Local dev mặc định dùng frontend CRA origin khớp `FRONTEND_ORIGIN` và backend API origin khớp cấu hình env example.
- SMTP có thể chưa được cấu hình trong local dev; app startup vẫn được phép tiếp tục, nhưng mọi flow cần gửi OTP phải trả lỗi an toàn nếu không gửi được email.
- Google OAuth backend config có thể chưa được cấu hình trong local dev; frontend xử lý bằng trạng thái "chưa được cấu hình" thay vì cung cấp form nhập token/credential thô.
- OTP xác thực email và reset mật khẩu được lưu dưới dạng hash/proof, không phải raw OTP; thuật toán proof cụ thể sẽ được quyết định trong spec/plan/implementation.
- `users.email` là unique theo database design. Quy tắc normalize email trước khi lưu/lookup cần được spec làm rõ để tránh duplicate do casing hoặc whitespace.
- Basic profile read trong `feat-auth` chỉ trả thông tin an toàn cần thiết cho current user/profile, không bao gồm cập nhật profile image hoặc upload file.
- Mọi quyền thực tế của protected API sẽ dựa vào middleware/service backend và `req.user` đã xác thực từ cookie, không dựa vào route guard hoặc state phía frontend.

## 6. OPEN QUESTIONS (Các câu hỏi còn bỏ ngỏ)

- API contract chính xác cho Auth sẽ dùng nguyên các route dự kiến trong `PROJECT_AGENTS.md` hay cần điều chỉnh trước khi tạo `spec.md`?
- [Resolved] Google OAuth UX dùng frontend Google Identity Services lấy credential rồi gửi backend verify; backend redirect/callback flow chưa dùng trong Auth MVP.
- Khi Google verified email trùng với user đang `pending_verification`, hệ thống có tự link và activate không, hay bắt buộc user hoàn tất OTP local trước?
- Sau khi reset password thành công hoặc set-password lần đầu cho Google-only user, có cần revoke tất cả refresh token/session cũ của user không?
- Khi tạo Google-only user mới, `users.avatar_url` có được populate từ Google verified profile không, hay chỉ lưu avatar trong `oauth_accounts.provider_avatar_url` và để `users.avatar_url = NULL` cho đến profile update feature?
- Quy tắc rate limit ngoài OTP attempts/cooldown, ví dụ theo IP/email cho register, login, forgot password và resend OTP, có thuộc Auth MVP không?
- Nội dung email OTP, ngôn ngữ email, sender display name và mã lỗi public cụ thể khi SMTP fail safely sẽ được chuẩn hóa trong spec hay để plan/implementation quyết định?

## 7. IMPLEMENTATION ALIGNMENT NOTES (Cập nhật sau triển khai)

- Registration UI có thêm `confirmPassword` để kiểm tra khớp mật khẩu ở frontend. Field này không thuộc backend contract và không được gửi tới API đăng ký.
- Email verification UI giữ email từ bước đăng ký qua route state và chỉ cho người dùng nhập OTP. Nếu mở trực tiếp màn verify mà không có email từ registration state, frontend điều hướng người dùng quay lại đăng ký.
- Google OAuth UX dùng Google Identity Services ở frontend để lấy provider credential, sau đó gửi credential về backend `/auth/google` để backend verify. Frontend không nhận, lưu hoặc yêu cầu người dùng nhập/dán raw OAuth token.
- Nếu backend Google config chưa sẵn sàng, frontend dùng trạng thái an toàn bằng cách ẩn hoặc vô hiệu hóa Google entry point, không hiển thị form nhập credential thô.
- Frontend Auth state dùng `AuthProvider` + `useAuth`. Context chỉ lưu safe current-user object từ backend response; không lưu JWT, refresh token, cookie value, OTP, password hash hoặc Google token.
- Khi refresh browser, `AuthProvider` rehydrate user bằng `/auth/me` với cookie credentials. Browser tự gửi httpOnly cookie; frontend không đọc token.
- Sau login, verify email hoặc Google login thành công, frontend điều hướng theo role do backend trả về: `LEARNER -> /learner`, `MENTOR -> /mentor`, `ADMIN -> /admin`; role lạ fallback về `/auth/me`.
- Các route `/learner`, `/mentor`, `/admin` hiện chỉ là Auth-only placeholder dashboards để kiểm tra session/role/current-user data. Chúng không triển khai nghiệp vụ learner course, mentor review, admin management hoặc reports.
