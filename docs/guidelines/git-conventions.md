# Git Conventions

---

## Branch Strategy

```
main          ← production deployments only (protected)
staging       ← staging deployments, merged from feature branches
feature/*     ← all development work
fix/*         ← bug fixes
chore/*       ← dependency updates, config changes
```

**Branch naming:** `feature/LP-<ticket>-short-description` (e.g., `feature/LP-42-360-rater-interface`)

---

## Commit Messages

Format: `<type>(<scope>): <subject>`

```
feat(auth): add refresh token rotation
fix(360): enforce anonymity threshold before revealing scores
chore(deps): upgrade NestJS to 10.4.1
test(scoring): add unit tests for Big Five T-score calculation
docs(adr): add ADR-0007 for report generation strategy
```

**Types:** `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, `perf`

**Scope:** module name — `auth`, `org`, `360`, `competency`, `personality`, `readiness`, `reporting`, `analytics`, `web`, `shared`, `infra`, `deps`

**Rules:**
- Subject is imperative present tense: "add" not "added" or "adds"
- No period at end of subject
- Body explains WHY if non-obvious (not WHAT — the diff shows what)
- 72 char limit on subject line

---

## Pull Request Rules

1. Every PR targets `staging` (not `main` directly)
2. PR title follows the same commit message format
3. PR description includes: what changed, why, and testing notes
4. Minimum one reviewer approval required
5. All CI checks must pass before merge
6. Squash merge — one clean commit per PR on `staging`

**PR description template:**
```markdown
## What
Brief description of the change.

## Why
The reason this change was needed.

## Testing
- [ ] Unit tests added/updated
- [ ] Tested locally against Docker Compose DB
- [ ] Tenant isolation verified (tested with two orgs)
- [ ] Mobile responsiveness checked (if UI change)
```

---

## Tags & Releases

```
v0.1.0   ← Phase 0 complete (auth + org + users)
v0.2.0   ← Phase 1 complete (competency library + assessment wizard)
v0.3.0   ← Phase 2 complete (all UC interfaces + scoring)
v1.0.0   ← Pilot-ready release
```

---

## What NOT to Commit

- `.env` files — use `.env.example` with placeholder values
- Generated files: `dist/`, `.next/`, `node_modules/`
- Migration files with `synchronize: true` artifacts
- Secrets, API keys, passwords (use Azure Key Vault references)
- Large binary files — PDFs, images go to Blob Storage
