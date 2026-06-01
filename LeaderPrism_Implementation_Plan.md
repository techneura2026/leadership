# LeaderPrism 360° Leadership Assessment Platform
## Detailed Implementation Plan
**Stack:** Next.js 14 · NestJS · PostgreSQL 16 · Azure**  
**Timeline:** 14 Weeks | **Team:** 3–4 Developers + 1 IO Psychologist/Content Specialist

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Azure Infrastructure Design](#2-azure-infrastructure-design)
3. [Database Schema Design](#3-database-schema-design)
4. [NestJS Backend Structure](#4-nestjs-backend-structure)
5. [Next.js Frontend Structure](#5-nextjs-frontend-structure)
6. [Phase-wise Implementation Plan](#6-phase-wise-implementation-plan)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Security & Compliance](#8-security--compliance)
9. [Azure Cost Estimate](#9-azure-cost-estimate)

---

## 1. Architecture Overview

### 1.1 System Pattern: Modular Monolith

LeaderPrism uses a **modular monolith** — not microservices. Clear module boundaries enable independent development across the 3–4 person team without the operational overhead of a distributed system.

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Front Door (CDN/WAF)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────┐            ┌────────────────┐
│  Next.js 14   │            │  NestJS API    │
│ (App Router)  │◄──REST────►│  (Port 3001)   │
│ Azure App     │            │  Azure App     │
│ Service (Node)│            │  Service (Node)│
└───────────────┘            └───────┬────────┘
                                     │
               ┌─────────────────────┼──────────────────────┐
               ▼                     ▼                      ▼
      ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
      │ Azure Database  │  │ Azure Cache for  │  │ Azure Blob       │
      │ for PostgreSQL  │  │ Redis            │  │ Storage          │
      │ Flexible Server │  │ (Sessions, Queue)│  │ (PDFs, Uploads)  │
      └─────────────────┘  └──────────────────┘  └──────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS | SSR for reports/SEO; RSC reduces client bundle; built-in API routes for BFF |
| Backend API | NestJS 10 + TypeScript | Enterprise structure, decorators, Guards, Interceptors; excellent DI |
| ORM | TypeORM + PostgreSQL driver | Native TypeScript; migrations; RLS support |
| Database | PostgreSQL 16 | Multi-tenant RLS; JSON support for flexible responses; ACID |
| Cache / Queue | Azure Cache for Redis (ioredis + BullMQ) | Session store, rate limiting, PDF generation queue |
| File Storage | Azure Blob Storage | S3-compatible; native Azure integration |
| Email | Azure Communication Services (Email) | Transactional email; GDPR/PDPA compliant; Azure-native |
| PDF Generation | Puppeteer (Chromium headless) | Full HTML→PDF control for branded reports |
| Authentication | Passport.js (JWT + Local strategy) | Stateless, extensible to SAML/SSO later |
| Background Jobs | BullMQ on Redis | Report generation, email batching, reminders |
| Monitoring | Azure Application Insights + Azure Monitor | Distributed tracing, alerts, dashboards |
| Secrets | Azure Key Vault | No secrets in environment variables or code |
| Container Registry | Azure Container Registry | Private Docker image storage |

---

## 2. Azure Infrastructure Design

### 2.1 Resource Groups

```
leaderprism-rg-prod       (Production)
leaderprism-rg-staging    (Staging / UAT)
leaderprism-rg-dev        (Development)
```

### 2.2 Azure Services per Environment

```
┌─────────────────────────────────────────────────────────────────┐
│  leaderprism-rg-prod (Region: Southeast Asia — Singapore)       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Networking Layer                                         │   │
│  │  • Azure Front Door Premium (WAF + CDN + HTTPS offload)  │   │
│  │  • Custom domain: app.leaderprism.com                    │   │
│  │  • Azure Virtual Network (10.0.0.0/16)                   │   │
│  │    - subnet-app  (10.0.1.0/24) — App Services            │   │
│  │    - subnet-data (10.0.2.0/24) — DB + Redis              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Compute Layer                                            │   │
│  │  • Azure App Service Plan (P2v3, Linux)                  │   │
│  │    - leaderprism-api (NestJS, 2 instances)               │   │
│  │    - leaderprism-web (Next.js, 2 instances)              │   │
│  │  • Azure Container Registry (leaderprismacr)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Data Layer                                               │   │
│  │  • Azure Database for PostgreSQL Flexible Server         │   │
│  │    - SKU: Standard_D2ds_v4 (2 vCores, 8 GB RAM)         │   │
│  │    - Storage: 128 GB with auto-grow                      │   │
│  │    - Zone-redundant HA (standby replica)                 │   │
│  │    - Automated backups: 35-day retention                 │   │
│  │  • Azure Cache for Redis (C1 Standard, 1 GB)             │   │
│  │  • Azure Blob Storage (leaderprismstore)                 │   │
│  │    - Container: reports (PDF files)                      │   │
│  │    - Container: uploads (CSV, logos)                     │   │
│  │    - Lifecycle: move to Cool tier after 90 days          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Supporting Services                                      │   │
│  │  • Azure Key Vault (leaderprism-kv)                      │   │
│  │  • Azure Communication Services (email sending)          │   │
│  │  • Azure Application Insights (APM + logging)            │   │
│  │  • Azure Monitor (alerts + dashboards)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Infrastructure as Code

Use **Bicep** (Azure-native IaC) with the following file structure:

```
infra/
├── main.bicep               # Root orchestration
├── modules/
│   ├── app-service.bicep
│   ├── postgres.bicep
│   ├── redis.bicep
│   ├── blob-storage.bicep
│   ├── key-vault.bicep
│   ├── front-door.bicep
│   └── app-insights.bicep
├── parameters/
│   ├── dev.bicepparam
│   ├── staging.bicepparam
│   └── prod.bicepparam
└── scripts/
    ├── deploy.sh
    └── setup-secrets.sh
```

### 2.4 Scaling Strategy

| Service | Dev | Staging | Prod |
|---------|-----|---------|------|
| App Service Plan | B1 (1 vCore) | B2 (2 vCores) | P2v3 (2 vCores) × 2 |
| PostgreSQL | Burstable B1ms | Standard D2ds | Standard D2ds with HA |
| Redis | C0 Basic | C1 Standard | C1 Standard |
| Blob Storage | LRS | LRS | ZRS |

---

## 3. Database Schema Design

### 3.1 Multi-Tenancy Approach

**Shared database, shared schema with Row-Level Security (RLS).**

Every table has `organisation_id` as a foreign key. PostgreSQL RLS policies enforce data isolation — no tenant can query another tenant's data even if API security is misconfigured.

```sql
-- Enable RLS on every tenant-scoped table
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows from their organisation
CREATE POLICY tenant_isolation ON assessments
  USING (organisation_id = current_setting('app.current_organisation_id')::uuid);

-- NestJS sets this at the start of each request
SET app.current_organisation_id = '<uuid>';
```

### 3.2 Core Schema

```sql
-- ============================================================
-- CORE: Authentication & Organisation
-- ============================================================

CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  logo_url        TEXT,
  primary_colour  CHAR(7) DEFAULT '#1E40AF',
  branding_name   VARCHAR(255),
  plan            VARCHAR(50) DEFAULT 'trial',
  is_active       BOOLEAN DEFAULT true,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  parent_id       UUID REFERENCES departments(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id),
  email           VARCHAR(255) NOT NULL,
  password_hash   TEXT,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  role            VARCHAR(50) NOT NULL CHECK (role IN ('superadmin','org_admin','hr_manager','participant','manager')),
  job_title       VARCHAR(255),
  avatar_url      TEXT,
  language_pref   CHAR(2) DEFAULT 'en',
  is_active       BOOLEAN DEFAULT true,
  email_verified  BOOLEAN DEFAULT false,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, email)
);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token   TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COMPETENCY LIBRARY
-- ============================================================

CREATE TABLE competency_domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),  -- NULL = global/system
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(20) NOT NULL,
  colour          CHAR(7),
  display_order   INT DEFAULT 0
);

CREATE TABLE competencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),  -- NULL = system default
  domain_id       UUID NOT NULL REFERENCES competency_domains(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  display_order   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE competency_levels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id   UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  level           INT NOT NULL CHECK (level BETWEEN 1 AND 4),
  label           VARCHAR(50) NOT NULL,  -- Emerging, Developing, Proficient, Mastery
  description     TEXT NOT NULL,
  indicators      JSONB DEFAULT '[]',    -- Array of behavioural indicators
  UNIQUE(competency_id, level)
);

CREATE TABLE competency_behaviours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id   UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  statement       TEXT NOT NULL,
  display_order   INT DEFAULT 0
);

