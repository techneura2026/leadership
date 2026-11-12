# LeaderPrism HRIS Integration API

This guide is for developers connecting an HRIS to LeaderPrism. It covers authentication, every
endpoint, webhooks and single sign-on. The design is described in
[LeaderPrism-HRIS-KPI-Integration-Spec.pdf](../LeaderPrism-HRIS-KPI-Integration-Spec.pdf).

All endpoints live under `{API}/api/v1/integrations/hris/`. Responses use the usual LeaderPrism
envelope: `{ "data": …, "meta": { "timestamp": … } }`. Errors have this shape:

```json
{ "error": { "code": "UNKNOWN_EMPLOYEES", "message": "…", "details": { "employeeRefs": ["E-9"] } }, "meta": { … } }
```

Live, browsable schemas are in Swagger at `{API}/api/docs`, under the tag **HRIS Integration**.

---

## 1. Authentication

An organisation admin creates an API key in **Settings → Integrations**. The full key is shown
**once**, for example `lpk_Ab3dE6gH_…`. Send it on every call:

```
X-Api-Key: lpk_Ab3dE6gH_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys belong to one organisation, so every call only reads or writes that organisation's data.
User JWTs are not accepted on these routes. A revoked key, or a key for a deactivated or
expired-trial organisation, gets `401`. A missing scope gets `403 INSUFFICIENT_SCOPE`.

| Scope | Allows |
|---|---|
| `employees:write` | `PUT departments`, `PUT employees` |
| `assessments:write` | `POST assessment-requests` |
| `results:read` | `GET results`, `GET framework`, `GET ping` |
| `reports:read` | `POST reports` |
| `sso:issue` | `POST sso-tickets` |
| `scores:write` | Phase 2: final performance scores |
| `talent:read` | Phase 2: readiness, 9-box and succession |
| `personality:read` | Phase 3: personality profile (development use only) |

Connection test: `GET /integrations/hris/ping` returns `{ "orgId": "…" }`.

---

## 2. Syncing org structure

The HRIS is the source of truth. Synced records are marked **Managed by HRIS** in LeaderPrism;
their HRIS-owned fields cannot be edited in the app (`409 HRIS_MANAGED_FIELD`).

### `PUT /departments`

```json
{ "departments": [
  { "departmentRef": "D-ENG", "name": "Engineering" },
  { "departmentRef": "D-ENG-PLAT", "name": "Platform", "parentRef": "D-ENG", "isActive": true }
] }
```

- At most 1000 rows per call. Rows can appear in any order; parents are resolved after all rows are written.
- `parentRef: null` clears the parent. Leaving `parentRef` out keeps the current parent.

### `PUT /employees`

```json
{ "fullSync": false, "employees": [
  { "employeeRef": "E-100", "email": "kavinda@acme.lk", "firstName": "Kavinda", "lastName": "Silva",
    "departmentRef": "D-ENG", "managerRef": "E-001", "designationRef": "SE-2", "jobTitle": "Software Engineer",
    "employmentStatus": "active", "language": "en" }
] }
```

**Matching.** A row is matched by `employeeRef` first. If there is no match, it links to an
existing LeaderPrism user with the same email who has no `employeeRef` yet. Otherwise a new user
is created.

**Employment status.** `employmentStatus` is `active`, `probation` or `left`. A `left` employee is
deactivated and signed out. Organisation admins are never deactivated by a sync; the row gets the
warning `protected_role_not_deactivated` instead.

**Roles.** You may send `role` (`participant`, `manager` or `hr_manager`). Without it, new users
are `participant`, and anyone with direct reports becomes `manager`. Roles are never demoted
automatically, and an org admin's role is never changed.

**Full sync.** `fullSync: true` deactivates every HRIS-managed user who is missing from the
payload. Only use it when the payload holds **all** employees, which limits it to 1000 or fewer.

**Signing in.** New users get no usable password. They sign in through SSO (section 6), or can
choose a password later with "forgot password".

### Row results (both sync calls)

The call returns HTTP 200 even when some rows fail:

```json
{ "results": [
  { "ref": "E-100", "status": "created", "id": "…" },
  { "ref": "E-200", "status": "updated", "id": "…", "warnings": ["manager_not_found"] },
  { "ref": "E-500", "status": "error", "error": "email_conflict" }
] }
```

| `status` | Meaning |
|---|---|
| `created` / `updated` / `unchanged` | The row was applied |
| `error` | The row was skipped; see `error` |

| Code | Kind | Meaning |
|---|---|---|
| `email_conflict` | error | Another `employeeRef` already uses this email |
| `manager_cycle` | error | The row would create a management loop |
| `parent_cycle` | error | The row would create a department loop |
| `manager_not_found` | warning | The manager is not in LeaderPrism yet; send the row again later |
| `department_not_found` | warning | The department is not in LeaderPrism yet |
| `parent_not_found` | warning | The parent department is not in LeaderPrism yet |
| `deactivated_missing_from_full_sync` | warning | Deactivated because it was missing from a full sync |
| `protected_role_not_deactivated` | warning | An org admin was sent as `left` and was not deactivated |

---

## 3. Starting assessments for a review cycle — `POST /assessment-requests`

```json
{
  "cycleRef": "2027-H1",
  "title": "H1 2027 leadership review",
  "types": ["competency", "360_feedback"],
  "startDate": "2027-01-01", "endDate": "2027-06-30",
  "employeeRefs": ["E-100", "E-101"],
  "competencyIds": ["…"],
  "roleProfileId": "…",
  "includeSelfAssessment": true,
  "raters": { "E-100": [ { "email": "peer@acme.lk", "name": "Peer One", "relationship": "peer" } ] }
}
```

**What gets created.**
- `competency`: one assessment per cycle, holding every listed employee.
- `360_feedback`: one assessment **per employee**, because LeaderPrism allows one subject per 360.
- Everything is launched immediately.

**Repeating a request is safe.** Sending the same `cycleRef` and type again returns the same
assessments (`created: false`, HTTP 200). It only adds employees, and raters, that are not there
yet, so you can add late joiners this way.

**Errors.**
- An unknown or inactive employee gets `422 UNKNOWN_EMPLOYEES` with `details.employeeRefs`, and nothing is created.
- LeaderPrism Managers and HR Managers cannot give 360 feedback. Such raters get `422 RATERS_NOT_ALLOWED` with `details.emails`, and nothing is created.
- Plan limits apply and are returned as `403`.

**Response:**

```json
{ "assessments": [ { "assessmentId": "…", "type": "competency", "employeeRefs": ["E-100","E-101"], "created": true }, … ] }
```

---

## 4. Reading results

### `GET /results?cycleRef=2027-H1&employeeRef=E-100`

Returns one employee. Leave out `employeeRef` to get pages instead: add `&limit=50` (at most 100)
and `&cursor=<nextCursor>`. A page looks like `{ "data": [...], "nextCursor": "E-150" | null }`.

```json
{
  "employeeRef": "E-100", "cycleRef": "2027-H1", "status": "final",
  "assessmentIds": ["…", "…"],
  "competency": {
    "scaleMax": 4,
    "roleProfile": { "ref": "…", "title": "Engineering Manager" },
    "items": [ { "competencyRef": "…", "name": "Strategic Thinking", "domain": "Conceptual",
                 "selfLevel": 3, "managerLevel": 2, "requiredLevel": 3, "weightInRole": 0.15,
                 "gapSelfVsManager": -1, "gapVsRequired": -1,
                 "managerEvidence": "…", "developmentComment": "…" } ],
    "summary": { "managerAvgPct": 50.0, "achievementVsRequiredPct": 66.7 }
  },
  "feedback360": {
    "status": "ok", "scaleMax": 5, "minRaterThreshold": 3,
    "items": [ { "competencyId": "…", "othersMean": 3.6, "self": 4, "gapVsSelf": -0.4,
                 "byGroup": { "peer": { "mean": 3.7, "n": 4 } } } ],
    "overallOthersPct": 65.0
  },
  "reports": [ { "reportId": "…", "type": "competency", "url": "https://…", "expiresAt": "…" } ]
}
```

**Status.** `status` is `final` once every assessment the employee is in has closed.

**Competency block.** Levels run from 1 to 4, and only **submitted** ratings are included.
`achievementVsRequiredPct` is the weighted average of manager level ÷ required level. It is
**not capped**; apply your own cap.

**360 privacy.**
- `othersMean` never includes the self-rating.
- A rater group appears in `byGroup` only if it has at least `minRaterThreshold` raters.
- If fewer non-self raters than the threshold have responded, `feedback360` is
  `{ "status": "insufficient_raters", "minRaterThreshold": 3 }` with no numbers at all.
- Rater identities and individual answers are never exported.

**Mapping to a 0–100% KPI.** `overallOthersPct` is (mean − 1) ÷ (scaleMax − 1) × 100.

**Not found.** An unknown cycle, an employee who is not in the cycle, or another organisation's
cycle all give `404`.

### `GET /framework`

Returns the competencies (with their 4 level descriptions) and the role profiles. Use them to
create leadership KPIs in the HRIS, with `requiredLevel` as the KPI target.

### Reports — `POST /reports`

```json
{ "cycleRef": "2027-H1", "employeeRef": "E-100", "type": "competency" }
```

`type` is `competency` or `individual_360`. The report is queued. When it is ready, it appears in
`results.reports` with a **signed link valid for 15 minutes**. The link needs no API key, so you
can hand it to a browser. Fetch fresh results to get a fresh link. A tampered or expired link
gets `403`.

---

## 5. Webhooks

An admin adds endpoints in **Settings → Integrations → Webhooks**. The signing secret
(`whsec_…`) is shown once.

| Event | When | Body |
|---|---|---|
| `assessment.launched` | A cycle assessment starts | `{ event, orgRef, cycleRef, assessmentId, assessmentType, employeeRefs, occurredAt }` |
| `assessment.closed` | Closed by HR, or auto-closed when everyone finished | as above |
| `results.ready` | A manager submitted competency ratings for an employee | `{ event, orgRef, cycleRef, assessmentId, employeeRefs, occurredAt }` |
| `report.ready` | A PDF finished generating | `{ event, orgRef, reportId, assessmentId, reportType, employeeRef, occurredAt }` |
| `readiness.computed` | Phase 2 | as `results.ready` |
| `ping` | The **Send test** button | `{ event, orgRef, occurredAt }` |

`orgRef` is the organisation's HRIS reference if one is set, otherwise its LeaderPrism slug.

**Headers:** `X-LeaderPrism-Event`, `X-LeaderPrism-Delivery` (a unique ID, use it to de-duplicate),
`X-LeaderPrism-Timestamp` (Unix seconds) and `X-LeaderPrism-Signature: sha256=<hex>`.

**Verifying a delivery** (Node.js):

```js
const crypto = require('crypto');
function verify(rawBody, headers, secret) {
  const ts = headers['x-leaderprism-timestamp'];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;          // reject replays
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headers['x-leaderprism-signature'] ?? ''));
}
```

**Retries.** Reply with any 2xx within 10 seconds. Anything else is retried up to 6 attempts with
exponential back-off starting at 30 seconds. Every delivery is listed under **Recent deliveries**.

**URLs.** Production endpoint URLs must use https and must not point at private or loopback addresses.

**What to do on an event.** Webhooks only notify. Fetch the data with `GET /results` when
`results.ready` or `assessment.closed` arrives.

---

## 6. Single sign-on — `POST /sso-tickets`

```json
{ "employeeRef": "E-100", "redirectPath": "/my-assessments" }
```

The response is `{ "url": "https://app…/sso/hris?ticket=…", "expiresAt": "…" }`. Open the URL in
the employee's browser (a new tab is fine). The ticket is **single-use** and expires after
**60 seconds**, so create it at the moment the user clicks.

- `redirectPath` must be a same-site path (it starts with a single `/`) and defaults to `/my-assessments`.
- Useful targets: `/my-assessments`, and `/my-assessments/{assessmentId}` for one assessment.
- Employees who are unknown, inactive or `left` get `404`.

---

## 7. Talent data (Phase 2) and personality (Phase 3)

### `PUT /performance-scores` (scope `scores:write`)

```json
{ "cycleRef": "2027-H1",
  "scores": [ { "employeeRef": "E-100", "finalScore": 82.5, "ratingBand": "Exceeds", "finalisedAt": "2027-07-20T10:00:00Z" } ] }
