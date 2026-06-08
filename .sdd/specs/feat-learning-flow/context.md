## 1. PROBLEM STATEMENT (Tuyen bo bai toan)

Tinh nang `feat-learning-flow` can thiet lap trai nghiem hoc tap cot loi cho OCP sau khi learner da co quyen truy cap khoa hoc. Day la lop noi giua enrollment/access, cau truc course, noi dung lesson, tien do hoc tap, va cac module tuong lai nhu quiz, final project, mentor review, report va certificate.

Nguoi hoc can co mot luong hoc ro rang: mo khoa hoc da enroll, xem section va lesson theo thu tu, mo lesson duoc phep hoc, cap nhat tien do lesson, xem tien do course, va tiep tuc hoc tu lesson phu hop nhat. Neu course yeu cau hoc tuan tu, learner khong duoc bo qua lesson truoc khi backend xac nhan dieu kien unlock.

Tinh nang nay phai giai quyet cac rui ro nghiep vu quan trong:

- Paid lesson content khong duoc lo cho user chua co access hop le.
- Progress phai thuoc ve learner dang dang nhap, khong duoc cap nhat thay learner khac.
- Continue learning phai dua tren tien do that va cau truc course hien tai, khong dua tren state tam thoi cua frontend.
- Sequential learning neu duoc bat phai duoc enforce o backend, vi frontend lock/hidden button co the bi bypass.
- Learning Flow phai dung contract cua Auth, Course va Enrollment/Access, khong tu doc payment hoac tu quyet dinh enrollment/access.

Dau ra cua pha context nay chi la tai lieu boi canh tai `.sdd/specs/feat-learning-flow/context.md`. Khong trien khai code, khong tao endpoint, khong sua Prisma schema, khong tao migration, khong tao UI, va khong trien khai cac module ngoai Learning Flow.

## 2. DOMAIN KNOWLEDGE (Kien thuc chuyen mon / Nghiep vu)

- OCP la nen tang khoa hoc truc tuyen. Learning Flow chi bat dau sau khi user co identity dang tin cay va course access duoc xac nhan boi backend.
- Backend la source of truth cho identity, role, account status, enrollment, course access, lesson unlock va progress ownership. Frontend chi ho tro dieu huong va hien thi UX.
- Stack co dinh cua du an: backend NodeJS + JavaScript ESM + Express-style REST API, Prisma, MySQL; frontend React JSX + Bootstrap + Create React App; auth bang JWT trong httpOnly Cookie; validation bang Zod; package manager npm.
- Backend phai theo layered architecture `Route -> Middleware -> Controller -> Service -> Repository -> Prisma/MySQL`. Controller khong chua business logic; service chua business logic; repository la tang duy nhat thao tac Prisma/MySQL.
- Learning + Quiz + Final Project thuoc module Member 4 - Duc. Rieng Learning Flow so huu tien do hoc tap, nhung khong so huu user identity, course content, payment, order, enrollment, mentor review hoac report.
- Auth + Email + Profile thuoc Member 1 - AnhND. Learning Flow phai dung backend-authenticated user tu Auth/session middleware va khong tu xu ly JWT hoac doc cookie o service rieng.
- Course Catalog + Content thuoc Member 2 - Nam. Learning Flow can course, section, lesson, lesson order, lesson active/deleted state va preview metadata tu Course contract/module, khong tu dinh nghia lai content ownership.
- Payment + Enrollment + Access thuoc Member 3 - CuongLH. Learning Flow phai dung course access contract, vi paid course chi unlock khi co enrollment hop le do backend tao sau payment thanh cong. Payment `PENDING` khong bao gio cap quyen hoc.
- Course access contract chia se trong `share_context.md` la `canAccessCourse(userId, courseId) -> boolean`. Learning Flow la consumer cua contract nay.
- Bang du lieu Learning Progress theo `DATABASE.md` gom:
  - `lesson_progress`: luu tien do cua mot learner tren mot lesson, co `user_id`, `lesson_id`, `status`, `progress_percent`, `last_position_seconds`, `completed_at`, timestamps va unique `user_id + lesson_id`.
  - `course_progress`: luu tong quan tien do cua mot learner tren mot course, co `user_id`, `course_id`, `completed_lessons`, `total_lessons`, `progress_percent`, `status`, `last_lesson_id`, `completed_at`, timestamps va unique `user_id + course_id`.
