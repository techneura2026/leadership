# LeaderPrism HRIS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LeaderPrism connectable to an external HRIS. The HRIS can push employees and departments, start assessments for its review cycles, pull competency and 360° results, receive webhooks, send employees in through single sign-on, and (Phase 2) push final performance scores back into the 9-box.

**Architecture:** A new `IntegrationsModule` (`api/src/integrations/hris/`) owns everything the HRIS touches:
- per-organisation API clients and the `ApiKeyGuard`;
- the sync, assessment-request, results, report-link, SSO-ticket and webhook endpoints, all under `/api/v1/integrations/hris/*`.

It reaches other modules only through their exported services; per CLAUDE.md, it never touches another module's repositories. Core modules publish domain events through `@nestjs/event-emitter`, and the integrations module listens for them. This means core modules never import integrations, which avoids circular module imports. Webhook delivery runs on a new BullMQ queue. The web app gains a Settings → Integrations page and an `/sso/hris` landing page.

**Tech Stack:** NestJS 10, TypeORM 0.3 + PostgreSQL 16, BullMQ 5, `@nestjs/event-emitter` (new), Node `crypto` (HMAC-SHA256, AES-256-GCM), Next.js 14 App Router + Zustand + Tailwind/shadcn, Jest + Supertest.

**Spec:** `docs/LeaderPrism-HRIS-KPI-Integration-Spec.pdf` (source HTML: the `kpi-spec/spec.html` scratchpad copy). The relevant sections are Part A §4–§7 (outputs O-1…O-9, inputs I-A…I-E, data contracts, prerequisites P-1…P-10) and Part B §10–§12. Gap context: `docs/kpi-hris-gap-analysis.md`.

## Global Constraints

- Every query on organisation data filters by `organisationId`. For integration routes, `orgId` comes from the authenticated API client (`req.integration.orgId`), **never** from the request body or query.
- Module boundaries: `IntegrationsModule` calls exported services only. Where a service lacks a method, add the method to the owning module's service and export it.
- No `synchronize: true`. Schema changes go through `npm run migration:generate -w api -- src/migrations/<Name>`; review the generated SQL before committing.
- No raw SQL without parameters. No secrets in code. Use `Logger`, not `console.log`. Tokens are never stored in `localStorage`. Use Tailwind only (no CSS modules).
- Route prefix for every integration endpoint: `/api/v1/integrations/hris/`. API key header: `X-Api-Key`. Key format: `lpk_<8-char prefix>_<43-char base64url secret>`. Only `sha256(secret)` is stored.
- Scopes (exact strings): `employees:write`, `assessments:write`, `results:read`, `reports:read`, `sso:issue`, `scores:write`, `talent:read`, `personality:read`.
- External reference fields: `externalRef` (≤ 100 chars), unique per organisation when not null. Payload field names follow spec §6 exactly: `employeeRef`, `cycleRef`, `orgRef`, `competencyRef`, `scaleMax`, `selfLevel`, `managerLevel`, `requiredLevel`, `weightInRole`, `gapSelfVsManager`, `gapVsRequired`, `managerEvidence`, `developmentComment`, `othersMean`, `gapVsSelf`, `byGroup`, `overallOthersPct`, `managerAvgPct`, `achievementVsRequiredPct`, `minRaterThreshold`, `status` (`in_progress` | `final`).
- Competency scale is 1–4. The 360 scale is `config.ratingScale ?? 5`. Anonymity threshold is `config.raterMinThreshold ?? 3`, applied per rater group **and** to the total of non-self raters. Individual 360 answers and rater identities never leave LeaderPrism through the integration.
- Webhook headers: `X-LeaderPrism-Event`, `X-LeaderPrism-Delivery`, `X-LeaderPrism-Timestamp`, `X-LeaderPrism-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">`. Events: `assessment.launched`, `assessment.closed`, `results.ready`, `report.ready`, `readiness.computed` (Phase 2).
- 9-box performance banding: `≥ 70 → high`, `≥ 40 → medium`, else `low` (same as `readiness-scoring.service.ts:346-347`).
- New env vars (add to `api/.env.example` and `deploy/hostinger` compose env): `INTEGRATION_URL_SIGNING_SECRET`, `INTEGRATION_ENCRYPTION_KEY` (32-byte base64), `API_PUBLIC_URL` (public base URL of the API, default `http://localhost:3001`). The web URL is the existing `APP_URL`.
- Tests: unit tests in `api/test/unit/*.spec.ts` (`npm run test:unit -w api -- <pattern>`); e2e tests in `api/test/e2e/NN-*.e2e-spec.ts` (`npm run db:up` first, then `npm run test:e2e -w api -- <pattern>`). New e2e files are numbered from `17-` upwards and reuse `test/e2e/setup/{app,helpers,factories}.ts`.

## Decisions taken in this plan (confirm before executing)

- **D1: Managers can be assessed.** Today `EngineService.addParticipant` (`engine.service.ts:380-389`) rejects `MANAGER` and `HR_MANAGER` as participants in non-360 assessments. The HRIS's main leadership-KPI population is people managers, so Task 6 lifts the restriction for `MANAGER` (they are rated by their own `managerId`). It is kept for `HR_MANAGER`.
- **D2: SSO uses signed one-time tickets**, issued by the HRIS through the API, for the MVP. Full OIDC/SAML is out of scope.
- **D3: One 360 assessment per employee.** LeaderPrism allows exactly one participant per 360 assessment (`engine.service.ts:400-406`), so a 360 assessment request creates one assessment per employee, all tagged with the same `cycleRef`.
- **D4: HRIS-provisioned users get an unusable random password** and `mustChangePassword = false`. They sign in through SSO. They can still use "forgot password" to get a password if they want one.

## Review Focus

1. **Manager referenced before it exists.** An employee whose `managerRef` points to someone later in the same payload, or to someone sent in a later batch, must still end up linked to that manager. If the manager is still unknown, the employee is saved with no manager and a `manager_not_found` warning. (Test in Task 5.)
2. **Email collisions.** An incoming employee whose email belongs to an existing LeaderPrism user *without* an `externalRef` is linked to that user, not duplicated. If the email belongs to a user with a *different* `externalRef`, that row is rejected with `email_conflict` and the other rows still succeed. (Test in Task 5.)
3. **HRIS retries.** Re-sending the same assessment request (same `cycleRef` and type) creates no duplicate assessments and returns 200 with the same assessment IDs. Late joiners are added. (Tests in Tasks 8 and 9.)
4. **Small 360 rater groups never leak.** Any rater group with fewer than the threshold is left out of `byGroup`. If the total of non-self raters is below the threshold, `feedback360` is `{ status: 'insufficient_raters' }` with no numbers. (Tests in Task 10.)
5. **Leaver mid-assessment.** An employee sent with `status: 'left'` while an assessment is in progress is deactivated and their sessions are revoked. Their completed results stay exportable, and SSO tickets for them are refused. (Tests in Tasks 5 and 17.)

---

## File Structure

