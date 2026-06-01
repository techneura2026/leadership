# ADR-0006: Database Migration Strategy

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** TechNeura Engineering

---

## Context

We use PostgreSQL 16 with TypeORM. We need a migration strategy that:
- Prevents schema drift between environments
- Allows rollback
- Works with CI/CD (automated migration on deploy)
- Is safe for a shared-schema multi-tenant database

---

## Decision

**TypeORM migrations with explicit, hand-reviewed migration files. `synchronize: false` in all environments including development.**

### Rules

1. **Never use `synchronize: true`** — it auto-alters tables without review and will destroy data on a multi-tenant database
2. **Generate, then review:** Run `npm run migration:generate -w api -- src/migrations/MigrationName` to generate a diff, then manually review the generated SQL before committing
3. **One concern per migration:** A migration that adds a column should not also create an index — separate concerns, separate files
4. **Migrations are append-only:** Never edit a committed migration file. Fix mistakes in a new migration
5. **Every destructive operation requires a corresponding seed/backfill migration** — e.g., if adding `NOT NULL` to an existing column, the migration must first backfill nulls

### Migration File Naming

```
src/migrations/
├── 1717200000000-InitialSchema.ts
├── 1717200001000-AddCompetencyDomains.ts
└── 1717200002000-AddAssessmentsTable.ts
```

Prefix is a Unix timestamp in milliseconds (TypeORM default). TypeORM runs migrations in timestamp order.

### CLI Commands

```bash
# Generate migration from entity diff
npm run migration:generate -w api -- src/migrations/AddCompetencyTable

# Run pending migrations
npm run migration:run -w api

# Revert last migration
npm run migration:revert -w api

# Show migration status
npm run migration:show -w api
```

### CI/CD Integration

Migrations run automatically before the new app version starts:
```yaml
# GitHub Actions deploy step
- name: Run migrations
  run: npm run migration:run -w api
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

The migration is idempotent — TypeORM's `migrations` table tracks which have run.

### Rollback Strategy

For **non-destructive** changes (add column, add table, add index): revert with `migration:revert`.

For **destructive** changes (drop column, change type): write a forward migration only. Do not rely on `down()` — it is required by TypeORM but should throw an error with a manual rollback instruction.

```typescript
async down(queryRunner: QueryRunner): Promise<void> {
  throw new Error('Destructive migration: manual rollback required. See runbook.');
}
```

---

## Consequences

**Positive:**
- Every schema change is reviewed, versioned, and auditable in git
- `migration:run` in CI ensures prod always matches the codebase
- No surprises from auto-sync silently altering production tables

**Negative:**
- Slightly slower inner dev loop (must generate + run migration to see schema change)
- Mitigated by: fast `migration:generate` command + Docker Compose local DB resets via `npm run db:reset`
