# LeaderPrism — QA Test Scenarios
**Version:** 1.0 | **Date:** 2026-05-31  
**Scope:** Full platform — API, web frontend, scoring engines, security, data isolation  
**Environment:** Local dev (Docker Compose: PostgreSQL 16, Redis 7)

---

## How to Use This Document

Each scenario has:
- **ID** — unique reference for bug reports
- **Priority** — P1 (show-stopper), P2 (major), P3 (moderate), P4 (minor/polish)
- **Setup** — preconditions before running the test
- **Steps** — numbered, exact actions
- **Expected** — what must happen (often tied to a specific HTTP status or UI state)
- **Notes** — edge case context, related code reference

Scenarios that reference specific thresholds (plan limits, anonymity, scoring formulas) are grounded in the actual source code.

---

## 1. Authentication & Session Management

### QA-AUTH-001 · P1 — New organisation registration, happy path
**Setup:** Clean DB, no existing users  
**Steps:**
1. POST `/api/v1/auth/register` with `{ orgName, orgSlug, firstName, lastName, email, password }`
2. Inspect response body
3. Inspect `Set-Cookie` response header

**Expected:**
- HTTP 201
- Body contains `{ data: { accessToken, user: { id, email, role: "org_admin" }, organisation: { id, plan: "trial", trialEndsAt } } }`
- `Set-Cookie: refresh_token=<uuid>; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/`
- `trialEndsAt` is exactly 30 days from now (within ±60s)
- JWT payload decodes to `{ sub, orgId, role: "org_admin" }`

---

### QA-AUTH-002 · P1 — Duplicate email on registration
**Setup:** User with `jane@test.com` already exists  
**Steps:**
1. POST `/api/v1/auth/register` with the same email but a different orgSlug

**Expected:**
- HTTP 409
- `{ error: { code: "CONFLICT", message: "An account with this email already exists" } }`

---

### QA-AUTH-003 · P2 — Duplicate org slug on registration
**Setup:** Org with slug `acme-hr` exists  
**Steps:**
1. POST `/api/v1/auth/register` with `orgSlug: "acme-hr"` but a different email

**Expected:**
- HTTP 409
- Error message mentions "slug … is already taken"

---

### QA-AUTH-004 · P1 — Login with correct credentials
**Steps:**
1. POST `/api/v1/auth/login` with valid email/password

**Expected:**
- HTTP 200
- Response body contains `accessToken`
- `refresh_token` HttpOnly cookie set
- `lastLoginAt` updated in DB (verify directly)

---

### QA-AUTH-005 · P1 — Login with wrong password
**Steps:**
1. POST `/api/v1/auth/login` with correct email but wrong password

**Expected:**
- HTTP 401
- `{ error: { code: "UNAUTHORISED" } }`
- No `Set-Cookie` header
- No information leakage — error message must not reveal "email correct but password wrong"

---

### QA-AUTH-006 · P1 — Access token refresh rotates cookie
**Setup:** Authenticated session with refresh cookie  
**Steps:**
1. Note current `refresh_token` cookie value
2. POST `/api/v1/auth/refresh`
3. Note new `refresh_token` cookie value
4. Try POST `/api/v1/auth/refresh` again using the OLD refresh token manually in the cookie

**Expected:**
- Step 2 → HTTP 200, new `accessToken`, new `refresh_token` cookie
- Step 4 → HTTP 401 (token rotation — old token is invalidated after use)

---

### QA-AUTH-007 · P1 — Expired trial blocks login
**Setup:** Org with `plan: "trial"` and `trialEndsAt` set to yesterday  
**Steps:**
1. POST `/api/v1/auth/login` for a user in that org

**Expected:**
- HTTP 401
- `message` mentions "Trial period has expired"

---

### QA-AUTH-008 · P1 — Inactive org blocks login
**Setup:** Org with `is_active = false`  
**Steps:**
1. POST `/api/v1/auth/login` for a user in that org

**Expected:**
- HTTP 401
- `message` mentions "Organisation is inactive"

---

### QA-AUTH-009 · P1 — JWT bearer token required on protected routes
**Steps:**
1. GET `/api/v1/assessments` with no `Authorization` header

**Expected:**
- HTTP 401

---

### QA-AUTH-010 · P2 — Expired access token rejected, refresh succeeds
**Setup:** Authenticated. Manually set `JWT_ACCESS_EXPIRY=1s` in `.env`, restart API  
**Steps:**
1. Login — get access token
2. Wait 2 seconds
3. GET `/api/v1/assessments` with the expired token

**Expected:**
- HTTP 401 from API
- Frontend auto-calls `/auth/refresh`, retries original request, succeeds (verify in browser network tab)

---

### QA-AUTH-011 · P2 — Logout clears session and cookie
**Steps:**
1. Login, note refresh token cookie
2. POST `/api/v1/auth/logout`
3. Attempt POST `/api/v1/auth/refresh` with the same cookie

**Expected:**
- Step 2 → HTTP 200, `Set-Cookie: refresh_token=; Max-Age=0` (cleared)
- Step 3 → HTTP 401

