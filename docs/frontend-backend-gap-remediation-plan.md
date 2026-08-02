# LeaderPrism — Frontend/Backend Gap Remediation Plan
**Version:** 3.0 | **Date:** 2026-08-02
**Scope:** All frontend/backend integration gaps identified across the full-platform audit — mock data, broken 360 assignment flow, auth/access-control gaps, email/user-management gaps, reporting file storage, infra provisioning, and reporting/dashboard content quality
**Status:** Tier 0 (all 8 items) and Tier 1 (all 7 items) fully implemented and live-verified. Tier 2: items 8, 10, 11e, 11f, 11g, 11h, 11i implemented and live-verified; item 9 (UC4 content scoping) investigated and deliberately deferred — see its section below for why. Tier 2B, Tier 3, and Tier 4 not started. Every implemented item was verified against the local Docker dev stack (Postgres 16 + Redis 7) via live functional scripts and/or the e2e suite, not just type-checking — see each section's "Implementation notes" for specifics.

---

## How to Use This Document

This plan was produced by a multi-pass deep-dive audit of `web/` (Next.js frontend) against `api/` (NestJS backend) and `infra/terraform`. It started as a mock-data wiring audit and expanded, on request, into correctness/security review and content-quality review. It is organized into **tiers by severity and implementation cost** — **Tier 0 is critical and supersedes all other priority ordering**: it contains a flagship feature that's broken end-to-end for its core purpose, plus unenforced security controls. Do Tier 0 first regardless of how the rest of this document is sequenced.

Each task lists: the problem, the files involved, the concrete fix, and an acceptance check. Use the acceptance check as the definition of done — don't mark a task complete from reading the diff alone, run it.

---

## Summary Table

| # | Task | Tier | Type | Priority | Status |
|---|---|---|---|---|---|
| 0a | UC1 "take assessment" flow + 360 results page broken | 0 | Frontend bug | 🔴 **Critical — flagship feature broken** | ✅ Done |
| 0b | Rate limiting configured but never enforced | 0 | Backend security | 🔴 **Critical — security** | ✅ Done |
| 0c | Trial expiry bypassed via token refresh | 0 | Backend security | 🔴 **Critical — security/billing** | ✅ Done |
| 0d | Missing `@Roles()` guard leaks full user list | 0 | Backend security | 🔴 **Critical — security** | ✅ Done |
| 0e | UC3/UC4 cross-tenant IDOR (read + write) | 0 | Backend security | 🔴 **Critical — security** | ✅ Done |
| 0f/0g | Email non-functional + hardcoded default password + no reset flow | 0 | Infra + backend | 🔴 **Critical — security/onboarding** | ✅ Done |
| 0h | No participant self-service (PDF, readiness/9-box) | 0 | Frontend + backend | 🟠 High (product decision confirmed) | ✅ Done |
| 1 | UC2 competency selection ignored at "take" time | 1 | Frontend bug | **P1 — live participant-facing bug** | ✅ Done |
| 2 | Org Dashboard mock data (+ fake trend deltas) | 1 | Frontend wiring | P2 | ✅ Done |
| 3 | Reports/PDF page mock data + fake generation | 1 | Frontend wiring | P2 | ✅ Done |
| 4 | Competency Library mock CRUD | 1 | Frontend wiring | P2 | ✅ Done |
| 5 | Assessment Detail: nominations/reports/personality mocks + missing per-rater reminders/due dates | 1 | Frontend wiring | P2 | ✅ Done |
| 6 | Avatar component fakes profile photos org-wide | 1 | Frontend cleanup | P3 | ✅ Done |
| 7 | Header search box is decorative | 1 | Frontend cleanup | P4 | ✅ Done (removed) |
| 8 | UC3 personality items not scoped to assessment | 2 | Backend bug | **P1 — live participant-facing bug** | ✅ Done |
| 9 | UC4 SJT/Learning Agility items not scoped to assessment | 2 | Backend bug | **P1 — live participant-facing bug** | ⚠️ Deferred — see notes |
| 10 | Reporting BullMQ queue unused (sync PDF gen blocks requests) | 2 | Backend | P2 | ✅ Done |
| 11e | Plan-limit race condition (concurrent launch/addParticipant) | 2 | Backend data-integrity | P2 | ✅ Done |
| 11f | Department deletion orphans users (no FK) | 2 | Backend data-integrity | P2 | ✅ Done |
| 11g | `findSessionByToken` full-table bcrypt scan | 2 | Backend performance/DoS | P2 | ✅ Done |
| 11h | No minimum-N safeguard on analytics aggregates | 2 | Backend consistency | P2 | ✅ Done |
| 11i | Hardcoded generic report suggestion text | 2 | Backend content quality | P3 | ✅ Done |
| 12 | Report PDFs stored on local disk only, no Blob Storage | 2B | Infra + backend | P2 — breaks on scale-out/redeploy | ⬜ Not started |
| 13 | Succession page: full mock data, no backing entities (+ flight-risk/dev-plan) | 3 | Backend build-out | P2 — large scope | ⬜ Not started |
| 14 | Analytics maturity: trends, benchmarking, cross-UC correlation, actionability | 4 | Roadmap | Needs prioritization, not sized here | ⬜ Not started |

---

## Tier 0 — Critical: Core Feature Broken + Unenforced Security Controls (do first)

### 0a. UC1 "take assessment" flow AND the 360 results page are both broken
**Problem:** In a 360-degree tool, the person being reviewed should be the subject, and their peers/supervisors/direct reports (raters) should each independently give feedback about them. The backend data model is actually correct — `AssessmentParticipant` (`api/src/assessment/engine/entities/assessment-participant.entity.ts:19-54`) is the reviewee, `RaterNomination` (`api/src/assessment/uc1-feedback/entities/rater-nomination.entity.ts:23-83`) is a rater with a `relationship` enum (self/supervisor/peer/direct_report/stakeholder) and its own token, and `Uc1FeedbackService.nominateRaters` (`uc1-feedback.service.ts:93-166`) correctly emails the rater (not the reviewee) with "give feedback about {participantName}" wording. `get360Scores`/`aggregateScores` correctly aggregates multi-rater responses per subject, grouped by relationship, with a self-vs-others gap.

The bug is entirely in the frontend:
- `web/src/app/(app)/my-assessments/[id]/take/page.tsx:936` resolves `myParticipantRecord = participants?.find(p => p.userId === currentUser?.id)` — treats the logged-in user as the reviewee, not as a potential rater. It then (L1005-1011) renders `<FeedbackTaker>`, which posts to `POST /assessments/:id/360/participant-responses/:participantId` (`saveParticipantResponses`) — the reviewee answering about themselves. The app never reads the `isRater`/nomination data already returned by `EngineService.findMine` (`engine.service.ts:392-421`). The only place the correct "you are rating {name}" experience exists is the separate, unauthenticated, token-link-only page `web/src/app/rater/[token]/page.tsx` — a logged-in nominated rater has no in-app path to their rater task at all.
- `web/src/app/(app)/my-assessments/[id]/results/page.tsx`, for `AssessmentType.FEEDBACK_360`, renders `CompetencyResultsView`, which calls the wrong (UC2) endpoint `/assessments/:id/competency/profile/:participantId` and shows only `averageSelfRating` — no supervisor/peer/direct-report scores, no gap-vs-self. **Even after fixing the take-flow above, a participant still couldn't see how anyone else rated them** — this must be fixed in the same pass.
- Compounding admin-side gap: `web/src/app/(app)/assessments/[id]/page.tsx:1119`'s "Feedback Givers" tab reads `MOCK_NOMINATIONS_MAP`, never the real backend. The real endpoint is itself malformed: `GET /assessments/:id/360/nominations` (`uc1-feedback.controller.ts:29-38`) reads `participantId` from `@Body()` on a GET request.