-- ============================================================
-- ITEM BANK (Questions / Scenarios)
-- ============================================================

CREATE TYPE item_type AS ENUM ('likert', 'forced_choice', 'mcq', 'open_text', 'sjt_scenario', 'rating_scale');

CREATE TABLE items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  item_type       item_type NOT NULL,
  module          VARCHAR(50) NOT NULL,  -- '360','competency','personality','sjt','learning_agility'
  factor          VARCHAR(100),          -- Big Five factor, or competency code
  stem            TEXT NOT NULL,
  options         JSONB,                 -- MCQ/forced-choice options
  scoring_key     JSONB,                 -- Correct answer or reverse-scoring flag
  is_reverse      BOOLEAN DEFAULT false,
  language        CHAR(2) DEFAULT 'en',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ASSESSMENTS (Core lifecycle)
-- ============================================================

CREATE TYPE assessment_type AS ENUM ('360_feedback', 'competency', 'personality', 'readiness');
CREATE TYPE assessment_status AS ENUM ('draft', 'active', 'closed', 'archived');

CREATE TABLE assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  assessment_type assessment_type NOT NULL,
  status          assessment_status DEFAULT 'draft',
  config          JSONB NOT NULL DEFAULT '{}',
  -- config stores: competency_ids, rating_scale, open_ended_enabled,
  --                rater_min_threshold, reminder_days, instructions
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessment_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  target_role_id  UUID REFERENCES role_profiles(id),   -- For UC4
  status          VARCHAR(50) DEFAULT 'invited',
  completed_at    TIMESTAMPTZ,
  UNIQUE(assessment_id, user_id)
);

-- ============================================================
-- UC1: 360 FEEDBACK
-- ============================================================

CREATE TYPE rater_relationship AS ENUM ('self', 'supervisor', 'peer', 'direct_report', 'stakeholder');

