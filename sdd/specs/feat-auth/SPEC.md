# Feature: Authentication (Đăng ký, Đăng nhập, OTP)

# Version: 1.0.0 | Owner: Member A | Status: DRAFT

# Mức độ: Detailed (Risk: High) | Inherits: CLAUDE.md

## 1. Context & Goal

Thiết lập hệ thống định danh an toàn cốt lõi cho hệ thống OCP.
Mục tiêu: Đảm bảo luồng đăng ký qua Email/OTP và đăng nhập trả về JWT.
Bảo mật tối thượng: Giải quyết dứt điểm rủi ro E2.2 (Role Demotion) bằng cơ chế Role Versioning và bảo vệ Token bằng httpOnly Cookies. Tuyệt đối không dùng Bearer Token cho user.

## 2. Actors & Roles

- **Guest**: Người dùng chưa đăng nhập. Có thể đăng ký tài khoản mới (mặc định là LEARNER), xác thực email và đăng nhập.
- **Authenticated User (Tất cả Roles)**: Có thể gọi endpoint refresh-token và logout.
- **System**: Tự động sinh OTP, dọn dẹp token hết hạn.

## 3. Functional Requirements (EARS Notation)

### Đăng ký & OTP (Registration)

- **WHEN** Guest gửi POST `/auth/register` với email và password hợp lệ, **THE hệ thống SHALL**:
  1. Hash password bằng bcrypt.
  2. Tạo user mới với `status = 'pending_verification'`, `role_version = 1`.
  3. Tạo 1 mã OTP 6 số hash (otp_hash), thời hạn 10 phút.
  4. Trả về HTTP 201 Created (không trả về password hash hay raw OTP).
- **WHEN** Guest gửi POST `/auth/verify-otp` với email và OTP hợp lệ, **THE hệ thống SHALL** cập nhật `users.status = 'active'` và đánh dấu OTP đã sử dụng.

### Đăng nhập (Login)

- **WHEN** Guest gửi POST `/auth/login` với email và password chính xác, **THE hệ thống SHALL**:
  1. Tạo **Access JWT** chứa `userId`, `role`, và `roleVersion` hiện tại từ DB. Thời gian hết hạn (TTL) CHÍNH XÁC là 5 phút.
  2. Tạo **Refresh Token** (thời hạn 7 ngày), lưu hash vào bảng `refresh_tokens`.
  3. Set httpOnly, secure, sameSite cookies cho cả 2 token.
  4. Trả về HTTP 200 OK cùng thông tin user cơ bản.

### Đăng xuất & Refresh (Logout / Refresh)

- **WHEN** User gửi POST `/auth/refresh-token`, **THE hệ thống SHALL** kiểm tra Refresh token trong cookie, đối chiếu `token_hash` trong DB. Nếu hợp lệ, cấp phát Access JWT mới (5 phút) có chứa `roleVersion` mới nhất **VÀ một Refresh Token mới (chính xác 7 ngày), đồng thời thu hồi (revoke) Refresh Token cũ vừa được sử dụng**.
- **WHEN** User gửi POST `/auth/logout`, **THE hệ thống SHALL** xóa refresh token **(chỉ token được gửi lên từ cookie của thiết bị hiện tại)** khỏi DB và xóa auth cookies khỏi trình duyệt.

## 4. Non-functional Requirements

- **Security**: Mật khẩu bắt buộc hash bằng `bcrypt` trước khi lưu DB.
- **Security**: Raw OTP KHÔNG BAO GIỜ được lưu plaintext, chỉ lưu `otp_hash`.
- **Security Auth Storage**: JWT phải nằm trong httpOnly cookie.
- **Performance**: Endpoint `/auth/login` phản hồi < 300ms (P95).
- **Security**: Cookie lưu JWT bắt buộc phải thiết lập các cờ HttpOnly=true, Secure=true, và  SameSite='Strict'.
- **Security**: Mật khẩu bắt buộc dùng bcrypt. Tuy nhiên, Raw OTP KHÔNG BAO GIỜ được lưu plaintext mà phải dùng hàm hash SHA-256 (vì OTP ngắn hạn, dùng bcrypt quá chậm và không cần thiết).

## 5. Data Model (Tóm tắt từ DATABASE.md)

Sử dụng 3 bảng:

