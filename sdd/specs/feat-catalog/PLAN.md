# PLAN.md — Course Catalog Implementation Plan

**Version:** 1.0.0  
**Owner:** TienTD (Member 3)  
**Status:** Ready for Implementation  
**Based on:** SPEC.md v1.1.0  
**Date:** 2026-06-19

---

## 1. ARCHITECTURAL APPROACH

### 1.1 Technical Strategy

Áp dụng **Layered Architecture** theo quy chuẩn OCP để đảm bảo separation of concerns và testability:

```
Route → Middleware → Controller → Service → Repository → Prisma → MySQL
```

### 1.2 Design Patterns

**1. Repository Pattern**
- **Lý do**: Tách biệt business logic khỏi data access logic. Repository sở hữu toàn bộ Prisma queries.
- **Áp dụng**: `CatalogRepository` chịu trách nhiệm tất cả database operations liên quan đến courses, users, sections, lessons.

**2. Service Layer Pattern**
- **Lý do**: Tập trung business rules và orchestration logic. Service không import Prisma trực tiếp.
- **Áp dụng**: `CatalogService` xử lý business logic như filter published courses, validate pagination, transform data.

**3. DTO (Data Transfer Object) Pattern**
- **Lý do**: Đảm bảo API response structure nhất quán và không leak internal data.
- **Áp dụng**: Transform database records thành DTOs trước khi trả về client.

**4. Fail-Safe Defaults Pattern**
- **Lý do**: Theo SPEC section 6 - pagination invalid → dùng default thay vì throw error.
- **Áp dụng**: Middleware validation với fallback values (page=1, limit=20).

### 1.3 Security Approach

- **IDOR Prevention**: Filter `status = 'published'` và `users.status != 'blocked'` tại Repository layer (database query), không dựa vào client input.
- **No Authentication Required**: API công khai cho Guest, không check JWT.
- **Input Sanitization**: Zod validation cho query params (page, limit) để tránh injection.

---

## 2. COMPONENTS

### 2.1 Routes (`backend/src/api/catalog.routes.js`)

**Trách nhiệm**: Định nghĩa endpoints và attach middleware.

**Endpoints**:
```javascript
GET /courses
  - Query Params: ?page=1&limit=20
  - Response: { success, data: { courses: [...], pagination: {...} }, metadata }

GET /courses/:courseId
  - Params: courseId (UUID)
  - Response: { success, data: { course: {...} } }
```

**Dependencies**: `catalog.controller.js`, `validatePagination` middleware.

---

### 2.2 Middleware (`backend/src/middlewares/validatePagination.middleware.js`)

**Trách nhiệm**: Validate và sanitize pagination query params.

**Interface**:
- **Input**: `req.query.page`, `req.query.limit`
- **Output**: `req.pagination = { page: number, limit: number, warnings: [] }`
- **Logic**:
  - Parse `page` và `limit` thành integer
  - Nếu invalid hoặc missing → dùng default (page=1, limit=20)
  - Nếu limit > 100 → cap ở 100 (max_page_size)
  - Add warnings vào metadata nếu dùng fallback

**Validation Rules**:
```javascript
{
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(20).catch(20)
}
```

---

### 2.3 Controller (`backend/src/controllers/catalog.controller.js`)

**Trách nhiệm**: Nhận request, gọi service, trả về response. Không chứa business logic.

**Functions**:

**`getCourseList(req, res, next)`**
- **Input**: `req.pagination` (từ middleware)
- **Process**: Gọi `catalogService.getPublishedCourses(page, limit)`
- **Output**: 
  ```javascript
  {
    success: true,
    data: {
      courses: [...],
      pagination: { page, limit, total, totalPages }
    },
    metadata: { warnings: [...] }  // Nếu pagination fallback
  }
  ```
- **Error Handling**: Catch errors từ service và pass to error middleware