---

### QA-AUTH-012 · P3 — Password validation rules enforced
**Steps:** Attempt registration with each of these passwords:
- `short1A` (7 chars)
- `alllowercase1`
- `ALLUPPERCASE1`
- `NoNumbers!!`

**Expected:** All return HTTP 400 with `VALIDATION_ERROR` and `fields.password`

---

### QA-AUTH-013 · P3 — Org slug validation (format)
**Steps:** Attempt registration with each:
- `Has Spaces`
- `HAS_UPPERCASE`
- `has@special!`
- `ab` (too short)

**Expected:** All return HTTP 400, `fields.orgSlug`

---

## 2. Multi-Tenancy & Data Isolation

> These are the most critical security tests. A failure here is a data breach.

### QA-TENANT-001 · P1 — Org A cannot read Org B's assessments
**Setup:** Two separate orgs (A and B), each with one assessment  
**Steps:**
1. Login as Org A admin, get access token
2. GET `/api/v1/assessments` — note Org A's assessment ID
3. GET `/api/v1/assessments` — confirm Org B's assessment does NOT appear
4. Directly GET `/api/v1/assessments/<org_b_assessment_id>` with Org A's token

**Expected:**
- Step 3 → only Org A data in response
- Step 4 → HTTP 404 (not 403 — must not even confirm the ID exists)

---

### QA-TENANT-002 · P1 — Org A cannot modify Org B's assessment
**Setup:** Two orgs with known assessment IDs  
**Steps:**
1. Attempt PATCH `/api/v1/assessments/<org_b_id>` with Org A's token
2. Attempt POST `/api/v1/assessments/<org_b_id>/launch` with Org A's token

**Expected:** Both → HTTP 404

---

### QA-TENANT-003 · P1 — Org A cannot view Org B's competency library
**Steps:**
1. Org B creates a custom competency
2. Login as Org A, GET `/api/v1/competencies`

**Expected:** Org B's custom competency is not in the response. System-wide (null orgId) competencies are visible to all.

---

### QA-TENANT-004 · P1 — Org A cannot read Org B's reports or rater responses
**Setup:** Org B has a completed 360 assessment with rater responses  
**Steps:**
1. Login as Org A, GET `/api/v1/reports?assessmentId=<org_b_assessment_id>`
2. GET `/api/v1/assessments/<org_b_id>/360/scores/<participant_id>`

**Expected:** Both → HTTP 404

---

### QA-TENANT-005 · P1 — orgId in JWT cannot be spoofed via request body
**Steps:**
1. Login as Org A, get valid token (orgId = org_a_id)
2. POST `/api/v1/assessments` with request body containing `organisationId: "<org_b_id>"`

**Expected:**
- Assessment created under Org A (orgId from JWT, not body)
- Verify in DB: `organisation_id = org_a_id`

---

### QA-TENANT-006 · P2 — Rater token is not org-scoped but still secure
**Setup:** Rater nomination exists for Org B with a valid token  
**Steps:**
1. Capture the rater token UUID
2. GET `/api/v1/rater/<token>` (no auth at all)
3. Verify response only contains information about Org B's participant — no other org data

**Expected:** Only participant name, assessment title, competency list for Org B's assessment

---

## 3. Role-Based Access Control

### QA-RBAC-001 · P1 — Participant cannot access admin-only endpoints
**Setup:** User with role `participant`  
**Steps:**
1. Login as participant
2. Attempt POST `/api/v1/assessments` (create assessment)
3. Attempt POST `/api/v1/organisations/me/invite`
4. Attempt GET `/api/v1/analytics/dashboard`

**Expected:** All → HTTP 403 with `FORBIDDEN`

---

### QA-RBAC-002 · P1 — Manager can rate direct reports, not create assessments
**Setup:** User with role `manager`  
**Steps:**
1. Login as manager
2. Attempt POST `/api/v1/assessments` → expect 403
3. POST `/api/v1/assessments/<id>/competency/manager` for a valid assessment → expect 200 or 201

**Expected:** As described

---

### QA-RBAC-003 · P2 — HR Manager can manage assessments but not org settings
**Setup:** User with role `hr_manager`  
**Steps:**
1. POST `/api/v1/assessments` → expect success
2. PATCH `/api/v1/organisations/me` → expect 403 (ORG_ADMIN only)

**Expected:** As described

---

### QA-RBAC-004 · P2 — Super admin is not assignable via registration
**Steps:**
1. POST `/api/v1/auth/register` — verify the created user has `role: "org_admin"`, not `super_admin`
2. Attempt POST `/api/v1/organisations/me/invite` with `role: "super_admin"` in body

**Expected:**
- Registration always creates `org_admin`
- Invite with `super_admin` role should fail validation (400)

---

## 4. Assessment Lifecycle & Plan Limits

### QA-ASS-001 · P1 — Create assessment, happy path
**Setup:** Org with professional plan  
**Steps:**
1. POST `/api/v1/assessments` with valid `{ title, assessmentType: "360_feedback", config: { competencyIds: [...] } }`

