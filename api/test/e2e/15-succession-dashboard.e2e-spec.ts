/**
 * E2E Test Suite: Succession Dashboard (UC4)
 * QA Scenarios: QA-SUCC-001 through QA-SUCC-007
 *
 * Validates the succession dashboard API: empty initial state, candidate aggregation
 * after readiness computation, assessment-level filtering, role profile CRUD
 * (including personalityFit specs), named-role candidate grouping, and
 * multi-tenant data isolation between organisations.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  authGet,
  authPost,
  createDraftAssessment,
  addParticipant,
  launchAssessment,
  createUserInOrg,
  setOrgPlan,
  TestOrg,
  AuthSession,
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

// ── Shared helpers ────────────────────────────────────────────────────────────

async function submitAllSjtResponses(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
  participantId: string,
): Promise<void> {
  const questRes = await authGet(
    app,
    session,
    `/api/v1/assessments/${assessmentId}/sjt/${participantId}`,
  );
  expect(questRes.status).toBe(200);
  const items: Array<{ id: string }> = questRes.body.data?.items ?? [];
  for (const item of items) {
    const res = await authPost(
      app,
      session,
      `/api/v1/assessments/${assessmentId}/sjt/${participantId}/responses`,
      { itemId: item.id, selectedOption: 0 },
    );
    expect([200, 201]).toContain(res.status);
  }
}

async function submitAllLaResponses(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
  participantId: string,
): Promise<void> {
  const questRes = await authGet(
    app,
    session,
    `/api/v1/assessments/${assessmentId}/learning-agility/${participantId}`,
  );
  expect(questRes.status).toBe(200);
  const items: Array<{ id: string }> = questRes.body.data?.items ?? [];
  for (const item of items) {
    const res = await authPost(
      app,
      session,
      `/api/v1/assessments/${assessmentId}/learning-agility/${participantId}/responses`,
      { itemId: item.id, value: 4 },
    );
    expect([200, 201]).toContain(res.status);
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('[QA-SUCC] Succession Dashboard', () => {
  let app: INestApplication;
  let ds: DataSource;

  let org: TestOrg;

  // Assessment 1 — primary (participant 1)
  let asm1Id: string;
  let apId1: string; // AssessmentParticipant.id

  // Assessment 2 — used for the assessment-filter test (participant 2)
  let asm2Id: string;
  let apId2: string;

  // Role profile created in QA-SUCC-002
  let roleProfileId: string;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, org.id, 'professional');

    const sfx = uid();

    const p1UserId = await createUserInOrg(ds, org.id, {
      email: `succ-p1+${sfx}@stp.lk`,
      firstName: 'Kasun',
      lastName: 'Mendis',
      role: 'participant',
      password: 'Participant1!',
    });

    const p2UserId = await createUserInOrg(ds, org.id, {
      email: `succ-p2+${sfx}@stp.lk`,
      firstName: 'Dilini',
      lastName: 'Wickramasinghe',
      role: 'participant',
      password: 'Participant2!',
    });

    // Assessment 1 with participant 1
    asm1Id = await createDraftAssessment(app, org.admin, {
      title: `Succession Readiness Asm1 ${sfx}`,
      assessmentType: 'readiness',
    });
    await addParticipant(app, org.admin, asm1Id, p1UserId);
    await launchAssessment(app, org.admin, asm1Id);
    const p1Res = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${asm1Id}/participants`,
    ).expect(200);
    apId1 = p1Res.body.data[0].id;

    // Assessment 2 with participant 2
    asm2Id = await createDraftAssessment(app, org.admin, {
      title: `Succession Readiness Asm2 ${sfx}`,
      assessmentType: 'readiness',
    });
    await addParticipant(app, org.admin, asm2Id, p2UserId);
    await launchAssessment(app, org.admin, asm2Id);
    const p2Res = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${asm2Id}/participants`,
    ).expect(200);
    apId2 = p2Res.body.data[0].id;

    // Submit SJT + LA responses for both participants so compute does not fail
    await submitAllSjtResponses(app, org.admin, asm1Id, apId1);
    await submitAllLaResponses(app, org.admin, asm1Id, apId1);
    await submitAllSjtResponses(app, org.admin, asm2Id, apId2);
    await submitAllLaResponses(app, org.admin, asm2Id, apId2);
  });

  // ── QA-SUCC-001 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-001 | P1
   * Scenario: GET /succession/dashboard before any readiness computation returns
   * a valid empty structure — totalCandidates=0, all four rating buckets zeroed,
   * and byRole=[]. The endpoint must not 500 on empty readiness_scores data.
   */
  it('QA-SUCC-001 | P1 — dashboard with no computed scores returns 200 with empty structure', async () => {
    const res = await authGet(app, org.admin, '/api/v1/succession/dashboard').expect(200);
    const dashboard = res.body.data;

    expect(dashboard).toBeDefined();
    expect(dashboard.totalCandidates).toBe(0);
    expect(typeof dashboard.byRating).toBe('object');

    // All four ReadinessRating enum values must be present
    expect(dashboard.byRating).toHaveProperty('ready_now');
    expect(dashboard.byRating).toHaveProperty('1_2_years');
    expect(dashboard.byRating).toHaveProperty('developing');
    expect(dashboard.byRating).toHaveProperty('not_yet_ready');

    // Every bucket must be 0
    for (const count of Object.values(dashboard.byRating)) {
      expect(count).toBe(0);
    }

    expect(Array.isArray(dashboard.byRole)).toBe(true);
    expect(dashboard.byRole.length).toBe(0);
  });

  // ── QA-SUCC-002 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-002 | P1
   * Scenario: POST /role-profiles creates a role profile; GET /role-profiles
   * includes it. The id returned by POST is used in later dashboard grouping tests.
   */
  it('QA-SUCC-002 | P1 — POST /role-profiles creates profile with id; GET /role-profiles lists it', async () => {
    const createRes = await authPost(app, org.admin, '/api/v1/role-profiles', {
      title: 'Head of People Operations',
      level: 'head',
      requiredCompetencies: [],
    }).expect(201);

    const profile = createRes.body.data;
    expect(profile).toHaveProperty('id');
    expect(profile.title).toBe('Head of People Operations');
    expect(profile.level).toBe('head');
    roleProfileId = profile.id;

    // GET must include the newly created profile
    const listRes = await authGet(app, org.admin, '/api/v1/role-profiles').expect(200);
    const profiles: Array<{ id: string }> = listRes.body.data ?? [];
    expect(profiles.some((p) => p.id === roleProfileId)).toBe(true);
  });

  // ── QA-SUCC-003 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-003 | P1
   * Scenario: After computing readiness for participant 1 without a role profile,
   * the dashboard shows totalCandidates≥1, the correct byRating bucket is incremented,
   * and byRole contains an 'Unassigned' group that includes this participant.
   */
  it('QA-SUCC-003 | P1 — after computing readiness (no role profile), participant appears under Unassigned', async () => {
    const computeRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asm1Id}/readiness/${apId1}/compute`,
      {},
    ).expect(201);

    const score = computeRes.body.data;
    expect(['ready_now', '1_2_years', 'developing', 'not_yet_ready']).toContain(
      score.readinessRating,
    );

    const dashRes = await authGet(app, org.admin, '/api/v1/succession/dashboard').expect(200);
    const dashboard = dashRes.body.data;

    expect(dashboard.totalCandidates).toBeGreaterThanOrEqual(1);
    expect(dashboard.byRating[score.readinessRating]).toBeGreaterThanOrEqual(1);

    // Participant 1 should appear in the 'Unassigned' group (no roleProfileId)
    const unassigned = dashboard.byRole.find(
      (g: { roleTitle: string }) => g.roleTitle === 'Unassigned',
    );
    expect(unassigned).toBeDefined();
    expect(
      unassigned.candidates.some((c: { participantId: string }) => c.participantId === apId1),
    ).toBe(true);
  });

  // ── QA-SUCC-004 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-004 | P1
   * Scenario: Recomputing readiness for participant 1 with a roleProfileId moves the
   * candidate into the named role group in the dashboard. The byRole entry for that
   * role profile must exist with the correct title and include participant 1.
   */
  it('QA-SUCC-004 | P1 — computing readiness with roleProfileId places candidate under named role group', async () => {
    await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asm1Id}/readiness/${apId1}/compute`,
      { roleProfileId },
    ).expect(201);

    const dashRes = await authGet(app, org.admin, '/api/v1/succession/dashboard').expect(200);
    const byRole: Array<{
      roleProfileId: string;
      roleTitle: string;
      candidates: Array<{ participantId: string }>;
    }> = dashRes.body.data.byRole ?? [];

    const roleGroup = byRole.find((g) => g.roleProfileId === roleProfileId);
    expect(roleGroup).toBeDefined();
    expect(roleGroup!.roleTitle).toBe('Head of People Operations');
    expect(
      roleGroup!.candidates.some((c) => c.participantId === apId1),
    ).toBe(true);
  });

  // ── QA-SUCC-005 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-005 | P1
   * Scenario: GET /succession/dashboard?assessmentId= filters results to candidates
   * from only that assessment. Participant 1 (asm1) and participant 2 (asm2) must
   * not appear in each other's filtered dashboard results.
   */
  it('QA-SUCC-005 | P1 — assessmentId query param filters dashboard to a single assessment', async () => {
    // Compute readiness for participant 2 in asm2 (no prior compute for p2)
    await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asm2Id}/readiness/${apId2}/compute`,
      {},
    ).expect(201);

    // asm1 filter — should include apId1, exclude apId2
    const asm1Res = await authGet(
      app,
      org.admin,
      `/api/v1/succession/dashboard?assessmentId=${asm1Id}`,
    ).expect(200);
    const asm1Cands: Array<{ participantId: string }> = (
      asm1Res.body.data.byRole ?? []
    ).flatMap((g: { candidates: Array<{ participantId: string }> }) => g.candidates);

    expect(asm1Cands.some((c) => c.participantId === apId1)).toBe(true);
    expect(asm1Cands.some((c) => c.participantId === apId2)).toBe(false);

    // asm2 filter — should include apId2, exclude apId1
    const asm2Res = await authGet(
      app,
      org.admin,
      `/api/v1/succession/dashboard?assessmentId=${asm2Id}`,
    ).expect(200);
    const asm2Cands: Array<{ participantId: string }> = (
      asm2Res.body.data.byRole ?? []
    ).flatMap((g: { candidates: Array<{ participantId: string }> }) => g.candidates);

    expect(asm2Cands.some((c) => c.participantId === apId2)).toBe(true);
    expect(asm2Cands.some((c) => c.participantId === apId1)).toBe(false);
  });

  // ── QA-SUCC-006 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-006 | P1
   * Scenario: POST /role-profiles with a personalityFit specification correctly
   * persists the factor weights and T-score targets. The stored values must be
   * returned unchanged — no truncation, no type coercion.
   */
  it('QA-SUCC-006 | P1 — role profile with personalityFit spec persists all fields exactly', async () => {
    const personalityFit = {
      openness: { minTScore: 55, idealTScore: 65, weight: 0.4 },
      conscientiousness: { minTScore: 60, idealTScore: 70, weight: 0.6 },
    };

    const createRes = await authPost(app, org.admin, '/api/v1/role-profiles', {
      title: 'Chief Transformation Officer',
      level: 'c-suite',
      requiredCompetencies: [],
      personalityFit,
    }).expect(201);

    const profile = createRes.body.data;
    expect(profile).toHaveProperty('id');
    expect(profile.personalityFit).toBeDefined();
    expect(profile.personalityFit.openness).toMatchObject({
      minTScore: 55,
      idealTScore: 65,
      weight: 0.4,
    });
    expect(profile.personalityFit.conscientiousness).toMatchObject({
      minTScore: 60,
      idealTScore: 70,
      weight: 0.6,
    });

    // GET /role-profiles must include the profile with its personalityFit intact
    const listRes = await authGet(app, org.admin, '/api/v1/role-profiles').expect(200);
    const found = (listRes.body.data ?? []).find(
      (p: { id: string }) => p.id === profile.id,
    );
    expect(found).toBeDefined();
    expect(found.personalityFit.openness.idealTScore).toBe(65);
    expect(found.personalityFit.conscientiousness.weight).toBe(0.6);
  });

  // ── QA-SUCC-007 ──────────────────────────────────────────────────────────────

  /**
   * QA-SUCC-007 | P2
   * Scenario: A second organisation's succession dashboard is empty and its role
   * profile list does not include profiles from Org A. Dashboard data must be
   * scoped strictly by organisationId from the JWT payload.
   */
  it('QA-SUCC-007 | P2 — multi-tenancy: org B dashboard is isolated from org A data', async () => {
    const orgB = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, orgB.id, 'professional');

    // Org B has no readiness data — dashboard must return 0 candidates
    const bDashRes = await authGet(app, orgB.admin, '/api/v1/succession/dashboard').expect(200);
    const bDash = bDashRes.body.data;
    expect(bDash.totalCandidates).toBe(0);
    expect(bDash.byRole.length).toBe(0);

    // Org B's role profile list must not contain Org A's profiles
    const bProfilesRes = await authGet(app, orgB.admin, '/api/v1/role-profiles').expect(200);
    const bProfileIds: string[] = (bProfilesRes.body.data ?? []).map(
      (p: { id: string }) => p.id,
    );
    expect(bProfileIds).not.toContain(roleProfileId);
  });
});