CREATE TABLE rater_nominations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES users(id),
  rater_email     VARCHAR(255) NOT NULL,
  rater_name      VARCHAR(255),
  relationship    rater_relationship NOT NULL,
  token           UUID UNIQUE DEFAULT gen_random_uuid(),
  token_expires   TIMESTAMPTZ,
  status          VARCHAR(50) DEFAULT 'pending',  -- pending, approved, declined, completed
  approved_by     UUID REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rater_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id   UUID NOT NULL REFERENCES rater_nominations(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES items(id),
  competency_id   UUID REFERENCES competencies(id),
  score           NUMERIC(4,2),
  open_text       TEXT,
  responded_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- UC2: COMPETENCY ASSESSMENT
-- ============================================================

CREATE TABLE competency_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES users(id),
  assessor_id     UUID NOT NULL REFERENCES users(id),
  assessor_type   VARCHAR(20) NOT NULL,  -- 'self', 'manager'
  submitted_at    TIMESTAMPTZ
);

CREATE TABLE competency_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ca_id           UUID NOT NULL REFERENCES competency_assessments(id) ON DELETE CASCADE,
  competency_id   UUID NOT NULL REFERENCES competencies(id),
  level_rated     INT CHECK (level_rated BETWEEN 1 AND 4),
  evidence_text   TEXT,
  development_comment TEXT
);

-- ============================================================
-- UC3: PERSONALITY (Big Five)
-- ============================================================

CREATE TABLE personality_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES users(id),
  item_id         UUID NOT NULL REFERENCES items(id),
  response_value  INT NOT NULL,  -- 1-5 Likert or 1/2 forced-choice
  responded_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE personality_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id),
  participant_id  UUID NOT NULL REFERENCES users(id),
  factor          VARCHAR(30) NOT NULL,  -- openness, conscientiousness, etc.
  raw_score       NUMERIC(6,2),
  t_score         NUMERIC(5,2),
  percentile      NUMERIC(5,2),
  calculated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assessment_id, participant_id, factor)
);

CREATE TABLE normative_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor          VARCHAR(30) NOT NULL,
  population      VARCHAR(100) DEFAULT 'sri_lanka_general',
  sample_size     INT,
  mean            NUMERIC(6,3),
  std_dev         NUMERIC(6,3),
  percentile_table JSONB,  -- {p10: x, p25: x, p50: x, p75: x, p90: x}
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- UC4: READINESS / POTENTIAL
-- ============================================================