```
api/src/integrations/
  integrations.module.ts                 # imports Users/Organisations/Engine/Uc1/Uc2/Uc4/Succession/Reporting/Auth modules
  api-clients/
    api-client.entity.ts                 # api_clients table
    api-clients.service.ts               # create (returns plaintext once), list, revoke, authenticate(rawKey)
    api-clients.controller.ts            # ORG_ADMIN JWT routes: /integrations/api-clients
    api-key.guard.ts                     # X-Api-Key → req.integration = { orgId, clientId, scopes }
    require-scopes.decorator.ts          # @RequireScopes(...scopes)
    integration-context.decorator.ts     # @IntegrationOrgId(), @IntegrationContext()
    key-format.ts                        # generateApiKey(), parseApiKey(), hashSecret()
  hris/
    hris-sync.controller.ts              # PUT departments, PUT employees
    hris-sync.service.ts                 # two-pass upserts, row results
    hris-assessments.controller.ts       # POST assessment-requests
    hris-assessments.service.ts
    hris-results.controller.ts           # GET results, POST reports, GET report-files/:id (signed)
    hris-results.service.ts              # builds EmployeeResultDto
    feedback-export.ts                   # pure: toOthersAggregate()
    competency-export.ts                 # pure: buildCompetencyBlock()
    signed-url.ts                        # signReportUrl(), verifyReportSignature()
    hris-sso.controller.ts               # POST sso-tickets
    hris-scores.controller.ts            # Phase 2: PUT performance-scores
    dto/*.dto.ts
  webhooks/
    webhook-endpoint.entity.ts           # webhook_endpoints
    webhook-delivery.entity.ts           # webhook_deliveries
    webhooks.service.ts                  # CRUD, enqueue(orgId, event, data)
    webhooks.controller.ts               # ORG_ADMIN JWT routes: /integrations/webhooks
    webhook.processor.ts                 # BullMQ 'webhooks' worker
    webhook-signing.ts                   # signPayload(), encryptSecret(), decryptSecret()
    domain-event.listener.ts             # @OnEvent → enqueue
api/src/shared/events/domain-events.ts   # event names + payload types (used by core modules)
api/src/core/auth/sso/sso-ticket.entity.ts, sso-ticket.service.ts   # Task 17
api/src/core/audit/                      # Phase 2, Task 23
shared/src/types/integrations.ts         # EmployeeResultDto etc. (exported from shared index)
web/src/app/(app)/settings/integrations/page.tsx
web/src/app/sso/hris/page.tsx
```

---

# MVP (Phase 1)

### Task 1: External reference columns

**Files:**
- Modify: `api/src/core/users/entities/user.entity.ts`, `api/src/core/organisations/entities/department.entity.ts`, `api/src/core/organisations/entities/organisation.entity.ts`, `api/src/assessment/engine/entities/assessment.entity.ts`
- Create: migration via `npm run migration:generate -w api -- src/migrations/HrisExternalRefs`
- Modify: `shared/src/types/index.ts` (`UserDto`, `DepartmentDto`, `AssessmentDto` gain the new optional fields)
- Test: `api/test/e2e/17-hris-external-refs.e2e-spec.ts`

**Interfaces:**
- Produces columns:
  - `users.external_ref varchar(100) null`, `users.hris_managed boolean default false`, `users.employment_status varchar(20) default 'active'` (`active | probation | left`), `users.designation_ref varchar(100) null`
  - `departments.external_ref`, `departments.hris_managed`
  - `organisations.external_ref`
  - `assessments.cycle_ref varchar(100) null`, `assessments.subject_ref varchar(100) null` (360 only), `assessments.source varchar(20) default 'app'` (`app | hris`)
  - Partial unique indexes `(organisation_id, external_ref) WHERE external_ref IS NOT NULL` on users and departments; plain index `(organisation_id, cycle_ref)` on assessments.
- Entity properties: `externalRef`, `hrisManaged`, `employmentStatus`, `designationRef`, `cycleRef`, `subjectRef`, `source`.

- [ ] **Step 1: Write the failing e2e test** `17-hris-external-refs.e2e-spec.ts`. Register an org, then use the DataSource to insert two users in the org with the same `external_ref`. Expect the second insert to reject with Postgres error code `23505`. Inserting the same `external_ref` in a *different* org succeeds. Two users with `external_ref = NULL` in the same org succeed.
- [ ] **Step 2: Run** `npm run test:e2e -w api -- 17-hris-external-refs`. Expected: FAIL (column `external_ref` does not exist).
- [ ] **Step 3: Add the entity columns** listed above, using `@Index(['organisationId','externalRef'], { unique: true, where: '"external_ref" IS NOT NULL' })`. Generate the migration and check it contains only these columns and indexes.
- [ ] **Step 4: Run** `npm run db:migrate && npm run test:e2e -w api -- 17-hris-external-refs`. Expected: PASS. Then run `npm run test:e2e -w api` and expect all existing suites to still pass.
- [ ] **Step 5: Commit** `feat(api): add HRIS external reference columns`

### Task 2: API clients and `ApiKeyGuard`

**Files:**
- Create: `api/src/integrations/integrations.module.ts`, everything under `api/src/integrations/api-clients/`; migration `ApiClients`
- Modify: `api/src/app.module.ts` (import `IntegrationsModule`)
- Test: `api/test/unit/api-key-format.spec.ts`, `api/test/e2e/18-integration-auth.e2e-spec.ts`

**Interfaces:**
- `api_clients`: `id uuid`, `organisation_id`, `name varchar(100)`, `key_prefix char(8) unique`, `secret_hash char(64)`, `scopes text[]`, `created_by uuid`, `last_used_at`, `revoked_at`, `created_at`.
- `key-format.ts`:
  - `generateApiKey(): { prefix: string; secret: string; raw: string }`
  - `parseApiKey(raw: string): { prefix: string; secret: string } | null`
  - `hashSecret(secret: string): string` (sha256 hex)
- `ApiClientsService`:
  - `create(orgId, userId, dto: { name: string; scopes: IntegrationScope[] }): Promise<{ client: ApiClient; rawKey: string }>`
  - `list(orgId): Promise<ApiClient[]>` (never returns the hash)
  - `revoke(orgId, id): Promise<void>`
  - `authenticate(rawKey: string): Promise<{ orgId: string; clientId: string; scopes: IntegrationScope[] } | null>`. This rejects revoked keys and organisations where `!isActive`, or where the plan is `trial` and the trial has expired (the same rule as `AuthService.assertOrgIsUsable`). It compares secrets with `crypto.timingSafeEqual` and updates `last_used_at` at most once a minute.
- `type IntegrationScope` and the scope string list go in `shared/src/types/integrations.ts`.
- `ApiKeyGuard` sets `req.integration`. `@RequireScopes(...)` is enforced by the same guard; a missing scope gives 403 `{ error: 'INSUFFICIENT_SCOPE' }`.
- Decorators `@IntegrationOrgId()` and `@IntegrationContext()`.
- Routes (JWT + `@Roles(ORG_ADMIN)`): `POST /integrations/api-clients` → `{ id, name, scopes, keyPrefix, rawKey }` (rawKey is shown only once), `GET /integrations/api-clients`, `DELETE /integrations/api-clients/:id`.
- Test-only probe route `GET /integrations/hris/ping` (`@RequireScopes('results:read')`) → `{ orgId }`. It is kept in production as a connection test.

- [ ] **Step 1: Write unit tests** `api-key-format.spec.ts`:
  - `generateApiKey().raw` matches `/^lpk_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{43}$/`;
  - `parseApiKey(raw)` round-trips;
  - `parseApiKey('Bearer x')` and `parseApiKey('lpk_short_x')` return `null`;
  - `hashSecret('a')` equals `'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'`.
- [ ] **Step 2: Write the e2e tests** `18-integration-auth.e2e-spec.ts`:
  - `ORG_ADMIN creates a client and gets rawKey once` (GET list has no `rawKey` or `secretHash`);
  - `ping with valid key returns own orgId`;
  - `ping without header → 401`, `with revoked key → 401`, `with key of deactivated org → 401` (use `deactivateOrg` helper);
  - `client without results:read → 403 INSUFFICIENT_SCOPE`;
  - `PARTICIPANT cannot create clients → 403`;
  - `a JWT Bearer token is not accepted on ping → 401`.