**Expected:**
- HTTP 201
- `{ data: { id, status: "draft", assessmentType: "360_feedback" } }`

---

### QA-ASS-002 · P1 — Trial plan blocks Competency and Readiness assessment types
**Setup:** Org on `trial` plan  
**Steps:**
1. POST `/api/v1/assessments` with `assessmentType: "competency"`
2. POST `/api/v1/assessments` with `assessmentType: "readiness"`
3. POST `/api/v1/assessments` with `assessmentType: "360_feedback"` (allowed)
4. POST `/api/v1/assessments` with `assessmentType: "personality"` (allowed)

**Expected:**
- Steps 1, 2 → HTTP 403, message mentions plan restriction
- Steps 3, 4 → HTTP 201

---

### QA-ASS-003 · P1 — Trial plan max 2 active assessments
**Setup:** Org on `trial` plan with 2 active assessments  
**Steps:**
1. Create a 3rd assessment (draft)
2. Attempt to launch it

**Expected:**
- Draft creation succeeds
- Launch → HTTP 403, message mentions "Plan limit reached: maximum 2 active assessments"

---

### QA-ASS-004 · P1 — Trial plan max 10 participants enforced at launch
**Setup:** Org on `trial` plan, assessment in draft with 11 participants  
**Steps:**
1. Attempt to launch assessment

**Expected:** HTTP 403, message mentions participant limit (10)

---

### QA-ASS-005 · P1 — Cannot update an ACTIVE assessment
**Setup:** Assessment in `active` status  
**Steps:**
1. PATCH `/api/v1/assessments/<id>` with `{ title: "New title" }`

**Expected:** HTTP 400, "Only DRAFT assessments can be updated"

---

### QA-ASS-006 · P1 — Cannot launch with zero participants
**Setup:** Assessment in draft with no participants  
**Steps:**
1. POST `/api/v1/assessments/<id>/launch`

**Expected:** HTTP 400, "Cannot launch assessment with no participants"

---

### QA-ASS-007 · P2 — Cannot add duplicate participant
**Setup:** User already added as a participant  
**Steps:**
1. POST `/api/v1/assessments/<id>/participants` with the same userId again

**Expected:** HTTP 400, "already a participant"

---

### QA-ASS-008 · P2 — Cannot close a DRAFT assessment
**Steps:**
1. POST `/api/v1/assessments/<draft_id>/close`

**Expected:** HTTP 400, "Only ACTIVE assessments can be closed"

---

### QA-ASS-009 · P2 — Cannot add participant to closed assessment
**Setup:** Assessment in `closed` status  
**Steps:**
1. POST `/api/v1/assessments/<id>/participants` with a valid userId

**Expected:** HTTP 400, "Cannot add participants to a closed or archived assessment"

---

### QA-ASS-010 · P3 — Status transition diagram is enforced end-to-end
```
draft → active (launch)
active → closed (close)
```
**Steps:**
1. Try `close` on a draft → 400
2. Try `launch` on a closed → 400
3. Try `launch` → `launch` again (already active) → 400
4. Valid path: create draft → launch → close → confirm status=closed

---

## 5. 360-Degree Feedback (UC1)

### QA-360-001 · P1 — Rater nomination full flow
**Setup:** Active 360 assessment with participant  
**Steps:**
1. Participant: POST `/api/v1/assessments/<id>/360/nominations` with 1 supervisor, 3 peers, 3 direct reports
2. Admin: POST `/api/v1/assessments/<id>/360/nominations/approve`
3. Verify each nomination now has status=`approved`, token, tokenExpires (14 days from now)
4. Verify notification logged (in dev: Logger output)

**Expected:**
- Step 3: Nominations have UUID tokens set
- Step 4: Email log entries appear in API logs

---

### QA-360-002 · P1 — Rater submits feedback via token
**Setup:** Approved nomination with valid token  
**Steps:**
1. GET `/api/v1/rater/<token>` → verify landing info
2. POST `/api/v1/rater/<token>/responses` with all competency scores + overall

**Expected:**
- Step 1 → HTTP 200, `{ participantName, assessmentTitle, competencies }`
- Step 2 → HTTP 201, nomination status becomes `completed`

---

### QA-360-003 · P1 — Rater cannot submit twice (idempotency guard)
**Setup:** Rater has already submitted (status = completed)  
**Steps:**
1. POST `/api/v1/rater/<token>/responses` again

**Expected:** HTTP 400, "Feedback already submitted"

---

### QA-360-004 · P1 — Expired rater token is rejected
**Setup:** Nomination with `tokenExpires` set to yesterday (manually update DB)  
**Steps:**
1. GET `/api/v1/rater/<token>` or POST responses

**Expected:** HTTP 403, "Rater token has expired"

---

### QA-360-005 · P1 — Anonymity threshold blocks score retrieval
**Setup:** Active 360 with only 2 peer responses (below MIN_RATERS=3)  
**Steps:**
1. GET `/api/v1/assessments/<id>/360/scores/<participantId>`

**Expected:** HTTP 403, "Insufficient peer responses for anonymity (2/3)"

---

