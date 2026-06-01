# API Conventions

All NestJS backend code follows these conventions. Deviations require a comment explaining why.

---

## URL Structure

```
/api/v1/<resource>              # Collection
/api/v1/<resource>/:id          # Single item
/api/v1/<resource>/:id/<sub>    # Sub-resource
```

All routes are prefixed with `/api/v1` in `main.ts`. Do not include this prefix in controller `@Controller()` decorators.

```typescript
@Controller('assessments')  // resolves to /api/v1/assessments
```

---

## HTTP Methods

| Operation | Method | Body | Success Code |
|-----------|--------|------|-------------|
| List | GET | — | 200 |
| Get single | GET | — | 200 |
| Create | POST | DTO | 201 |
| Full replace | PUT | DTO | 200 |
| Partial update | PATCH | Partial DTO | 200 |
| Delete (soft) | DELETE | — | 200 `{ success: true }` |
| Action (non-CRUD) | POST | DTO | 200 |

Use action endpoints for state transitions: `POST /assessments/:id/launch`, `POST /assessments/:id/close`.

---

## Response Envelope

Every response (success or error) uses this envelope via `TransformInterceptor`:

```typescript
// Success
{ "data": <payload>, "meta": { "timestamp": "..." } }

// List with pagination
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }

// Error (HttpException)
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {...} } }
```

---

## DTO Rules

1. Every POST/PUT/PATCH endpoint has a dedicated DTO class in `dto/`
2. DTOs use `class-validator` decorators — not manual validation
3. Response types are exported from `shared/` — DTOs that cross the API boundary belong there
4. Input DTOs live in `api/` — they are not exported to `web/`

```typescript
// api/src/core/auth/dto/login.dto.ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

---

## Error Codes

Use machine-readable error codes (not just HTTP status). Defined in `shared/src/enums/error-codes.enum.ts`.

```typescript
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORISED = 'UNAUTHORISED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  ASSESSMENT_CLOSED = 'ASSESSMENT_CLOSED',
  RATER_TOKEN_INVALID = 'RATER_TOKEN_INVALID',
  ANONYMITY_THRESHOLD_NOT_MET = 'ANONYMITY_THRESHOLD_NOT_MET',
}
```

---

## Guards Order

Apply guards in this order on every protected endpoint:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
```

1. `JwtAuthGuard` — validates token, sets `req.user`
2. `RolesGuard` — checks `req.user.role` against `@Roles()`
3. `PlanGuard` — checks org plan against `@PlanLimit()`

---

## Pagination

Cursor-based pagination for lists that may grow large (responses, nominations). Offset-based for small lists (assessments, participants).

```typescript
// Query params
GET /assessments?page=1&limit=20
GET /rater-responses?cursor=<uuid>&limit=50

// Response
{
  "data": [...],
  "meta": { "total": 150, "page": 2, "limit": 20, "nextCursor": "<uuid>" }
}
```

---

## Tenant Scoping Checklist

Before merging any service method that queries the database:

- [ ] Does the query include `WHERE organisation_id = :orgId`?
- [ ] Is `orgId` sourced from `req.user.orgId` (JWT), not from the request body?
- [ ] Does the unit test pass a specific `organisationId` fixture?
- [ ] Is there no way for user input to override the `orgId`?

---

## Swagger Documentation

All public and authenticated endpoints must have `@ApiOperation`, `@ApiResponse` decorators. The Swagger UI is available at `/api/docs` in development.
