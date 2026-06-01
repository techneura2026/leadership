# Architecture Decision Records

This directory contains ADRs for LeaderPrism. Each ADR documents a significant architectural decision, its context, and its consequences.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-multi-tenancy-strategy.md) | Multi-Tenancy Strategy | Accepted |
| [0002](0002-monorepo-structure.md) | Monorepo Structure | Accepted |
| [0003](0003-modular-monolith.md) | Modular Monolith Over Microservices | Accepted |
| [0004](0004-authentication-strategy.md) | Authentication Strategy | Accepted |
| [0005](0005-saas-plan-management.md) | SaaS Plan Management | Accepted |
| [0006](0006-database-migration-strategy.md) | Database Migration Strategy | Accepted |

## Format

Each ADR uses this template:
- **Context** — the forces at play, the problem being solved
- **Decision** — what we decided and the key details
- **Consequences** — positive, negative, and constraints this creates

## Adding a New ADR

1. Copy the naming pattern: `NNNN-kebab-case-title.md`
2. Use the next available number
3. Add a row to the index above
4. Status options: `Proposed` → `Accepted` → `Deprecated` / `Superseded by ADR-XXXX`