### QA-360-006 · P1 — Anonymity threshold met → scores returned
**Setup:** 3+ peer responses completed  
**Steps:**
1. GET `/api/v1/assessments/<id>/360/scores/<participantId>`

**Expected:**
- HTTP 200
- Response contains per-competency scores broken down by perspective (supervisor/peer/direct_report)
- Self score present and gap vs others calculated
- Open-text comments returned shuffled (no ordering information)

---

### QA-360-007 · P2 — Supervisor group always returns scores (no minimum threshold)
**Setup:** Only 1 supervisor responded, 3 peers responded, 3 direct reports responded  
**Steps:**
1. GET `/api/v1/assessments/<id>/360/scores/<participantId>`

**Expected:** HTTP 200 (supervisor data included, no minimum threshold applied to supervisor group)

---

### QA-360-008 · P2 — Unapproved nomination cannot be used for submission
**Setup:** Nomination in `pending` status (not yet approved by admin)  
**Steps:**
1. POST `/api/v1/rater/<token>/responses`

**Expected:** HTTP 403, "This nomination has not been approved yet"

---

### QA-360-009 · P2 — Invalid/unknown rater token returns 404
**Steps:**
1. GET `/api/v1/rater/00000000-0000-0000-0000-000000000000`

**Expected:** HTTP 404 (not 500, not 401)

---

### QA-360-010 · P2 — Self-assessment is separate from rater responses
**Steps:**
1. Participant submits their self-assessment scores
2. Verify these appear as `relationship: "self"` in the aggregation
3. Verify self scores are excluded from the "others" mean

**Expected:** Gap analysis = `others_mean - self_score` per competency

---

### QA-360-011 · P3 — Reminders only sent to incomplete raters
**Setup:** 3 raters total: 2 completed, 1 still pending  
**Steps:**
1. POST `/api/v1/assessments/<id>/360/reminders`
2. Check API logs

**Expected:** Reminder email logged for 1 rater only (the pending one)

---

## 6. Competency Assessment (UC2)

### QA-COMP-001 · P1 — Self-assessment creation and submission
**Steps:**
1. POST start/or get self-assessment for participant
2. Submit ratings for all competencies with evidence text
3. Verify `submittedAt` is set

**Expected:** Ratings saved, `submittedAt` populated

---

### QA-COMP-002 · P1 — Gap analysis returns correct calculation
**Setup:** Self-rating = 2 (Developing), Manager-rating = 3 (Proficient) for same competency  
**Steps:**
1. GET gap analysis endpoint

**Expected:**
- `gap = 1` (manager - self = 3 - 2)
- Positive gap = underestimating themselves
- Domain-level summaries are averages of competency gaps within that domain

---

### QA-COMP-003 · P2 — Manager cannot submit another participant's self-assessment
**Setup:** Manager tries to POST to participant's self-assessment endpoint  
**Steps:**
1. Manager submits to `POST /api/v1/assessments/<id>/competency/self` for a participant they don't manage

**Expected:** HTTP 403 or 404 (manager can only submit via the manager endpoint with participant specified)

---

### QA-COMP-004 · P3 — Missing manager assessment still returns partial results
**Setup:** Participant completed self-assessment, manager has not submitted  
**Steps:**
1. GET gap analysis

**Expected:** Self-scores returned, manager gap = null or N/A (not a 500 error)

---

## 7. Personality Assessment (UC3 — Big Five)

### QA-PERS-001 · P1 — Questionnaire returns exactly 60 items
**Setup:** Active personality assessment  
**Steps:**
1. GET `/api/v1/assessments/<id>/personality/questionnaire`

**Expected:** `items` array length = 60, distribution: 12 per factor (openness/conscientiousness/extraversion/agreeableness/emotional_stability)

---

### QA-PERS-002 · P1 — Scoring: reverse-scored item inverted correctly
**Setup:** Item with `isReverse: true`, rated as 1 by participant  
**Expected internal calculation:**
- Raw contribution = 6 - 1 = 5 (not 1)
- Verify via computed T-score: higher raw → higher T-score

---

### QA-PERS-003 · P1 — T-score formula: mean response → T=50
**Setup:** All 12 items in one factor rated at exactly the normative mean  
**Expected:**
- Raw score = norm.mean × 12
- T-score = 50 (± rounding tolerance of 0.5)
- Percentile = ~50th percentile

---

### QA-PERS-004 · P1 — T-score clamping at extremes
**Setup:** All 12 items rated 5 (maximum possible)  
**Expected:** T-score ≤ 80 (not unbounded)

**Setup:** All 12 items rated 1 (minimum possible)  
**Expected:** T-score ≥ 20

---

### QA-PERS-005 · P1 — Scoring requires normative data (graceful failure without it)
**Setup:** Delete normative data for `openness` factor  
**Steps:**
1. Submit complete personality questionnaire
2. Call scoring endpoint

**Expected:** Warning logged, openness score skipped/null — other 4 factors still score correctly. No 500 error.

---