- Lesson content thuoc Course module. Learning Flow chi quyet dinh learner hien tai co duoc nhan full content hay chi nhan safe locked/unavailable state hay khong.
- Public course browsing va preview lesson cho guest/learner chua enroll thuoc Course module. Learning Flow khong bien protected learning behavior thanh public content API.
- Lesson completion trong MVP la hanh dong ro rang cua learner. Video watch duration, playback percentage, auto-complete theo thoi luong xem va realtime sync khong thuoc scope hien tai.
- Course progress phai tinh tu required active lessons trong cau truc course hien tai. Course co 0 active required lessons phai tra progress 0 de tranh chia cho 0 hoac danh dau complete sai.
- Sequential learning la rule co the duoc bat/tat theo course policy. Khi bat, lesson dau tien duoc mo neu learner co access; lesson tiep theo chi mo sau khi previous required active lesson da completed boi chinh learner do.
- Locked lesson co the xuat hien duoi dang metadata an toan de frontend hien thi navigation, nhung khong duoc tra protected content, protected video URL hoac body content.
- Progress state se la nen cho quiz eligibility, final project eligibility, report va certificate trong tuong lai, nhung cac nghiep vu do phai co spec rieng.

## 3. STAKEHOLDERS (Cac ben lien quan)

- Learner: mo khoa hoc da enroll, xem bai hoc duoc phep hoc, cap nhat tien do cua minh, tiep tuc hoc tu lesson phu hop va xem course progress.
- Guest: co the browse course/preview qua Course module, nhung khong thuoc protected Learning Flow neu chua dang nhap va chua co access.
- Auth module: cung cap identity, role, account status va session validity dang tin cay cho protected learning behavior.
- Course module: cung cap course structure, section/lesson order, active/deleted state, lesson metadata va protected lesson content theo contract duoc phe duyet.
- Payment/Enrollment/Access module: la authority cho course access, enrollment state va unlock sau payment; Learning Flow khong tu doc payment hay enrollment table.
- Learning service: chiu trach nhiem build learning view, tinh lesson state, enforce sequential lock, update progress va bao ve ownership cua learner hien tai.
- Frontend Learning UI/API client: hien thi dashboard, lesson states, continue-learning action va progress feedback; moi request can cookie credentials; frontend khong phai access authority.
- Mentor/Final Project module: ve sau co the dung progress/course completion de xac dinh eligibility nop/cham final project, nhung khong thuoc scope Learning Flow MVP.
- Admin/Reports module: ve sau co the doc aggregate progress qua contract/report reader duoc duyet, nhung khong mutate du lieu Learning Flow.

## 4. CONSTRAINTS (Cac rang buoc)

- Khong doi stack: khong chuyen sang TypeScript, CommonJS, Vite/Next.js, ORM/database khac, Bearer-token auth, hoac auth/access pattern khac voi OCP.
- JWT chi nam trong httpOnly Cookie. Frontend khong luu JWT trong `localStorage`/`sessionStorage` va khong gan `Authorization: Bearer <token>`.
- Learning requests can protected session phai gui cookie credentials. Backend doc identity tu session da xac thuc, khong tu tin `userId`, `role`, `accountStatus`, `paymentStatus`, `enrollmentStatus` hoac `courseAccess` tu frontend.
- User pending, blocked, soft-deleted, session het han, session revoked, hoac session khong hop le phai bi chan khoi protected learning behavior.
- Learning Flow phai validate course access qua Enrollment/Access authority truoc khi tra protected course learning structure hoac paid lesson content.
- Learning Flow khong duoc doc payment status truc tiep va khong duoc quyet dinh paid course unlock bang payment data rieng. Payment `PENDING`, failed payment, cancelled/refunded/inactive enrollment khong duoc unlock lesson.
- Course, section, lesson, content va order thuoc Course module. Learning Flow chi su dung contract/query duoc phe duyet va khong so huu course content CRUD.
- Request body, query va route params quan trong phai validate bang Zod hoac validator duoc duyet truoc khi business behavior chay.
- Error response phai theo `{ success, message, code, details }` hoac helper tuong duong. Khong tra raw stack trace, raw SQL/Prisma error, secret, JWT, cookie value, password, payment internals hoac data cua learner khac.
- Progress update phai chi ap dung cho authenticated learner. Neu request co user id cua learner khac, backend phai bo qua hoac reject theo contract va dung identity tu session.
- `lesson_progress` phai unique theo `user_id + lesson_id`; repeat update phai idempotent, khong tao duplicate progress.
- `course_progress` phai unique theo `user_id + course_id`; update lesson progress phai dong bo hoac tinh lai course progress cho learner-course tuong ung.
- Progress percent phai nam trong khoang 0 den 100. Course co 0 required active lessons tra 0 percent.
- Inactive/deleted lessons khong tinh vao required active lessons cho progress moi va sequential unlock moi; historical progress co the duoc giu de audit/continuity.
- Locked lessons khong duoc tra protected body content/video URL. Metadata an toan neu tra ve phai du de UI hien thi trang thai lock, khong lo noi dung hoc phi.
- Sequential learning neu disabled/khong co policy thi khong them dieu kien previous-lesson completion ngoai course access va lesson active state.
- Learning Flow khong hard-delete progress data tru khi co spec duoc approve ro. Progress la du lieu nghiep vu co gia tri audit/continuity.
- Frontend API calls phai di qua `frontend/src/api`, dung `REACT_APP_API_BASE_URL`, va gui cookie credentials theo auth contract.
- Tests ve sau phai dung baseline da duyet: backend `node:test` + `assert` + `supertest`; frontend `node:test` cho API client/source-rule tests nhe. Khong them test framework khac neu chua co human approval.
- Pham vi ngoai `feat-learning-flow`: auth registration/login, course CRUD/content management, payment/VNPAY, enrollment creation, quiz, final project, mentor review, certificate, report dashboards, notes, bookmarks, comments, video playback tracking, realtime sync va recommendation.

