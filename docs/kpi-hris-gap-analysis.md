# KPI Management — Gap Analysis vs LeaderPrism

**Date:** 2026-11-10
**Purpose:** Compare the KPI Management feature list (sections 1–16) with what LeaderPrism does today, so the gaps can be built in the HRIS and the two systems connected.

---

## 1. Summary

LeaderPrism is a **leadership assessment** platform: it measures *how* people lead (competencies, 360 feedback, personality, readiness). It is **not** a performance or KPI system: it has no idea of KPIs, targets, actual values, goals, weightages, or evaluation cycles.

So almost all of the KPI list is a gap, and the HRIS must build it. LeaderPrism does already cover the **behavioural / leadership side** of a performance review, and the HRIS can use it instead of rebuilding it:

| LeaderPrism already has | Useful for KPI sections |
|---|---|
| Competency framework (domains → competencies → 4 levels → behaviours), org-specific competencies | §8 "assess behavioural competencies", §3 Leadership category |
| Self vs manager competency ratings with gap analysis (UC2) | §7 self vs manager distinction, §8, §15 "self vs manager evaluation" |
| 360° feedback with anonymity threshold, rater nomination + approval (UC1) | §10 "optional 180/360, anonymous feedback" |
| Big Five personality profiling (UC3) | §13 development input |
| Leadership readiness, role profiles, 9-box, succession key roles & bench (UC4) | §13 "promotion readiness", "succession planning" |
| PDF reports (360, competency, personality, readiness, org summary) | §15 individual leadership reports |
| Departments (hierarchical), manager → direct report links, roles | Org structure; the HRIS should own this |