- [ ] **Step 3: Run both.** Expected: FAIL (module not found / 404).
- [ ] **Step 4: Implement** the entity, service, guard, decorators and controllers. Generate the `ApiClients` migration.
- [ ] **Step 5: Run** `npm run test:unit -w api -- api-key-format` and `npm run test:e2e -w api -- 18-integration-auth`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(api): per-organisation API clients for HRIS integration`

### Task 3: Web, Settings → Integrations (API keys)

**Files:**
- Create: `web/src/app/(app)/settings/integrations/page.tsx`
- Modify: the settings navigation (the component that links `settings/users`, `settings/departments`, `settings/organisation`; find it with `grep -r "settings/departments" web/src`), adding an "Integrations" entry visible to `org_admin` only.
- Test: `web/e2e/` Playwright spec `integrations-settings.spec.ts` (follow the existing web e2e setup).

**Interfaces:**
- Consumes Task 2 routes through `web/src/lib/api.ts`.
- UI: a table of clients (name, key prefix, scopes, last used, Revoke button). A "Create API key" dialog with name and scope checkboxes. After creation, a one-time panel shows the raw key with a Copy button and the text "This key will not be shown again."

- [ ] **Step 1: Write the Playwright test.** The admin creates a key with `results:read`. The key text matches `/^lpk_/`. After a reload the key text is gone and the prefix is listed. Revoking removes the row. A participant visiting `/settings/integrations` is redirected the same way as other admin-only settings pages.
- [ ] **Step 2: Run** `npm run test:e2e -w web -- integrations-settings`. Expected: FAIL.
- [ ] **Step 3: Implement the page** with existing shadcn components (Table, Dialog, Checkbox, Button).
- [ ] **Step 4: Run it again.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): integrations settings page for API keys`

### Task 4: Department sync (I-B)

**Files:**
- Create: `api/src/integrations/hris/hris-sync.controller.ts`, `hris-sync.service.ts`, `dto/sync-departments.dto.ts`
- Modify: `api/src/core/organisations/organisations.service.ts`, adding `upsertDepartmentsByRef(orgId: string, rows: DepartmentSyncRow[]): Promise<SyncRowResult[]>` (exported; this is where the repository access stays)
- Test: `api/test/e2e/19-hris-sync-departments.e2e-spec.ts`

**Interfaces:**
- `PUT /integrations/hris/departments` with scope `employees:write`. Body: `{ departments: Array<{ departmentRef: string; name: string; parentRef?: string | null; isActive?: boolean }> }`, max 1000 rows (`@ArrayMaxSize(1000)`).
- Response: `{ results: SyncRowResult[] }`, where `SyncRowResult = { ref: string; status: 'created' | 'updated' | 'unchanged' | 'error'; id?: string; error?: string; warnings?: string[] }`. HTTP 200 even when some rows fail.
- Algorithm: pass 1 upserts every row without its parent. Pass 2 resolves `parentRef` against existing departments plus the batch. An unknown parent gives warning `parent_not_found`. A parent cycle gives error `parent_cycle`. Synced departments get `hrisManaged = true`.

- [ ] **Step 1: Write the e2e tests:**
  - `creates departments with child listed before parent` (child row first; afterwards `child.parent_id = parent.id`);
  - `second identical call returns unchanged`;
  - `rename updates name, status updated`;
  - `unknown parentRef → created with warning parent_not_found`;
  - `A→B→A cycle → both rows error parent_cycle, other rows succeed`;
  - `departments land in the key's org only` (a second org's key can't see them through `GET /organisations/me/departments`).
- [ ] **Step 2: Run.** Expected: FAIL (404).
- [ ] **Step 3: Implement** `upsertDepartmentsByRef` in a single transaction, then the controller and service.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): HRIS department sync`

### Task 5: Employee sync (I-A)

**Files:**
- Modify: `hris-sync.controller.ts`, `hris-sync.service.ts`; create `dto/sync-employees.dto.ts`
- Modify: `api/src/core/users/users.service.ts`, adding `upsertEmployeesByRef(orgId: string, rows: EmployeeSyncRow[], opts: { fullSync: boolean }): Promise<SyncRowResult[]>`
- Test: `api/test/e2e/20-hris-sync-employees.e2e-spec.ts`

**Interfaces:**
- `PUT /integrations/hris/employees` with scope `employees:write`. Body: `{ fullSync?: boolean; employees: Array<{ employeeRef; email; firstName; lastName; departmentRef?; managerRef?; designationRef?; jobTitle?; employmentStatus: 'active' | 'probation' | 'left'; joiningDate?: string; language?: 'en' | 'si' | 'ta'; role?: 'participant' | 'manager' | 'hr_manager' }> }`, max 1000 rows.
- Matching order: (1) `externalRef`; (2) the same email in the org with `externalRef IS NULL`, which gets linked; (3) otherwise create.
- Email belonging to a user with a different `externalRef` → `error: 'email_conflict'`.
- Unknown `departmentRef` → warning `department_not_found`, department left as null.
- Role:
  - an explicit `role` wins, except that it never changes an `org_admin` or `super_admin`;
  - otherwise, on create, `participant`;
  - after pass 2, a `participant` who has at least one direct report becomes `manager`. Nobody is demoted automatically.
- Managers: pass 2 resolves `managerRef` the same way Task 4 resolves parents, and reuses the existing `assertManagerAssignmentValid` (cycle check). Unknown manager → warning `manager_not_found`.
- `employmentStatus: 'left'` → `isActive = false` + `deleteUserSessions(userId)`.
- `fullSync: true` → every `hrisManaged` user in the org that is missing from the payload gets the same treatment as `left`; their row result is `{ status: 'updated', warnings: ['deactivated_missing_from_full_sync'] }`. Requires `fullSync` payloads ≤ 1000 rows; larger orgs send pages with `fullSync` only on a separate `POST /integrations/hris/employees/full-sync-complete { seenRefs }` (not in MVP; document the limit).
- Created users: password `crypto.randomBytes(32).toString('base64url')`, `mustChangePassword: false`, `hrisManaged: true`. No welcome email (the HRIS sends people in through SSO).

- [ ] **Step 1: Write the e2e tests:**
  - `creates employees, manager listed after report is still linked` (Review Focus 1);
  - `manager in a later batch: first call warns manager_not_found, second call links it`;
  - `links existing app user by email when they have no externalRef` (create the user with `createUserInOrg`; afterwards there is still one row with that email and `external_ref` is set) (Review Focus 2);
  - `email owned by different externalRef → row error email_conflict, other rows created`;
  - `participant with direct reports becomes manager; org_admin role untouched when role: participant is sent`;
  - `employmentStatus left deactivates user and their refresh session stops working` (log in first, then sync as left, then `POST /auth/refresh` → 401) (Review Focus 5);
  - `fullSync deactivates hrisManaged users missing from payload but not app-created users`;
  - `synced user cannot log in with password and has mustChangePassword false`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `upsertEmployeesByRef` (one transaction per call), the DTO validation (`@IsEmail`, `@MaxLength(100)` on refs) and the controller method.
- [ ] **Step 4: Run.** Expected: PASS. Also run `16-user-management` and expect PASS.
- [ ] **Step 5: Commit** `feat(api): HRIS employee sync with manager resolution and leavers`

### Task 6: Managers as competency participants (D1)

**Files:**
- Modify: `api/src/assessment/engine/engine.service.ts:380-389` (the restriction now applies to `HR_MANAGER` only)
- Modify: web navigation so `manager` users see "My Assessments" (check `web/src/components` for the role-filtered nav; `grep -r "my-assessments" web/src`)
- Test: `api/test/e2e/06-competency.e2e-spec.ts` (add cases)

**Interfaces:** none new. Behaviour: a `MANAGER` can be added to competency, personality and readiness assessments. Their manager-assessor is their own `managerId`, through the existing `assertManagerOwnsReport`.

- [ ] **Step 1: Add tests to `06-competency`:**
  - `MANAGER can be added as competency participant` (201);
  - `HR_MANAGER still rejected` (400, same message);
  - `the manager's own manager (role MANAGER, set as managerId) can submit manager ratings for them`.
