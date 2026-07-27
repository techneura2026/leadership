# LeaderPrism — Claude Code Context

## What This Is

LeaderPrism is a **SaaS 360° Leadership Assessment Platform** for HR consultancies. It covers four assessment use cases: 360-degree feedback, leadership competency assessment, Big Five personality profiling, and leadership readiness/potential assessment.

Built by TechNeura Consulting. Target market: Sri Lankan and regional HR consultancies.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS 10, TypeScript, TypeORM |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 (BullMQ) |
| File storage | Azure Blob Storage |
| Email | Azure Communication Services |
| PDF generation | Puppeteer (Chromium headless) |
| Auth | JWT (access) + HttpOnly cookie (refresh), Passport.js |

## Monorepo Packages

```
api/        NestJS backend — all backend logic
web/        Next.js frontend (the product app)
shared/     Shared TypeScript types, enums, interfaces
landing/    Next.js public landing site — independent app, own Next/React/Tailwind
            versions, static-exported and deployed to Azure Static Web Apps (not the Tailwind-only
            / no-CSS-files rule below — it's a self-contained site with its own design system)
infra/      Terraform IaC (infra/terraform)
```

## Key Commands

```bash
# Start local infrastructure (PostgreSQL + Redis)
npm run db:up

# Start both api and web in dev mode
npm run dev

# Start individually
npm run dev:api
npm run dev:web
npm run dev:landing

# Run migrations
npm run db:migrate

# Seed default competency framework
npm run db:seed

# Tests
npm run test -w api
npm run test:e2e -w web

# Generate a new DB migration
npm run migration:generate -w api -- src/migrations/MyMigrationName
```

## Critical Architecture Rules

### Multi-Tenancy (READ THIS FIRST)

Every entity that stores per-organisation data has `organisationId`. **Every query MUST filter by `organisationId`**. This is the primary data isolation mechanism.

- `organisationId` always comes from `req.user.orgId` (JWT payload), **never from the request body**
- The `@CurrentOrgId()` decorator injects it automatically
- Forgetting this = data leak between tenants

See [ADR-0001](docs/adr/0001-multi-tenancy-strategy.md) for the full strategy.

### Module Boundaries

NestJS modules communicate only through exported services. A module **must never** access another module's repository or entity directly. Cross-module access goes through the owning module's service interface.

### No `synchronize: true`

TypeORM `synchronize: true` is disabled in all environments. Use migrations: `npm run migration:generate -w api -- src/migrations/Name`.

## Module Map

```
api/src/
├── core/
│   ├── auth/          # JWT, Passport, login/register/refresh
│   ├── organisations/ # Org CRUD, departments, plan management
│   ├── users/         # User CRUD, invitations, roles
│   ├── notifications/ # Email queue (BullMQ), templates
│   └── database/      # TypeORM config, tenant middleware
│
├── assessment/
│   ├── engine/        # Assessment lifecycle (create/launch/close)
│   ├── items/         # Item bank, competency library
│   ├── uc1-feedback/  # 360-degree feedback
│   ├── uc2-competency/# Competency assessment
│   ├── uc3-personality/# Big Five personality profiling
│   └── uc4-readiness/ # Leadership readiness / potential
│
├── reporting/         # PDF generation (Puppeteer, BullMQ)
├── analytics/         # Org-level aggregations, heatmaps
└── shared/            # Decorators, filters, interceptors, base entities
```

## User Roles

```typescript
enum UserRole {
  SUPER_ADMIN    // TechNeura staff — cross-org access
  ORG_ADMIN      // Organisation administrator
  HR_MANAGER     // HR manager within org
  MANAGER        // People manager (rates direct reports)
  PARTICIPANT    // Leader being assessed
}
```

## Authentication Flow

1. POST `/api/v1/auth/register` — creates org + admin user
2. POST `/api/v1/auth/login` — returns access token (body) + sets refresh cookie
3. POST `/api/v1/auth/refresh` — rotates refresh token, returns new access token
4. POST `/api/v1/auth/logout` — invalidates session, clears cookie

Rater (anonymous): `GET /api/v1/rater/:token` — UUID token from email link, no login required.

## Adding a New Assessment Module

1. Create `api/src/assessment/uc<N>-<name>/` with module, controller, service, entities, dto
2. Add the module to `assessment/assessment.module.ts`
3. Add route prefix to `api-conventions.md`
4. Create TypeORM entities — remember `organisationId` on every entity
5. Generate migration: `npm run migration:generate -w api -- src/migrations/AddUcNTables`
6. Add shared response types to `shared/src/types/`

## What NOT to Generate

- No microservices — modular monolith only (see ADR-0003)
- No `synchronize: true` in TypeORM config
- No raw SQL without parameterised queries
- No JWT secrets in code — use `process.env.JWT_ACCESS_SECRET`
- No `console.log` — use NestJS `Logger` (`this.logger = new Logger(ClassName.name)`)
- No localStorage for tokens — access token in Zustand memory only
- No direct DB queries that skip `organisationId` filter
- No CSS modules or styled-components — Tailwind only

## Local Dev Environment

Docker Compose provides PostgreSQL 16 and Redis 7. No cloud services needed locally.

```
API:      http://localhost:3001
Web:      http://localhost:3000
Landing:  http://localhost:3002
Swagger:  http://localhost:3001/api/docs
DB:       localhost:5432 (user: leaderprism, pass: leaderprism_dev, db: leaderprism)
Redis:    localhost:6379
```

## Phase Status

- [x] Phase 0 — Foundation (auth, org, users, DB, Docker Compose)
- [x] Phase 1 — Items module, assessment engine, notifications, seed data
- [x] Phase 2 — UC1/UC2/UC3 modules, scoring engines, assessment interfaces
- [x] Phase 3 — PDF reporting (Puppeteer + Handlebars), BullMQ queue, report templates
- [x] Phase 4 — UC4 readiness, analytics, succession dashboard (9-box)
- [x] Phase 5 — 55 unit tests passing, Playwright E2E setup, build verified
- [x] Landing site — landing page live on Azure Static Web Apps (infra/terraform)
- [ ] Prod deployment — Azure resources (infra/terraform, VM + Static Web App provisioned for dev)