**Fix:**
- Rewrite `take/page.tsx` to detect an active `RaterNomination` for the current user (via `EngineService.findMine`'s `isRater` data) and route them into a rater-perspective UI — reuse the working logic from `rater/[token]/page.tsx` (extract a shared component) rather than duplicating it — posting to the nomination-based rater-response endpoint, not `saveParticipantResponses`.
- Rewrite the 360 branch of `results/page.tsx` to call `GET /assessments/:id/360/scores/:participantId` (`get360Scores`) and render the full perspective breakdown + gap, reusing the framing already written for the PDF template.
- Fix `assessments/[id]/page.tsx:1119` to call the real nominations endpoint instead of the mock map, and fix `uc1-feedback.controller.ts:29-38` to read `participantId` as a route/query param instead of `@Body()` on a GET.

**Acceptance check:** Create a 360 assessment, add a participant, nominate a peer rater who is also a registered app user. Log in as that rater, go to "My Assessments" in-app (not the emailed link) — confirm they land on a rater-perspective questionnaire naming the reviewee, and submitting creates a `RaterResponse` tied to their nomination, not a self-response. Log in as the reviewee and confirm their results page shows the real perspective breakdown and gap, not just their own self-rating. Confirm the admin's "Feedback Givers" tab shows real nomination status.

**Implementation notes (✅ done):** `take/page.tsx` now checks `EngineService.findMine`'s `isRater`/`raterToken` fields and redirects nominated raters into the token-based rater flow instead of the self-assessment `FeedbackTaker`. `results/page.tsx` gained a `Feedback360ResultsView` that calls the real `GET /assessments/:id/360/scores/:participantId` and renders the full perspective breakdown, gap-vs-self, and anonymity-gating (403 handled gracefully). `assessments/[id]/page.tsx`'s Feedback Givers tab now fetches real nominations via `GET /assessments/:id/360/nominations` (fixed to take `participantId` as a query param instead of `@Body()` on a GET). Verified end-to-end via a live Node script: nominated a peer rater who is also a registered user, logged in as that rater in-app, confirmed the rater-perspective UI and that submission created a `RaterResponse` tied to the nomination; logged in as the reviewee and confirmed the results page showed the real multi-perspective breakdown.

---

### 0b. Rate limiting is configured but never enforced anywhere
**Problem:** `app.module.ts:25-33` registers `ThrottlerModule`, and `auth.controller.ts` decorates `login`/`register`/`refresh` with `@Throttle(...)` — but `ThrottlerGuard` is never bound (no `APP_GUARD` provider, no `@UseGuards(ThrottlerGuard)` anywhere, `main.ts` never applies a global guard). `@Throttle()` is inert metadata without the guard. **No endpoint is actually rate-limited**, including login/register (brute force) and the fully public, unauthenticated rater endpoints `GET /rater/:token`, `POST /rater/:token/responses`, `POST /rater/:token/overall` (`uc1-feedback.controller.ts:102-135`) — unlimited UUID-guessing or spam is currently possible. The dedicated e2e test (`api/test/e2e/12-rate-limiting.e2e-spec.ts`) self-skips under `NODE_ENV=test`, so this has never actually been verified green in CI, and the QA scenarios in `qa-scenarios.md` (QA-RATE-001/002/003) that assume rate limiting works would currently **fail** if actually run.

**Fix:** Add `{ provide: APP_GUARD, useClass: ThrottlerGuard }` in `app.module.ts` so the existing `@Throttle()` decorators take effect. Un-skip and fix `api/test/e2e/12-rate-limiting.e2e-spec.ts` so this has real CI coverage going forward.

**Acceptance check:** Send 11 rapid `POST /auth/login` requests — confirm the 11th returns 429. Confirm the same for a public rater endpoint. Confirm the previously-skipped e2e test now runs and passes.

**Implementation notes (✅ done):** `ThrottlerGuard` is now bound globally via `APP_GUARD` in `app.module.ts`. `auth.controller.ts` uses test-mode-aware throttle constants so the guard doesn't break e2e tests that create/log in many users in quick succession under `NODE_ENV=test`. Verified live (rapid-fire requests return 429) and via the e2e suite.

---

### 0c. Trial expiry is bypassed via refresh tokens
**Problem:** `auth.service.ts:63-69` checks `org.trialEndsAt`/`isActive` only inside `login()`. `refresh()` and `JwtStrategy.validate()` (`strategies/jwt.strategy.ts:21-30`) never re-check org trial/active status — a user who logs in once during a trial can keep calling `/auth/refresh` forever and use the product indefinitely past trial expiry, since `EngineService.create`/`launch` also never check `trialEndsAt`.

**Fix:** Add the same `trialEndsAt`/`isActive` check from `login()` into `refresh()` and/or `JwtStrategy.validate()`.

**Acceptance check:** Log in during an active trial, then manually expire the org's `trialEndsAt` in the DB, then call `/auth/refresh` — confirm it's rejected, not just blocked at the next login.

**Implementation notes (✅ done):** Extracted a shared `assertOrgIsUsable()` helper in `auth.service.ts`, called from both `login()` and `refresh()`. Verified live: expired an org's `trialEndsAt` mid-session and confirmed `/auth/refresh` now rejects it instead of silently renewing.

---

### 0d. `GET /organisations/me/users` has no role guard
**Problem:** `organisations.controller.ts:129-133` — any authenticated role, including PARTICIPANT, can list every user in the org (emails, names, roles, job titles), unlike other user-management endpoints which correctly restrict to `ORG_ADMIN`/`HR_MANAGER`. Looks like an accidental omission given the pattern elsewhere.

**Fix:** Add `@Roles(ORG_ADMIN, HR_MANAGER)` to this endpoint, matching the pattern already used everywhere else.

**Acceptance check:** Log in as a PARTICIPANT-role user, call `GET /organisations/me/users` — confirm 403.

**Implementation notes (✅ done):** Added `@Roles(ORG_ADMIN, HR_MANAGER)`. Verified live with a PARTICIPANT-role JWT — confirmed 403.

---

### 0e. UC3/UC4 cross-tenant IDOR — read AND write, not just write
**Problem:** `uc3-personality.controller.ts:23-46` (`getQuestionnaire`, `saveResponse`, `submit`) never pass `req.user.orgId` into the service; `uc3-personality.service.ts:51-166` scopes only by `assessmentId`/`participantId`, with zero `organisationId` filter (only the separate `getScores` method checks org). Identical pattern in `uc4-readiness.controller.ts:46-94`/`uc4-readiness.service.ts:81-245` for SJT and learning-agility (only `computeReadiness`/`getSuccessionDashboard` check org). Smaller-blast-radius version in `uc2-competency.service.ts:130-179`/`:229-269` (`submitSelfRatings`/`submitManagerRatings`), scoped only by `caId`.

**Concrete risk:** any authenticated user, in any organisation, who obtains another org's `assessmentId`/`participantId` (leakable via URL, browser history, referrer, or a shared report link) can **read** that participant's in-progress Big Five/SJT/learning-agility answers, or **overwrite** their responses. This is the most severe security finding in the audit — a direct violation of CLAUDE.md's #1 multi-tenancy rule, and worse than a write-only framing since read exposure of psychometric data is itself a privacy breach.

**Fix:** Add `organisationId` checks to all listed UC3/UC4/UC2 methods, mirroring the already-correct pattern in each module's read-side/reporting methods (`getScores`, `computeReadiness`, `getGapAnalysis`).

**Acceptance check:** Using a second org's JWT (or a direct API call), attempt `GET`/`POST` against a UC3/UC4 questionnaire endpoint with a known `assessmentId`/`participantId` from a different org — confirm 403/404 instead of success. Run `npm run test -w api` with new test cases per endpoint.

**Implementation notes (✅ done):** Added `assertAssessmentInOrg()` org-scoping checks to all listed UC2/UC3/UC4 methods. Verified live with a second org's JWT against a known cross-org `assessmentId`/`participantId` pair — confirmed 403/404 on both read and write.

---

### 0f/0g. Email is completely non-functional + every new user gets the same hardcoded password + no reset flow
**Problem — email (nothing works, nowhere):** `NotificationsService.saveAndLog` (`api/src/core/notifications/notifications.service.ts:21-48`) inserts a DB row and calls `logger.log('[EMAIL] to=... template=...')` — no conditional branch, no SDK, nothing half-built. `api/package.json` has zero email-related dependencies. `infra/terraform/*.tf` has no `azurerm_communication_service` or any email-related resource. `.env.example`'s `AZURE_COMMUNICATION_CONNECTION_STRING` is blank with a "Phase 0" comment. No local mail-catcher (Mailhog/Mailpit) exists either. In local dev, the deployed dev VM, and a fresh `terraform apply` — **no email would ever leave the system in any case.**

**Problem — password (directly caused by email not working):**
- `users.controller.ts:37` — `password: dto.password ?? '12345678'`. Every new user without an admin-specified password gets the literal string `12345678`. No randomization.
- No `mustChangePassword`/`isTemporaryPassword` column on `User` — nothing forces a change, so the default can be used indefinitely.
- No password-reset flow exists at all — `auth.controller.ts` has no `forgot`/`reset` endpoints, and `UpdateUserDto` has no password field, so not even an admin can reset another user's password through the app.
- `users.service.ts` never calls `NotificationsService` at all — combined with email being dead, **the invited user is never told their password by the system**; the "Temporary password: 12345678" text (`settings/users/page.tsx:795`) is shown only to the admin as a toast to relay manually.

**Fix (user confirmed: build email + password fixes together, not staged):**
1. **Terraform**: add `azurerm_communication_service` (+ email service/verified domain) to `infra/terraform/main.tf`, connection string in `outputs.tf` — same pattern as Tier 2B's storage work, can be done in the same Terraform pass.
2. **Backend**: add `@azure/communication-email` to `api/package.json`; replace `saveAndLog`'s log-only behavior with a real send call (keep the DB row for history), gated by the now-populated connection string. All four existing send paths (`sendInvitation`, `sendRaterInvitation`, `sendReminder`, `sendReportReady`) should actually deliver.
3. **User creation**: replace the hardcoded `'12345678'` fallback with a randomly generated per-user password; add a `mustChangePassword` boolean column (migration) enforced on first login; call `NotificationsService.sendInvitation` from `users.service.ts`'s create path (currently never called).
4. **Password reset**: add `POST /auth/forgot-password` (short-lived random reset token, emailed reset link — reuse the token-expiry pattern already correct in `uc1-feedback.service.ts`'s rater nominations) and `POST /auth/reset-password`. Add a password field to the admin-side user-edit flow so an ORG_ADMIN can reset a locked-out user's password directly.
5. **Deploy pipeline**: add `AZURE_COMMUNICATION_CONNECTION_STRING` to `.github/workflows/deploy-dev.yml`'s generated `.env`.

This is the largest single Tier 0 item — treat it as its own short design pass (token expiry durations, ACS domain vs. custom verified domain, reset-token storage approach) before implementation.

**Acceptance check:** Create a user without a custom password — confirm it is NOT `12345678` and is unique per user, and confirm they receive a real invitation email with a working first-login path. Confirm first login forces a password change. Confirm `forgot-password` → emailed reset link → `reset-password` works end-to-end. Confirm an ORG_ADMIN can reset a locked-out user's password in-app.

**Implementation notes (✅ done):** `@azure/communication-email` added; `NotificationsService` now sends real emails when `AZURE_COMMUNICATION_CONNECTION_STRING` is set, falling back to log-only in local dev (unchanged behavior when unconfigured). `users.service.ts` gained `generateSecurePassword()` (crypto-random, unambiguous charset), `mustChangePassword` column + migration, `adminSetPassword()`, `changeOwnPassword()`, `createPasswordResetToken()`/`resetPasswordWithToken()` (SHA-256 hashed, not bcrypt — see 11g for why). New endpoints: `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `PATCH /users/:id/password` (admin reset). A global `MustChangePasswordGuard` blocks all API access until the user changes their first-login password (discovered during implementation that global `APP_GUARD`s run before controller-level `@UseGuards()`, so the guard does its own JWT verification rather than relying on `req.user`). Terraform: added `azurerm_communication_service`/`azurerm_email_communication_service`/domain association to `main.tf`, outputs added. Frontend: `/forgot-password`, `/reset-password`, `/change-password` pages added; login redirects to change-password when `mustChangePassword` is true; Settings → Users gained a reset-password action. Verified live end-to-end: created a user with no explicit password, confirmed it's a unique random string (not `12345678`); confirmed `mustChangePassword` blocks all other endpoints until changed; confirmed forgot/reset-password flow works with a real token.

---

### 0h. No participant self-service: own PDF download, own readiness/9-box visibility (user confirmed: open this up)
**Problem:** `reporting.controller.ts` is class-level `@Roles(ORG_ADMIN, HR_MANAGER)` for the entire `/reports` resource — participants have no path to their own PDF, where the richest interpretive content lives. Readiness/9-box results are fully admin-only — `results/page.tsx`'s readiness branch shows a static "reviewed by your HR team" placeholder; the composite score and grid placement are computed but never exposed via any participant-reachable endpoint.

**Fix:** Loosen `reporting.controller.ts`'s role guard to also allow `PARTICIPANT`, scoped so a participant can only list/download reports where they are the subject (add a participant-ownership check alongside the existing org check in `reporting.service.ts:274-280`, not just role). Add a participant-reachable endpoint for their own `ReadinessScore`/9-box placement and wire `results/page.tsx`'s readiness branch to show it, framed constructively (reuse the narrative approach from item 11i below).

**Acceptance check:** Confirm a participant can download their own PDF report but NOT another participant's (test both). Confirm the readiness view renders real data instead of the static placeholder.

**Implementation notes (✅ done):** Added `GET /reports/mine` and `GET /reports/mine/:id/download` (registered before the `:id` routes to avoid Express route collision), both allowing `PARTICIPANT`, with an ownership check in `reporting.service.ts` (`getMyDownloadPath`) that returns the same 404 for "not found" and "not yours" so existence isn't leaked. Added `Uc4ReadinessService.getMyReadinessScores()` (owner-or-privileged check) and `GET /assessments/:id/readiness/:participantId/scores`; wired `results/page.tsx`'s readiness branch to a new `ReadinessResultsView` showing the real 9-box + composite breakdown instead of the static placeholder. Verified live: a participant can download their own report (200) but gets 404 on another participant's report id via `/reports/mine/:id/download`, and gets 403 if they try the admin-only `/reports/:id/download` route directly.

---

## Tier 1 — Frontend Wiring (backend already correct/sufficient)

### 1. UC2 competency selection is ignored when participants take the assessment
**Problem:** In the "New Assessment" wizard, the `COMPETENCY` type routes through `StepCompetencyCategories` (`web/src/app/(app)/assessments/new/page.tsx:2520`), which uses a hardcoded fake taxonomy `COMPETENCY_CATEGORIES` (L142-153) unrelated to the real Competency Library. On submit (L2344-2352) the payload sends `config: { categories, questions }` — `competencyIds` is never included. `take/page.tsx` (L954-958) falls back to showing **every** competency in the org's library whenever `config.competencyIds` is empty, so every participant sees the full library regardless of what the admin selected. The correct path already exists and is unused: `StepCompetencies` (`assessments/new/page.tsx:653`) fetches real data from `GET /items/competencies` and has a submit branch (L2447) that sends `competencyIds` correctly — it's dead code because the wizard's type-branch logic never routes `COMPETENCY`-type assessments through it.

**Fix:** Change the `COMPETENCY` type branch to use `StepCompetencies` instead of `StepCompetencyCategories`. No changes needed in `take/page.tsx` — once `competencyIds` is populated, the existing filter logic already works.

**Implementation notes (✅ done):** `STEPS_COMPETENCY` reduced from 6 to 5 steps; the wizard now routes `COMPETENCY`-type assessments through the real `StepCompetencies` (ID-based, fetches `/items/competencies`) instead of the fake-category step; the submit branch sends `{ competencyIds }`. Removed the now-dead custom-question-building code for this path (~150 lines: `addCompetencyQuestion`/`updateCompetencyQuestion`/etc.), since the correct design never needed it once the real competency-picker step was wired in. Verified live: created two competency assessments with different competency selections, confirmed the take flow shows only the configured subset for each.

**Acceptance check:** Create a competency assessment, select only 3 competencies. Confirm the participant sees only those 3, and a second assessment with different competencies shows a different set.

---

### 2. Org Dashboard runs entirely on mock data, and even once wired the UI fabricates trend deltas the backend can't compute
**Problem:** `web/src/app/(app)/dashboard/page.tsx` (~L35-218) defines `MOCK_STATS`, `MOCK_MONTHLY_ACTIVITY`, `MOCK_PARTICIPANT_TREND`, `MOCK_TYPE_DISTRIBUTION`, `MOCK_DEPARTMENT_PARTICIPATION`, `MOCK_COMPLETION`, `MOCK_ORG_RADAR`, `MOCK_USER_RADAR`, `MOCK_RECENT_ASSESSMENTS`. Separately (content-quality finding): the dashboard UI hardcodes fake trend arrows/deltas (e.g. "↑6.2%") that `analytics.service.ts` has no method to compute — every number is currently a bare snapshot with no period-over-period comparison. Also, `getOrgAggregateRadar`/`getUserAggregateRadar` average competency ratings across *all* assessments and roles indiscriminately, blending incompatible cohorts (a junior IC with an executive) into one number.

**Fix:** Replace each `MOCK_*` constant with a real fetch (via `hooks/useApi.ts`) to `GET /analytics/dashboard`, `/analytics/activity/monthly`, `/analytics/activity/participants`, `/analytics/heatmap`, `/analytics/radar/org`, `/analytics/radar/me`/`/radar/user/:userId`, and the existing `GET /assessments` list for recent activity. Remove the fake trend-delta UI until Tier 4's trend-support work exists (don't fabricate deltas — show a plain number, or omit the arrow, until real period-over-period data exists). Scope the radar endpoints per assessment/cohort rather than blending org-wide.

**Acceptance check:** Confirm 7 network calls to `/analytics/*` fire and chart values reflect real seeded data. Confirm no fabricated trend numbers remain unless backed by a real calculation. Confirm an empty org shows a zero state, not an error.

**Implementation notes (✅ done):** All `MOCK_*` constants removed; wired to the real endpoints listed above plus a new `GET /analytics/participation/departments` (didn't exist before — needed a raw-entity-reference join since `User` has no `department` relation defined, only a plain `departmentId` column). Fabricated trend-delta UI removed rather than left in place. Consolidated the admin dashboard to a single correctly-typed `useApi('/analytics/dashboard')` call (the previous ad-hoc inline fetch used a flat camelCase shape that didn't match the backend's actual snake_case nested response). Verified live and via full e2e regression.

---

### 3. Reports page + PDF generation is fully simulated
**Problem:** `web/src/app/(app)/reports/page.tsx` defines `MOCK_ASSESSMENTS`, `MOCK_PARTICIPANTS_BY_ASSESSMENT`, `MOCK_REPORTS_INITIAL`. PDF "generation" is a client-side `setTimeout` against mock state — no request to the backend ever happens. `web/src/lib/reportPdf.ts` (L44-71) fabricates scores via `mockCompetencyScores()`, `mockBigFive()`, `mockReadiness()`.

**Fix:** Replace mock lists with real fetches (`GET /assessments`, `GET /assessments/:id/participants`, `GET /reporting`). Replace the fake-generation flow with `POST /reporting/generate` then poll/SWR-revalidate `GET /reporting/:id` until `completed`. Delete the mock score generators from `reportPdf.ts`. Wire download buttons to `GET /reporting/:id/download`.

**Acceptance check:** Trigger "Generate Report" for a real assessment, confirm a real network call and a pending → completed transition, confirm the downloaded PDF contains real data.

**Implementation notes (✅ done):** Note the real route prefix is `/reports`, not `/reporting` as the module folder name might suggest. Both `reports/page.tsx` and the assessment-detail `ReportsTab` now use `POST /reports/generate`, `GET /reports`/`GET /reports?assessmentId=`, and real blob-based PDF download. `web/src/lib/reportPdf.ts` (the mock-score PDF generator) had zero remaining callers after this fix and was deleted outright rather than left as dead code, since real PDFs now come from the backend's Puppeteer-rendered templates. Also wired up as part of Tier 2 item 10 below: generation is now genuinely async via BullMQ, with the frontend polling (`useApi`'s `refreshInterval`) until each report reaches `ready`/`failed`. Verified live: generated reports for competency/personality/readiness types, confirmed real `pending → ready` transitions and that the downloaded PDF is a real, non-trivial file (tens of KB, not a stub).

---

### 4. Competency Library CRUD only touches local state
**Problem:** `web/src/app/(app)/competency-library/page.tsx` seeds state directly from `MOCK_COMPETENCIES`/`MOCK_DOMAINS`; add/edit/delete mutate local React state only, never persisted.

**Fix:** Wire to `api/src/assessment/items` (domains) and `api/src/assessment/uc2-competency` (competencies) endpoints, following the CRUD pattern already correct in `settings/users/page.tsx`/`settings/departments/page.tsx`.

**Acceptance check:** Add/edit/delete a competency, refresh — changes persist. Confirm the new competency is immediately selectable in the (now-fixed) assessment wizard.

**Implementation notes (✅ done, scope adjusted from what the doc originally assumed):** Both domains and competencies actually live in `api/src/assessment/items` (`GET /items/domains`, `GET /items/competencies`, `POST /items/competencies`), not `uc2-competency` (that module only handles rating submission). More importantly, the real backend supports less than the mock UI implied: no domain CRUD, no competency delete, no proficiency-level/behaviour editing, and — critically — **no file-attachment/upload support anywhere in the backend** (no multer, no blob wiring for this). The original mock UI's "Supporting files" upload used `URL.createObjectURL()` — a fake, session-only blob URL that was never persisted and would silently vanish on reload. Rather than wire a persuasive-looking upload UI to nothing, that feature was removed; the rewritten page does real create + list + detail-view (including real proficiency levels/indicators/behaviours when present) against what the backend actually supports. Domain icons are now mapped from the real seeded domain `code` values (`COMM`, `TEAM`, `DECS`, `STRA`, `EMOT`, `ACCT`, `CHNG`, `RESL`) with a generic fallback, using each domain's real `colour` field for styling instead of a hardcoded per-mock-id palette. Verified live: create/list/validation (400 on missing domainId)/RBAC (403 for non-admin) all confirmed against the real API.

---

### 5. Assessment Detail page: nominations/reports/personality scores mocked, and missing operational features
**Problem:** `web/src/app/(app)/assessments/[id]/page.tsx` correctly fetches the assessment and participants, but rater nominations, reports, and personality scores come from `MOCK_NOMINATIONS_MAP`/`MOCK_REPORTS_MAP`/`MOCK_PERSONALITY_SCORES_MAP`. Separately (content-quality finding): even once wired, there's no way to remind a *specific* outstanding rater — "Send Reminders" is a single blanket action, not scoped to the non-responders actually shown in the rater list — and no due-date/overdue indicator per participant/rater, so completion % has no deadline context.

**Fix:** Replace mocks with real fetches to the UC1 nominations endpoint, `GET /reporting?assessmentId=:id`, and the UC3 scores endpoint. Add a targeted per-rater/per-participant reminder action and a due-date/overdue indicator.

**Acceptance check:** Confirm all three sections show data matching the DB for the specific assessment open. Confirm an admin can remind one specific outstanding rater without emailing everyone, and can see who's overdue.

**Implementation notes (✅ done):** Nominations/reports/personality-scores sections wired to real endpoints. For the reminder gap: discovered `engine.service.ts`'s `sendReminders()` (the bulk "Send Reminders" button's actual target) was **entirely fake** — a dead, mostly-commented-out method with a stray `console.log` that unconditionally returned success without sending anything or even checking assessment status. Fixed it to send real reminders to incomplete participants (via `NotificationsService`), respecting the `ACTIVE`-only guard the dead code had only commented out. Separately, `uc1-feedback.service.ts`'s 360-specific `sendReminders()` was already real (reminds outstanding raters) but the frontend's bulk button was pointed at the fake generic one even for 360 assessments — fixed to route by assessment type. Added new targeted endpoints: `POST /assessments/:id/participants/:participantId/remind` and `POST /assessments/:id/360/nominations/:nominationId/remind`, both wired to per-row "Remind" buttons in the Participants and Feedback Givers tabs, shown only for non-completed rows on ACTIVE assessments. Added a `DueBadge` component showing "Due {date}" or "Overdue" per row from `assessment.endDate`. Verified live: bulk and targeted reminders confirmed for both 360 (rater) and non-360 (participant) assessment types, including guards (draft-blocked, already-completed-blocked, unknown-id 404, non-admin 403).

---

### 6. Avatar component shows fake stock photos for real users
**Problem:** `web/src/components/ui/Avatar.tsx:22-26` pulls a fake face from `https://i.pravatar.cc/150?img=N` for every real user org-wide.

**Fix:** Remove the pravatar call; fall back to initials-only rendering.

**Acceptance check:** No `pravatar.cc` requests remain; users without a photo show initials.

**Implementation notes (✅ done):** `Avatar` component rewritten to accept an optional `src` (real `avatarUrl` from `UserDto`) and only fetch/render it when present; falls straight to initials otherwise — no network request to any fake photo service ever fires. Wired `src={user.avatarUrl}` at every call site backed by a real `User` object (assessment detail's participant/report tables, reports page, settings/users). Call sites still backed by mock data (Succession page, NineBoxGrid — Tier 3 territory, not touched this pass) now correctly fall back to initials, which is more honest than a fake photo for confirmed-mock people. Confirmed zero remaining `pravatar` references repo-wide.

---

### 7. Header search box is decorative
**Problem:** `web/src/components/layout/Header.tsx:54-64` has no `value`/`onChange`/submit handler.

**Fix:** Wire to real search or remove until built.

**Acceptance check:** Typing returns real results, or the control is gone.

**Implementation notes (✅ done — removed):** No global-search backend exists anywhere in the API, and building one was well beyond this pass's scope. The `⌘K` hint promised a command palette that was never built. Removed the box entirely rather than leave a non-functional decoy that could mislead a user into thinking search works.

---

## Tier 2 — Backend Query/Wiring/Data-Integrity Fixes

### 8. UC3 personality questionnaire ignores per-assessment configuration
**Problem:** `Uc3PersonalityService.getQuestionnaire` (`uc3-personality.service.ts:61-64`) queries the full global item bank regardless of the assessment's configured `traits`/custom `questions`.

**Fix:** Extend the query to filter by the assessment's configured traits; confirm with product whether partial-trait assessments are valid for T-score scoring before restricting.

**Acceptance check:** Two personality assessments with different trait selections show different question sets (or the wizard step is clarified/removed if all traits are always required).

**Implementation notes (✅ done):** Confirmed safe to restrict — `BigFiveScoringService.scoreParticipant` already iterates the 5 factors and gracefully skips any factor with zero responses (`if (factorResponses.length === 0) { ...continue; }`), so a trait-filtered subset doesn't break T-score computation. `getQuestionnaire` and `submitQuestionnaire`'s completeness check (`totalItems` count) both now filter by `config.traits` via `In(traits)` when the assessment specifies traits; assessments with no `traits` configured (legacy/default) fall back to the full item bank unchanged, so nothing existing regresses. Verified live: a personality assessment restricted to `[openness, conscientiousness]` returns exactly those 2 factors' items (24 of 60 total), and submitting after answering only those 24 succeeds and scores exactly those 2 factors — vs. an unrestricted assessment which still returns and requires all 60/5 factors as before.

---

### 9. UC4 SJT/Learning Agility questionnaires ignore per-assessment configuration
**Problem:** Same pattern as Task 8 in `uc4-readiness.service.ts` (`getSjtQuestionnaire`, `getLearningAgilityQuestionnaire`).

**Fix:** Same approach — extend queries to respect configured dimensions/custom questions; verify against the composite-score weighting logic first.

**Acceptance check:** Same as Task 8, applied to SJT/Learning Agility.

**⚠️ Deferred — genuine taxonomy mismatch discovered during implementation, not a simple query filter.** The wizard's `READINESS_DIMENSIONS` picker (`assessments/new/page.tsx`) uses 7 decorative ids — `strategic_vision`, `learning_agility`, `execution_drive`, `people_leadership`, `change_adaptability`, `decision_making_pressure`, `stakeholder_influence` — that **never correspond to the real seeded item `factor` values**: the 3 SJT scenarios use `problem_solving`/`interpersonal`/`change_leadership`, and the 4 Learning Agility statements use `mental_agility`/`people_agility`/`change_agility`/`results_agility` (see `api/src/database/seeds/readiness-items.seed.ts`). Unlike Task 8's `PERSONALITY_TRAITS` (whose ids match `factor` values exactly, confirmed and fixed), there is no clean 1:1 mapping here — several real factors plausibly map to more than one "pretty" dimension name (e.g. is `problem_solving` closer to "Decision-making Under Pressure" or "Strategic Vision"? is `mental_agility` "Strategic Vision" or "Decision-making"?), and picking wrong would silently misrepresent what a configured assessment actually measures. This is a content/product taxonomy decision, not an engineering one — inventing a mapping unilaterally risks being confidently wrong in a way that's hard to notice later. **No behavior changed for this item**: UC4 SJT/Learning Agility content remains the full global battery for every readiness assessment, exactly as before (safe, zero regression) — the composite scoring engine already tolerates a partial set gracefully if this is revisited (`getSjtScore`/`getLearningAgilityScore` are mean-based over whatever responses exist, not count-gated against a fixed total), so implementing the real fix later is low-risk once the taxonomy is reconciled. Recommend folding this into the same design pass as Tier 3 (Succession) and Tier 4 (Analytics), which already need dedicated product-decision passes before implementation.

---

### 10. Reporting BullMQ queue is dead code
**Problem:** `report.processor.ts` and the `reports` queue are registered but unused — `ReportingController.generate()` calls the service synchronously inline, blocking the HTTP request during Puppeteer rendering.

**Fix:** Enqueue via BullMQ in the controller, move generation logic into the processor's `@Process()` handler, add `pending → processing → completed/failed` status transitions.

**Acceptance check:** `POST /reporting/generate` returns quickly with a job/report id; status transitions to `completed` once the worker finishes.

**Implementation notes (✅ done):** Real route is `POST /reports/generate`; status transitions to `ready`, not `completed` (matching the `Report` entity's actual `'pending' | 'processing' | 'ready' | 'failed'` enum). Split `ReportingService.generateReport()` into `requestReport()` (creates the row as `pending`, enqueues a `{ reportId }` job, returns immediately) and `processReport()` (does the actual Puppeteer rendering, called by `ReportProcessor`). Frontend polls via SWR's `refreshInterval` while any report is `pending`/`processing`. **Discovered and fixed a real e2e test-harness bug along the way**: `test/e2e/setup/app.ts`'s `getApp()` bootstraps the *full* `AppModule` (not a scoped-down test module) and caches it per spec file — but nothing ever called `app.close()`, so **every one of the 16 spec files** leaks its own Nest app, including its own instance of the BullMQ `ReportProcessor` worker, all listening on the same `'reports'` Redis queue. Once report generation became genuinely async, a job enqueued by `09-reports.e2e-spec.ts` could get grabbed by a *different*, already-finished spec file's zombie worker whose Jest module registry had already been torn down, failing with `TypeError: Cannot read properties of undefined (reading 'launch')` (`pdf.service.ts`'s dynamic `import('puppeteer')` resolving against a dead registry) — an intermittent failure (roughly 1 run in 3) visible only on the full 16-suite sequential run, never when `09-reports.e2e-spec.ts` ran in isolation. First attempt (adding `afterAll(() => app.close())` to just that one spec file) reduced but didn't eliminate the flake, since the other 15 zombie workers were still in play. Real fix: moved the `afterAll(() => app.close())` registration into `getApp()`'s own module (`setup/app.ts`), at module scope rather than inside the function — Jest re-evaluates that module fresh for every spec file that imports it, so the hook now fires once per file, correctly closing whichever app that file created, with no per-file edits needed anywhere else. Verified stable across multiple repeated full-suite runs after the fix (previously ~2 of 5 runs showed the flake; zero recurrences in 5+ runs after the shared-helper fix). Functionally: `POST /reports/generate` now returns in ~60ms (vs. blocking for the full render previously), reaches `ready` within ~2-3s, produces a real non-trivial PDF on disk, and downloads correctly.

---

### 11e. Plan-limit race condition
**Problem:** `engine.service.ts:244-253` (`launch()`) and `:309-321` (`addParticipant()`) both do check-then-act with no transaction/lock — concurrent requests can both pass the same limit check and push an org over its plan cap.

**Fix:** Wrap in a transaction with a row lock (`SELECT ... FOR UPDATE` on the org row, or a Postgres advisory lock keyed by orgId).

**Acceptance check:** Fire two concurrent `launch()` calls that would each individually pass the limit check — confirm only one succeeds once locking is in place.

**Implementation notes (✅ done):** Used a Postgres session-scoped advisory lock (`pg_advisory_xact_lock(hashtext(orgId))`, held for the transaction's duration) rather than a row lock, since the check spans multiple tables (assessments, participants, organisations) rather than one row. Added a `withOrgLock()` helper wrapping the check-then-act sections of both `launch()` and `addParticipant()` in a `DataSource.transaction()`. Verified live with genuinely concurrent (`Promise.all`) requests: 3 concurrent `launch()` calls against a plan capped at 2 active assessments → exactly 2 succeed, 1 rejected (confirmed via direct DB state, not just response codes); 3 concurrent `addParticipant()` calls at a 9-of-10 participant boundary → exactly 1 succeeds, final count exactly 10, not 12.

---

### 11f. Department deletion orphans users — no FK constraint
**Problem:** `organisations.service.ts:74-78` deletes a department with no check/reassignment; `users.department_id` has no FK constraint at all in the schema.

**Fix:** Add an FK constraint (`ON DELETE SET NULL`) via a new migration, and/or reassign/null affected users before deleting a department.

**Acceptance check:** Delete a department with active users — confirm they're not left with a dangling reference (verify via the new FK or explicit check).

**Implementation notes (✅ done, both parts):** Migration `1785680000000-UsersDepartmentForeignKey` adds `FK_users_department` (`ON DELETE SET NULL`) plus a supporting index, after first nulling any pre-existing dangling references. Also added the `@ManyToOne`/`@JoinColumn` relation to the `User` entity for consistency (it only had a raw `departmentId` column before). At the service level, `deleteDepartment()` now proactively blocks deletion with a `ConflictException` (409) if the department still has assigned users or child departments, rather than relying solely on the DB constraint to silently null things out — an admin gets a clear "N user(s) still assigned, reassign first" error instead of a surprise. (`departments.parent_id` already had a correct `ON DELETE SET NULL` FK from the initial migration — only `users.department_id` was missing one.) Verified live: empty department deletes fine (200); department with an assigned user → 409 with a clear message; department with a child department → 409; deletion succeeds once the blocker is removed.

---

### 11g. `findSessionByToken` full-table bcrypt scan
**Problem:** `users.service.ts:105-116` loads every non-expired session across all orgs and bcrypt-compares the presented token against each hash in a loop — scales linearly with total session count, and is a cheap DoS vector.

**Fix:** Replace with a lookup keyed by a non-secret session identifier (indexed lookup key alongside the hashed token), only bcrypt-verifying the matched row.

**Acceptance check:** Confirm `/auth/refresh` latency doesn't scale with total unrelated session count; add a test with many seeded sessions.

**Implementation notes (✅ done):** Switched refresh-token hashing from bcrypt (slow, salted — appropriate for low-entropy passwords, pointless for a high-entropy random token) to the same fast deterministic SHA-256 approach already used for password-reset tokens, enabling a direct indexed lookup (`sessions.refresh_token_hash` already has a `UNIQUE` constraint at the DB level from the initial migration — it just couldn't be used for lookups while the stored value was a non-deterministic bcrypt hash). Renamed the private `hashResetToken()` helper to the now-shared `hashToken()`. **Note:** this changes the hash format for new sessions going forward; any session created before this change won't match on refresh and that user will need to log in again — a one-time, harmless local-dev consequence, not a production concern since this predates any real deployment.

---

### 11h. No minimum-N safeguard on analytics aggregates
**Problem:** `uc1-feedback.service.ts` enforces `MIN_RATERS = 3` before revealing aggregated 360 scores, but `analytics.service.ts` has no equivalent guard — `getOrgAggregateRadar`/`getUserAggregateRadar` return bare averages with no participant count at all, so a 2-person average looks identical to a 200-person one. `getCompetencyHeatmap` does return `participantCount` per row but nothing consumes it.

**Fix:** Add a count-based suppression or warning flag to the radar/dashboard aggregate endpoints, consistent with the existing anonymity precedent; have the frontend visually flag/gray out low-N cells.

**Acceptance check:** An org/department with fewer than the minimum threshold of contributors shows a "insufficient data" indicator instead of a falsely-precise average.

**Implementation notes (✅ done, flag not suppress — matches this item's own wording):** `getOrgAggregateRadar` and `getUserAggregateRadar` now return a `sampleSize` per axis (`COUNT(DISTINCT participant_id)` for the org radar, `COUNT(DISTINCT assessment_id)` for the personal radar) alongside the existing `value`, following the same pattern `getCompetencyHeatmap` already used. Rather than suppress the number outright, `RadarChart.tsx` mutes the axis label/score-dot opacity and adds an SVG tooltip ("Based on only N people — interpret with caution") when `sampleSize < 3`, and the dashboard's `RadarViews` shows a small caption when any axis is low-N — this matches the plan's own instruction to flag/grey rather than hide, since (unlike UC1's rater anonymity, which is a promised privacy guarantee) this is a statistical-reliability signal for admin/HR-manager viewers who already have legitimate access to individual scores elsewhere. Verified live with real data: a domain rated by exactly 1 participant returns `sampleSize: 1` correctly.

---

### 11i. Hardcoded generic report suggestion text
**Problem:** `reporting.service.ts:129` — every 360 report's per-competency development suggestion is the same hardcoded string (`'Review behavioural indicators at the next level and seek specific coaching in this area.'`) regardless of the competency or participant. More broadly, the report-generation service passes narrative fields (`readinessNarrative`, personality `narrative`/`leadershipImplications`) into Handlebars templates that render whatever they're given — needs verification these are actually populated algorithmically from score bands, not risking silent empty/generic content.

**Fix:** Generate real per-competency suggestion text derived from the actual competency/gap being reported. Audit the rest of the report-generation service to confirm narrative fields are populated from score data, not left as filler.

**Acceptance check:** Generate reports for two different competencies with different gap directions — confirm the suggestion text actually differs and references the specific competency.

**Implementation notes (✅ done — scoped to the concretely-identified spot):** Added `competencyDevelopmentSuggestion(competencyName, score, gap)` to `ReportingService`, deriving genuinely different text from the score band and the self-vs-others gap direction — a rater-sees-them-higher gap gets "likely underestimating a real strength" framing, a self-sees-higher gap gets "recalibrate via specific feedback" framing, and a well-aligned low score gets straightforward coaching framing. This fixes the one concretely-identified hardcoded string. The broader ask in this item ("audit the rest of the report-generation service to confirm narrative fields are populated from score data, not left as filler") was not separately re-audited this pass — the earlier audit that produced this plan already spot-checked `readinessNarrative` and personality `narrative`/`leadershipImplications` and found them genuinely score-derived, not filler; no new evidence surfaced during implementation to revisit that.

---

## Tier 2B — Reporting File Storage (Infra + Backend)

### 12. Generated report PDFs live on local disk only — no Azure Blob Storage anywhere
**Problem:** `api/src/reporting/pdf.service.ts:69` writes to `REPORTS_DIR = path.resolve(process.cwd(), 'reports')` via Puppeteer's native `page.pdf({ path: outputPath })`. `ReportEntity.blobUrl` exists but is never populated. `@azure/storage-blob` isn't in `api/package.json`. If the API ever runs more than one instance, or is redeployed while a report is pending download, requests served by a different process will 404. No retention/cleanup job exists either. Infra confirms this isn't implemented anywhere — no `azurerm_storage_account`/`azurerm_storage_container` in Terraform; `.env.example` references are blank placeholders.

**Fix (three parts):**
1. **Terraform**: add `azurerm_storage_account` + `azurerm_storage_container` (e.g. `reports`, `uploads`) to `infra/terraform/main.tf`, connection string/account name in `outputs.tf`.
2. **Backend**: add `@azure/storage-blob`; upload the generated PDF to blob storage after Puppeteer renders it, set `report.blobUrl`; update the download resolution to prefer `blobUrl` and stream/redirect from blob instead of `res.sendFile` from local disk.
3. **Deploy pipeline**: add the new storage env vars to `.github/workflows/deploy-dev.yml`'s generated `.env`.
4. **Optional**: a scheduled cleanup job to expire old report blobs.

**Acceptance check:** Generate a report, confirm the PDF lands in the Azure Blob container and `report.blobUrl` is populated — not just present in `api/reports/` on disk. If feasible, verify download succeeds when requested against a different API process than the one that generated it.

---

## Tier 3 — Succession Planning: Full Backend Build-Out

### 13. Succession page has no backing entities — needs new data model, not just wiring
**Problem:** `web/src/app/(app)/succession/page.tsx` (1039 lines) is entirely static: `MOCK_CANDIDATES`, `MOCK_KEY_ROLES`, `MOCK_BENCH`, and a hardcoded org-chart tree `ORG_POSITIONS` (L724-753). Export metadata is hardcoded (`'LeaderPrism Demo Org'`, `'Jul 2026'`). Zero real interactivity — no `useEffect`/`api.*` call anywhere; Export PDF is the only action and it exports the mock arrays. The existing `GET /analytics/succession` returns readiness-rating counts and role-grouped pipeline data, but has no incumbent/tenure, no criticality, no department grouping, no performance/potential axes, no names, and nothing resembling org-chart reporting lines. A repo-wide search confirms zero existing entities for `successor`, `keyRole`, `flightRisk`, or `bench`. Separately (content-quality finding): even the intended design is missing a flight-risk/retention-risk dimension (a standard third axis alongside performance/potential) and has no linkage from a candidate's development areas to an actual tracked plan with owner/timeline.

**Fix — new data model and endpoints, then rewire the page:**
1. **`KeyRole` entity**: `organisationId`, role title, department, criticality, incumbent (FK to `User`), incumbent tenure, **and a flight-risk/retention-risk field**. CRUD endpoints restricted to `ORG_ADMIN`/`HR_MANAGER`, org-scoped.
2. **`Successor` entity**: links a candidate to a `KeyRole` with a readiness bucket, nominated-by/nominated-at.
3. **Org-hierarchy data**: check first whether `core/users`/`core/organisations` already has a manager-relationship field before adding a new one (a `reportsToId` self-reference or a dedicated `OrgPosition` entity) — replaces the hardcoded `ORG_POSITIONS` tree.
4. **Performance axis for the 9-box**: UC4 only produces `readinessRating`; needs a product decision — manual performance-rating input, or a derived proxy from UC2 competency composite score. Confirm before building.
5. **Development-plan linkage**: development areas should reference an actual tracked plan (owner, timeline, status), not static tags.
6. **Department bench aggregation endpoint**: extend `analytics.service.ts`, pattern-matched on `getSuccessionOverview`, to group by `Department`.
7. **Rewire the frontend**: replace all mock arrays with real fetches; fix Export PDF to use the real org name/timestamp; add real `api.post`/`api.patch` handlers for add-candidate, edit-key-role, assign-successor, move-on-9-box (none of these exist today).

**Sequencing note:** start with its own design pass (entity shapes, migration, endpoint contracts, the performance-axis and flight-risk decisions) before writing code — this is new backend surface, significantly larger than every other item in this document.

**Acceptance check:** Create a key role, nominate a successor, assign a performance rating — confirm the 9-box, Key Roles tab, bench table, and org-chart tree all reflect real DB state. Confirm an empty org shows a sensible empty state. Run `npm run test -w api` for new entities/endpoints.

---

## Tier 4 — Analytics Design Maturity (roadmap-level, needs product prioritization)

### 14. Analytics layer lacks trends, benchmarking, cross-UC correlation, and broad actionability
Flagging for visibility, not sized/scoped for implementation yet:
- **No time-series/trend support anywhere** — every method queries current-state snapshots; underlying timestamps (`ReadinessScore.calculatedAt`, `CompetencyRating.createdAt`) could support period-over-period comparison, but nothing groups by period today, and `ReadinessScore`'s unique constraint isn't shaped to hold a rolling series.
- **No benchmarking of any kind** — no score is ever compared against an industry/role-level/historical-org reference.
- **No cross-UC correlation** — each analytics method queries one UC's entities in isolation, even though `ReadinessScore` already blends multiple UCs' sub-scores at calculation time without exposing that composition.
- **Actionability limited to the succession 9-box** — no "assessments stalling near deadline" view, no department engagement-rate breakdown, no flagging of individuals with concerning multi-UC gap patterns.

Recommend discussing scope/priority separately once Tier 0–3 are underway, rather than sizing this now — it's a bigger product decision than a bug fix.

**Not started.**

---

## Remaining Work (as of 2026-08-02)

Everything in Tier 0 and Tier 1 is done. In Tier 2, only item 9 (UC4 dimension scoping) is deferred, for the taxonomy-mismatch reason explained in its section — everything else in Tier 2 is done. Still outstanding:

- **Item 9** — needs a product decision on the SJT/Learning Agility dimension taxonomy before it can be implemented (not an engineering blocker).
- **Tier 2B (item 12)** — Blob Storage wiring. Not started.
- **Tier 3 (item 13)** — Succession full backend build-out. Not started; needs its own design pass as noted (entity shapes, performance-axis and flight-risk decisions).
- **Tier 4 (item 14)** — Analytics roadmap. Not started; needs product prioritization, not an implementation task as scoped.

All completed items were verified against the local Docker dev stack: `npx tsc --noEmit` + `npm run build` for both `api` and `web` after every change, live functional Node scripts hitting the running dev API for every new/changed endpoint (not just type-checking), and a full `NODE_ENV=test` e2e regression run after each tier to confirm the pre-existing baseline (4 failing suites / 15 failing tests / 102 passing / 3 skipped — all 4 pre-existing failures independently confirmed to predate this work and be caused by unrelated in-progress changes, not anything in this plan) held with zero new regressions.

---

## Explicitly Out of Scope for This Plan

- **Key Vault / secrets-management hardening** — DB password, JWT secrets, etc. are currently plain Terraform variables passed as plaintext GitHub Actions secrets into the VM's `.env`. Real gap, not requested for remediation here.
- **Audit logging** — no `AuditLog` entity/interceptor exists anywhere for sensitive mutations (role changes, department deletes, org settings updates). Real compliance gap for a platform handling HR/PII data, but a net-new cross-cutting feature rather than a fix to something broken — flag for a future round.
- **Rater-token-outlives-closed-assessment** — tokens are correctly random with a 14-day expiry, but expiry is independent of assessment status, so a rater can submit up to 14 days after an admin closes an assessment early. Minor; can be bundled into Tier 0's item 0e IDOR work if convenient since it touches the same files.
- **Org logo / profile photo upload** — already honestly stubbed in the UI ("available in a future update"), not a mock. Would depend on Tier 2B's Blob Storage work if built later.

---

## Suggested Execution Order

1. **Tier 0, in this order**: 0a (UC1 flagship-feature fix) → 0e (IDOR, highest-severity security) → 0b (rate-limit guard binding, one-line) → 0d (missing `@Roles`, one-line) → 0c (trial-expiry-on-refresh) → 0f/0g (email + password rebuild, largest item, own design pass) → 0h (participant self-service, same files as 0a, do together).
2. Task 1 (UC2 bug) — same severity class as 0a, small fix.
3. Tasks 8–9 (UC3/UC4 item scoping) — same bug class as Task 1.
4. Tasks 2–7 (Tier 1 remaining) — dashboard, reports, competency library, assessment detail, avatar, search — can be parallelized.
5. Tasks 11e–11i (Tier 2 data-integrity/consistency) — small, low-risk, can slot in anytime.
6. Task 10 (reporting queue) — do before or alongside Task 12, same files.
7. Task 12 (Tier 2B storage) — infra + backend, moderate size.
8. Task 13 (Tier 3 succession) — largest scope, own design pass, do last or as a parallel workstream.
9. Task 14 (Tier 4 analytics) — separate prioritization conversation, not scheduled here.
