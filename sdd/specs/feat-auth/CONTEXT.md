# CONTEXT.md — Feature: Authentication & Account (Member A)

# Người viết: CuongLH | Ngày: 2026-06-18

## 1. PROBLEM STATEMENT

Hệ thống OCP cần một cơ chế định danh, xác thực và phân quyền cực kỳ an toàn cho 4 vai trò (Admin, Manager, Mentor, Learner). Vấn đề nhức nhối (pain point) đã từng xảy ra (Lỗi E2.2): Khi Admin giáng cấp Mentor xuống Learner, token cũ vẫn còn hiệu lực khiến họ truy cập trái phép vào các endpoint của Mentor. Tính năng này phải giải quyết triệt để bài toán bảo mật đó.

## 2. DOMAIN KNOWLEDGE

- **JWT (JSON Web Token):** Dùng để xác thực user.
- **Role Versioning (Lỗi E2.2):** Một cơ chế bắt buộc nơi version của quyền (role) được nhúng vào JWT. Khi user bị block hoặc đổi quyền, `role_version` trong DB tăng lên, làm vô hiệu hóa tức thì toàn bộ JWT cũ.
- **OTP (One Time Password):** Mã 6 số dùng để xác minh email và reset mật khẩu, hết hạn sau 10 phút, khóa sau 5 lần nhập sai.

## 3. STAKEHOLDERS

- **Guest / Learner:** Đăng ký, xác minh email, đăng nhập.
- **Admin:** Đổi quyền, khóa tài khoản user [7].
- **Các Module B, C, D, E:** Là "khách hàng" nội bộ, phụ thuộc hoàn toàn vào file export `AUTH_MIDDLEWARE` do Member A cung cấp để bảo vệ API của họ [3, 11].

## 4. CONSTRAINTS (Ràng buộc không thể thay đổi)

- **Database:** Bắt buộc sử dụng 4 bảng: `users`, `refresh_tokens`, `email_verifications`, `password_reset_tokens` [12].
- **Auth Storage:** JWT bắt buộc phải lưu trong **httpOnly Cookies**. TUYỆT ĐỐI CẤM dùng Bearer-token cho User auth [13, 14].
- **Security:** Mật khẩu phải hash bằng bcrypt [15]. Không bao giờ lưu OTP dạng plaintext (chỉ lưu `otp_hash`) [9, 10].
- **Token TTL:** Access token hết hạn chính xác sau **5 phút** (đã fix từ 15-60 phút per E2.2). Refresh token hết hạn sau 7-30 ngày [16-18].

## 5. ASSUMPTIONS (Giả định)

- Hệ thống gửi email (Nodemailer/SMTP) sẽ được xử lý độc lập và tự động fail an toàn nếu dịch vụ mail sập [13].
- Việc Google OAuth chưa làm trong Sprint này mà chỉ tập trung vào Email/Password (password_hash có thể null nếu tích hợp Google sau này) [19].

## 6. OPEN QUESTIONS

1. Rate limiting (giới hạn request) cho việc gửi OTP (đăng ký / quên mật khẩu) là bao nhiêu lần/phút để tránh bị spam SMS/Email?
2. Có cần thiết lập cooldown (thời gian chờ) 60 giây giữa các lần nhấn "Gửi lại OTP" không?

## 7. ANSWERS TO OPEN QUESTIONS

### Answer 1: Rate Limiting Scope (Resolved: 2026-06-19)

**Question:** Rate limiting (giới hạn request) cho việc gửi OTP (đăng ký / quên mật khẩu) là bao nhiêu lần/phút để tránh bị spam SMS/Email?

**Answer:**

- **Scope:** Per User (1 email chỉ được gửi tối đa 1 OTP mỗi 60 giây)
- **Áp dụng cho:** Cả email verification (register) VÀ password reset (forgot password)
- **Implementation:**
  - Backend check `last_sent_at` của OTP record gần nhất cho userId
  - Nếu `last_sent_at + 60s > now` → Return HTTP 429 "Please wait before requesting new OTP"
  - Nếu đủ cooldown → Cho phép tạo OTP record mới, update `last_sent_at = now`
- **Business Impact:**
  - Prevent spam: User không thể flood email server với unlimited OTP requests
  - UX: User phải chờ 60s giữa các lần nhấn "Resend OTP"

### Answer 2: Global Rate Limit (Resolved: 2026-06-19)

**Question:** Có cần thiết lập cooldown (thời gian chờ) 60 giây giữa các lần nhấn "Gửi lại OTP" không?

**Answer:**

- **Confirmed:** CÓ - 60 giây cooldown giữa các lần resend
- **Additional Global Limit:** KHÔNG cần thêm rate limit hourly (ví dụ: 10 OTP/hour)
- **Rationale:**
  - Combination của **60s cooldown** + **5 failed attempts** + **30-minute lockout** đã đủ prevent abuse
  - Không cần thêm Redis hoặc bảng `rate_limits` trong MVP scope
  - Nếu cần tăng cường security sau này có thể thêm IP-based rate limit (out of scope hiện tại)

### Implementation Summary

**Đã Implement:**

- ✅ `OTP_RESEND_COOLDOWN_SECONDS = 60` (env variable)
- ✅ `last_sent_at` field trong `email_verifications` và `password_reset_tokens` tables
- ✅ Logic check cooldown trong AuthService.register() và AuthService.forgotPassword()

**Reference:**

- `DATABASE.md` lines 157, 163, 181, 188
- `backend/src/config/auth.config.js` lines 35-38
- `TASKS.md` T002, T010
- `checklists/requirements.md` FR-007
