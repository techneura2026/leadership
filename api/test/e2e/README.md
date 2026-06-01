# LeaderPrism — E2E Test Suite

## Overview

85 test scenarios covering all QA scenarios from `docs/qa-scenarios.md`.  
Tests run against a real PostgreSQL database and a real NestJS application (no mocks).

## Test Suite Structure

| File | Section | Scenarios |
|------|---------|-----------|
| `01-auth.e2e-spec.ts` | Authentication & Session | QA-AUTH-001–013 |
| `02-multi-tenancy.e2e-spec.ts` | Multi-Tenancy / Data Isolation | QA-TENANT-001–006 |
| `03-rbac.e2e-spec.ts` | Role-Based Access Control | QA-RBAC-001–004 |
| `04-assessment-lifecycle.e2e-spec.ts` | Assessment Lifecycle & Plan Limits | QA-ASS-001–010 |
| `05-360-feedback.e2e-spec.ts` | 360-Degree Feedback (UC1) | QA-360-001–011 |
| `06-competency.e2e-spec.ts` | Competency Assessment (UC2) | QA-COMP-001–004 |
| `07-personality.e2e-spec.ts` | Big Five Personality (UC3) | QA-PERS-001–008 |
| `08-readiness.e2e-spec.ts` | Leadership Readiness (UC4) | QA-READY-001–005 |
| `09-reports.e2e-spec.ts` | Report Generation | QA-RPT-001–007 |
| `10-analytics.e2e-spec.ts` | Analytics & Dashboard | QA-ANA-001–003 |
| `11-validation.e2e-spec.ts` | Input Validation & Error Responses | QA-VAL-001–006 |
| `12-rate-limiting.e2e-spec.ts` | Rate Limiting | QA-RATE-001–003 |
| `13-security.e2e-spec.ts` | Security | QA-SEC-001–007 |

## Prerequisites

- Docker running: `npm run db:up` (PostgreSQL + Redis)
- Node.js 20+
- `api/.env.test` exists (committed to repo — no secrets)

## Running E2E Tests

```bash
# From the repo root — resets DB, seeds, runs all 85 tests
npm run e2e

# From the api/ directory
npm run test:e2e

# Watch mode (re-runs on file change)
npm run test:e2e:watch

# Single suite
cd api && npx jest --config jest.e2e.config.js test/e2e/01-auth.e2e-spec.ts
```

## How It Works

### Global Setup (`setup/global-setup.ts`)
Runs once before all tests:
1. Applies any pending TypeORM migrations
2. Truncates all tables (cascade via `TRUNCATE organisations CASCADE`)
3. Seeds reference data: competency framework (8 domains, 16+ competencies), 60 Big Five items, normative data for 5 factors

Each test suite registers its own organisation via the API and is responsible for creating its own data. No cross-suite state dependencies.

### Test Isolation
- Each `describe` block registers a unique organisation (slug includes a timestamp)
- Tests within a suite share the org but are ordered intentionally
- Cross-tenant tests (Section 02) register separate organisations and verify data cannot cross org boundaries

### Realistic Test Data
All test data uses Sri Lankan names and organisations:
- **Primary org:** Strategic Talent Partners (professional plan)
- **Trial org:** Peak Performance Consulting (trial plan)
- **Isolation org:** Nexus Leadership Group

### Assertions
- Success responses: `res.body.data` contains the payload
- Error responses: `res.body.error.code` contains the machine-readable error code
- HTTP status codes are always asserted first (`.expect(200)`, `.expect(201)`, etc.)

## Setup Files

```
test/e2e/
├── setup/
│   ├── global-setup.ts     — DB reset + migrations + seeds (runs once)
│   ├── global-teardown.ts  — Closes DataSource
│   ├── app.ts              — NestJS test application factory (singleton)
│   ├── factories.ts        — Realistic test data constants
│   └── helpers.ts          — Auth helpers, HTTP helpers, DB helpers
├── scripts/
│   └── reset-and-run.ts    — Standalone DB reset script (for debugging setup)
└── 01-auth.e2e-spec.ts … 13-security.e2e-spec.ts
```
