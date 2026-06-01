# ADR-0003: Modular Monolith Over Microservices

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** TechNeura Engineering

---

## Context

The platform has clear domain boundaries: authentication, organisations, assessments (four types), reporting, and analytics. We must decide whether to implement these as separate deployable microservices or as modules within a single deployable application.

---

## Decision

**Modular monolith: all domains implemented as NestJS modules within a single deployable API process.**

The NestJS module system enforces clear boundaries — each module has its own controllers, services, entities, and DTOs. Modules can only communicate via exported services injected through the DI container. This gives the organisational benefits of microservices without the operational cost.

### Module Boundary Rules
1. A module may import and use another module's exported services
2. A module must NEVER directly access another module's repository or entity
3. Cross-module data access goes through the owning module's service interface
4. Circular dependencies between modules are forbidden and will fail compilation

### Module Map

```
src/
├── core/                    # Infrastructure modules (imported by all)
│   ├── auth/
│   ├── organisations/
│   ├── users/
│   ├── notifications/
│   └── database/
│
├── assessment/              # Domain modules (depend on core/)
│   ├── engine/              # Shared assessment lifecycle
│   ├── items/               # Item bank + competency library
│   ├── uc1-feedback/        # 360-degree feedback
│   ├── uc2-competency/      # Competency assessment
│   ├── uc3-personality/     # Big Five personality
│   └── uc4-readiness/       # Readiness/potential
│
├── reporting/               # Cross-cutting: reads from assessment modules
├── analytics/               # Cross-cutting: aggregations
└── shared/                  # Pure utilities (decorators, filters, interceptors)
```

---

## Consequences

**Positive:**
- Single deployment unit: one Docker image, one App Service, one connection pool
- No inter-service network calls, serialisation, or distributed tracing needed
- Full ACID transactions across module boundaries (one DB connection)
- 3–4 developer team can share codebase without service ownership friction
- Trivial to extract a module into a microservice later if one domain needs independent scaling

**Negative:**
- All modules share the same process: a memory leak in one module affects all
- Scaling is all-or-nothing (can't scale just the report generation worker) — mitigated by offloading heavy work (PDF generation) to a BullMQ job queue

**Extraction path (post-MVP):** If `reporting` becomes a scaling bottleneck, it can be extracted into a separate worker service that reads from the same DB. The module boundary ensures the extraction is mechanical, not architectural.

---

## Alternatives Considered

**Microservices from day one:** Rejected. A 3–4 person team would spend 40% of sprint time on service mesh, distributed tracing, inter-service auth, and deployment pipelines instead of shipping assessment features.

**Serverless functions (Azure Functions):** Rejected. Cold start latency is unacceptable for the assessment rating interface (rater expects <500ms response). Good candidate for report generation jobs in Phase 3+.