### QA-PERS-006 · P2 — Auto-save each response (one at a time)
**Steps:**
1. Submit item 1 response
2. Reload the questionnaire endpoint
3. Verify item 1 response is persisted and item 1 is marked answered in progress

**Expected:** Progress state reflects item 1 as answered

---

### QA-PERS-007 · P2 — Submit triggers scoring automatically
**Steps:**
1. Submit all 60 responses
2. POST to `/submit` endpoint
3. GET personality scores

**Expected:** Scores populated for all 5 factors with tScore, percentile, narrative

---

### QA-PERS-008 · P3 — Narrative is returned for all T-score ranges
**Verify each of these calls returns non-empty narrative string:**
- `getFactorNarrative('openness', 65)` → high
- `getFactorNarrative('openness', 50)` → medium
- `getFactorNarrative('openness', 35)` → low
- Same for all 5 factors

---

## 8. Leadership Readiness (UC4)

### QA-READY-001 · P1 — Readiness score boundaries are exact
Using the formula: composite = 0.30×comp + 0.25×feedback + 0.25×SJT + 0.15×LA + 0.05×personality

| Composite Score | Expected Rating |
|----------------|----------------|
| 75.0 | ready_now |
| 74.9 | 1_2_years |
| 60.0 | 1_2_years |
| 59.9 | developing |
| 45.0 | developing |
| 44.9 | not_yet_ready |
| 0.0  | not_yet_ready |

**Verify** these exact boundary values produce the correct rating.

---

### QA-READY-002 · P1 — SJT scoring uses expert key
**Setup:** SJT item with `scoringKey: {"0": 4, "1": 3, "2": 2, "3": 1 }`  
**Steps:**
1. Participant selects option 0 (best response)

**Expected:** Score = 4 stored in `sjt_responses.score`

---

### QA-READY-003 · P1 — Missing source scores handled gracefully
**Setup:** Readiness assessment where participant has no 360 assessment (feedbackScore undefined)  
**Steps:**
1. Compute readiness

**Expected:** `feedbackScore` defaults to 50 (mid-range) or 0, composite still calculated. No 500 error. Response indicates which components were unavailable.

---

### QA-READY-004 · P2 — Succession dashboard shows correct groupings
**Setup:** 5 participants with various readiness ratings and grid positions  
**Steps:**
1. GET `/api/v1/analytics/succession`

**Expected:**
- Candidates are partitioned by readiness rating
- 9-box `gridPerformance` and `gridPotential` are populated
- Correct count per rating category

---

### QA-READY-005 · P2 — Role profile competency matching
**Setup:** Role profile requires `Strategic Thinking` at level 3 (Proficient), participant rated at level 2  
**Expected:**
- Competency score reflects the gap (level 2 of required 3)
- Not 0 — partial credit for getting closer

---

## 9. Report Generation

### QA-RPT-001 · P1 — Report job queued and status transitions
**Steps:**
1. POST `/api/v1/reports/generate` with valid `{ assessmentId, participantId, reportType, language }`
2. Immediately GET `/api/v1/reports/<id>` — check status

**Expected:**
- Step 1 → HTTP 201 or 202, `{ data: { id, status: "pending" } }`
- Step 2 → status = `pending` or `processing` (not `ready` yet — async)
- After BullMQ processes the job: status becomes `ready`

---

### QA-RPT-002 · P1 — PDF file is created on disk (local dev)
**Setup:** Wait for report status = `ready`  
**Steps:**
1. Check `api/reports/` directory for the PDF file

**Expected:**
- File exists: `api/reports/<report_id>.pdf`
- File size > 0 bytes
- File is valid PDF (open it — not corrupted)

---

### QA-RPT-003 · P1 — Download endpoint returns file or redirect
**Steps:**
1. GET `/api/v1/reports/<id>/download`

**Expected:**
- Status `ready` → file served (Content-Type: application/pdf) or redirect to signed URL
- Status `pending`/`processing` → HTTP 400 or 409

---

### QA-RPT-004 · P1 — Org A cannot download Org B's report
**Steps:**
1. Login as Org A admin
2. GET `/api/v1/reports/<org_b_report_id>/download`

**Expected:** HTTP 404

---

### QA-RPT-005 · P2 — 360 report only generated when anonymity threshold met
**Setup:** 360 assessment with insufficient rater responses  
**Steps:**
1. POST `/api/v1/reports/generate` with `reportType: "individual_360"`

**Expected:** Job fails with a meaningful error message stored in `reports.status = "failed"`, or HTTP 400 at the request level

---

### QA-RPT-006 · P2 — All 4 report types generate without server error
**Setup:** Complete data for each UC  
**Steps:**
1. Generate report type `individual_360`
2. Generate report type `competency`
3. Generate report type `personality`
4. Generate report type `readiness`

**Expected:** All 4 → status eventually `ready`, valid PDF files

---

### QA-RPT-007 · P3 — Organisation branding applied to report
**Setup:** Org with custom `primaryColour: "#E53E3E"` and `brandingName: "Acme HR Consulting"`  
**Steps:**
1. Generate any report type
2. Open the PDF

