# Constitution — Nguyên tắc cốt lõi của dự án OCP

Tài liệu này định nghĩa các quy tắc nền mà toàn bộ thành viên và AI agents phải tuân thủ khi viết spec, plan, tasks và code cho OCP.

## 1. Spec-Driven Development

- **Spec là giao diện giữa người và máy**: Spec định nghĩa hệ thống phải làm gì, không nhảy thẳng vào cách code.
- **Zero Ambiguity**: Nếu AI phải đoán, spec chưa đủ rõ. Mọi behavior quan trọng phải được viết cụ thể.
- **EARS Notation**: Requirement phải dùng cấu trúc `THE/WHEN/WHILE/WHERE ... SHALL ...` để trace được từ spec sang code/test.
- **Out of Scope bắt buộc rõ ràng**: Những gì không làm phải được ghi cụ thể để tránh mở rộng phạm vi ngầm.

## 2. Quy trình tài liệu

1. **Pha 0 — Context**: Human viết `CONTEXT.md` với problem, domain, stakeholders, constraints, assumptions và open questions.
2. **Pha 1 — Spec**: Human viết `SPEC.md` đủ 8 phần, dùng EARS notation và chỉ chuyển tiếp khi đã được review/approve.
3. **Pha 2 — Plan**: AI đọc `SPEC.md` để tạo `PLAN.md`; chỉ lập kế hoạch, không viết code.
4. **Pha 3 — Tasks**: AI đọc `PLAN.md` và `SPEC.md` để tạo `TASKS.md` dạng bảng task atomic, independent, verifiable.
5. **Pha 4 — Implementation**: AI/code agent implement theo `TASKS.md`, mỗi task phải có done criteria rõ ràng.

Trước mọi pha, AI agent phải đọc `AGENTS.md` và `CLAUDE.md` để nắm tech stack, module ownership, forbidden patterns và Definition of Done toàn cục.

## 3. Chuẩn `CONTEXT.md`

Mỗi feature context phải có đúng các phần:

1. `PROBLEM STATEMENT`
2. `DOMAIN KNOWLEDGE`
3. `STAKEHOLDERS`
4. `CONSTRAINTS`
5. `ASSUMPTIONS`
6. `OPEN QUESTIONS`

## 4. Chuẩn `SPEC.md`

Mỗi feature spec phải có đúng 8 phần:

1. `Context & Goal`
2. `Actors & Roles`
3. `Functional Requirements (EARS Notation)`
4. `Non-functional Requirements`
5. `Data Model`
6. `Error Handling`
7. `Acceptance Criteria (Given-When-Then)`
8. `Out of Scope`

## 5. Chuẩn `PLAN.md`

Mỗi implementation plan phải có đúng 6 phần:

1. `ARCHITECTURAL APPROACH`
2. `COMPONENTS`
3. `DATA FLOW`
4. `DEPENDENCIES`
5. `RISKS & MITIGATIONS`
6. `QUESTIONS FOR HUMAN`

## 6. Chuẩn `TASKS.md`

`TASKS.md` phải là bảng Markdown với các cột:

| ID | Task | Files | Est | Deps | Spec Refs | Done When |
| --- | --- | --- | --- | --- | --- | --- |

Quy tắc task:

- ID dùng `T001`, `T002`, ... theo thứ tự.
- Tên task bắt đầu bằng động từ và danh từ rõ ràng.
- Mỗi task tối đa 4 giờ; task lớn hơn phải chia nhỏ.
- Mỗi task phải có dependency rõ ràng hoặc `-`.
- Mỗi task phải trỏ về section/requirement trong `SPEC.md`.
- Done criteria phải kiểm chứng được bằng test, migration, response contract hoặc tài liệu cụ thể.

## 7. Ràng buộc kỹ thuật toàn cục

- Mọi input request phải validate bằng Zod hoặc validator được team approve.
- API cần auth phải dùng JWT theo contract của Auth module.
- Không hard delete dữ liệu liên quan user đã phát sinh payment/enrollment trừ khi spec được approve rõ.
- Cross-module access phải qua adapter/contract; không tự ý query bảng của module khác.
- Error response không được leak stack trace, secret, cookie, JWT hoặc query nội bộ.
- Tests phải trace được về acceptance criteria trong `SPEC.md`.
- Các đường dẫn implementation trong `PLAN.md` và `TASKS.md` phải theo cấu trúc chuẩn `/backend/src/api`, `/backend/src/controllers`, `/backend/src/services`, `/backend/src/repositories`, `/backend/src/middlewares`, `/backend/src/utils`.
