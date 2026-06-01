# Database Guidelines

---

## Tenant Scoping (Critical)

Every table that holds per-organisation data MUST:
1. Have `organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE`
2. Have an index on `organisation_id`
3. Every query against that table MUST include `WHERE organisation_id = :orgId`

**The `organisation_id` must always come from `req.user.orgId` (JWT), never from the request body or URL params.**

Violation = data leak between tenants. This is the most critical rule in the codebase.

---

## Entity Conventions

```typescript
@Entity('table_name')           // snake_case table name, plural
@Index(['organisationId'])      // always index the FK
export class SomeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

Rules:
- Column names in the DB are `snake_case` (use `name:` option)
- TypeScript properties are `camelCase`
- All entities extend `BaseEntity` (see `src/shared/entities/base.entity.ts`) — except entities that genuinely don't need all base fields
- `createdAt` / `updatedAt` on every entity
- Soft deletes via `@DeleteDateColumn()` — never hard delete assessment or response data

---

## JSONB Columns

Use JSONB for flexible, schema-less data that varies per assessment type (e.g., `assessment.config`, `organisation.settings`).

```typescript
@Column({ type: 'jsonb', default: '{}' })
config: Record<string, unknown>;
```

**Rules:**
- JSONB columns must have a TypeScript interface documenting their expected shape
- Do not query inside JSONB in hot paths — extract frequently queried fields to real columns
- JSONB changes do not require migrations — but document the schema in a comment or interface

---

## Enums

Prefer TypeScript enums stored as VARCHAR in PostgreSQL (not native PG enums):

```typescript
// shared/src/enums/index.ts
export enum UserRole { ... }

// Entity
@Column({ type: 'varchar', length: 50 })
role: UserRole;
```

Reason: Adding a value to a native PG enum requires a migration and table lock. VARCHAR + application-level validation avoids this.

---

## Migration Checklist

Before running a migration in production:
- [ ] Migration is backwards-compatible — the old app version can still run against the new schema
- [ ] New NOT NULL columns have a DEFAULT value set
- [ ] Large table alterations use `ALTER TABLE ... ADD COLUMN` (not recreate)
- [ ] Indexes are created with `CREATE INDEX CONCURRENTLY` in the migration
- [ ] The `down()` function either reverses the change or throws with a runbook reference

---

## Query Performance

- All foreign keys have indexes
- Compound indexes for multi-column filters: `(organisation_id, status)`, `(assessment_id, participant_id)`
- Use `EXPLAIN ANALYZE` in development for any query over 100ms
- Analytics queries use a Redis cache (1-hour TTL) — never run heavy aggregations on every dashboard load

---

## Naming Conventions

| Object | Convention | Example |
|--------|-----------|---------|
| Tables | `snake_case`, plural | `rater_nominations` |
| Columns | `snake_case` | `organisation_id` |
| Indexes | `idx_<table>_<columns>` | `idx_users_org_email` |
| Foreign keys | `fk_<table>_<ref>` | `fk_users_organisation` |
| Migrations | `<timestamp>-PascalCaseDescription` | `1717200000000-InitialSchema` |
