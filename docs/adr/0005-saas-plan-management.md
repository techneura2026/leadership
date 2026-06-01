# ADR-0005: SaaS Plan Management

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** TechNeura Engineering

---

## Context

LeaderPrism is a SaaS product. Organisations pay for access, and different tiers have different feature limits. We need a plan enforcement mechanism that does not block the MVP but is designed to accommodate billing from day one.

---

## Decision

### Plan Tiers

| Plan | Target | Limits |
|------|--------|--------|
| `trial` | New sign-ups | 30 days, 5 participants max, 1 active assessment |
| `starter` | Small consultancies | 25 participants, 5 active assessments, UC1+UC2 only |
| `professional` | Mid-size consultancies | 100 participants, unlimited assessments, all 4 UCs |
| `enterprise` | Large orgs | Unlimited, white-label, SSO, custom frameworks |

### Implementation

**Phase 0 (MVP):** Plan stored as a string column on `organisations`. Enforcement via a `PlanGuard` NestJS guard that reads `req.user.orgId`, loads the org's plan, and compares against a static `PLAN_LIMITS` config object.

```typescript
// api/src/core/billing/plan-limits.config.ts
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: { maxParticipants: 5, maxActiveAssessments: 1, allowedUcs: ['uc1', 'uc2'] },
  starter: { maxParticipants: 25, maxActiveAssessments: 5, allowedUcs: ['uc1', 'uc2'] },
  professional: { maxParticipants: 100, maxActiveAssessments: -1, allowedUcs: ['uc1','uc2','uc3','uc4'] },
  enterprise: { maxParticipants: -1, maxActiveAssessments: -1, allowedUcs: ['uc1','uc2','uc3','uc4'] },
};
```

**Phase 3+ (Billing integration):** Add Stripe as a payment processor. When a subscription event webhook arrives, update `organisations.plan` and `organisations.planExpiresAt`. The guard logic does not change — only the data it reads changes.

### Organisation Lifecycle

```
sign-up → trial (30 days) → upgrade prompt → starter/professional/enterprise
                                           ↘ churned (isActive = false)
```

The `organisations` table tracks:
- `plan` — current plan slug
- `trialEndsAt` — null for paid plans
- `planExpiresAt` — null for active subscriptions, set when payment fails
- `isActive` — soft-disable an org without deleting data

### Plan Guard Usage

```typescript
@Post()
@UseGuards(JwtAuthGuard, PlanGuard)
@PlanLimit({ feature: 'assessments', count: 1 })
createAssessment(@Body() dto: CreateAssessmentDto) { ... }
```

---

## Consequences

**Positive:**
- No dependency on Stripe in Phase 0 — unblock development
- Static config is easy to change — no DB migration needed to adjust limits
- `PlanGuard` is composable and reusable across any endpoint
- Billing integration in Phase 3 only changes the data layer, not the enforcement logic

**Negative:**
- Plan limits are not real-time if multiple processes run (acceptable: single App Service instance for MVP)
- Manual plan upgrades by admin in Phase 0 (acceptable: small number of initial clients)

---

## Alternatives Considered

**Feature flags service (LaunchDarkly, etc.):** Rejected for Phase 0. Overkill and adds an external dependency. Revisit if the plan matrix becomes complex.

**Per-feature entitlement table in DB:** Rejected for Phase 0. A static config object is sufficient and faster to iterate on than schema migrations.