**`getCourseDetail(req, res, next)`**
- **Input**: `req.params.courseId`
- **Process**: Gọi `catalogService.getCourseById(courseId)`
- **Output**:
  ```javascript
  {
    success: true,
    data: {
      course: {
        id, title, description, thumbnail, price,
        mentor: { id, name },
        sections: [
          { id, title, orderIndex, lessons: [...] }
        ]
      }
    }
  }
  ```
- **Error Handling**: 
  - Course not found hoặc not published → HTTP 404
  - Database timeout → HTTP 503

---

### 2.4 Service (`backend/src/services/catalog.service.js`)

**Trách nhiệm**: Business logic, orchestration, data transformation.

**Functions**:

**`async getPublishedCourses(page, limit)`**
- **Input**: `page` (number), `limit` (number)
- **Logic**:
  1. Tính offset: `(page - 1) * limit`
  2. Gọi `catalogRepository.findPublishedCoursesWithPagination(offset, limit)`
  3. Gọi `catalogRepository.countPublishedCourses()` để tính totalPages
  4. Transform courses data (nếu cần format price, thumbnail URL)
- **Output**: `{ courses, pagination: { page, limit, total, totalPages } }`
- **Business Rules**:
  - Chỉ lấy courses có `status = 'published'`
  - Filter Mentor bị blocked (`users.status != 'blocked'`)

**`async getCourseById(courseId)`**
- **Input**: `courseId` (UUID string)
- **Logic**:
  1. Validate courseId format (UUID)
  2. Gọi `catalogRepository.findCourseByIdWithDetails(courseId)`
  3. Nếu không tìm thấy hoặc status != 'published' → throw NotFoundError
  4. Nếu Mentor bị blocked → throw NotFoundError (giống như không tồn tại)
  5. Transform response DTO
- **Output**: Course detail object với nested sections/lessons
- **Business Rules**:
  - Chỉ trả về course có `status = 'published'`
  - Filter Mentor blocked
  - **TUYỆT ĐỐI KHÔNG** trả về `lesson.content`, `lesson_assets`, quiz data

---

### 2.5 Repository (`backend/src/repositories/catalog.repository.js`)

**Trách nhiệm**: Database access, Prisma queries, data fetching.

**Functions**:

**`async findPublishedCoursesWithPagination(offset, limit)`**
- **Query**:
  ```javascript
  prisma.course.findMany({
    where: {
      status: 'published',
      mentor: { status: { not: 'blocked' } }
    },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnail: true,
      price: true,
      mentor: {
        select: { id: true, name: true }
      }
    },
    skip: offset,
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
  ```
- **Security**: Filter tại database query (IDOR prevention)

**`async countPublishedCourses()`**
- **Query**:
  ```javascript
  prisma.course.count({
    where: {
      status: 'published',
      mentor: { status: { not: 'blocked' } }
    }
  })
  ```

**`async findCourseByIdWithDetails(courseId)`**
- **Query**:
  ```javascript
  prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnail: true,
      price: true,
      status: true,
      mentor: {
        select: { id: true, name: true, status: true }
      },
      sections: {
        select: {
          id: true,
          title: true,
          orderIndex: true,
          lessons: {
            select: {
              id: true,
              title: true,
              type: true,
              orderIndex: true
              // KHÔNG select content, lesson_assets
            },
            orderBy: { orderIndex: 'asc' }
          }
        },
        orderBy: { orderIndex: 'asc' }
      }
    }
  })
  ```
- **Security**: Không trả về sensitive fields (content, assets)
- **JOIN Type**: LEFT JOIN với sections/lessons (per SPEC section 5)

---

### 2.6 Validators (`backend/src/validators/catalog.validator.js`)

**Trách nhiệm**: Zod schemas cho request validation.

**Schemas**:

**`paginationQuerySchema`**
```javascript
z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).default(20).catch(20)
})
```

**`courseIdParamSchema`**
```javascript
z.object({
  courseId: z.string().uuid()
})
```

---

## 3. DATA FLOW

### 3.1 GET /courses (List Courses)