- [ ] **Step 2: Run** `npm run test:e2e -w api -- 06-competency`. Expected: the first and third tests FAIL.
- [ ] **Step 3: Change** the condition to `user.role === UserRole.HR_MANAGER`, update the error message to "HR Managers can only be added as participants to 360-degree feedback assessments", and update the nav.
- [ ] **Step 4: Run** `06-competency` and `04-assessment-lifecycle`. Expected: PASS. If an existing test asserts the old MANAGER rejection, update it to the new rule and mention it in the commit message.
- [ ] **Step 5: Commit** `feat: allow people managers to be assessed in competency assessments`

### Task 7: HRIS-managed fields are read-only in the app

**Files:**
- Modify: `api/src/core/users/users.service.ts` (`update`), `api/src/core/organisations/organisations.service.ts` (`updateDepartment`, `deleteDepartment`)
- Modify: `web/src/app/(app)/settings/users/page.tsx`, `web/src/app/(app)/settings/departments/page.tsx`
- Test: `api/test/e2e/20-hris-sync-employees.e2e-spec.ts` (add cases)

**Interfaces:**
- For `hrisManaged` users, these fields are owned by the HRIS: `email`, `firstName`, `lastName`, `departmentId`, `managerId`, `jobTitle`, `isActive`. Changing any of them through the app gives 409 `{ error: 'HRIS_MANAGED_FIELD', fields: [...] }`. `role` and `languagePref` stay editable.
- `hrisManaged` departments: `name`, `parentId`, `isActive` and delete give the same 409.
- Web: those inputs are disabled, with a "Managed by HRIS" badge.

- [ ] **Step 1: Add the tests:**
  - `PATCH /users/:id on hrisManaged user changing firstName → 409 HRIS_MANAGED_FIELD`;
  - `changing role → 200`;
  - `PATCH on app-created user unchanged → 200`;
  - `DELETE hrisManaged department → 409`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the guard checks in the services, then the web badge and disabled inputs.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: lock HRIS-managed user and department fields`

### Task 8: Assessment requests, competency (I-D)

**Files:**
- Create: `api/src/integrations/hris/hris-assessments.controller.ts`, `hris-assessments.service.ts`, `dto/assessment-request.dto.ts`
- Modify: `api/src/assessment/engine/engine.service.ts`, adding exported `findByCycleRef(orgId: string, cycleRef: string, type: AssessmentType, subjectRef?: string): Promise<Assessment | null>`, plus `create` accepting `{ cycleRef, subjectRef, source }` in `CreateAssessmentDto` (these fields are internal and **not** exposed on the public `POST /assessments` DTO; use a separate internal param object)
- Test: `api/test/e2e/21-hris-assessment-requests.e2e-spec.ts`

**Interfaces:**
- `POST /integrations/hris/assessment-requests` with scope `assessments:write`. Body: `{ cycleRef: string; title: string; types: Array<'competency' | '360_feedback'>; startDate: string; endDate: string; employeeRefs: string[]; competencyIds?: string[]; roleProfileId?: string; includeSelfAssessment?: boolean; raters?: Record<employeeRef, Array<{ email; name; relationship: 'supervisor' | 'peer' | 'direct_report' | 'stakeholder' }>> }`.
- Response: `{ assessments: Array<{ assessmentId: string; type: string; employeeRefs: string[]; created: boolean }> }`. 201 if anything was created, 200 if everything already existed.
- Unknown or inactive `employeeRefs` → 422 `{ error: 'UNKNOWN_EMPLOYEES', employeeRefs: [...] }` and nothing is created.
- Plan-limit `ForbiddenException`s pass through as 403.
- Competency: one assessment per `(cycleRef, 'competency')` with `config.competencyIds`, or `config.targetRoleId = roleProfileId`, `source = 'hris'`. If it already exists, only missing participants are added (late joiners). It is launched if still DRAFT.

- [ ] **Step 1: Write the e2e tests:**
  - `creates and launches competency assessment with cycleRef`;
  - `repeat identical request → 200, same assessmentId, created:false, no duplicate participants` (Review Focus 3);
  - `repeat with one extra employeeRef adds only that participant`;
  - `unknown employeeRef → 422 with list, no assessment created`;
  - `request with another org's key can't see or extend this org's cycle` (a fresh assessment is created in its own org; the first org's participant count is unchanged).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** via `EngineService.create/addParticipant/launch`. Resolve `employeeRefs` with a new exported `UsersService.findByExternalRefs(orgId, refs): Promise<User[]>`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): HRIS assessment requests for competency cycles`

### Task 9: Assessment requests, 360 (D3)

**Files:**
- Modify: `hris-assessments.service.ts`
- Test: `21-hris-assessment-requests.e2e-spec.ts` (add cases)

**Interfaces:**
- For `'360_feedback'`, one assessment per employee: `title = "<title> — <firstName> <lastName>"`, `cycleRef`, `subjectRef = employeeRef`.
- If `raters[employeeRef]` is given, call the existing `Uc1FeedbackService.nominateRaters` (`uc1-feedback.service.ts:150`) and then `approveNominations` (`:242`) for that assessment. Read their signatures there and pass the org-admin context the services expect, or add an internal overload without a requesting user, in the style of `getGapAnalysis`'s optional requester.
- Idempotency key: `(orgId, cycleRef, '360_feedback', subjectRef)`. A raters list on a repeat call only adds raters whose email is not already nominated.

- [ ] **Step 1: Add the tests:**
  - `360 request for 2 employees creates 2 assessments with subjectRef`;
  - `raters provided are nominated and approved (status approved/sent)`;
  - `repeat call creates nothing new and does not duplicate raters`;
  - `mixed types ['competency','360_feedback'] returns 1 + N entries`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): HRIS 360 assessment requests per employee`

### Task 10: 360 export aggregation with enforced anonymity

**Files:**
- Create: `api/src/integrations/hris/feedback-export.ts` (pure, no Nest)
- Test: `api/test/unit/feedback-export.spec.ts`

**Interfaces:**
- `toOthersAggregate(nominations: Array<{ relationship: RaterRelationship; status: string; responses: Array<{ competencyId: string; score: number | null }> }>, opts: { minPerGroup: number; scaleMax: number }): Feedback360Block`
- `type Feedback360Block = { status: 'ok'; scaleMax: number; minRaterThreshold: number; items: Array<{ competencyId: string; othersMean: number; self: number | null; gapVsSelf: number | null; byGroup: Partial<Record<'supervisor' | 'peer' | 'direct_report' | 'stakeholder', { mean: number; n: number }>> }>; overallOthersPct: number } | { status: 'insufficient_raters'; minRaterThreshold: number }`
- Rules:
  - only `completed` nominations count;
  - `self` is excluded from `othersMean`;
  - `n` counts distinct nominations;
  - groups with `n < minPerGroup` are left out of `byGroup`;
  - if the total of non-self completed raters is below `minPerGroup`, return `insufficient_raters`;
  - `overallOthersPct = round1(((mean of othersMean) − 1) / (scaleMax − 1) × 100)`;
  - means are rounded to 2 dp.

