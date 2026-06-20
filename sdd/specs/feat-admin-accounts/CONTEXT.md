# CONTEXT.md — Feature: Admin Accounts & Auth Middleware

# Người viết: CuongLH | Ngày: 2026-06-18

## 1. PROBLEM STATEMENT

Hệ thống hiện tại đang gặp một lỗ hổng bảo mật nghiêm trọng (Lỗi E2.2): Nếu Admin giáng cấp một người dùng (ví dụ từ Mentor xuống Learner), JWT cũ của họ vẫn còn hiệu lực và họ vẫn có thể tiếp tục thực hiện các tác vụ của quyền cũ cho đến khi token hết hạn. Đồng thời, toàn bộ dự án đang chờ đợi một authMiddleware chuẩn và bảo mật từ Member A để bảo vệ các API của tất cả các phân hệ khác (Member B, C, D, E)
.

## 2. DOMAIN KNOWLEDGE

Role Versioning (Phiên bản quyền): Một kỹ thuật bảo mật nhằm vô hiệu hóa token ngay lập tức khi quyền thay đổi. Bảng users lưu một số nguyên role_version (mặc định = 1). JWT Payload cũng chứa roleVersion này.
Integration Contract (Hợp đồng giao tiếp): authMiddleware không chỉ dùng nội bộ mà sẽ được export để tất cả các thành viên khác import vào phần công việc của họ. Nó đóng vai trò là "người gác cổng" duy nhất cho toàn bộ 66 APIs.

## 3. STAKEHOLDERS

Admin: Người có quyền gọi API PUT /admin/users/:userId/role để thăng/giáng cấp người dùng.
Các thành viên phát triển (Team B, C, D, E): Là "khách hàng" sử dụng AUTH_MIDDLEWARE do bạn export để bảo vệ API của họ.
Người dùng bị đổi quyền: Sẽ bị đăng xuất (token bị vô hiệu hóa) ngay lập tức khi Admin thay đổi quyền của họ.

## 4. CONSTRAINTS (Ràng buộc không thể thay đổi)

Cập nhật Role Version (CRITICAL E2.2): API đổi vai trò BẮT BUỘC phải tăng giá trị role_version trong bảng users lên 1 đơn vị (increment: 1)
.
Bảo mật Middleware (CRITICAL E2.2): authMiddleware BẮT BUỘC phải truy vấn DB ở mỗi request để kiểm tra: users.role_version trong DB có khớp với roleVersion trong JWT hay không
.
Chặn tài khoản Blocked: Middleware phải chặn đứng request nếu users.status hiện tại không phải là active
.
Quyền truy cập: Chỉ duy nhất tài khoản mang role ADMIN mới được phép gọi API PUT /admin/users/:userId/role
.

## 5. ASSUMPTIONS (Giả định)

Bảng users đã có sẵn trường role_version INT DEFAULT 1 và status theo đúng thiết kế Schema V2 Final
.
Thời gian sống (TTL) của Access JWT đã được cấu hình cứng là đúng 5 phút để giảm thiểu rủi ro
.
Việc khóa (Block) tài khoản user hoàn toàn (đổi status thành blocked) là nhiệm vụ của API DELETE /admin/users/:userId do Member E đảm nhận, không thuộc scope của spec này
.

## 6. OPEN QUESTIONS (Câu hỏi cần làm rõ trước khi viết Spec)

Q1 (Về việc thu hồi Refresh Token): Khi Admin đổi role và chúng ta tăng role_version lên để Access Token chết ngay lập tức, vậy đối với Refresh Token (lưu ở bảng refresh_tokens) thì sao? Chúng ta có nên thiết kế API này tự động cập nhật revoked_at = NOW() cho tất cả Refresh Token của người dùng đó để buộc họ phải đăng nhập lại hoàn toàn không, hay chỉ cần tăng role_version là đủ để API /auth/refresh-token tự động từ chối cấp mới?

## 7. ANSWERS (Đã chốt với Product Owner & Tech Lead)

**A. VỀ PHẠM VI (SCOPE BOUNDARIES):**

1. Các tính năng Block User, Batch Block, và Admin Reset Password thuộc scope của Member E (API 62, 63). Tuyệt đối nằm ngoài phạm vi của Spec này.
2. Không triển khai bảng Audit Log riêng vì Database Schema V2 đã khóa cứng ở 19 bảng. Chỉ sử dụng system/server logs để track actions.
3. Không cấu hình Transaction Isolation Level phức tạp. Lệnh update `role_version: { increment: 1 }` của Prisma là đủ an toàn.
4. Vấn đề "Block User during Payment" được ghi nhận là Known Gap thuộc trách nhiệm xử lý của Member C và Member E.

**B. VỀ NGHIỆP VỤ ĐỔI QUYỀN (ROLE CHANGE):**
5. **Self-Action Prevention:** CẤM Admin tự thay đổi role của chính mình (chặn request nếu req.user.id === targetUserId) để tránh mất quyền quản trị hệ thống.
6. **Admin Hierarchy (Bảo vệ Admin gốc):** BẮT BUỘC từ chối thay đổi quyền nếu target user đang có role là `ADMIN` (tránh nội chiến chiếm quyền).
7. **Rate Limiting:** Áp dụng giới hạn rate limit cơ bản cho endpoint này để chống Abuse/DOS.
8. **Mentor Downgrade Data Integrity:** Khi Mentor bị giáng cấp xuống Learner, dữ liệu khóa học (courses) của họ giữ nguyên (không xóa, không đổi mentor_id). Hệ thống tự động ngăn họ edit khóa học vì authMiddleware sẽ chặn các request vào /mentor/* dựa trên role mới (LEARNER).
9. **Quyết định cho Open Question Q1 (Refresh Token):** Chọn phương án tự động (Option B). Không cần can thiệp cập nhật bảng refresh_tokens. Khi gọi PUT /admin/users/:userId/role, hệ thống CHỈ CẦN tăng role_version = role_version + 1. Các API check Auth và Refresh-Token sẽ tự động từ chối cấp mới do roleVersion trong token cũ bị mismatch với DB.

**C. MIDDLEWARE EXPORT CONTRACT & PRIVILEGE SCOPE:**
10. **Admin Privilege Scope:** Xác nhận role `ADMIN` và `MANAGER` có quyền bypass các check enrollment của hệ thống.
11. **Export Signature:** `authMiddleware` sẽ được export với chữ ký chuẩn Express: `export async function authMiddleware(req, res, next)`.

- **Nhiệm vụ:** Verify JWT, check `users.status === 'active'`, verify `users.role_version === req.user.roleVersion`.
- **Output hợp lệ:** Gán `req.user = { userId, role, roleVersion }` và gọi `next()`.
- **Output lỗi:** Ném `UnauthorizedError` hoặc `ForbiddenError`.