**Expected:**
- Cover page shows "Acme HR Consulting" as Assessment Partner
- Charts/accents use red (`#E53E3E`) colour

---

## 10. Analytics & Dashboard

### QA-ANA-001 · P1 — Dashboard metrics are tenant-scoped
**Setup:** Org A has 3 active assessments, Org B has 7  
**Steps:**
1. Login as Org A, GET `/api/v1/analytics/dashboard`

**Expected:** `activeAssessments: 3` (not 10)

---

### QA-ANA-002 · P2 — Competency heatmap shows org-wide averages
**Setup:** 5 participants have completed competency assessments  
**Steps:**
1. GET `/api/v1/analytics/heatmap?assessmentId=<id>`

**Expected:**
- One entry per competency
- `averageScore` is the mean across all 5 participants
- Verify manually: (sum of all ratings) / count = returned average

---

### QA-ANA-003 · P3 — Empty org returns zero metrics (not a 500)
**Setup:** Newly registered org with no assessments  
**Steps:**
1. GET `/api/v1/analytics/dashboard`

**Expected:** HTTP 200, all numeric metrics = 0, `recentAssessments: []`

---

## 11. Input Validation & Error Responses

### QA-VAL-001 · P1 — All required fields validated
**Test each endpoint by omitting required fields:**
- POST `/auth/register` without `email`
- POST `/assessments` without `assessmentType`
- POST `/organisations/me/departments` without `name`

**Expected:** HTTP 400, `{ error: { code: "VALIDATION_ERROR", fields: { <fieldName>: ["..."] } } }`

---

### QA-VAL-002 · P1 — SQL injection via request body
**Steps:**
1. POST `/auth/login` with `email: "'; DROP TABLE users; --"`
2. POST `/assessments` with `title: "<script>alert('xss')</script>"`

**Expected:**
- HTTP 400 (email validation) or 401 (wrong password) — NOT a 500 with DB error
- Title stored as literal string, not executed
- No DB tables dropped (verify users table still exists)

---

### QA-VAL-003 · P2 — Excessively long strings are rejected
**Steps:**
1. POST `/auth/register` with `orgName` of 10,000 characters

**Expected:** HTTP 400, `VALIDATION_ERROR`, `fields.orgName`

---

### QA-VAL-004 · P2 — Unknown fields are stripped (whitelist validation)
**Steps:**
1. POST `/auth/login` with extra field `{ email, password, isAdmin: true }`
2. Verify `isAdmin` does not affect behaviour

**Expected:** Request succeeds normally, extra field ignored (NestJS `whitelist: true` in ValidationPipe)

---

### QA-VAL-005 · P2 — UUID parameters validated
**Steps:**
1. GET `/api/v1/assessments/not-a-uuid`
2. GET `/api/v1/rater/not-a-uuid`

**Expected:** HTTP 400 or 404 — not a 500 database error

---

### QA-VAL-006 · P3 — Consistent error response envelope
**Verify every error response has this exact shape:**
```json
{
  "error": {
    "code": "<ErrorCode enum value>",
    "message": "<human readable>",
    "fields": { "<field>": ["<message>"] }
  },
  "meta": {
    "timestamp": "<ISO 8601>",
    "path": "<request path>"
  }
}
```
**Test across:** 400, 401, 403, 404, 409

---

## 12. Rate Limiting

### QA-RATE-001 · P2 — Login rate limit (10 req/min)
**Steps:**
1. Send 11 POST `/api/v1/auth/login` requests within 60 seconds from the same IP

**Expected:** 11th request → HTTP 429

---

### QA-RATE-002 · P2 — Registration rate limit (5 req/min)
**Steps:**
1. Send 6 POST `/api/v1/auth/register` requests within 60 seconds

**Expected:** 6th request → HTTP 429

---

### QA-RATE-003 · P3 — General rate limit (100 req/min per user)
**Steps:**
1. Authenticated user sends 101 requests within 60 seconds

**Expected:** 101st request → HTTP 429

---

## 13. Frontend — Critical User Journeys

### QA-FE-001 · P1 — Registration → dashboard flow (web)
**Steps:**
1. Open `http://localhost:3000/register`
2. Fill all fields, submit
3. Verify redirect to `/dashboard`
4. Verify user name appears in sidebar
5. Verify org name and plan shown in sidebar

**Expected:** All as described, no console errors

---

### QA-FE-002 · P1 — Unauthenticated redirect to login
**Steps:**
1. Clear all cookies
2. Navigate to `http://localhost:3000/dashboard`

**Expected:** Immediate redirect to `/login?from=/dashboard`

---

### QA-FE-003 · P1 — Assessment wizard completes end-to-end
**Steps:**
1. Navigate to `/assessments/new`
2. Select `360° Feedback`
3. Enter title and dates, click Continue
4. Select 2+ competencies, click Continue
5. Select 1+ participants, click Continue
6. Review screen — click "Launch Assessment"

**Expected:**
- Redirected to `/assessments/<new_id>`
- Assessment status badge shows "active"

---