```
1. Client Request
   ↓
   GET /courses?page=2&limit=30

2. Route Layer
   ↓
   Match route, attach validatePagination middleware

3. Middleware Layer
   ↓
   validatePagination:
   - Parse query params: page=2, limit=30
   - Validate: ✓ valid
   - Set req.pagination = { page: 2, limit: 30, warnings: [] }

4. Controller Layer (catalog.controller.getCourseList)
   ↓
   - Extract req.pagination
   - Call catalogService.getPublishedCourses(2, 30)

5. Service Layer (catalog.service.getPublishedCourses)
   ↓
   - Calculate offset: (2-1)*30 = 30
   - Call catalogRepository.findPublishedCoursesWithPagination(30, 30)
   - Call catalogRepository.countPublishedCourses()
   - Calculate totalPages
   - Transform data (nếu cần)

6. Repository Layer (catalog.repository)
   ↓
   - Execute Prisma query với WHERE status='published' AND mentor.status!='blocked'
   - Return raw database records

7. Database (MySQL via Prisma)
   ↓
   - Execute query:
     SELECT courses.*, users.name FROM courses
     INNER JOIN users ON courses.mentor_id = users.id
     WHERE courses.status = 'published' AND users.status != 'blocked'
     ORDER BY courses.created_at DESC
     LIMIT 30 OFFSET 30
   - Return results

8. Response Transformation
   ↓
   Service → Controller:
   {
     courses: [...],
     pagination: { page: 2, limit: 30, total: 150, totalPages: 5 }
   }

9. HTTP Response
   ↓
   {
     success: true,
     data: { courses: [...], pagination: {...} },
     metadata: { warnings: [] }
   }
   Status: 200 OK
```

---

### 3.2 GET /courses/:courseId (Course Detail)

```
1. Client Request
   ↓
   GET /courses/abc-123-uuid

2. Route Layer
   ↓
   Match route, extract :courseId param

3. Controller Layer (catalog.controller.getCourseDetail)
   ↓
   - Extract req.params.courseId
   - Validate UUID format (via Zod)
   - Call catalogService.getCourseById(courseId)

4. Service Layer (catalog.service.getCourseById)
   ↓
   - Call catalogRepository.findCourseByIdWithDetails(courseId)
   - Check status = 'published'
   - Check mentor.status != 'blocked'
   - If not found or invalid → throw NotFoundError
   - Transform data (remove sensitive fields)

5. Repository Layer (catalog.repository)
   ↓
   - Execute Prisma query với:
     * findUnique by courseId
     * INNER JOIN users (mentor)
     * LEFT JOIN course_sections
     * LEFT JOIN lessons
     * SELECT only safe fields (NO content, assets)

6. Database (MySQL via Prisma)
   ↓
   - Execute JOIN query
   - Return course with nested sections/lessons

7. Response Transformation
   ↓
   Service → Controller:
   {
     course: {
       id, title, description, thumbnail, price,
       mentor: { id, name },
       sections: [ { id, title, orderIndex, lessons: [...] } ]
     }
   }

8. HTTP Response
   ↓
   {
     success: true,
     data: { course: {...} }
   }
   Status: 200 OK

   // Hoặc nếu không tìm thấy:
   {
     success: false,
     message: "Course not found",
     code: "COURSE_NOT_FOUND"
   }
   Status: 404 Not Found
```

---

## 4. DEPENDENCIES

### 4.1 Implementation Order

**Phase 1: Foundation (Repository)**
1. ✅ Đọc DATABASE.md, share_context.md để hiểu schema
2. ✅ Tạo `catalog.repository.js` với 3 functions
3. ✅ Unit test repository với mock Prisma client

**Phase 2: Business Logic (Service)**
4. ✅ Tạo `catalog.service.js` với 2 functions
5. ✅ Inject repository vào service (DI pattern)
6. ✅ Unit test service với mock repository

**Phase 3: Request Handling (Controller + Middleware)**
7. ✅ Tạo `validatePagination.middleware.js`
8. ✅ Tạo `catalog.controller.js`
9. ✅ Unit test controller và middleware

