# CONTEXT.md — Feature: User Profile (Hồ sơ người dùng)

# Người viết: CuongLH | Ngày: 2026-06-18

## 1. PROBLEM STATEMENT

Sau khi đăng nhập, người dùng (ở bất kỳ vai trò nào) cần một nơi để xem thông tin định danh của chính mình và cập nhật các thông tin cá nhân cơ bản để tương tác với hệ thống.

## 2. DOMAIN KNOWLEDGE

* **User JWT:** Token định danh lấy từ httpOnly cookie, chứa `userId` của người dùng hiện tại.
* **Profile Scope:** Các thông tin cá nhân cơ bản (tên, avatar). Thông tin nhạy cảm (như role, status) không thuộc quyền tự cập nhật của người dùng.

## 3. STAKEHOLDERS

* **Authenticated User (Tất cả vai trò):** Người dùng muốn xem và cập nhật hồ sơ cá nhân của mình.
* **Hệ thống:** Phục vụ dữ liệu cho UI hiển thị avatar, tên người dùng trên thanh điều hướng.

## 4. CONSTRAINTS (Ràng buộc không thể thay đổi)

* **Security:** Chỉ được phép lấy thông tin profile dựa trên `userId` được giải mã từ JWT của chính họ (trích xuất từ `req.user.id`), tuyệt đối không nhận `userId` từ body hay params để tránh lỗ hổng IDOR.
* **Role & Status Protection:** Người dùng KHÔNG được phép tự thay đổi `role` hoặc `status` của mình thông qua API cập nhật profile.
* **File Upload:** Backend tuyệt đối không xử lý multipart upload file avatar. Frontend phải xin Signed URL từ hệ thống và đẩy trực tiếp lên Cloudinary.

## 5. ASSUMPTIONS (Giả định)

* ✅ **RESOLVED:** Bảng `users` đã được bổ sung 2 fields mới (per DATABASE.md update 2026-06-19):
  * `name` VARCHAR(255) NULL - Tên hiển thị người dùng
  * `avatar_url` VARCHAR(500) NULL - URL ảnh đại diện từ Cloudinary

## 6. OPEN QUESTIONS (Câu hỏi cần làm rõ)

1. Ở API `PUT /profile/me`, chúng ta có cho phép người dùng thay đổi email đăng nhập không? (Nếu có, hệ thống sẽ phải xử lý việc gửi lại OTP xác thực rất phức tạp).

## 7. ANSWERS TO OPEN QUESTIONS

### Answer 1: Email Change via PUT /profile/me (Resolved: 2026-06-19)

**Question:** Ở API `PUT /profile/me`, chúng ta có cho phép người dùng thay đổi email đăng nhập không? (Nếu có, hệ thống sẽ phải xử lý việc gửi lại OTP xác thực rất phức tạp).

**Answer:** **KHÔNG** cho phép thay đổi email qua `PUT /profile/me`

**Rationale:**

* **API Scope:** `PUT /profile/me` chỉ update `name` và `avatar_url` (per API_CATALOG.md line 18)
* **Out of Scope:** Thay đổi email là separate feature yêu cầu OTP verification flow phức tạp
* **Security:** Email là primary identity - thay đổi cần workflow riêng với xác thực mạnh hơn
* **MVP Focus:** Giữ profile API đơn giản, tập trung vào use case cơ bản nhất

**Implementation:**

* ✅ Zod validator REJECT bất kỳ attempt nào update `email` field
* ✅ Backend service FORBIDDEN update `email` (hardcoded in allowed fields list)
* ✅ Separate API endpoint `/profile/change-email` sẽ được tạo cho change email feature (future scope)

**Business Impact:**

* User muốn đổi email → phải liên hệ support hoặc đợi future feature
* Simplicity > Flexibility trong MVP scope

**Reference:**

* `API_CATALOG.md` line 18: "Update current user profile (name, avatar_url only)"
* `feat-profile/SPEC.md` line 17: "❌ OUT OF SCOPE: Thay đổi email, password..."
* `feat-profile/SPEC.md` line 119: "FORBIDDEN cập nhật: email, password_hash, role, status, role_version"
