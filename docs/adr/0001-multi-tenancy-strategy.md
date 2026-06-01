# ADR-0001: Multi-Tenancy Strategy

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** TechNeura Engineering

---

## Context

LeaderPrism is a SaaS platform serving multiple independent organisations (HR consultancies and their enterprise clients). Each organisation's data must be strictly isolated. We need to choose a multi-tenancy model before any code is written, as it affects every table and every query.

The three canonical approaches are:

| Approach | Isolation | Operational Cost | Dev Complexity |
|----------|-----------|-----------------|----------------|
| Separate database per tenant | Highest | Very high (one DB per customer) | High |
| Separate schema per tenant | High | Medium (one schema per customer) | Medium |
| Shared schema, shared database | Lowest at DB level | Low (single DB) | Low–Medium |

---

## Decision

**Shared database, shared schema with application-level tenant scoping (Phase 0) and PostgreSQL Row-Level Security (Phase 5 hardening).**

### Phase 0 (MVP): Application-Level Scoping
- Every entity has an `organisation_id` UUID column as a non-nullable foreign key
- A NestJS `TenantGuard` extracts `orgId` from the validated JWT payload
- All service methods accept and filter by `organisationId` explicitly
- TypeORM repositories use `WHERE organisation_id = :orgId` on every query
- The `@CurrentOrgId()` decorator injects `req.user.orgId` into controllers

### Phase 5 (Hardening): PostgreSQL RLS
After pilot, add RLS as defence-in-depth:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
  USING (organisation_id = current_setting('app.current_organisation_id')::uuid);
```
NestJS middleware sets `SET LOCAL app.current_organisation_id = '<uuid>'` at the start of each DB transaction.

---

## Consequences

**Positive:**
- Single database is operationally simple for a 3–4 person team
- All tenants share infrastructure cost at MVP scale
- Standard PostgreSQL tooling (backups, monitoring, migrations) applies to one instance
- Easy to add RLS later without structural changes

**Negative:**
- Application code must be disciplined — forgetting `organisation_id` in a query is a data leak. Enforce via code review checklist.
- A noisy tenant can impact DB performance for all tenants (mitigate with query timeouts and plan limits)
- Regulatory requirements (PDPA data residency) are met at the Azure region level, not at DB level

**Constraints this creates:**
- Every table that holds tenant data MUST have `organisation_id UUID NOT NULL` with a FK to `organisations.id`
- No raw SQL queries without explicit `WHERE organisation_id = $1`
- Service tests must always pass an `organisationId` fixture — never test without it

---

## Alternatives Considered

**Separate DB per tenant:** Rejected. For 3–4 person team with 10–50 initial clients, provisioning, migrating, and monitoring 50 databases is operationally unsustainable.

**Separate schema per tenant:** Rejected. TypeORM does not handle schema-per-tenant cleanly. Migration management becomes exponentially complex.
