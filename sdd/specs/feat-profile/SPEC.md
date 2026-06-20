# Feature: User Profile (Hồ sơ người dùng)

# Version: 1.0.0 | Owner: Member A | Status: DRAFT

# Mức độ: Detailed (Risk: Medium) | Inherits: CLAUDE.md, AUTH_MIDDLEWARE

## 1. Context & Goal

Sau khi đăng nhập, người dùng (ở bất kỳ vai trò nào) cần một nơi để xem thông tin định danh của chính mình và cập nhật các thông tin cá nhân cơ bản để tương tác với hệ thống. Mục tiêu cốt lõi: Cung cấp API an toàn tuyệt đối chống lại lỗ hổng IDOR và ngăn chặn leo thang đặc quyền (không cho phép tự đổi role hay status). Giữ cho profile API đơn giản và tập trung vào các thông tin định danh cơ bản là name (Tên hiển thị) và avatar_url (Ảnh đại diện).

## 2. Actors & Roles

* **Authenticated User (Tất cả Roles)** : Có quyền xem và cập nhật hồ sơ cá nhân của chính mình.
* **System** : Phục vụ dữ liệu cho UI hiển thị tên và avatar trên thanh điều hướng.
* **Guest** : Người dùng chưa đăng nhập. Bị từ chối truy cập vào các API này.

## 3. Functional Requirements (EARS Notation)

### Xem hồ sơ (Get Profile)

* **WHEN**  Authenticated User gửi GET /profile/me,  **THE hệ thống SHALL** :
    1. Trích xuất userId trực tiếp từ payload của Access JWT thông qua req.user.id do authMiddleware cung cấp.
    2. Truy vấn bảng users trong cơ sở dữ liệu dựa trên userId này.
    3. Trả về HTTP 200 OK với object profile bao gồm: id, email, name, avatar_url, role, status.

### Cập nhật hồ sơ (Update Profile)

* **WHEN**  Authenticated User gửi PUT /profile/me với payload hợp lệ (chỉ chứa name, avatar_url),  **THE hệ thống SHALL** :
    1. Trích xuất userId trực tiếp từ payload của Access JWT (Tuyệt đối không lấy userId từ body hay params).
    2. Cập nhật các trường name và avatar_url vào bảng users.
    3. Trả về HTTP 200 OK kèm theo object profile đã được cập nhật.

### 4. Non-functional Requirements

* **Security (Anti-IDOR)** : Cả 2 API /profile/me BẮT BUỘC bỏ qua mọi userId truyền từ phía Client. Định danh duy nhất là token của người dùng.
* **Security (XSS Prevention)** : Zod schema cho trường `name` sử dụng Regex để từ chối nghiêm ngặt (Reject) bất kỳ chuỗi nào chứa ký tự `<` hoặc `>`.
* **Performance**: Response time API < 200ms (P95) bao gồm cả Database round-trip. (Ghi chú: Giới hạn P95 cho phép tối đa 5% số request có thể vượt ngưỡng này do độ trễ tự nhiên của MySQL).

## 5. Data Model (Tóm tắt từ DATABASE.md)

Sử dụng 1 bảng:

* users: id, email, password_hash, name, avatar_url, role, status, role_version.

## 6. Error Handling (EARS Unwanted Patterns - Rất quan trọng)

* **WHERE**  Client chưa đăng nhập, token hết hạn, token bị sai lệch `role_version`, hoặc tài khoản bị đổi `status` thành `blocked` giữa session,  **THE hệ thống SHALL**  để cho `authMiddleware` tự động chặn và trả về HTTP 401 hoặc 403.
* **WHERE**  Authenticated User gửi PUT request với body rỗng `{}`,  **THE hệ thống SHALL**  trả về HTTP 400 Bad Request.
* **WHERE**  Authenticated User cố tình truyền các trường nhạy cảm vào body của `PUT /profile/me` (ví dụ: `email`, `role`, `status`, `role_version`, `password_hash`),  **THE hệ thống SHALL**  trả về HTTP 400 Bad Request kèm thông báo "Payload chứa các trường không được phép cập nhật" (Strict Validation).
* **WHERE**  Payload chứa `name` rỗng `""` hoặc vượt quá 255 ký tự, **THE hệ thống SHALL** trả về HTTP 400 Bad Request.
* **WHERE**  Payload chứa `avatar_url` là chuỗi rỗng `""`, **THE hệ thống SHALL** chuyển đổi giá trị thành `NULL` khi lưu vào database (hành động xóa ảnh).
* **WHERE**  Payload chứa `avatar_url` KHÔNG bắt đầu bằng `https://res.cloudinary.com/` HOẶC không chứa `req.user.id` bên trong chuỗi URL, **THE hệ thống SHALL** trả về HTTP 400 Bad Request "URL ảnh đại diện không hợp lệ hoặc không thuộc quyền sở hữu của bạn".
**WHERE** Database query (MySQL) bị treo hoặc xử lý chậm vượt quá thời gian giới hạn (Timeout = 5 giây), **THE hệ thống SHALL** ngắt kết nối query đó và trả về HTTP 500 Internal Server Error (hoặc 503 Service Unavailable) để bảo vệ connection pool.

## 7. Acceptance Criteria (Tiêu chí nghiệm thu)

* [ ] GET /profile/me: Trả về đúng thông tin user đang đăng nhập gồm name và avatar_url, tuyệt đối không trả về password_hash.
* [ ] PUT /profile/me: Chỉ cập nhật được name và avatar_url. Lưu thành công vào database.
* [ ] Security Test: Cố tình gửi payload JSON có chứa "email" hoặc "role" vào API PUT, hệ thống phải chặn lại hoặc bỏ qua, không được phép thay đổi.

## 8. Out of Scope (Ngoài phạm vi)

* Không cho phép thay đổi Email (email) qua API này (luồng đổi email yêu cầu OTP xác thực sẽ thiết kế ở một spec khác).
* Không xử lý việc đổi Mật khẩu qua API này.
* Không xử lý upload file ảnh trực tiếp (multipart/form-data) tại Backend. Frontend phải tự xin Signed URL từ Backend (được cấu hình ghi đè bằng public_id = userId) và đẩy trực tiếp lên Cloudinary.
* Không cho phép xem Profile của người khác (Public Profile). API này chỉ lấy đúng dữ liệu của "ME".
