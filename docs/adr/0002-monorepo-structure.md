# ADR-0002: Monorepo Structure

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** TechNeura Engineering

---

## Context

The platform has three deployable units: a Next.js frontend, a NestJS backend API, and shared TypeScript types/enums. We need to decide how to organise these in version control.

Options:
1. Separate repositories per service
2. Single monorepo with npm workspaces
3. Turborepo / Nx monorepo

---

## Decision

**npm workspaces monorepo with three packages: `api/`, `web/`, `shared/`.**

```
leaderprism/
├── api/          # NestJS backend
├── web/          # Next.js frontend
├── shared/       # Shared TypeScript types, enums, DTOs
├── infra/        # Bicep IaC (not a workspace package)
├── docs/         # ADRs, guidelines
├── docker-compose.yml
├── package.json  # workspace root
└── CLAUDE.md
```

The `shared/` package is imported by both `api/` and `web/` as a local workspace dependency, ensuring type safety across the API boundary without code duplication.

---

## Consequences

**Positive:**
- Single `git clone` + `npm install` to get running
- Shared types enforce contract between API and web — a DTO change in `shared/` fails compilation in both packages immediately
- Single CI pipeline can test and deploy all packages
- Easy atomic commits across packages (e.g., add a new DTO field, update both usages in one commit)

**Negative:**
- `npm install` at root installs all packages (acceptable trade-off for a 3–4 person team)
- No per-package deployment triggers without additional tooling (Turborepo) — acceptable for MVP

**Why not Turborepo/Nx:**
- Adds configuration complexity for a team of 3–4
- Can migrate later if build times become an issue
- npm workspaces scripts (e.g., `npm run test -w api`) are sufficient

---

## Package Responsibilities

| Package | Contents | Published? |
|---------|----------|-----------|
| `shared` | TypeScript enums, response types, shared DTO interfaces | No (local only) |
| `api` | NestJS application — all backend logic | No (Docker image) |
| `web` | Next.js application — all frontend code | No (Docker image) |

---

## Import Convention

```typescript
// In api/ or web/ — import shared types
import { UserRole, AssessmentType } from '@leaderprism/shared';

// Never cross-import between api/ and web/
// api/ must never import from web/
// web/ must never import from api/
```