- `users`: id, email, password_hash, role, status ('active' | 'blocked' | 'pending_verification'), role_version.
- `refresh_tokens`: id, user_id, token_hash, expires_at, revoked_at.
- `email_verifications`: id, user_id, otp_hash, expires_at, failed_attempts, locked_at, last_sent_at.

## 6. Error Handling (EARS Unwanted Patterns - Rất quan trọng)

- **WHERE** User nhập sai OTP trên 5 lần (`failed_attempts >= 5`), **THE hệ thống SHALL** cập nhật `locked_at` và từ chối xác thực trong 30 phút, trả về HTTP 429 Too Many Requests.
- **WHERE** User yêu cầu gửi lại OTP khi chưa hết thời gian chờ (`last_sent_at` < 60s), **THE hệ thống SHALL** trả về HTTP 429 kèm thông báo "Vui lòng chờ 60 giây".
- **WHERE** email đăng nhập không tồn tại HOẶC password sai, **THE hệ thống SHALL** trả về HTTP 401 Unauthorized với thông báo CHUNG: "Email hoặc mật khẩu không chính xác" (Chống User Enumeration).
- **WHERE** tài khoản đang có `status = 'blocked'`, **THE hệ thống SHALL** từ chối đăng nhập và trả về HTTP 403 Forbidden.
- **WHERE** User đang có `status = 'pending_verification'` gọi API `/auth/login`, **THE hệ thống SHALL** từ chối đăng nhập, trả về HTTP 403 Forbidden kèm thông báo "Vui lòng xác thực email trước khi đăng nhập".
- **WHERE** User đã có `status = 'active'` nhưng gọi lại API `/auth/verify-otp`, **THE hệ thống SHALL** trả về HTTP 400 Bad Request kèm thông báo "Tài khoản đã được xác thực".
- **WHERE** Guest đăng ký (`/auth/register`) với email đã tồn tại NHƯNG `status = 'pending_verification'`, **THE hệ thống SHALL** tạo OTP mới, cập nhật hash vào database, gửi lại email và trả về HTTP 200 OK (Cho phép gửi lại OTP).
- **WHERE** Access Token hết hạn và User gửi yêu cầu với Refresh Token cũng đã hết hạn (`expires_at < now`), **THE hệ thống SHALL** trả về HTTP 401 Unauthorized yêu cầu User đăng nhập lại.
- **WHERE** 2 request xác thực OTP đến cùng lúc (Concurrent verification), **THE hệ thống SHALL** sử dụng transaction database với cơ chế lock row (`SELECT FOR UPDATE`) để ngăn chặn việc ghi nhận sai `failed_attempts`.

## 7. Acceptance Criteria (Tiêu chí nghiệm thu)

- [ ] POST `/auth/register`: Mật khẩu được mã hóa, OTP hash sinh ra trong DB, trả về 201.
- [ ] POST `/auth/verify-otp`: Nhập đúng OTP chuyển user sang 'active'. Nhập sai 5 lần bị khóa tạm thời.
- [ ] POST `/auth/login`: Trả về Access Token (5 phút) và Refresh Token qua httpOnly cookies. Cookie có cờ Secure.
- [ ] Payload Access Token bắt buộc chứa trường `roleVersion` khớp với DB.
- [ ] Thông báo lỗi chung chung (Generic error message) cho mọi trường hợp login thất bại.

## 8. Out of Scope (Ngoài phạm vi)

- Không implement đăng nhập Google OAuth trong sprint này.
- Không gửi SMS OTP (chỉ qua Email mô phỏng/Nodemailer).
- Không implement luồng Quên Mật Khẩu (Forgot Password) ở spec này (sẽ nằm ở spec riêng).
- Chức năng Admin đổi role và bắt middleware xác thực `roleVersion` (Sẽ nằm trong Feature Admin Accounts và file export `AUTH_MIDDLEWARE`).
- Không xử lý luồng Thay đổi Email (Change Email) trong spec này (Sẽ nằm ở Feature Profile).
- Không xử lý đăng nhập đa thiết bị đồng bộ (Concurrent multi-device sync), đăng xuất (logout) chỉ xóa    đúng refresh_token được gửi lên từ thiết bị hiện tại.
- Việc chỉ định role = MENTOR hoặc MANAGER nằm ngoài phạm vi API đăng ký này (Sẽ nằm ở Feature Admin  Accounts). API /auth/register mặc định ép cứng role = LEARNER.
