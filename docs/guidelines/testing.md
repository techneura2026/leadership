# Testing Guidelines

---

## Test Pyramid

```
         /\
        /E2E\          Playwright — critical user journeys (5–10 tests)
       /------\
      / Integr \       Jest + real DB — service layer with real PostgreSQL
     /----------\
    /    Unit    \     Jest — scoring engines, pure functions, guards
   /--------------\
```

---

## Unit Tests (`api/test/unit/`)

Target: pure functions and isolated services with mocked dependencies.

**Must unit test:**
- All scoring engines: `PersonalityScoringService`, `360AggregationService`, `ReadinessScoringService`
- `AnonymityService` — threshold logic is business-critical
- `PlanGuard` — limit enforcement
- DTOs — validation behaviour
- JWT strategy

**Rules:**
- No real DB connections in unit tests
- Mock repositories with `jest.fn()` or NestJS testing utilities
- Every public method on a scoring service has a test
- Test file lives next to the source: `auth.service.spec.ts` beside `auth.service.ts`

```typescript
describe('PersonalityScoringService', () => {
  it('converts raw score to T-score using normative data', () => {
    const result = service.toTScore(32, { mean: 30, stdDev: 5 });
    expect(result).toBe(54);
  });
});
```

---

## Integration Tests (`api/test/integration/`)

Target: service layer against a real PostgreSQL database (Docker Compose test instance).

**Must integration test:**
- Auth flow: register → login → refresh → logout
- Tenant isolation: creating data with org A cannot be read by org B
- Assessment lifecycle: create → launch → submit responses → close
- Report generation trigger

**Rules:**
- Each test file creates its own organisation via a helper (`createTestOrg()`)
- Each test cleans up its own data in `afterEach`
- Use `TEST_DATABASE_URL` (separate DB from development)
- Never use `synchronize: true` — always run migrations against the test DB

```typescript
describe('AssessmentsService', () => {
  it('cannot read assessments from another organisation', async () => {
    const org1 = await createTestOrg();
    const org2 = await createTestOrg();
    const assessment = await service.create(org1.id, dto);

    await expect(service.findOne(assessment.id, org2.id))
      .rejects.toThrow(NotFoundException);
  });
});
```

---

## E2E Tests (`web/test/e2e/` with Playwright)

Target: critical user journeys through the real UI.

**Phase 0 journeys to test:**
1. Org registration → login → dashboard
2. 360 rater flow: email link → complete feedback → thank-you

**Phase 2+ journeys to add:**
3. Admin: create assessment → add participants → launch → close → generate report
4. Participant: complete competency self-assessment

---

## Test Data

Use factories (not fixtures files) to create test data:

```typescript
// api/test/factories/user.factory.ts
export function createUserDto(overrides?: Partial<CreateUserDto>): CreateUserDto {
  return {
    email: `test-${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    password: 'Password1!',
    ...overrides,
  };
}
```

**Never commit real email addresses, real names, or real assessment data to test fixtures.**

---

## Coverage Targets

| Layer | Target |
|-------|--------|
| Scoring engines | 100% branch coverage |
| Service methods | 80%+ line coverage |
| Controllers | 70%+ (mostly covered by integration tests) |
| UI components | Not measured — covered by E2E |

Run coverage: `npm run test:cov -w api`