```

Sends the final, calibrated performance score for each employee.

**How it affects the 9-box.** The latest score, by `finalisedAt`, sets the performance axis of
LeaderPrism's 9-box:
- `≥ 70` → high
- `≥ 40` → medium
- anything lower → low

A manual override by HR in LeaderPrism still wins.

**Resending.** Sending the same cycle again overwrites the stored score, for example after an appeal.

**Row results.** The response uses the same row results as the sync calls. Row errors are
`employee_not_found` and `invalid_score` (the score must be between 0 and 100).

### Readiness and 9-box in results (scope `talent:read`)

API keys with `talent:read` also get these fields on every result:

```json
"readiness": { "rating": "1_2_years", "compositeScore": 62,
               "components": { "competency": 70, "feedback": 55, "sjt": 60, "learningAgility": 65, "personalityFit": 50 },
               "roleProfile": { "ref": "…", "title": "Engineering Manager" } },
"nineBox":   { "performance": "high", "potential": "high", "performanceSource": "hris", "overrideNote": null }
```

- `performanceSource` says where the performance value came from: `manual` (HR override), `hris` (your score) or `feedback360` (LeaderPrism's 360 result).
- **Use these for development and succession only, never as performance scores.**
- Without the scope, these keys are absent.
- `GET /succession` (scope `talent:read`) lists key roles with their successors by `employeeRef`, and the number of successors who are ready now (`readyNowCount`).

### Role profiles linked to designations

A role profile can list `designationRefs`, for example `["SE-2"]`. When a cycle has no explicit
`roleProfileId`, each employee's `requiredLevel` comes from the profile linked to their synced
`designationRef`.

### Personality (scope `personality:read`)

A single-employee read (`employeeRef=…`) also returns the employee's latest Big Five profile:

```json
"personality": { "assessedAt": "…", "usage": "development_only",
                 "factors": [ { "factor": "openness", "tScore": 62, "percentile": 88 } ] }