- [ ] **Step 1: Write the unit tests:**
  - `excludes self from othersMean` (self 5, two peers 3 and a supervisor 3, threshold 3 → othersMean 3, gapVsSelf −2);
  - `drops groups below threshold but keeps them in othersMean` (peers n=3 shown; supervisor n=1 hidden; othersMean averages all 4);
  - `returns insufficient_raters when only 2 non-self raters` (no numbers anywhere in the result);
  - `ignores non-completed nominations`;
  - `overallOthersPct maps 1→0 and scaleMax→100` (all 5s on a 5-point scale → 100; all 1s → 0);
  - `null scores ignored`.
- [ ] **Step 2: Run** `npm run test:unit -w api -- feedback-export`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): anonymity-safe 360 aggregation for HRIS export`

### Task 11: Competency export block

**Files:**
- Create: `api/src/integrations/hris/competency-export.ts` (pure)
- Modify: `api/src/assessment/uc2-competency/uc2-competency.service.ts`, adding exported `getRatingsDetail(assessmentId: string, participantId: string, orgId: string): Promise<Array<{ competencyId: string; competencyName: string; domainName: string; selfLevel: number | null; managerLevel: number | null; managerEvidence: string | null; developmentComment: string | null }>>`
- Test: `api/test/unit/competency-export.spec.ts`

**Interfaces:**
- `buildCompetencyBlock(ratings: ReturnType<getRatingsDetail>, roleProfile: { id: string; title: string; requiredCompetencies: Array<{ competencyId: string; minLevel: number; weight: number }> } | null): CompetencyBlock`
- `CompetencyBlock = { scaleMax: 4; roleProfile: { ref: string; title: string } | null; items: Array<{ competencyRef; name; domain; selfLevel; managerLevel; requiredLevel; weightInRole; gapSelfVsManager; gapVsRequired; managerEvidence; developmentComment }>; summary: { managerAvgPct: number | null; achievementVsRequiredPct: number | null } }`
- Rules:
  - `requiredLevel` comes from the role profile; it is `null` when there is no profile or the competency isn't in it;
  - `gapSelfVsManager = managerLevel − selfLevel`;
  - `gapVsRequired = managerLevel − requiredLevel`;
  - `managerAvgPct = round1(avg(managerLevel) / 4 × 100)` over rated items;
  - `achievementVsRequiredPct = round1(Σ(weight × managerLevel / requiredLevel × 100) / Σweight)` over items that have both values, **uncapped** (the HRIS applies its own cap, spec §10.2);
  - `competencyRef` is the competency `id`.

- [ ] **Step 1: Write the unit tests:**
  - `computes gaps and required levels from role profile`;
  - `achievementVsRequiredPct is weight-weighted and uncapped` (manager 4 vs required 3 at weight 0.5, plus manager 2 vs required 4 at weight 0.5 → 91.7);
  - `no role profile → requiredLevel null, achievementVsRequiredPct null`;
  - `no manager ratings yet → managerAvgPct null`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `buildCompetencyBlock` and `getRatingsDetail` (org-checked by the assessment's `organisationId`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): competency export block with role-profile gaps`

### Task 12: Results endpoint (O-1, O-2, O-3)

**Files:**
- Create: `api/src/integrations/hris/hris-results.controller.ts`, `hris-results.service.ts`; `shared/src/types/integrations.ts` (`EmployeeResultDto`, `ResultsPageDto`, exported from `shared/src/types/index.ts`)
- Modify: `api/src/assessment/uc1-feedback/uc1-feedback.service.ts`, exporting `getCompletedNominationsWithResponses` (`:692`, already present) with an org check, through a new `getCompletedNominationsForExport(assessmentId, participantId, orgId)`
- Modify: `api/src/assessment/engine/engine.service.ts`, adding exported `findAllByCycleRef(orgId, cycleRef): Promise<Assessment[]>`
- Test: `api/test/e2e/22-hris-results.e2e-spec.ts`

**Interfaces:**
- `GET /integrations/hris/results?cycleRef=…&employeeRef=…` with scope `results:read` → `EmployeeResultDto`.
- `GET /integrations/hris/results?cycleRef=…&cursor=<employeeRef>&limit=<1..100, default 50>` → `{ data: EmployeeResultDto[]; nextCursor: string | null }`, ordered by `employeeRef`.
- `EmployeeResultDto` has the spec §6 shape: `{ employeeRef; cycleRef; status: 'in_progress' | 'final'; competency: CompetencyBlock | null; feedback360: Feedback360Block | null; reports: Array<{ type; url; expiresAt }> }`, plus `assessmentIds: string[]`.
- `status` is `final` when every cycle assessment that includes the employee is CLOSED or ARCHIVED.
- The role profile is the competency assessment's `config.targetRoleId` (looked up through the exported `Uc4ReadinessService.getRoleProfiles(orgId)`), else `null`.
- Unknown `cycleRef` or `employeeRef` in this org → 404.
- **O-9 framework:** `GET /integrations/hris/framework` with scope `results:read` → `{ domains: Array<{ id; name; competencies: Array<{ competencyRef; name; description; levels: Array<{ level; label; description; indicators }> }> }>; roleProfiles: Array<{ ref; title; level; requiredCompetencies: Array<{ competencyRef; minLevel; weight }> }> }`. It covers the org's own active competencies plus the global ones (`organisation_id IS NULL`), through the exported `ItemsService` (the same data as `GET /items/framework`) and `Uc4ReadinessService.getRoleProfiles`. The HRIS uses it to create leadership KPIs (spec §10.1).

- [ ] **Step 1: Write the e2e tests.** Start with `framework returns seeded competencies with 4 levels and the org's role profiles, and no other org's custom competencies`. Then the results tests: Set up through the integration API: sync 1 manager + 2 reports, request competency + 360 for `2027-H1`, submit self and manager ratings through the existing UC2 routes, and submit 360 ratings through the rater-token routes.
  - `single employee result has competency items with selfLevel/managerLevel and status in_progress`;
  - `after closing assessments status is final`;
  - `360 with 2 raters returns insufficient_raters` (Review Focus 4);
  - `360 with 3 peers + self returns othersMean excluding self`;
  - `bulk paging returns nextCursor then null`;
  - `other org's key gets 404 for this cycleRef`;
  - `response never contains raterEmail, raterName or token` (`JSON.stringify(body)` must not match `/@clientorg\.lk|token/`).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `HrisResultsService.buildEmployeeResult(orgId, cycleRef, user): Promise<EmployeeResultDto>` using Tasks 10 and 11. Leave `reports: []` until Task 13.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): HRIS results export endpoint`

### Task 13: Report links and report requests (O-8)

**Files:**
- Create: `api/src/integrations/hris/signed-url.ts`
- Modify: `hris-results.controller.ts`, `hris-results.service.ts`
- Test: `api/test/unit/signed-url.spec.ts`, `22-hris-results.e2e-spec.ts` (add cases)

**Interfaces:**
- `signReportUrl(baseUrl: string, reportId: string, ttlSeconds: number, secret: string, now?: Date): { url: string; expiresAt: string }`, producing `${baseUrl}/api/v1/integrations/hris/report-files/${reportId}?exp=<unix>&sig=<hex hmac(reportId.exp)>`.
- `verifyReportSignature(reportId, exp, sig, secret, now?): boolean` (timing-safe; false when expired).
- `GET /integrations/hris/report-files/:id?exp&sig` needs **no** API key (the signature is the credential). It streams the PDF via `ReportingService.getDownloadPath(id, orgIdFromReportRow)`. A bad signature gives 403, not 404.
- `POST /integrations/hris/reports` with scope `reports:read`. Body `{ cycleRef; employeeRef; type: 'competency' | 'individual_360' }` → `{ reportId, status }` via `ReportingService.requestReport`.
- `EmployeeResultDto.reports` lists `ready` reports for the employee's cycle assessments, with URLs valid for 900 seconds. The base URL is `API_PUBLIC_URL`.

- [ ] **Step 1: Write the unit tests:**
  - `round-trips valid signature`;
  - `rejects tampered reportId`;
  - `rejects expired` (now = exp + 1);
  - `rejects sig of different length without throwing`.
- [ ] **Step 2: Add e2e tests:**
  - `POST reports then results.reports contains url once ready` (poll up to 30 s, as in `09-reports`);
  - `GET url returns application/pdf`;
  - `GET with modified sig → 403`.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(api): signed report links for HRIS`