### QA-FE-004 · P1 — Rater interface works without login (mobile)
**Setup:** Valid rater token URL  
**Steps (on Chrome mobile emulation at 375px):**
1. Open `/rater/<token>` — verify landing screen, no sidebar, no header
2. Click "Begin Feedback"
3. Rate all behaviours on first cluster (verify large touch targets)
4. Click "Save & Continue"
5. Complete all clusters, overall rating, submit

**Expected:**
- Never shows login page
- Touch targets ≥ 44px height
- Thank-you screen shown after submit
- No JS errors in console

---

### QA-FE-005 · P1 — Participant takes personality assessment with auto-save
**Steps:**
1. Navigate to `/my-assessments/<id>/take` (personality assessment)
2. Answer questions 1–5
3. Close the browser tab
4. Reopen and navigate back to the take page

**Expected:** Questions 1–5 already answered (progress saved via auto-save on each response)

---

### QA-FE-006 · P2 — Assessment wizard prevents proceeding with no type selected
**Steps:**
1. Navigate to `/assessments/new`
2. Without selecting a type, click "Continue"

**Expected:** Continue button is disabled (verify it cannot be clicked)

---

### QA-FE-007 · P2 — Report center polls for processing status
**Steps:**
1. Generate a report, immediately check the reports page
2. Observe the status badge update automatically

**Expected:** Status updates from `pending` → `processing` → `ready` without page refresh (SWR `refreshInterval: 5000`)

---

### QA-FE-008 · P2 — Succession 9-box grid renders correctly
**Setup:** Candidates in all 9 grid positions (high/medium/low × high/medium/low)  
**Steps:**
1. Navigate to `/succession`

**Expected:**
- 9-box grid rendered correctly
- Each cell contains candidate names/initials
- Top-right cells (high/high) are green
- Bottom-left cells (low/low) are red
- Talent pool table shows all candidates

---

### QA-FE-009 · P3 — Settings: org branding update
**Steps:**
1. Navigate to `/settings/organisation`
2. Change primary colour to `#FF5733`
3. Click "Save Changes"
4. Reload page

**Expected:** Colour persists after reload; success indicator shown

---

### QA-FE-010 · P3 — Sidebar navigation shows correct items per role
**Verify navigation items by role:**

| Item | org_admin | hr_manager | participant | manager |
|------|-----------|------------|-------------|---------|
| Assessments | ✓ | ✓ | ✗ | ✗ |
| My Assessments | ✗ | ✗ | ✓ | ✓ |
| Reports | ✓ | ✓ | ✗ | ✗ |
| Succession | ✓ | ✓ | ✗ | ✗ |
| Settings | ✓ | ✗ | ✗ | ✗ |

---

## 14. Security

### QA-SEC-001 · P1 — Refresh token is HttpOnly (XSS cannot steal it)
**Steps:**
1. Login successfully
2. Open browser DevTools → Application → Cookies
3. Check `refresh_token` cookie attributes

**Expected:**
- `HttpOnly: true`
- `SameSite: Strict` (production) / `Lax` (development)
- `Secure: true` (production only)
- Cookie is NOT accessible via `document.cookie` in console

---

### QA-SEC-002 · P1 — Access token is NOT stored in localStorage or sessionStorage
**Steps:**
1. Login
2. Open DevTools → Application → Local Storage and Session Storage

**Expected:** `refresh_token` not present. `access_token` not present. Token lives in memory only (Zustand store).

---

### QA-SEC-003 · P1 — CORS blocks requests from unknown origins
**Steps:**
1. From a different origin (e.g. `http://malicious.test:8080`), attempt a cross-origin request to the API

**Expected:** CORS preflight fails; request blocked. Only `http://localhost:3000` (or configured `WEB_URL`) is allowed.

---

### QA-SEC-004 · P2 — Password hashing — bcrypt not plain text
**Steps:**
1. Register a user
2. Query `SELECT password_hash FROM users WHERE email = 'test@test.com'`

**Expected:**
- Value starts with `$2b$` (bcrypt)
- Value is NOT the plaintext password
- Value is different even for the same password (salted)

---

### QA-SEC-005 · P2 — JWT secret cannot be brute-forced via algorithm confusion
**Steps:**
1. Create a JWT with `algorithm: "none"` and no signature
2. Send it in Authorization header

**Expected:** HTTP 401 (algorithm `none` rejected)

---

### QA-SEC-006 · P2 — Sensitive data excluded from user list responses
**Steps:**
1. GET `/api/v1/organisations/me/users`

**Expected:**
- `passwordHash` is NOT in any user object
- `refreshTokenHash` is NOT in any user object
- Only whitelisted fields returned

---

### QA-SEC-007 · P3 — PDF download URL expires
**Setup:** Report with status `ready` (local dev: local file path)  
**Steps:** _(For prod Blob Storage — skip in local dev)_
1. Get download URL
2. Wait for signed URL expiry (1 hour)
3. Try to access the URL again

**Expected:** URL returns 403 or 404 after expiry

---

## 15. Background Jobs (BullMQ)

### QA-BQ-001 · P1 — Redis is required — API fails gracefully without it
**Steps:**
1. Stop Redis (`docker compose stop redis`)
2. Attempt to generate a report