## 5. ASSUMPTIONS (Cac gia dinh)

- Learner da dang nhap bang Auth cookie hop le truoc khi dung protected Learning Flow.
- Role `LEARNER` va account status duoc Auth module xac thuc truoc khi Learning service chay protected behavior.
- Course access da duoc Payment/Enrollment/Access module xac dinh, bao gom free enrollment va paid enrollment sau khi backend verify payment thanh cong.
- Course module co kha nang cung cap active course structure gom section order, lesson order, lesson active/deleted state va lesson metadata can thiet.
- Sequential learning policy se duoc Course module hoac cau hinh course duoc phe duyet cung cap. Neu khong co policy, mac dinh khong bat sequential lock.
- Required active lessons la nhung lesson dang active, khong deleted, thuoc active course structure va duoc tinh vao learning completion cua course.
- Lesson completion trong MVP la explicit learner action; `last_position_seconds` va `progress_percent` co the duoc giu cho mo rong sau nhung khong duoc dung de auto-complete neu spec chua approve.
- Continue-learning target duoc tinh tu course structure hien tai va learner progress hien tai; neu tat ca required active lessons completed thi course duoc xem la completed va khong can target lesson tiep theo.
- Historical progress co the ton tai voi lesson da inactive/deleted, nhung khong buoc learner moi phai complete lesson khong con active.
- Reports, quiz, final project va certificate co the doc progress state trong tuong lai qua contract duoc duyet, nhung khong them logic cua cac module do vao Learning Flow MVP.
- Frontend co the hien thi lesson lock/progress/continue-learning, nhung moi access va progress ownership deu duoc backend enforce lai.

## 6. OPEN QUESTIONS (Cac cau hoi con bo ngo)

- Course module se expose sequential learning policy bang truong nao va scope nao: theo course, theo section, hay theo lesson dependency?
- Course module se tra lesson content qua contract rieng cho Learning Flow hay Learning repository duoc phep doc lesson data trong pham vi course/lesson owner da duyet?
- Lesson `IN_PROGRESS` duoc set khi learner mo lesson lan dau, khi cap nhat manual progress, hay chi khi frontend gui explicit progress event?
- Khi learner reopen mot lesson da completed, co cho phep chuyen nguoc ve `IN_PROGRESS`/`NOT_STARTED` khong, hay completed la trang thai gan nhu final cho MVP?
- Neu course content thay doi lam total required active lessons giam/tang, course progress da completed co can tinh lai va co the mat completed status khong?
- Safe locked lesson metadata gom nhung field nao: title/order/status thoi, hay them duration/preview flag/section info?
- Continue-learning target khi sequential enabled va learner co gap trong progress do lesson inactive/deleted se chon lesson nao?
- Learning dashboard co can danh sach tat ca enrolled courses hay chi course learning view cho mot `courseId` trong MVP dau tien?

## 7. IMPLEMENTATION ALIGNMENT NOTES (Cap nhat sau trien khai)

- Spec hien tai cua `feat-learning-flow` tap trung vao protected learning course view, lesson access, lesson progress, course progress, continue learning va optional sequential locking.
- Learning Flow phai goi Access contract cua Payment/Enrollment thay vi tu doc payment/order/enrollment de unlock paid content.
- Preview/public course browsing khong thuoc Learning Flow; neu can preview cho guest, Course module/spec phai dinh nghia rieng.
- Database design trong `DATABASE.md` su dung `lesson_progress.status`, `progress_percent`, `last_position_seconds` va `course_progress.status`, khong chi la boolean `completed`.
- Future quiz/final project/certificate integration chi dung progress state lam input; eligibility va workflow chi tiet phai nam trong spec rieng.
- GitNexus automated resources khong co san trong phien lam viec hien tai, nen impact analysis neu can se phai thuc hien bang doc tai lieu va search thu cong.