### Task 14: Domain events

**Files:**
- Modify: `api/package.json` (add `@nestjs/event-emitter@^2.1.1`), `api/src/app.module.ts` (`EventEmitterModule.forRoot()`)
- Create: `api/src/shared/events/domain-events.ts`
- Modify: `engine.service.ts` (`launch`, `close`, `maybeCloseAssessment`), `uc2-competency.service.ts` (`submitManagerRatings`), `reporting/report.processor.ts` (on ready)
- Test: `api/test/e2e/23-domain-events.e2e-spec.ts`

**Interfaces:**
- `export const DomainEvent = { AssessmentLaunched: 'assessment.launched', AssessmentClosed: 'assessment.closed', ResultsReady: 'results.ready', ReportReady: 'report.ready', ReadinessComputed: 'readiness.computed' } as const`
- Payloads:
  - `AssessmentEventPayload { orgId; assessmentId; assessmentType; cycleRef: string | null; participantUserIds: string[]; occurredAt: string }`
  - `ResultsReadyPayload { orgId; assessmentId; cycleRef; userId; occurredAt }`
  - `ReportReadyPayload { orgId; reportId; assessmentId; participantUserId: string | null; reportType; occurredAt }`
- Emit only after the database write has committed (`emitAsync` is not needed; use `this.eventEmitter.emit` after `save`).

- [ ] **Step 1: Write the e2e test.** Get `EventEmitter2` from the app and attach `jest.fn()` listeners. Launching, then closing, emits `assessment.launched` and then `assessment.closed` with the right `cycleRef` and `participantUserIds`. Manager submission emits `results.ready`. Auto-close through `maybeCloseAssessment` also emits `assessment.closed`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Install and implement.**
- [ ] **Step 4: Run** `23-domain-events` and the full e2e suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): publish assessment domain events`

### Task 15: Webhooks backend (P-6)

**Files:**
- Create: everything under `api/src/integrations/webhooks/`; migration `Webhooks`
- Test: `api/test/unit/webhook-signing.spec.ts`, `api/test/e2e/24-webhooks.e2e-spec.ts`

**Interfaces:**
- Tables:
  - `webhook_endpoints`: `id`, `organisation_id`, `url text`, `secret_encrypted text`, `events text[]`, `is_active`, `created_at`.
  - `webhook_deliveries`: `id`, `endpoint_id`, `organisation_id`, `event`, `payload jsonb`, `status varchar(20)` (`pending | succeeded | failed`), `attempts int`, `last_status_code int null`, `last_error text null`, `delivered_at null`, `created_at`.
- `webhook-signing.ts`:
  - `signPayload(secret: string, timestamp: number, rawBody: string): string` (hex);
  - `encryptSecret(plain: string, keyB64: string): string` and `decryptSecret(enc: string, keyB64: string): string` (AES-256-GCM, output `iv.tag.ciphertext` in base64url).
- Routes (JWT ORG_ADMIN):
  - `POST /integrations/webhooks { url, events }` → `{ id, url, events, secret }` (secret shown once, `whsec_` + 32 random bytes base64url);
  - `GET` (list without secret);
  - `DELETE /:id`;
  - `POST /:id/test` (sends `ping`);
  - `GET /integrations/webhooks/deliveries?limit=50`.
- URL rules: `https://` required unless `NODE_ENV !== 'production'`. Reject private and loopback hosts in production (`localhost`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`).
- `DomainEventListener` (`@OnEvent` for every `DomainEvent`):
  - maps `participantUserIds` to `employeeRefs` through a new exported `UsersService.getExternalRefs(orgId: string, userIds: string[]): Promise<Map<string, string>>` (users without a ref are dropped);
  - skips events for orgs with no active endpoints subscribed to that event;
  - builds the spec §6 body `{ event, orgRef, cycleRef, assessmentId, employeeRefs, occurredAt }` (for `report.ready`, `reportId` and `employeeRef`);
  - writes a `pending` delivery row and enqueues a BullMQ job on queue `webhooks` with `attempts: 6, backoff: { type: 'exponential', delay: 30_000 }`.
- `WebhookProcessor` POSTs with a 10 s timeout and the four headers. A 2xx response marks the delivery `succeeded`; anything else throws so BullMQ retries, and after the final attempt the delivery is marked `failed`.

- [ ] **Step 1: Write the unit tests:**
  - `signPayload` matches a known vector (secret `whsec_test`, ts `1700000000`, body `{"a":1}`; compute the expected hex once with Node `crypto` in the test and hardcode it);
  - encrypt/decrypt round-trips;
  - decrypting with a wrong key throws.
- [ ] **Step 2: Write the e2e tests.** Start a local `http.createServer` receiver on port 0.
  - `closing a cycle assessment delivers assessment.closed with employeeRefs and a valid signature`;
  - `endpoint not subscribed to event receives nothing`;
  - `receiver returning 500 leaves delivery pending with attempts ≥ 1 and last_status_code 500`;
  - `deliveries list shows the delivery`;
  - `https required and localhost rejected when NODE_ENV=production` (call the service validator directly).
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.** Register the queue with `BullModule.registerQueue({ name: 'webhooks' })` in `IntegrationsModule`.
- [ ] **Step 5: Run.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(api): signed webhooks with retries for HRIS`

### Task 16: Web, webhook settings and delivery log

**Files:**
- Modify: `web/src/app/(app)/settings/integrations/page.tsx` (add a "Webhooks" section)
- Test: `web/e2e/integrations-settings.spec.ts` (add cases)

**Interfaces:** Consumes Task 15 routes. UI:
- an endpoint list (URL, events, Send test, Delete);
- an "Add endpoint" dialog (URL and event checkboxes) that shows the secret once;
- a deliveries table (time, event, status badge, attempts, last status code).

- [ ] **Step 1: Write the Playwright test.** Add an endpoint; the secret matching `/^whsec_/` appears once; "Send test" adds a delivery row.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): webhook configuration and delivery log`

### Task 17: SSO tickets backend (P-7, D2)

**Files:**
- Create: `api/src/core/auth/sso/sso-ticket.entity.ts`, `sso-ticket.service.ts`; migration `SsoTickets`; `api/src/integrations/hris/hris-sso.controller.ts`
- Modify: `api/src/core/auth/auth.module.ts` (export `SsoTicketService`), `auth.service.ts` (add `loginWithSsoTicket`), `auth.controller.ts` (add the exchange route)
- Test: `api/test/e2e/25-hris-sso.e2e-spec.ts`