**Biggest integration point:** the 9-box **performance axis** is currently derived from the 360 feedback score ([readiness-scoring.service.ts:101](../api/src/assessment/uc4-readiness/readiness-scoring.service.ts#L101)), with a manual High/Medium/Low override by HR. Once the HRIS has KPI final scores, they should **feed the 9-box performance axis**. That is the standard model: performance from KPIs, potential from LeaderPrism.

---

## 2. Section-by-section gap table

Legend: ✅ exists · 🟡 partial / related concept · ❌ missing

### §1 KPI Management Dashboard — ❌ Missing
LeaderPrism's dashboard ([analytics.service.ts](../api/src/analytics/analytics.service.ts)) shows *assessment* metrics only: active assessments, participants, pending rater responses, reports generated, monthly activity, department participation, completion rate.

| Feature | Status | Note |
|---|---|---|
| Active KPIs, employees with KPIs, completed/ongoing/overdue/pending KPIs | ❌ | No KPI entity |
| Company / department performance score, top departments | ❌ | Only competency averages (heatmap, radar) |
| Current cycles & deadlines | 🟡 | Assessments have start/end dates, but they are not performance cycles |
| KPIs awaiting approval, employees not updating progress | ❌ | |
| Upcoming reviews, trends by month/quarter/year | 🟡 | 12-month assessment activity only |
| Quick actions | 🟡 | "New assessment" only |
| Charts: progress bars, scorecards, dept comparison, distribution, rankings | ❌ | Has heatmap, radar, 9-box: leadership charts, not KPI charts |

### §2 KPI Configuration & Master — ❌ Missing
There is no KPI master. The closest concept is the **competency library** ([competency.entity.ts](../api/src/assessment/items/entities/competency.entity.ts)): create/edit/deactivate, org-specific, but no target, unit, baseline, weightage, frequency, data source, or versioning.

All form fields (KPI name, measurement type, target, baseline, weightage, dates, frequency, owner, evaluator, data source, approval flag), Excel import/export, templates, and version history are **missing**.

### §3 KPI Categories & Templates — ❌ Missing
- Categories: LeaderPrism has 4 competency domains (People, Conceptual, Behavioural, Technical). This covers only the "Leadership", "Communication & teamwork", and "Technical competency" categories, and only as competencies, not KPIs.
- 🟡 **Role profiles** (UC4) map a job title to required competencies + weights + minimum levels. This is the nearest equivalent of "templates by job title", but it is used for readiness scoring, not KPI assignment.
- Department templates, auto-assign by designation, probation vs permanent templates: ❌. The user record has only a free-text `jobTitle`. There is no designation master and no employment type / probation status.

### §4 KPI Assignment & Goal Setting — ❌ Missing
No goals, targets, milestones, cascading/alignment, transfers, or acknowledgment.
🟡 The only "assignment" is adding participants to an assessment.

### §5 Evaluation Cycle Management — 🟡 Partial (concept only)
An **Assessment** has a lifecycle DRAFT → ACTIVE → CLOSED → ARCHIVED, with start/end dates, participants, completion tracking, and manual reminders ([engine.controller.ts](../api/src/assessment/engine/engine.controller.ts)).

| Feature | Status |
|---|---|
| Monthly / quarterly / half-yearly / annual / probation / project cycles | ❌ No cycle type or recurrence |
| Separate self-evaluation and manager deadlines | ❌ Single end date |
| Open / close | ✅ (launch, close, archive) |
| Extend / cancel / reopen with permission | ❌ Only DRAFT can be edited; no reopen |
| Different cycles per department | ❌ |
| Auto-generate recurring cycles | ❌ No scheduler. `reminderDays` exists in config but nothing runs it; reminders are sent manually |
| Track completion rate | ✅ |
| Lock completed evaluations | 🟡 Closed assessments reject responses |
| Prorated evaluations | ❌ |

### §6 KPI Progress Tracking — ❌ Missing
No actual values, progress %, milestones, notes, evidence attachments, statuses, delay reasons, manager verification, or system integrations. The suggested statuses (Not Started → Cancelled) do not exist. Participant status is only `invited | in_progress | completed | withdrawn`.

### §7 Employee Self-Evaluation — 🟡 Partial (competencies only)
✅ Employees can self-rate **competencies** (UC2) with evidence text and development comments, save, then submit. Self and manager ratings are stored separately (`assessorType: 'self' | 'manager'`).
✅ "My assessments" page lists past assessments and results.
❌ KPI self-scoring, unmet-target explanations, file uploads, achievements/challenges sections, next-period development goals, request feedback, acknowledgment of final review.

### §8 Manager Performance Evaluation — 🟡 Partial (competencies only)
✅ Managers rate the competencies of their reports, with a gap analysis between self and manager ratings ([uc2-competency.controller.ts](../api/src/assessment/uc2-competency/uc2-competency.controller.ts)).
✅ Manager → direct-report hierarchy exists (`users.manager_id`).
❌ KPI scoring, approve/reject progress, strengths/improvement areas as structured fields, submit to HR, request revision, 1:1 meetings, performance history view.

### §9 KPI Scoring & Rating Engine — ❌ Missing (pattern exists)
LeaderPrism has scoring engines for **assessments**: 360 averages, competency levels (1–4), Big Five T-scores/percentiles, and readiness composite with weights. It also has one example of **calculated vs manually overridden score kept separately**: the 9-box performance override, which stores the user, note, and timestamp. This is a good pattern to copy for §9 "calibrated vs calculated".
Missing: weighted KPI scoring, higher/lower-is-better, pass/fail, thresholds, caps, a 100% weightage validation, department/team scores, and rating bands.

### §10 Feedback & Continuous Monitoring — 🟡 Partial
✅ **360° feedback** with anonymous token links, an anonymity threshold, relationship types (self, supervisor, peer, direct report, stakeholder), and nomination approval. This directly satisfies "optional 180/360" and "anonymous feedback with privacy controls".
❌ Continuous feedback, check-ins, 1:1 notes, recognition, follow-up actions, coaching tracking.

### §11 Approval & Review Workflow — ❌ Missing
The only approval flow is **360 rater nomination approval**. There is no generic multi-level workflow engine, escalation, calibration, dispute/appeal, or approval history. There is also **no audit log** in the system.

### §12 Performance Improvement Plans — ❌ Missing
Nothing exists. The PDF reports do generate rule-based "development actions" text, but these are not trackable plans.

### §13 Development & Career Growth — 🟡 Partial (strongest overlap)
| Feature | Status |
|---|---|
| Identify skill gaps | ✅ Competency gap (self vs manager vs required level in role profile) |
| Promotion readiness | ✅ UC4 readiness rating (Ready now / 1–2 yrs / Developing / Not yet) |
| Succession planning | ✅ Key roles, successors, bench, org chart, 9-box |
| Leadership development tracking | 🟡 Repeat assessments show change, but there is no IDP entity |
| Individual development plans, training recommendations, certifications, training completion, L&D link | ❌ |

### §14 — *Not in the list you sent (numbering jumps 13 → 15).* Please check whether a section is missing.

### §15 KPI Reports & Analytics — 🟡 Partial (leadership reports only)
✅ PDF reports via a background queue: individual 360, competency, personality, readiness, org summary. Downloads are role-restricted, and employees see only their own reports.
✅ Competency heatmap per assessment, org and user radar charts.
❌ All KPI reports, period comparison, custom report builder, **Excel export** (no Excel library in the codebase), scheduled reports, saved report configurations.

### §16 AI KPI Assistant — ❌ Missing
LeaderPrism has **no AI/LLM integration**. Report narratives are rule-based templates ([reporting.service.ts](../api/src/reporting/reporting.service.ts)). Your HRIS AI agent could use LeaderPrism data (competency gaps, 360 themes, readiness) as context for "AI Skill Gap Analysis" and "AI Development Plan".

---

## 3. Integration gaps: what LeaderPrism lacks for connecting to an HRIS

These are gaps on the **LeaderPrism side**. They must be closed whatever the HRIS builds.

| # | Gap | Today | Needed |
|---|---|---|---|
| I-1 | **Service-to-service auth** | Only user JWT login | API keys or OAuth2 client credentials per org, so the HRIS can call LeaderPrism |
| I-2 | **Employee identity mapping** | Users are matched by email within an org. No `employeeId` / external ID | `externalId` (HRIS employee number) on users, departments, and possibly the org |
| I-3 | **User & org sync** | Users and departments are created manually in LeaderPrism | Sync/upsert endpoint or SCIM-style provisioning from the HRIS (department, manager, job title, active status, joiners/leavers) |
| I-4 | **SSO** | Separate password login | SSO (OIDC/SAML) or a token hand-off, so employees don't need a second login |
| I-5 | **Designation / job master** | Free-text `jobTitle` | Link to HRIS designation ID. Needed for role profiles and templates |
| I-6 | **Inbound performance score** | 9-box performance = 360 score or manual H/M/L | Endpoint to receive the KPI final score per employee per cycle, used as the performance axis |
| I-7 | **Outbound results API** | Score endpoints exist, but they are per assessment and per participant and need a user JWT | Bulk "results by employee" export: competency levels, gaps, 360 scores, readiness, 9-box placement |
| I-8 | **Webhooks / events** | None | Events such as `assessment.completed`, `readiness.computed`, `report.ready`, so the HRIS can react |
| I-9 | **Audit log** | None | Needed if results are used in employment decisions |
| I-10 | **Scheduler** | Only the report queue runs; reminders are manual | Needed for auto reminders, and for syncs if pull-based |

---

## 4. Recommended split

**Build in the HRIS (the true gaps):**
§1 KPI dashboard · §2 KPI master · §3 KPI categories & templates · §4 assignment & goals · §5 performance cycles · §6 progress tracking · §7/§8 KPI self & manager evaluation · §9 scoring engine · §10 check-ins, 1:1s, recognition · §11 approval workflow · §12 PIP · §13 IDP & training · §15 KPI reports + Excel · §16 AI assistant.

**Reuse from LeaderPrism (don't rebuild):**
- Behavioural/leadership competency rating inside the manager evaluation (§8) → embed or link the UC2 assessment.
- 180/360 anonymous feedback (§10) → UC1.
- Skill gaps, promotion readiness, succession (§13) → UC2 gap + UC4 + succession module.
- Leadership PDF reports (§15) → existing reports, linked from the HRIS employee profile.

**Data flow once connected:**

```
HRIS ──(employees, departments, managers, designations)──▶ LeaderPrism   [I-2, I-3, I-5]
HRIS ──(KPI final score per cycle)───────────────────────▶ LeaderPrism   [I-6] → 9-box performance axis
LeaderPrism ──(competency gaps, 360, readiness, 9-box)───▶ HRIS          [I-7, I-8] → evaluation, IDP, PIP, AI
```

---

## 5. Open questions

1. **Section 14** is missing from the feature list. What should it contain?
2. **Source of truth for org structure:** I assume the HRIS. If so, LeaderPrism's user/department screens should become read-only for HRIS-linked orgs.
3. **Overall rating:** should the final review rating combine KPI score + competency score (e.g. 70/30)? If yes, the HRIS scoring engine (§9) needs the LeaderPrism competency score as an input.
4. **Tenancy:** does one HRIS instance map to one LeaderPrism organisation, or does one HRIS serve many client companies (multi-org)?
