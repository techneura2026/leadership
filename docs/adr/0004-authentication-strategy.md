# ADR-0004: Authentication Strategy

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** TechNeura Engineering

---

## Context

The platform has three distinct user types with different auth requirements:
1. **Authenticated users** (admins, HR managers, participants, managers) — must log in with email + password
2. **Anonymous raters** (360 feedback respondents) — receive a one-time email link, no account required
3. **Future:** SSO via SAML/OAuth (enterprise clients) — must be extensible

---

## Decision

### Authenticated Users: JWT with HttpOnly Cookie Refresh

- **Access token:** Short-lived JWT (15 minutes), signed with `JWT_ACCESS_SECRET`
  - Payload: `{ sub, orgId, role, email }`
  - Sent in `Authorization: Bearer <token>` header
  - Stored in memory only (Zustand store) — never localStorage or sessionStorage
- **Refresh token:** Long-lived (30 days), signed with `JWT_REFRESH_SECRET`
  - Stored as a `bcrypt` hash in the `sessions` table
  - Sent to client as `HttpOnly; Secure; SameSite=Strict` cookie
  - Token rotation: each `/auth/refresh` call issues a new refresh token and invalidates the old one

**Flow:**
```
Login → access token (response body) + refresh token (HttpOnly cookie)
↓
On 401 → call POST /auth/refresh → new access token
↓
On refresh failure → redirect to /login
```

**Why HttpOnly cookie for refresh token:** XSS attacks cannot read HttpOnly cookies. The access token in memory is short-lived enough that a brief XSS window cannot cause lasting damage.

### Anonymous Raters: Signed UUID Token

- Each rater nomination record has a `token` field (UUID v4)
- Token is stored in the DB (indexed) and sent in the invitation email URL: `/rater/<token>`
- Rater submits feedback via `POST /api/v1/rater/<token>/responses` — no Authorization header required
- Token is single-use per submission, expires after 14 days
- Submission is idempotent: a rater can update their responses until the assessment closes

### Future SSO: Passport.js Strategy Pattern

NestJS Passport strategies are designed for extension. When an enterprise client requires SAML/OIDC:
1. Add a new `SamlStrategy` to `auth/strategies/`
2. Register it in `AuthModule`
3. No changes to JWT guard or existing auth flow

---

## Consequences

**Positive:**
- Access token in memory protects against XSS (cannot be stolen from storage)
- HttpOnly refresh token protects against XSS (JavaScript cannot read it)
- Token rotation limits the blast radius of a stolen refresh token
- Single `JwtAuthGuard` protects all app routes
- Rater flow requires zero account creation — maximises completion rates

**Negative:**
- In-memory access token is lost on tab close/refresh — Next.js app must call `/auth/refresh` on mount to restore session
- CSRF is theoretically possible for cookie-based refresh endpoint — mitigate with `SameSite=Strict` and a `X-Requested-With` header check

**Session invalidation:**
- Logout: delete session row from DB
- User deactivated: session row remains but JWT claims are checked against live user on each access token refresh
- Org suspended: middleware checks `organisation.isActive` on every request

---

## Token Payload Design

```typescript
interface AccessTokenPayload {
  sub: string;      // userId
  orgId: string;    // organisationId
  role: UserRole;   // current role within org
  email: string;
}
```

The `orgId` in the token is the source of truth for tenant scoping. It is set at login and cannot be changed without re-authentication.