**Interfaces:**
- `sso_tickets`: `id`, `organisation_id`, `user_id`, `token_hash char(64) unique`, `redirect_path varchar(500)`, `expires_at`, `used_at null`, `created_at`.
- `SsoTicketService`:
  - `issue(orgId, userId, redirectPath): Promise<{ ticket: string; expiresAt: Date }>`, with a 60-second TTL; the ticket is 32 random bytes base64url and only its sha256 is stored;
  - `consume(ticket): Promise<{ userId; orgId; redirectPath } | null>`, a single atomic `UPDATE … SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING …`.
- `POST /integrations/hris/sso-tickets` with scope `sso:issue`, body `{ employeeRef; redirectPath?: string }`, returns `{ url: "${APP_URL}/sso/hris?ticket=<t>", expiresAt }`.
  - `redirectPath` must match `^/(?!/)[A-Za-z0-9/_\-?=&.%]*$`; the default is `/my-assessments`; anything else gives 400.
  - Unknown, inactive or `left` employees → 404 (Review Focus 5).
- `POST /auth/sso/hris/exchange { ticket }` (public, throttled 20/min) returns the same body as login and sets the refresh cookie (reuse `setRefreshCookie`), plus `redirectPath`. An invalid, used or expired ticket gives 401.
- `AuthService.loginWithSsoTicket(ticket, req)` → `consume`, then `findByIdInternal`, then `assertOrgIsUsable`, then the private `issueTokens`.

- [ ] **Step 1: Write the e2e tests:**
  - `issued ticket exchanges once for tokens and refresh cookie`;
  - `second exchange of same ticket → 401`;
  - `expired ticket → 401` (set `expires_at` in the past through the DataSource);
  - `redirectPath //evil.com → 400`, `https://evil.com → 400`;
  - `ticket for left employee → 404`;
  - `exchanged access token works on GET /assessments/mine`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: one-time SSO tickets for HRIS hand-off`

### Task 18: Web, `/sso/hris` landing page

**Files:**
- Create: `web/src/app/sso/hris/page.tsx` (outside the `(app)` and `(auth)` groups; no auth required)
- Test: `web/e2e/sso-hris.spec.ts`

**Interfaces:**
- Reads `ticket` from the query string. POSTs to `/auth/sso/hris/exchange` with `credentials: 'include'`. On success, calls `useAuthStore.getState().setAuth(...)` (memory only, never `localStorage`) and then `router.replace(redirectPath)`.
- On failure, shows "This sign-in link has expired or was already used. Please open LeaderPrism again from your HRIS." with a link to `/login`.
- Removes `ticket` from the URL (`history.replaceState`) before redirecting.

- [ ] **Step 1: Write the Playwright test.** Get a ticket through the API with a test key. Visiting `/sso/hris?ticket=…` ends on `/my-assessments` with the user's name in the header. Reusing the same URL shows the expired message.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): HRIS SSO landing page`

### Task 19: MVP end-to-end cycle and integration guide

**Files:**
- Create: `api/test/e2e/26-hris-full-cycle.e2e-spec.ts`, `docs/integrations/hris-api.md`
- Modify: `CLAUDE.md` (module map: add `integrations/`; Phase Status: add "HRIS integration MVP"), `api/.env.example`

**Interfaces:** none new.

- [ ] **Step 1: Write the full-cycle e2e test**, following spec §9 steps 2, 5 and 6:
  1. sync departments and employees;
  2. request competency + 360 for `2027-H1`;
  3. complete the ratings;
  4. close;
  5. assert the webhook `assessment.closed` arrives;
  6. fetch results (status `final`, competency + feedback360 present);
  7. request a report and download it through the signed URL;
  8. issue an SSO ticket and exchange it.
- [ ] **Step 2: Run** `npm run test:e2e -w api -- 26-hris-full-cycle`. Expected: PASS (every part already exists). If it fails, fix the owning task's code and add a regression test there.
- [ ] **Step 3: Write `docs/integrations/hris-api.md`**: authentication, scopes, every endpoint with request and response examples from the tests, webhook verification snippet, error codes, row-result semantics, limits (1000 rows per sync call, 100 results per page, 60 s SSO tickets, 15 min report URLs).
- [ ] **Step 4: Run** `npm run test -w api` and `npm run test:e2e -w api`. Expected: all PASS.
- [ ] **Step 5: Commit** `docs: HRIS integration guide and full-cycle e2e`

---

# Phase 2

### Task 20: Inbound performance score → 9-box (I-E, P-8)

**Files:**
- Create: `api/src/assessment/uc4-readiness/entities/external-performance-score.entity.ts`; migration `ExternalPerformanceScores`; `api/src/integrations/hris/hris-scores.controller.ts`
- Modify: `api/src/assessment/uc4-readiness/entities/readiness-score.entity.ts` (`effectiveGridPerformance`); every caller (`uc4-readiness.service.ts:503`, `succession.service.ts`, `reporting.service.ts:346`; find them all with `grep -rn "effectiveGridPerformance\|gridPerformance" api/src`)
- Modify: `uc4-readiness.service.ts`, adding exported `upsertExternalPerformanceScores(orgId, rows: Array<{ userId; cycleRef; finalScore: number; ratingBand: string | null; finalisedAt: Date }>): Promise<number>` and `getLatestExternalScores(orgId, userIds): Promise<Map<string, ExternalPerformanceScore>>`
- Test: `api/test/unit/readiness-scoring.service.spec.ts` (add cases), `api/test/e2e/27-hris-performance-scores.e2e-spec.ts`

**Interfaces:**
- Table `external_performance_scores`: `id`, `organisation_id`, `user_id`, `cycle_ref`, `final_score numeric(5,2)` (0–100, `CHECK`), `rating_band varchar(50) null`, `finalised_at`, `received_at`; unique `(organisation_id, user_id, cycle_ref)`.
- `PUT /integrations/hris/performance-scores` with scope `scores:write`. Body as in spec §6: `{ cycleRef, scores: [{ employeeRef, finalScore, ratingBand, finalisedAt }] }`. Returns row results like Task 4. A repeat for the same cycle overwrites (appeal changes).
- `effectiveGridPerformance(s, external?: { finalScore: number } | null)` returns `s.manualGridPerformance ?? (external ? band(external.finalScore) : s.gridPerformance)`, using the bands in Global Constraints. The latest score is the one with the most recent `finalisedAt`.

- [ ] **Step 1: Write the unit tests:**
  - `manual override beats external`;
  - `external 70 → high, 69.99 → medium, 40 → medium, 39.9 → low`;
  - `no external → 360-derived value` (unchanged behaviour).
- [ ] **Step 2: Write the e2e tests:**
  - `pushed score changes succession dashboard performance for that user`;
  - `score outside 0–100 → row error`;
  - `other org cannot push for this org's employeeRef` (row error `employee_not_found`).
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement**, updating every caller.
- [ ] **Step 5: Run** `08-readiness`, `15-succession-dashboard`, `27-…` and the unit tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat: HRIS final performance score drives 9-box performance axis`

### Task 21: Talent exports, readiness, 9-box and succession (O-4, O-5, O-6)

**Files:**
- Modify: `hris-results.service.ts`, `shared/src/types/integrations.ts`, `uc4-readiness.service.ts` (emit `readiness.computed` in `computeReadiness`), the webhook listener (subscribe to it)
- Create: `GET /integrations/hris/succession` in `hris-results.controller.ts`
- Test: `api/test/e2e/28-hris-talent-exports.e2e-spec.ts`

**Interfaces:**
- `EmployeeResultDto` gains `readiness` and `nineBox`, **only** when the client has scope `talent:read`; otherwise these keys are absent.
  - `readiness: { rating: ReadinessRating; compositeScore: number; components: { competency; feedback; sjt; learningAgility; personalityFit }; roleProfile: { ref; title } } | null`
  - `nineBox: { performance: 'high' | 'medium' | 'low'; potential: 'high' | 'medium' | 'low'; performanceSource: 'manual' | 'hris' | 'feedback360'; overrideNote: string | null } | null`
- `GET /integrations/hris/succession` with scope `talent:read` → `{ keyRoles: Array<{ id; title; successors: Array<{ employeeRef; readinessRating | null; nominatedAt }>; readyNowCount }> }`, built from the exported `SuccessionService.listKeyRoles` and `getBench`.

- [ ] **Step 1: Write the e2e tests:**
  - `talent fields absent without talent:read`;
  - `present with talent:read after computeReadiness`;
  - `performanceSource is hris after Task 20 push`;
  - `succession lists nominated successor by employeeRef`;
  - `readiness.computed webhook delivered`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): readiness, 9-box and succession exports for HRIS`