CREATE TABLE role_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  title           VARCHAR(255) NOT NULL,
  level           VARCHAR(100),
  required_competencies JSONB,  -- [{competency_id, min_level, weight}]
  personality_fit JSONB,        -- {factor, min_percentile, max_percentile}
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sjt_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id),
  participant_id  UUID NOT NULL REFERENCES users(id),
  item_id         UUID NOT NULL REFERENCES items(id),
  selected_option INT NOT NULL,
  score           NUMERIC(4,2),
  responded_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE learning_agility_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id),
  participant_id  UUID NOT NULL REFERENCES users(id),
  item_id         UUID NOT NULL REFERENCES items(id),
  response_value  INT NOT NULL,
  responded_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE readiness_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id),
  participant_id  UUID NOT NULL REFERENCES users(id),
  role_profile_id UUID REFERENCES role_profiles(id),
  readiness_rating VARCHAR(30),  -- 'ready_now','1_2_years','developing','not_yet_ready'
  composite_score NUMERIC(5,2),
  competency_score NUMERIC(5,2),
  feedback_score  NUMERIC(5,2),
  sjt_score       NUMERIC(5,2),
  learning_agility_score NUMERIC(5,2),
  personality_fit_score  NUMERIC(5,2),
  grid_performance VARCHAR(10),  -- 'high','medium','low'
  grid_potential   VARCHAR(10),
  calculated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assessment_id, participant_id)
);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  assessment_id   UUID NOT NULL REFERENCES assessments(id),
  participant_id  UUID REFERENCES users(id),
  report_type     VARCHAR(50) NOT NULL,  -- 'individual_360','competency','personality','readiness','org_summary'
  blob_url        TEXT,
  status          VARCHAR(30) DEFAULT 'pending',
  language        CHAR(2) DEFAULT 'en',
  generated_at    TIMESTAMPTZ,
  generated_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  user_id         UUID REFERENCES users(id),
  email           VARCHAR(255),
  type            VARCHAR(100) NOT NULL,
  template_key    VARCHAR(100) NOT NULL,
  payload         JSONB DEFAULT '{}',
  status          VARCHAR(30) DEFAULT 'pending',
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_org       ON users(organisation_id);
CREATE INDEX idx_assessments_org ON assessments(organisation_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_rater_nominations_token ON rater_nominations(token);
CREATE INDEX idx_rater_nominations_assessment ON rater_nominations(assessment_id, participant_id);
CREATE INDEX idx_reports_assessment ON reports(assessment_id, participant_id);
CREATE INDEX idx_personality_responses_assessment ON personality_responses(assessment_id, participant_id);
```

---

## 4. NestJS Backend Structure

### 4.1 Project Layout

```
api/
├── src/
│   ├── main.ts                    # Bootstrap, Swagger, global pipes
│   ├── app.module.ts
│   │
│   ├── core/
│   │   ├── auth/                  # JWT, Passport strategies, Guards
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts
│   │   │       └── roles.guard.ts
│   │   │
│   │   ├── organisations/         # Org management, departments, settings
│   │   ├── users/                 # User CRUD, invitations, roles
│   │   └── notifications/         # Email queue, templates, reminders
│   │
│   ├── assessment/
│   │   ├── engine/                # Assessment lifecycle (create/configure/distribute/close)
│   │   ├── items/                 # Item bank CRUD, competency library
│   │   ├── uc1-feedback/          # 360: nominations, rater interface, anonymity engine
│   │   ├── uc2-competency/        # Competency: self/manager ratings, gap analysis
│   │   ├── uc3-personality/       # Big Five: scoring engine, T-score, norm referencing
│   │   └── uc4-readiness/         # SJT engine, learning agility, composite scoring
│   │
│   ├── reporting/
│   │   ├── reporting.module.ts
│   │   ├── pdf.service.ts         # Puppeteer HTML→PDF
│   │   ├── chart.service.ts       # Chart data calculation (radar, heatmap, bar)
│   │   ├── templates/             # Handlebars/HTML report templates
│   │   │   ├── 360-feedback.hbs
│   │   │   ├── competency.hbs
│   │   │   ├── personality.hbs
│   │   │   ├── readiness.hbs
│   │   │   └── org-summary.hbs
│   │   └── jobs/
│   │       └── report.processor.ts  # BullMQ worker
│   │
│   ├── analytics/
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   └── analytics.service.ts   # Org-level aggregations, heatmaps
│   │
│   └── shared/
│       ├── database/              # TypeORM config, RLS middleware
│       ├── azure/                 # Blob storage, Key Vault clients
│       ├── decorators/            # @CurrentUser, @OrgId, @Roles
│       ├── interceptors/          # TenantInterceptor (sets RLS context)
│       ├── filters/               # Global exception filter
│       └── dto/                   # Shared DTOs (pagination, errors)
│
├── migrations/                    # TypeORM migration files
├── seeds/                         # Seed scripts (competency framework, items)
├── test/
│   ├── unit/
│   └── e2e/
├── Dockerfile
├── .env.example
└── nest-cli.json
```

### 4.2 Key API Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

GET    /api/v1/organisations/:id
PATCH  /api/v1/organisations/:id
GET    /api/v1/organisations/:id/departments
POST   /api/v1/organisations/:id/departments
GET    /api/v1/organisations/:id/users
POST   /api/v1/organisations/:id/invite

GET    /api/v1/competencies
POST   /api/v1/competencies
PUT    /api/v1/competencies/:id
GET    /api/v1/competency-domains
GET    /api/v1/items?module=360&language=en

POST   /api/v1/assessments
GET    /api/v1/assessments
GET    /api/v1/assessments/:id
PATCH  /api/v1/assessments/:id
POST   /api/v1/assessments/:id/launch
POST   /api/v1/assessments/:id/close

# UC1: 360 Feedback
GET    /api/v1/assessments/:id/participants
POST   /api/v1/assessments/:id/participants
GET    /api/v1/assessments/:id/nominations          (participant nominates)
POST   /api/v1/assessments/:id/nominations
PATCH  /api/v1/assessments/:id/nominations/:nomId  (admin approves)
POST   /api/v1/assessments/:id/reminders
GET    /api/v1/rater/:token                         (public, token-only)
POST   /api/v1/rater/:token/responses               (public, token-only)

# UC2: Competency
POST   /api/v1/assessments/:id/competency/self
POST   /api/v1/assessments/:id/competency/manager
GET    /api/v1/assessments/:id/competency/gap-analysis

# UC3: Personality
POST   /api/v1/assessments/:id/personality/responses
GET    /api/v1/assessments/:id/personality/scores

# UC4: Readiness
POST   /api/v1/assessments/:id/sjt/responses
POST   /api/v1/assessments/:id/learning-agility/responses
GET    /api/v1/assessments/:id/readiness/:participantId

# Reports
POST   /api/v1/reports/generate
GET    /api/v1/reports/:id
GET    /api/v1/reports/:id/download   (signed Blob URL redirect)

# Analytics
GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/heatmap?assessmentId=&domain=
GET    /api/v1/analytics/succession-dashboard
```

### 4.3 Scoring Engine Design

```typescript
// UC3: Big Five T-score calculation
@Injectable()
export class PersonalityScoringService {
  async scoreAssessment(assessmentId: string, participantId: string): Promise<PersonalityScores> {
    const responses = await this.getResponses(assessmentId, participantId);
    const norms = await this.getNormativeData();

    const factorScores: Record<string, number> = {};
    for (const factor of BIG_FIVE_FACTORS) {
      const items = responses.filter(r => r.item.factor === factor);
      const raw = this.calculateRawScore(items);      // handles reverse-scored items
      const tScore = this.toTScore(raw, norms[factor]);
      const percentile = this.toPercentile(tScore);
      factorScores[factor] = { raw, tScore, percentile };
    }
    return factorScores;
  }

  private toTScore(raw: number, norm: NormData): number {
    return 50 + 10 * ((raw - norm.mean) / norm.stdDev);
  }
}

// UC4: Composite readiness scoring
@Injectable()
export class ReadinessScoringService {
  async calculateReadiness(assessmentId: string, participantId: string, roleProfileId: string) {
    const [competencyScore, feedbackScore, sjtScore, laScore, personalityFit] =
      await Promise.all([
        this.getCompetencyScore(assessmentId, participantId, roleProfileId),
        this.get360Score(participantId),
        this.getSjtScore(assessmentId, participantId),
        this.getLearningAgilityScore(assessmentId, participantId),
        this.getPersonalityFit(participantId, roleProfileId),
      ]);

    const composite = this.weightedAverage({
      competencyScore: { value: competencyScore, weight: 0.30 },
      feedbackScore:   { value: feedbackScore,   weight: 0.25 },
      sjtScore:        { value: sjtScore,         weight: 0.25 },
      laScore:         { value: laScore,          weight: 0.15 },
      personalityFit:  { value: personalityFit,  weight: 0.05 },
    });

    return { composite, readinessRating: this.mapToRating(composite), ... };
  }
}
```

### 4.4 Anonymity Engine (360)

```typescript
// Enforces minimum rater thresholds before exposing results
@Injectable()
export class AnonymityService {
  MIN_RATERS_PER_GROUP = 3;

  async canRevealResults(assessmentId: string, participantId: string): Promise<AnonymityCheck> {
    const groups = await this.getRaterGroupCounts(assessmentId, participantId);
    const issues: string[] = [];

    for (const [relationship, count] of Object.entries(groups)) {
      if (relationship !== 'supervisor' && count < this.MIN_RATERS_PER_GROUP) {
        issues.push(`Insufficient ${relationship} responses (${count}/${this.MIN_RATERS_PER_GROUP})`);
      }
    }

    return { canReveal: issues.length === 0, issues };
  }

  async getAnonymisedComments(assessmentId: string, participantId: string): Promise<string[]> {
    const comments = await this.getAllComments(assessmentId, participantId);
    return this.shuffleArray(comments);  // Remove ordering that could reveal identity
  }
}
```

---

## 5. Next.js Frontend Structure

### 5.1 App Router Layout

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout: fonts, providers
│   │   ├── page.tsx                      # Landing/login redirect
│   │   │
│   │   ├── (auth)/                       # Public auth routes
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   │
│   │   ├── (app)/                        # Protected: requires JWT
│   │   │   ├── layout.tsx                # App shell: sidebar, header
│   │   │   │
│   │   │   ├── dashboard/page.tsx        # Admin overview
│   │   │   │
│   │   │   ├── assessments/
│   │   │   │   ├── page.tsx              # Assessment list
│   │   │   │   ├── new/page.tsx          # Create wizard
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx          # Assessment detail
│   │   │   │       ├── participants/page.tsx
│   │   │   │       ├── nominations/page.tsx
│   │   │   │       └── reports/page.tsx
│   │   │   │
│   │   │   ├── my-assessments/
│   │   │   │   ├── page.tsx              # Participant: pending list
│   │   │   │   └── [id]/
│   │   │   │       ├── nominate/page.tsx
│   │   │   │       └── take/page.tsx     # Assessment interface
│   │   │   │
│   │   │   ├── reports/page.tsx          # Report centre
│   │   │   ├── competency-library/page.tsx
│   │   │   ├── succession/page.tsx       # 9-box dashboard
│   │   │   └── settings/page.tsx
│   │   │
│   │   └── rater/
│   │       └── [token]/
│   │           ├── page.tsx              # Rater landing (public, no auth)
│   │           ├── feedback/page.tsx     # Rater interface
│   │           └── thank-you/page.tsx
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn/ui base components
│   │   ├── assessment/
│   │   │   ├── WizardStepper.tsx
│   │   │   ├── RatingScale.tsx           # 5-point frequency scale
│   │   │   ├── CompetencyCard.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── SjtScenario.tsx
│   │   ├── charts/
│   │   │   ├── RadarChart.tsx            # Recharts radar
│   │   │   ├── GapAnalysisBar.tsx
│   │   │   ├── HeatmapGrid.tsx
│   │   │   ├── BigFiveSpectrum.tsx
│   │   │   └── NineBoxGrid.tsx
│   │   ├── reports/
│   │   │   └── ReportCard.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── PageHeader.tsx
│   │
│   ├── lib/
│   │   ├── api.ts                        # Axios client with interceptors
│   │   ├── auth.ts                       # Token storage, refresh logic
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── useAssessment.ts
│   │   ├── useRaterSession.ts
│   │   └── useReport.ts
│   │
│   ├── store/                            # Zustand stores
│   │   ├── auth.store.ts
│   │   └── assessment.store.ts
│   │
│   └── i18n/
│       ├── en.json
│       ├── si.json                       # Sinhala
│       └── ta.json                       # Tamil
│
├── Dockerfile
├── next.config.ts
└── tailwind.config.ts
```

### 5.2 Key UI Flows

**Assessment Creation Wizard (5 steps):**
```
Step 1: Type selection  →  Step 2: Competency selection  →
Step 3: Participants     →  Step 4: Settings & dates    →
Step 5: Review & Launch
```

**Rater Flow (no login required):**
```
Email link → Token landing page → Cluster-by-cluster rating →
Overall rating → Thank you (response encrypted + stored)
```

**Participant Flow:**
```
Dashboard → Pending assessments → Start assessment →
Progress-saved per screen → Completion confirmation
```

### 5.3 Report Rendering Strategy

Reports are generated server-side as PDFs. The frontend only downloads/previews:
- Admin clicks "Generate Report" → POST to `/api/v1/reports/generate` → BullMQ job queued
- Job runs Puppeteer on the NestJS server → PDF saved to Azure Blob
- Frontend polls report status then downloads via signed URL

```typescript
// app/(app)/reports/page.tsx — Server Component for initial load
export default async function ReportsPage() {
  const reports = await fetchReports();  // direct DB call via server action
  return <ReportList reports={reports} />;
}
```

---

## 6. Phase-wise Implementation Plan

### Phase 0 — Foundation (Week 1–2)

**Goal:** Production-ready scaffold deployed to Azure staging.

#### Engineering Tasks
| Task | Owner | Days |
|------|-------|------|
| Azure resource provisioning (Bicep: App Service, PostgreSQL, Redis, Blob, Key Vault) | Tech Lead | 1 |
| GitHub repo setup: monorepo (`/api`, `/web`, `/infra`), branch protection, PR rules | Tech Lead | 0.5 |
| NestJS project scaffold: modules, TypeORM, RLS middleware, JWT auth, Swagger | Tech Lead | 2 |
| Next.js project scaffold: App Router, Tailwind, shadcn/ui, Axios client, Zustand | FE Dev | 2 |
| PostgreSQL schema: all core tables + migrations via TypeORM | Tech Lead | 1.5 |
| Docker Compose for local dev (API + DB + Redis) | Tech Lead | 0.5 |
| GitHub Actions CI pipeline: lint, test, build, push to ACR, deploy to staging | Tech Lead | 1 |
| Seed scripts: system competency framework (8 clusters, 35–40 items) | Dev 2 | 1 |
| Azure Key Vault integration: load secrets at app startup | Tech Lead | 0.5 |

**Deliverable:** `https://leaderprism-staging.azurewebsites.net` accessible with auth working.

#### Content Tasks (IO Psychologist)
- Begin 360 competency framework: 8 clusters, behavioural descriptors
- Begin Big Five item adaptation from IPIP (60 items, contextualised)

---

### Phase 1 — Core Modules (Week 3–4)

**Goal:** Organisation management, competency library, assessment creation wizard operational.

#### Engineering Tasks
| Task | Owner | Days |
|------|-------|------|
| Org module: departments tree, user invitation emails, role-based access | Dev 2 | 3 |
| Competency library CRUD: domains, competencies, level descriptors, behaviours | Dev 2 | 2 |
| Assessment creation wizard (all 4 types): 5-step flow, config storage | FE Dev | 3 |
| User management UI: invite, activate, role assignment | FE Dev | 2 |
| 360 rater nomination flow: add raters, categorise, minimum threshold validation | Dev 2 | 2 |
| Email notification service: Azure Communication Services integration, templates | Dev 2 | 1 |

**Deliverable:** Admin can create an org, add users, define a competency framework, and start a 360 assessment.

#### Content Tasks
- 360 behavioural items v1 (review cycle with engineering)
- Competency level descriptors (4 levels × 20–25 competencies)

---

### Phase 2 — Assessment Interfaces + Scoring (Week 5–6)

**Goal:** All four assessment interfaces working end-to-end. Demo-ready by end of Week 6.

#### Engineering Tasks
| Task | Owner | Days |
|------|-------|------|
| Rater feedback interface (public, token-based): landing, cluster rating, thank-you | FE Dev | 3 |
| Self-assessment interface: progress-saved, one competency per screen | FE Dev | 2 |
| Personality assessment: 60-item questionnaire, mixed Likert + forced-choice | FE Dev | 2 |
| SJT interface: scenario + 4-option selection, countdown timer | FE Dev | 1 |
| 360 scoring engine: aggregation by perspective, anonymity enforcement | Dev 2 | 2 |
| Big Five scoring engine: raw score, T-score, percentile, norm referencing | Dev 2 | 2 |
| Admin dashboard: response rate gauges, reminder triggers, assessment cards | FE Dev | 2 |
| Automated email reminders: BullMQ scheduler (Day 3, 7, 10) | Dev 2 | 1 |

**WEEK 6 DEMO:** End-to-end 360 workflow + personality assessment. HR consultancy feedback session.

#### Content Tasks
- 360 items finalised
- Big Five items v1 complete
- First 8 SJT scenarios drafted

---

### Phase 3 — Report Generation (Week 7–8)

**Goal:** PDF reports generated for UC1, UC2, UC3.

#### Engineering Tasks
| Task | Owner | Days |
|------|-------|------|
| Puppeteer PDF service: Azure-compatible Chromium setup, HTML→PDF pipeline | Tech Lead | 2 |
| 360 Feedback Report (8–12 pages): radar chart, self-other gap bars, perspective heatmap, comment themes | Dev 2 + FE Dev | 4 |
| Competency Profile Report (6–8 pages): domain radar, RAG proficiency grid, strengths/gaps | Dev 2 + FE Dev | 3 |
| Personality Profile Report (6–8 pages): Big Five spectrum, narrative text engine, leadership implications | Dev 2 + FE Dev | 3 |
| Report branding: org logo, primary colour injection into PDF | FE Dev | 1 |
| Azure Blob upload: store PDFs, generate signed download URLs (1-hour expiry) | Tech Lead | 1 |
| BullMQ report generation queue: async generation, status polling | Tech Lead | 1 |
| Manager rating interface (UC2): rate direct report, provide evidence | FE Dev | 2 |
| Competency assessment scoring: gap calculation, RAG mapping | Dev 2 | 1 |

**Deliverable:** Downloadable branded PDF reports for 360, Competency, and Personality assessments.

#### Content Tasks
- SJT scenarios completed (15–20)
- Learning agility instrument (15 items, 5 dimensions)
- Report narrative templates (conditional text blocks per score range)

---

### Phase 4 — Readiness Module + Analytics (Week 9–10)

**Goal:** UC4 operational. Org-level analytics dashboard live.

#### Engineering Tasks
| Task | Owner | Days |
|------|-------|------|
| Role profile management: create target roles, map competency requirements + weights | Dev 2 | 2 |
| SJT engine: scenario display, scoring against expert keys | Dev 2 | 2 |
| Learning agility scoring: 5-dimension calculation | Dev 2 | 1 |
| Composite readiness scoring: weighted formula across all sources | Dev 2 | 2 |
| Readiness Report generation (10–14 pages): readiness badge, composite breakdown, 9-box, IDP | Dev 2 + FE Dev | 4 |
| Succession dashboard: 9-box grid (interactive), talent pool depth, role coverage | FE Dev | 3 |
| Org-level analytics: cohort heatmap, aggregated competency gaps, filters | FE Dev + Dev 2 | 3 |
| i18n scaffold: next-intl setup, Sinhala translation for participant-facing screens | FE Dev | 2 |

**Deliverable:** Full UC4 flow. Admin sees succession dashboard with readiness matrix.

#### Content Tasks
- Sinhala translations (priority: rater interface, participant interface)
- Report narrative finalisation
- Pilot preparation pack

---

### Phase 5 — Hardening + Pilot (Week 11–14)

**Goal:** Pilot with 20–30 real participants. Production deployment.

#### Engineering Tasks
| Task | Owner | Days |
|------|-------|------|
| Mobile responsiveness audit: all rater + participant screens tested on iOS/Android | FE Dev | 2 |
| E2E test suite (Playwright): rater flow, 360 admin flow, report generation | Dev 2 | 3 |
| Unit tests: scoring engines (Big Five, 360 aggregation, readiness composite) | Dev 2 | 2 |
| Security hardening: OWASP top 10 review, input sanitisation, rate limiting | Tech Lead | 2 |
| PDPA compliance: data residency check (Southeast Asia region), retention policies, right-to-erasure endpoint | Tech Lead | 1 |
| Performance: DB query optimisation, Redis caching for analytics, Blob CDN | Tech Lead | 2 |
| Load testing (k6): simulate 50 concurrent raters, 10 simultaneous report generations | Tech Lead | 1 |
| Production Azure deployment: App Service auto-scaling rules, alert thresholds | Tech Lead | 1 |
| Monitoring setup: Application Insights dashboards, alert rules for errors + latency | Tech Lead | 1 |
| Org summary report (admin): cohort heat maps, benchmarking charts | Dev 2 | 2 |

**Deliverable:** Production URL live. 20–30 pilot participants complete assessments. Normative baseline begins.

#### Content Tasks
- Pilot testing: item analysis, adjust item wording based on response patterns
- Normative data collection (minimum 200 respondents for Big Five norms)
- Final content corrections post-pilot

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd api && npm ci
      - run: cd api && npm run lint
      - run: cd api && npm run test:unit
      - run: cd api && npm run test:e2e

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd web && npm ci
      - run: cd web && npm run lint
      - run: cd web && npm run typecheck
      - run: cd web && npm run build

  deploy-staging:
    needs: [test-api, test-web]
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: azure/login@v1
        with: { creds: ${{ secrets.AZURE_CREDENTIALS }} }
      - name: Build and push API image
        run: |
          az acr build --registry leaderprismacr \
            --image leaderprism-api:${{ github.sha }} ./api
      - name: Deploy API to staging
        run: |
          az webapp config container set \
            --name leaderprism-api-staging \
            --resource-group leaderprism-rg-staging \
            --docker-custom-image-name leaderprismacr.azurecr.io/leaderprism-api:${{ github.sha }}
      - name: Build and push Web image
        run: |
          az acr build --registry leaderprismacr \
            --image leaderprism-web:${{ github.sha }} ./web
      - name: Deploy Web to staging
        run: |
          az webapp config container set \
            --name leaderprism-web-staging \
            --resource-group leaderprism-rg-staging \
            --docker-custom-image-name leaderprismacr.azurecr.io/leaderprism-web:${{ github.sha }}

  deploy-prod:
    needs: [test-api, test-web]
    if: github.ref == 'refs/heads/main'
    environment: production    # Requires manual approval
    runs-on: ubuntu-latest
    steps:
      # Same as staging but targets prod resource group
      # Also runs DB migrations before swap
      - name: Run DB migrations
        run: |
          az webapp ssh --name leaderprism-api-prod \
            --resource-group leaderprism-rg-prod \
            -- npm run migration:run
```

### 7.2 Deployment Slots Strategy

Use Azure App Service **deployment slots** for zero-downtime releases:
1. Deploy to `staging` slot
2. Run smoke tests against staging URL
3. Swap `staging` → `production` (atomic, zero-downtime)

---

## 8. Security & Compliance

### 8.1 Authentication & Authorisation
- **JWT** access tokens (15-minute expiry) + **Refresh tokens** (30-day, stored in HttpOnly cookie)
- **RBAC** via NestJS `@Roles()` decorator: `superadmin | org_admin | hr_manager | participant | manager`
- **Rate limiting**: `@nestjs/throttler` — 100 req/min per user, 20 req/min for rater token endpoints
- **Rater tokens**: UUID v4, stored hashed in DB, 14-day expiry, single-use per submission

### 8.2 Data Security
- All data encrypted at rest: Azure Database for PostgreSQL (AES-256), Blob Storage (SSE)
- All data encrypted in transit: TLS 1.2+ enforced by Azure Front Door
- Secrets: Azure Key Vault only — no environment variables for credentials
- PostgreSQL RLS enforced at DB level as defence-in-depth
- PDF reports: served via signed Azure Blob URLs (1-hour expiry) — no direct public access

### 8.3 PDPA (Sri Lanka Personal Data Protection Act) Compliance
- Data residency: Southeast Asia region (Singapore), configurable
- Data retention policies: automated Blob lifecycle (delete reports after 3 years)
- Right to erasure: `DELETE /api/v1/users/:id/erase` — anonymises PII, retains aggregate scores
- Consent: explicit consent captured at registration and rater entry
- Anonymity guarantee: rater minimum threshold enforced at DB and API layers

### 8.4 Assessment Anonymity Safeguards
- Rater group size < 3: results suppressed or merged (configurable per assessment)
- Comments: shuffled, stripped of ordering metadata
- Perspective groups: supervisor responses always shown separately (only 1 expected)

---

## 9. Azure Cost Estimate

### 9.1 Monthly Costs (USD) — Production

| Azure Service | SKU | Monthly Cost |
|--------------|-----|-------------|
| App Service Plan (P2v3, Linux) — shared by API + Web | 2 × P2v3 | $280 |
| Azure Database for PostgreSQL Flexible Server | Standard_D2ds_v4, 128 GB, Zone-HA | $180 |
| Azure Cache for Redis | C1 Standard, 1 GB | $55 |
| Azure Blob Storage | 50 GB + 1M transactions | $5 |
| Azure Front Door Premium | Base + 10M requests | $75 |
| Azure Communication Services (Email) | 10,000 emails/month | $1 |
| Azure Container Registry | Basic | $5 |
| Azure Key Vault | Standard, 10K operations | $5 |
| Azure Application Insights | 5 GB data/month | $12 |
| Azure Bandwidth | 10 GB egress | $1 |
| **Total Production** | | **~$619/month** |

### 9.2 Environment Cost Breakdown

| Environment | Configuration | Est. Monthly Cost |
|-------------|--------------|-------------------|
| Development | B1 App Service, Burstable PostgreSQL, Basic Redis | ~$80 |
| Staging | B2 App Service, Standard_D2ds PostgreSQL, Standard Redis | ~$220 |
| Production | P2v3 × 2, Standard_D2ds HA, Standard Redis, Front Door | ~$619 |
| **Total (all envs)** | | **~$919/month** |

### 9.3 14-Week Build Phase Cost

| Category | Low (USD) | High (USD) |
|----------|-----------|------------|
| Engineering (3.5 months, 3–4 devs) | $20,300 | $40,600 |
| IO Psychologist / Content (3.5 months) | $2,625 | $5,250 |
| Azure Infrastructure (dev + staging + prod) | $3,200 | $3,200 |
| Azure Pipelines / GitHub Actions | $0 | $0 |
| Domain, SSL (managed by Azure Front Door) | $50 | $100 |
| Monitoring / SaaS tools | $200 | $400 |
| Pilot Testing | $500 | $1,500 |
| Contingency (15%) | $3,960 | $7,660 |
| **TOTAL MVP INVESTMENT** | **$30,835** | **$58,710** |

**Realistic mid-range: USD 40,000–48,000**

---

## 10. Monorepo Structure

```
leaderprism/
├── api/                    # NestJS backend
├── web/                    # Next.js frontend
├── infra/                  # Bicep IaC
├── shared/                 # Shared TypeScript types (DTOs, enums)
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── pr-checks.yml
├── docker-compose.yml      # Local dev: API + PostgreSQL + Redis
├── .env.example
└── README.md
```

```jsonc
// package.json (root) — npm workspaces
{
  "workspaces": ["api", "web", "shared"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w api\" \"npm run dev -w web\"",
    "test": "npm run test -w api && npm run test -w web",
    "build": "npm run build -w shared && npm run build -w api && npm run build -w web"
  }
}
```

---

## 11. Post-MVP Expansion Roadmap

| Priority | Feature | Trigger | Timeline After MVP |
|----------|---------|---------|-------------------|
| 1 | Repeat 360 / trend analysis | First client re-runs after 6 months | Weeks 1–4 |
| 2 | Industry-specific competency frameworks | New industry client onboards | Weeks 2–6 |
| 3 | Tamil language support | Client with Tamil workforce | Weeks 4–8 |
| 4 | Development planning module (IDP generation) | Clients ask "what do we do with results?" | Months 2–4 |
| 5 | Team dynamics assessment | Client wants team-level data | Months 3–5 |
| 6 | White-label / multi-client management | 5+ active clients | Months 4–6 |
| 7 | Custom assessment builder | Consultancy wants proprietary instruments | Months 5–8 |
| 8 | AI narrative generation (Claude API) | Competitive pressure | Months 4–8 |

---

*LeaderPrism Implementation Plan v1.0 — Prepared for TechNeura Consulting (Pvt) Ltd*  
*Stack: Next.js 14 · NestJS 10 · PostgreSQL 16 · Azure (Southeast Asia)*