**Phase 4: API Exposure (Routes)**
10. ✅ Tạo `catalog.routes.js`
11. ✅ Register routes vào `backend/src/api/index.js`
12. ✅ Integration test với supertest

**Phase 5: Validation**
13. ✅ Tạo `catalog.validator.js` với Zod schemas
14. ✅ Integrate vào middleware

---

### 4.2 External Dependencies

**Required Libraries** (đã có trong project):
- `express` - Web framework
- `@prisma/client` - Database ORM
- `zod` - Input validation
- `uuid` - UUID validation (hoặc dùng Zod's `.uuid()`)

**Testing Dependencies**:
- `node:test` - Test runner
- `node:assert` - Assertions
- `supertest` - HTTP integration tests

---

### 4.3 Cross-Module Dependencies

**Member A (Auth Module)**:
- **Table**: `users` (id, name, status)
- **Contract**: INNER JOIN để lấy mentor info và filter blocked users
- **Note**: Member C chỉ READ, không WRITE vào users table

**Member B (Mentor Studio Module)**:
- **Tables**: `courses`, `course_sections`, `lessons`
- **Contract**: Member C READ courses với status='published', LEFT JOIN sections/lessons
- **Note**: Member C không access `lesson.content`, `lesson_assets`, `quizzes`

**No Service-to-Service Calls**:
- Theo share_context.md section 3.1, Member C không cần gọi service của Member A/B
- Tất cả data access qua direct database queries (monolithic architecture)

---

## 5. RISKS & MITIGATIONS

### 5.1 Risk: Performance Degradation with Complex JOINs

**Xác suất**: MEDIUM  
**Impact**: HIGH (vi phạm NFR: p95 < 500ms)

**Mô tả**:
- Query GET /courses/:id JOIN 4 tables (courses → users → sections → lessons)
- Nếu course có 50+ sections, mỗi section 10+ lessons → N+1 query problem
- Response time có thể vượt 500ms

**Mitigation**:
1. **Database Indexes** (đã có trong DATABASE.md):
   - `courses(mentor_id, status)`
   - `course_sections(course_id, order_index)`
   - `lessons(section_id, order_index)`
2. **Prisma Select Optimization**: Chỉ select fields cần thiết, không select ALL
3. **Pagination cho sections/lessons**: Nếu MVP vẫn chậm, limit số sections trả về
4. **Monitoring**: Add performance logging để track p95 thực tế

**Verification**: Run load test với 100 concurrent users, measure p95 response time

---

### 5.2 Risk: IDOR Attack via UUID Guessing

**Xác suất**: LOW  
**Impact**: HIGH (security breach - access unpublished courses)

**Mô tả**:
- UUID v4 có 2^122 combinations → khó brute-force
- Nhưng nếu attacker biết pattern (ví dụ: sequential UUID v1) → có thể đoán

**Mitigation**:
1. **Database-Level Filter**: Repository PHẢI filter `status='published'` trong WHERE clause
2. **Never Trust Client Input**: Không dựa vào client gửi `status` parameter
3. **Audit Logging**: Log tất cả 404 requests để detect brute-force attempts
4. **Rate Limiting** (out of scope MVP, nhưng nên có): Limit requests per IP

**Verification**: 
- Unit test: Gọi API với UUID của draft course → expect 404
- Security test: Mock Prisma để return draft course, verify service throws NotFoundError

---

### 5.3 Risk: Stale Data when Mentor Gets Blocked

**Xác suất**: LOW  
**Impact**: MEDIUM (hiển thị courses của mentor bị khóa)

**Mô tả**:
- Admin block Mentor tại t=0
- User gọi GET /courses tại t=1
- Nếu có cache layer, có thể trả về stale data (course vẫn hiển thị)

**Mitigation**:
1. **No Caching in MVP**: SPEC không yêu cầu Redis cache → always query fresh data
2. **INNER JOIN users**: Query sẽ tự động filter courses của blocked mentor
3. **Future Enhancement**: Nếu thêm cache, phải invalidate khi Admin blocks user

**Verification**:
- Integration test: Block mentor → gọi API → verify course không xuất hiện
- Acceptance Criteria đã cover scenario này (SPEC section 7)

---

### 5.4 Risk: Invalid Pagination Causing Empty Results

**Xác suất**: MEDIUM  
**Impact**: LOW (user experience issue, không phải bug nghiêm trọng)

**Mô tả**:
- User gọi `/courses?page=999&limit=20` khi chỉ có 5 pages
- Database trả về empty array
- User không biết có phải lỗi hay đã hết data

**Mitigation**:
1. **Return Total Count**: Response bao gồm `pagination.total` và `totalPages`
2. **Metadata Warnings**: Nếu page > totalPages, add warning vào metadata
3. **Graceful Degradation**: Vẫn trả về HTTP 200 (không phải 400 hay 404)

**Verification**: 
- Test case: Request page=999 → expect HTTP 200 với empty array và pagination info

---

### 5.5 Risk: Database Timeout Under Load

**Xác suất**: LOW (nếu có proper indexes)  
**Impact**: HIGH (HTTP 503, service unavailable)

**Mô tả**:
- Nhiều concurrent requests → database connection pool exhausted
- Query timeout → unhandled exception

**Mitigation**:
1. **Connection Pool Config**: Prisma connection pool size phù hợp với load
2. **Query Timeout**: Set timeout 5s cho Prisma queries
3. **Error Handling**: Catch Prisma timeout errors → trả về HTTP 503 với request_id
4. **Circuit Breaker** (future): Tạm dừng requests nếu database down

**Verification**: Load test với 200+ concurrent users, monitor connection pool

---

## 6. QUESTIONS FOR HUMAN

### Q1: Mentor Name Field Mapping

**Context**: SPEC section 3 yêu cầu trả về "tên Mentor", nhưng không chỉ rõ field nào trong `users` table.

**Question**: 
- Lấy `users.name` hay `users.email`?
- Nếu `users.name` NULL (vì user chưa cập nhật profile), fallback về `users.email` hay trả về `null`?
- Có cần thêm `users.avatar` (ảnh đại diện Mentor) trong response không?

**Impact**: Ảnh hưởng đến response DTO structure và frontend rendering.

---

### Q2: Course Thumbnail Default Value

**Context**: SPEC nói trả về "ảnh đại diện" (thumbnail), nhưng DATABASE.md cho phép `courses.thumbnail` NULL.

**Question**:
- Nếu `courses.thumbnail` NULL, có trả về placeholder URL không? (Ví dụ: `/assets/default-course.png`)
- Hay trả về `null` và để frontend xử lý?

**Impact**: Quyết định xử lý ở backend hay frontend.

---

### Q3: Pagination Metadata Warning Format

**Context**: SPEC section 6 nói "Response SHOULD bao gồm metadata cảnh báo về việc áp dụng giá trị mặc định".

**Question**: Format metadata warnings như thế nào?

**Option A** (Detailed):
```javascript
{
  success: true,
  data: {...},
  metadata: {
    warnings: [
      { field: "limit", originalValue: "abc", appliedValue: 20, reason: "Invalid format" }
    ]
  }
}
```

**Option B** (Simple):
```javascript
{
  success: true,
  data: {...},
  metadata: {
    warnings: ["Pagination limit was invalid, using default value 20"]
  }
}
```

**Impact**: API contract với frontend.

---

### Q4: Empty Sections Representation

**Context**: SPEC section 5 nói dùng LEFT JOIN để courses mới được duyệt (chưa có sections) vẫn hiển thị với "mảng rỗng []".

**Question**: Response structure cho course không có sections:

**Option A**:
```javascript
{
  course: {
    id: "...",
    title: "...",
    sections: []  // Empty array
  }
}
```

**Option B**:
```javascript
{
  course: {
    id: "...",
    title: "...",
    sections: null  // NULL indicates no sections
  }
}
```

**Recommendation**: Option A (empty array) để frontend không cần check null.

---

### Q5: Database Connection Timeout Value

**Context**: SPEC section 6 nói "WHERE kết nối Database bị timeout, trả về HTTP 503".

**Question**: 
- Prisma query timeout nên set bao nhiêu giây? (Đề xuất: 5s)
- Connection pool size nên là bao nhiêu? (Đề xuất: 10 connections cho MVP)

**Impact**: Performance và reliability under load.

---

### Q6: Error Response Format for 404

**Context**: SPEC section 3 nói "WHERE không tìm thấy courseId, trả về HTTP 404".

**Question**: Error response format cụ thể?

**Option A** (Align với project error handling):
```javascript
{
  success: false,
  message: "Course not found",
  code: "COURSE_NOT_FOUND"
}
```

**Option B** (Verbose):
```javascript
{
  success: false,
  error: {
    code: "COURSE_NOT_FOUND",
    message: "Course not found",
    details: { courseId: "abc-123" }
  }
}
```

**Recommendation**: Cần check error handler pattern hiện có trong project (CLAUDE.md hoặc existing controllers).

---

## 7. TESTING STRATEGY

### 7.1 Unit Tests

**Repository Tests** (`catalog.repository.test.js`):
- Mock Prisma client
- Test `findPublishedCoursesWithPagination()` với various filters
- Test `countPublishedCourses()`
- Test `findCourseByIdWithDetails()` với courseId valid/invalid

**Service Tests** (`catalog.service.test.js`):
- Mock repository
- Test `getPublishedCourses()` với valid pagination
- Test `getCourseById()` với course not found, mentor blocked, draft course

**Controller Tests** (`catalog.controller.test.js`):
- Mock service
- Test request/response handling
- Test error handling (404, 503)

---

### 7.2 Integration Tests

**API Tests** (`catalog.api.test.js`):
- Use `supertest` to call actual endpoints
- Seed test database với courses (published, draft, blocked mentor)
- Test GET /courses với pagination
- Test GET /courses/:id với valid/invalid courseId
- Test acceptance criteria scenarios (SPEC section 7)

---

### 7.3 Performance Tests

**Load Testing** (manual or script):
- Tool: `artillery` hoặc `k6`
- Scenario: 100 concurrent users calling GET /courses
- Measure: p95 response time < 500ms
- Target: Pass NFR requirement

---

## 8. IMPLEMENTATION CHECKLIST

- [ ] Phase 1: Create `catalog.repository.js` with 3 functions
- [ ] Phase 1: Unit test repository
- [ ] Phase 2: Create `catalog.service.js` with 2 functions
- [ ] Phase 2: Unit test service
- [ ] Phase 3: Create `validatePagination.middleware.js`
- [ ] Phase 3: Create `catalog.validator.js` with Zod schemas
- [ ] Phase 3: Create `catalog.controller.js` with 2 handlers
- [ ] Phase 3: Unit test controller and middleware
- [ ] Phase 4: Create `catalog.routes.js`
- [ ] Phase 4: Register routes in `backend/src/api/index.js`
- [ ] Phase 4: Integration tests with supertest
- [ ] Phase 5: Verify acceptance criteria (SPEC section 7)
- [ ] Phase 5: Performance test (p95 < 500ms)
- [ ] Phase 6: Get answers for Q1-Q6 from human
- [ ] Phase 6: Update implementation based on answers

---

## 9. SUCCESS CRITERIA

Implementation được coi là **DONE** khi:

1. ✅ Tất cả acceptance criteria trong SPEC section 7 pass
2. ✅ Unit tests coverage ≥ 80%
3. ✅ Integration tests pass (GET /courses, GET /courses/:id)
4. ✅ Performance test: p95 < 500ms với 100 concurrent users
5. ✅ Security test: IDOR attack bị chặn (cannot access draft courses)
6. ✅ Code review pass (tuân thủ AGENTS.md và CLAUDE.md)
7. ✅ No console.log, no debug statements, no commented code
8. ✅ Error handling đầy đủ (404, 503, validation errors)

---

**End of PLAN.md**