### Task 22: Designation sync → role profile link (I-C)

**Files:**
- Modify: `api/src/assessment/uc4-readiness/entities/role-profile.entity.ts` (add `designationRefs text[] default '{}'`); migration; the role-profile create/update DTO and web role-profile form (add a "HRIS designation codes" input)
- Modify: `hris-results.service.ts` (role-profile fallback), `hris-assessments.service.ts` (default `roleProfileId` per employee)
- Test: `api/test/e2e/21-hris-assessment-requests.e2e-spec.ts`, `22-hris-results.e2e-spec.ts` (add cases)

**Interfaces:** Role-profile resolution order: `config.targetRoleId` → the profile whose `designationRefs` contains the user's `designationRef` → `null`. If more than one profile matches, the most recently updated one wins.

- [ ] **Step 1: Add the tests:**
  - `employee with designationRef gets requiredLevel from linked profile when assessment has no targetRoleId`;
  - `explicit targetRoleId still wins`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: link role profiles to HRIS designations`

### Task 23: Audit log (P-9)

**Files:**
- Create: `api/src/core/audit/audit.module.ts`, `audit-log.entity.ts`, `audit.service.ts`, `audit.controller.ts`; migration `AuditLogs`; `web/src/app/(app)/settings/audit-log/page.tsx`
- Modify (call sites):
  - `ApiClientsService` create and revoke;
  - `WebhooksService` create and delete;
  - `HrisSyncService` (one entry per batch, plus one per deactivation);
  - `HrisAssessmentsService`;
  - `HrisResultsService` (results read: one entry per request with the employee count; report download);
  - the scores push;
  - `Uc4ReadinessService.setPerformanceOverride`;
  - `AuthService.loginWithSsoTicket`.
- Test: `api/test/e2e/29-audit-log.e2e-spec.ts`

**Interfaces:**
- `audit_logs`: `id`, `organisation_id`, `actor_type varchar(20)` (`user | api_client | system`), `actor_id uuid null`, `action varchar(100)` (e.g. `integration.employees.synced`), `entity_type varchar(50)`, `entity_id varchar(100) null`, `before jsonb null`, `after jsonb null`, `reason text null`, `metadata jsonb`, `created_at`. Index `(organisation_id, created_at desc)`.
- `AuditService.record(entry: AuditEntry): Promise<void>` never throws to the caller (it logs a warning on failure).
- Rows can't be changed: there are no update or delete routes, and the migration adds `REVOKE UPDATE, DELETE ON audit_logs FROM <app role>` if the deploy uses a dedicated role (otherwise document it in the guide).
- `GET /audit-logs?action&actorType&from&to&cursor&limit` (JWT ORG_ADMIN) and `GET /audit-logs/export.csv`.

- [ ] **Step 1: Write the e2e tests:**
  - `employee sync writes integration.employees.synced with api_client actor`;
  - `performance override writes before/after`;
  - `results read is logged`;
  - `HR_MANAGER cannot read audit log` (403);
  - `other org's entries not visible`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, including the web page (table + filters + CSV export button).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: audit log for integration and talent changes`

### Task 24: Scheduler (P-10)

**Files:**
- Create: `api/src/core/scheduler/scheduler.module.ts`, `scheduler.processor.ts` (BullMQ queue `scheduler` with repeatable jobs registered on module init)
- Modify: `engine.service.ts`, adding exported `findDueForReminder(today: Date): Promise<Assessment[]>`; `SsoTicketService` (add `purgeExpired()`)
- Test: `api/test/unit/reminder-schedule.spec.ts`, `api/test/e2e/30-scheduler.e2e-spec.ts`

**Interfaces:**
- `isReminderDue(endDate: Date, reminderDays: number[], today: Date, tz = 'Asia/Colombo'): boolean`. `reminderDays` means **days before `endDate`** (the field exists in `AssessmentConfig` but nothing uses it today; this plan defines what it means).
- Jobs:
  - `auto-reminders` at cron `0 8 * * *` in `Asia/Colombo`: for each due ACTIVE assessment, call the existing `EngineService.sendReminders`, plus `Uc1FeedbackService.sendReminders` for 360;
  - `purge-sso-tickets` at cron `0 3 * * *`: delete tickets more than 1 day past expiry.
- Repeatable jobs use fixed `jobId`s so restarts don't add duplicates.

- [ ] **Step 1: Write the unit tests:**
  - `due when today is endDate − 3 and reminderDays [3]`;
  - `not due on other days`;
  - `uses Colombo date at 23:30 UTC` (UTC 2027-06-26T23:30Z is 2027-06-27 in Colombo);
  - `empty reminderDays never due`.
- [ ] **Step 2: Write the e2e test.** Call the processor's handler directly for `auto-reminders`. Only the due assessment's participants are reminded (spy on `NotificationsService.sendReminder`).
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(api): scheduled reminders and SSO ticket cleanup`

---

# Phase 3

### Task 25: Personality export (O-7)

**Files:**
- Modify: `hris-results.service.ts`, `shared/src/types/integrations.ts`; `uc3-personality.service.ts`, adding exported `getLatestScoresForUser(orgId, userId): Promise<Array<{ factor; tScore; percentile }>>` if no equivalent exists
- Test: `22-hris-results.e2e-spec.ts` (add cases)

**Interfaces:** `EmployeeResultDto.personality?: { assessedAt: string; factors: Array<{ factor: string; tScore: number; percentile: number }>; usage: 'development_only' }`. It is present only with scope `personality:read` and is never included in the paged bulk response, only in single-employee reads. `docs/integrations/hris-api.md` gains a "Permitted use" box quoting spec §12.

- [ ] **Step 1: Add the tests:**
  - `personality absent without personality:read`;
  - `present on single read with scope`;
  - `absent from bulk page even with scope`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): personality export for development use`

---

## Out of scope / follow-ups noticed during planning

- **The in-app 360 results also skip the anonymity threshold.** `Uc1FeedbackService.get360Scores` returns per-group means with `count` even when the count is 1 or 2. Rater emails and the web UI promise "minimum 3 per rater group" (`uc1-feedback.service.ts:228`). The API also includes the self score in `overallMean` (`uc1-feedback.service.ts:662-663`). Task 10 fixes this for the HRIS export only. The in-app endpoint and PDF should get the same fix in a separate change.
- **Full OIDC/SAML SSO** (spec P-7 alternative) and **pushing results to the HRIS without it calling first** (webhooks currently notify; the HRIS still pulls).
- **Full-sync for orgs over 1000 employees** (paged full sync).
- **The spec's proposed `assessment.participant_completed` event is not built.** Completion is set in several UC services. `results.ready`, emitted when the manager submits competency ratings, covers the HRIS need (results available before the assessment closes). Add the event later if the HRIS wants progress tracking.