**Expected:** HTTP 503 or 500 with a meaningful error (not an unhandled crash)

---

### QA-BQ-002 · P2 — Report job survives API restart
**Steps:**
1. Trigger report generation (status = processing)
2. Immediately restart the API process
3. Wait for the job to complete

**Expected:** Report completes and status becomes `ready` (job re-queued from Redis on startup)

---

### QA-BQ-003 · P2 — Failed report job updates status to "failed"
**Setup:** Manually break the PDF template (e.g. corrupt the .hbs file)  
**Steps:**
1. Generate a report

**Expected:**
- Job fails in BullMQ
- `reports.status` = `"failed"` in DB
- GET report endpoint returns `status: "failed"`, not `pending` indefinitely

---

## 16. Email Notifications (Local Dev — Log Verification)

### QA-EMAIL-001 · P2 — Invitation emails are logged on 360 nomination approval
**Steps:**
1. Approve nominations
2. Check API logs

**Expected:** Logger output contains email details: `to`, `subject`, `raterUrl` for each approved rater

---

### QA-EMAIL-002 · P2 — Reminder emails are logged for pending raters only
**Steps:**
1. POST reminders endpoint
2. Check logs

**Expected:** One log entry per pending/incomplete rater; completed raters NOT included

---

### QA-EMAIL-003 · P3 — Report ready notification is logged
**Steps:**
1. Report reaches `ready` status

**Expected:** Log entry for participant email containing download URL

---

## 17. Database & Migrations

### QA-DB-001 · P1 — All migrations run in order without errors
**Steps:**
```bash
npm run db:migrate
```

**Expected:** All 8 migrations apply cleanly, `migrations` table shows all as executed, no errors

---

### QA-DB-002 · P1 — Seed data loads correctly
**Steps:**
```bash
npm run db:seed
```

**Expected:**
- 8 competency domains and their competencies in DB
- 60 personality items (12 per factor)
- 5 normative data rows
- No duplicate insert errors on re-run (seeds should be idempotent)

---

### QA-DB-003 · P2 — Foreign key cascade works on org deletion
**Steps:**
1. Create an org, user, and assessment
2. DELETE the org (direct SQL: `DELETE FROM organisations WHERE id = '<id>'`)
3. Verify users and assessments for that org are also deleted (CASCADE)

**Expected:** Cascade DELETE removes all tenant data

---

### QA-DB-004 · P2 — Organisation_id index present on all major tables
**Steps:**
```sql
SELECT tablename, indexname FROM pg_indexes 
WHERE indexname LIKE 'idx_%_org%' OR indexname LIKE '%organisation%';
```

**Expected:** Index exists on at minimum: users, assessments, assessment_participants, rater_nominations, competency_assessments, personality_responses, reports, notifications

---

## 18. Performance Smoke Tests

### QA-PERF-001 · P3 — 360 assessment with 50 concurrent raters
**Tool:** `k6` or similar  
**Setup:** 50 rater nominations approved  
**Script:** 50 virtual users, each submits all competency scores simultaneously  
**Expected:**
- All 50 submissions complete within 30 seconds
- No 500 errors
- All nomination statuses = completed in DB

---

### QA-PERF-002 · P3 — Analytics dashboard response time
**Setup:** Org with 200 participants, 10 closed assessments  
**Steps:**
1. GET `/api/v1/analytics/dashboard` and measure response time

**Expected:** Response within 2 seconds

---

### QA-PERF-003 · P3 — Report generation time (PDF)
**Setup:** 360 assessment with all data present  
**Steps:**
1. Trigger report and poll for completion

**Expected:** Report ready within 60 seconds

---

## Appendix A — Known Limitations (Test as Non-Blocking)

| Item | Current Status | When to Fix |
|------|---------------|-------------|
| Email sending | Console.log only in dev; no actual email | Phase 3+ with Azure Communication Services |
| PDF storage | Local disk only; no Azure Blob | Before production deployment |
| Sinhala/Tamil translations | Scaffold only; `si.json` and `ta.json` incomplete | Phase 4 |
| RLS in PostgreSQL | App-level scoping only; no DB-level RLS yet | Phase 5 hardening |
| Stripe billing | Plan managed manually via DB | Phase 3+ |
| Token blacklist on logout | Session deleted from DB; no Redis blacklist | Nice-to-have for distributed deployments |

---

## Appendix B — Test Environment Setup

```bash
# Start local infrastructure
npm run db:up

# Apply all migrations
npm run db:migrate

# Seed default content
npm run db:seed

# Start API and Web
npm run dev

# Run unit tests
npm run test -w api -- --testPathPattern=unit

# Run E2E tests (requires both servers running)
npm run test:e2e -w web
```

**Local URLs:**
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/api/docs`
- Web: `http://localhost:3000`
- Database: `localhost:5432` (user: leaderprism, pass: leaderprism_dev)
- Redis: `localhost:6379`

---

*Document prepared for LeaderPrism MVP — TechNeura Consulting (Pvt) Ltd*
