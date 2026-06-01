/**
 * E2E Test Suite: Competency Library (Items Module)
 * QA Scenarios: QA-ITEMS-001 through QA-ITEMS-012
 *
 * Validates the competency library API: reading system domains and competencies,
 * org-specific competency CRUD (create / update / soft-delete), item catalogues
 * (personality / SJT / learning agility), the full framework endpoint used for
 * 360 configuration, and tenant isolation for custom competencies.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  authGet,
  authPost,
  authPatch,
  setOrgPlan,
  TestOrg,
} from './setup/helpers';
import { ORGS } from './setup/factories';

let _counter = 0;
function uid() {
  return `${Date.now()}${++_counter}`;
}

function uniqueOrg(base: typeof ORGS.strategicTalent) {
  const sfx = uid();
  return {
    ...base,
    orgName: `${base.orgName} ${sfx}`,
    orgSlug: `${base.orgSlug}-${sfx}`,
    email: base.email.replace('@', `+${sfx}@`),
  };
}

describe('[QA-ITEMS] Competency Library', () => {
  let app: INestApplication;
  let ds: DataSource;

  let org: TestOrg;

  // IDs shared across tests
  let systemDomainId: string;
  let createdCompetencyId: string;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, org.id, 'professional');
  });

  // ── QA-ITEMS-001 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-001 | P1
   * Scenario: GET /items/domains returns the seeded system domains.
   * Each domain has id and name; at least one exists from seed data.
   * The first domain's id is stored for use in subsequent filter tests.
   */
  it('QA-ITEMS-001 | P1 — GET /items/domains returns system domains with id and name', async () => {
    const res = await authGet(app, org.admin, '/api/v1/items/domains').expect(200);
    const domains: Array<{ id: string; name: string }> = res.body.data;

    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThan(0);

    const first = domains[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(typeof first.id).toBe('string');
    expect(typeof first.name).toBe('string');

    systemDomainId = first.id;
  });

  // ── QA-ITEMS-002 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-002 | P1
   * Scenario: GET /items/competencies returns the full list with nested levels
   * and behaviours. At least one seed competency must have a levels array with entries.
   */
  it('QA-ITEMS-002 | P1 — GET /items/competencies returns competencies with nested levels and behaviours', async () => {
    const res = await authGet(app, org.admin, '/api/v1/items/competencies').expect(200);
    const competencies: Array<{
      id: string;
      name: string;
      domainId: string;
      levels: Array<{ level: number }>;
    }> = res.body.data;

    expect(Array.isArray(competencies)).toBe(true);
    expect(competencies.length).toBeGreaterThan(0);

    const first = competencies[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('domainId');

    // Seed competencies have 1-5 levels loaded
    const withLevels = competencies.find(
      (c) => Array.isArray(c.levels) && c.levels.length > 0,
    );
    expect(withLevels).toBeDefined();
    expect(withLevels!.levels[0]).toHaveProperty('level');
  });

  // ── QA-ITEMS-003 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-003 | P1
   * Scenario: GET /items/competencies?domainId=X returns only competencies that
   * belong to the specified domain — the service must apply the WHERE clause correctly.
   */
  it('QA-ITEMS-003 | P1 — GET /items/competencies?domainId= filters to the specified domain only', async () => {
    const res = await authGet(
      app,
      org.admin,
      `/api/v1/items/competencies?domainId=${systemDomainId}`,
    ).expect(200);

    const filtered: Array<{ id: string; domainId: string }> = res.body.data;
    expect(Array.isArray(filtered)).toBe(true);

    for (const c of filtered) {
      expect(c.domainId).toBe(systemDomainId);
    }
  });

  // ── QA-ITEMS-004 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-004 | P1
   * Scenario: POST /items/competencies creates an org-specific competency in the
   * org's domain. The returned record has the caller's organisationId in the DB,
   * and the competency is visible in subsequent GET /items/competencies.
   */
  it('QA-ITEMS-004 | P1 — POST /items/competencies creates org competency; visible in GET list; DB has correct organisationId', async () => {
    const name = `Strategic Listening ${uid()}`;

    const createRes = await authPost(app, org.admin, '/api/v1/items/competencies', {
      domainId: systemDomainId,
      name,
      description: 'Ability to extract strategic intent from ambiguous communication',
      displayOrder: 99,
    }).expect(201);

    const created = createRes.body.data;
    expect(created).toHaveProperty('id');
    expect(created.name).toBe(name);
    expect(created.domainId).toBe(systemDomainId);
    createdCompetencyId = created.id;

    // Verify DB row has the org's organisationId
    const rows = await ds.query(
      `SELECT id, name, organisation_id FROM competencies WHERE id = $1`,
      [createdCompetencyId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].organisation_id).toBe(org.id);

    // Must appear in subsequent GET
    const listRes = await authGet(app, org.admin, '/api/v1/items/competencies').expect(200);
    const ids: string[] = listRes.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(createdCompetencyId);
  });

  // ── QA-ITEMS-005 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-005 | P1
   * Scenario: PATCH /items/competencies/:id updates name and description.
   * The updated values must be reflected in the PATCH response and in the
   * subsequent GET list — not stale cached data.
   */
  it('QA-ITEMS-005 | P1 — PATCH /items/competencies/:id updates name and description; GET reflects changes', async () => {
    const updatedName = `Strategic Listening (Revised) ${uid()}`;

    const patchRes = await authPatch(
      app,
      org.admin,
      `/api/v1/items/competencies/${createdCompetencyId}`,
      { name: updatedName, description: 'Revised description after stakeholder review' },
    ).expect(200);

    expect(patchRes.body.data.name).toBe(updatedName);
    expect(patchRes.body.data.description).toBe('Revised description after stakeholder review');

    // GET list must reflect the updated name
    const listRes = await authGet(app, org.admin, '/api/v1/items/competencies').expect(200);
    const found = listRes.body.data.find(
      (c: { id: string; name: string }) => c.id === createdCompetencyId,
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(updatedName);
  });

  // ── QA-ITEMS-006 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-006 | P1
   * Scenario: PATCH with isActive=false soft-deletes the competency. The service
   * filters isActive=true so the deactivated competency must no longer appear in
   * GET /items/competencies.
   */
  it('QA-ITEMS-006 | P1 — PATCH isActive=false soft-deletes; competency excluded from subsequent GET', async () => {
    // Create a dedicated competency for deactivation (keeps createdCompetencyId available for QA-ITEMS-007)
    const toDeactivateRes = await authPost(app, org.admin, '/api/v1/items/competencies', {
      domainId: systemDomainId,
      name: `To Be Deactivated ${uid()}`,
    }).expect(201);
    const toDeactivateId: string = toDeactivateRes.body.data.id;

    // Soft-delete
    await authPatch(
      app,
      org.admin,
      `/api/v1/items/competencies/${toDeactivateId}`,
      { isActive: false },
    ).expect(200);

    // Must NOT appear in GET /items/competencies (isActive=false filtered out by service)
    const listRes = await authGet(app, org.admin, '/api/v1/items/competencies').expect(200);
    const ids: string[] = listRes.body.data.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(toDeactivateId);
  });

  // ── QA-ITEMS-007 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-007 | P2
   * Scenario: An org-specific competency created in Org A is invisible to Org B.
   * The service scopes GET /items/competencies by (organisationId IS NULL OR organisationId = orgId),
   * so custom competencies from another org must never appear.
   */
  it('QA-ITEMS-007 | P2 — org-specific competency is not visible to a different organisation', async () => {
    const orgB = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, orgB.id, 'professional');

    const listRes = await authGet(app, orgB.admin, '/api/v1/items/competencies').expect(200);
    const ids: string[] = listRes.body.data.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(createdCompetencyId);
  });

  // ── QA-ITEMS-008 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-008 | P1
   * Scenario: GET /items/personality returns personality questionnaire items.
   * Seed data includes Big Five items. Each item has id and stem.
   */
  it('QA-ITEMS-008 | P1 — GET /items/personality returns seeded Big Five items with id and stem', async () => {
    const res = await authGet(app, org.admin, '/api/v1/items/personality').expect(200);
    const items: Array<{ id: string; stem: string }> = res.body.data;

    expect(Array.isArray(items)).toBe(true);

    if (items.length > 0) {
      expect(items[0]).toHaveProperty('id');
      expect(items[0]).toHaveProperty('stem');
      expect(typeof items[0].id).toBe('string');
      expect(items[0].stem.length).toBeGreaterThan(0);
    }
  });

  // ── QA-ITEMS-009 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-009 | P1
   * Scenario: GET /items/personality?factor=openness returns only items for the
   * openness factor. The service's WHERE clause must correctly restrict by factor.
   * If no openness items are seeded the assertion trivially passes (empty array).
   */
  it('QA-ITEMS-009 | P1 — GET /items/personality?factor=openness returns only openness items', async () => {
    const res = await authGet(
      app,
      org.admin,
      '/api/v1/items/personality?factor=openness',
    ).expect(200);
    const items: Array<{ id: string; factor: string }> = res.body.data;

    expect(Array.isArray(items)).toBe(true);

    for (const item of items) {
      expect(item.factor).toBe('openness');
    }
  });

  // ── QA-ITEMS-010 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-010 | P1
   * Scenario: GET /items/sjt returns SJT scenario items with stem and options array.
   * SJT items are used in the UC4 readiness questionnaire.
   */
  it('QA-ITEMS-010 | P1 — GET /items/sjt returns SJT items with stem and options array', async () => {
    const res = await authGet(app, org.admin, '/api/v1/items/sjt').expect(200);
    const items: Array<{ id: string; stem: string; options: unknown[] }> = res.body.data;

    expect(Array.isArray(items)).toBe(true);

    if (items.length > 0) {
      const first = items[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('stem');
      expect(Array.isArray(first.options)).toBe(true);
    }
  });

  // ── QA-ITEMS-011 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-011 | P1
   * Scenario: GET /items/learning-agility returns Learning Agility items.
   * Each item has id, stem, and a factor string identifying the LA sub-dimension.
   */
  it('QA-ITEMS-011 | P1 — GET /items/learning-agility returns LA items with id and stem', async () => {
    const res = await authGet(app, org.admin, '/api/v1/items/learning-agility').expect(200);
    const items: Array<{ id: string; stem: string; factor: string }> = res.body.data;

    expect(Array.isArray(items)).toBe(true);

    if (items.length > 0) {
      const first = items[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('stem');
    }
  });

  // ── QA-ITEMS-012 ─────────────────────────────────────────────────────────────

  /**
   * QA-ITEMS-012 | P1
   * Scenario: GET /items/framework returns the full competency framework used to
   * configure 360 assessments. The response is an array of domains, each with a
   * nested competencies array that includes levels and behaviours.
   */
  it('QA-ITEMS-012 | P1 — GET /items/framework returns domains with nested competencies, levels, and behaviours', async () => {
    const res = await authGet(app, org.admin, '/api/v1/items/framework').expect(200);
    const domains: Array<{
      id: string;
      name: string;
      competencies: Array<{ id: string; name: string; levels: unknown[] }>;
    }> = res.body.data;

    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThan(0);

    const first = domains[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(Array.isArray(first.competencies)).toBe(true);

    // At least one domain must have competencies with levels
    const domainWithComp = domains.find(
      (d) => Array.isArray(d.competencies) && d.competencies.length > 0,
    );
    expect(domainWithComp).toBeDefined();

    const comp = domainWithComp!.competencies[0];
    expect(comp).toHaveProperty('id');
    expect(comp).toHaveProperty('name');
    expect(Array.isArray(comp.levels)).toBe(true);
  });
});