```

> **Permitted use.** Personality data is for coaching and development conversations only. It must
> never be an input to performance scores, rankings, improvement-plan triggers, pay or other
> employment decisions. Make it visible only to the employee and HR. For this reason it is never
> included in bulk result pages.

### Audit and reminders

Every integration call that changes or reads data is recorded in LeaderPrism's audit log, under
Settings → Audit log. This covers syncs, deactivations, assessment requests, results reads,
report downloads and score pushes.

Assessments with `config.reminderDays` send automatic reminders at 08:00 (Asia/Colombo) on those
days before `endDate`.

## 8. Limits

| Item | Limit |
|---|---|
| Sync rows per call | 1000 |
| Results page size | 100 (default 50) |
| SSO ticket | 60 seconds, single use |
| Report link | 15 minutes |
| Webhook timeout | 10 seconds |
| Webhook attempts | 6 |
| General rate limit | 100 requests per minute per client IP |

## 9. Server configuration

| Variable | Purpose |
|---|---|
| `INTEGRATION_URL_SIGNING_SECRET` | Signs report links. Required for report links. Generate with `openssl rand -hex 32` |
| `INTEGRATION_ENCRYPTION_KEY` | 32 bytes (base64); encrypts webhook secrets at rest. Required for webhooks. Generate with `openssl rand -base64 32` |
| `APP_URL` | **The single setting for the public web address.** Base of every generated link (one-time sign-in, rater, reset-password, login) and the CORS origin. `WEB_URL` is read only as a fallback. Without either, non-production falls back to `http://localhost:3000`; in production the API refuses to start if neither is set or the value points at localhost. Trailing slashes are stripped. |
| `API_PUBLIC_URL` | Public base URL of the API. Used for report links and for the HRIS connection string shown once when an API key is created. Defaults to `http://localhost:3001` outside production; in production it is required and must not be localhost (startup fails otherwise). |

### API key permissions and the connection string

- `PATCH /api/v1/integrations/api-clients/:id` with `{ "scopes": [...] }` (organisation admin) replaces a key's scopes without changing its secret; it takes effect on the key's next request. A revoked key returns `409`; an unknown scope returns `400`. The change is audit-logged (`integration.api_client.scopes_updated`).
- Creating a key returns, once, a `connectionString` of the form `https://<api key>@<API host>[:port]` built from `API_PUBLIC_URL`. It contains the secret and is never returned by list or get.
- The "HRIS integration" preset is `employees:write`, `sso:issue`, `results:read`; `assessments:write`, `reports:read`, `scores:write` and `talent:read` are optional.
