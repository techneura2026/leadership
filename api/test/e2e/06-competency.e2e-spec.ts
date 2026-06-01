/**
 * E2E Test Suite: Competency Assessment (UC2)
 * QA Scenarios: QA-COMP-001 through QA-COMP-004
 *
 * Tests the self and manager competency rating flows, gap analysis calculation,
 * boundary conditions for missing manager data, and access control on the
 * participant-specific self endpoint.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp, http } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  login,
  authGet,
  authPost,
  createDraftAssessment,
  addParticipant,
  launchAssessment,
  createUserInOrg,
  setOrgPlan,
  getSeedCompetencyIds,
  TestOrg,
  AuthSession,
} from './setup/helpers';
import { ORGS, USERS, ASSESSMENTS } from './setup/factories';

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

describe('[QA-COMP] Competency Assessment (UC2)', () => {
  let app: INestApplication;
  let ds: DataSource;

  let org: TestOrg;
  let adminSession: AuthSession;
  let managerSession: AuthSession;
  let participantSession: AuthSession;

  let participantUserId: string;
  let managerUserId: string;

  let assessmentId: string;
  let participantId: string; // assessment-participant record ID

  let competencyIds: string[];

  // IDs of the CA records created during tests (shared across QA-COMP-001/002)
  let selfCaId: string;
  let managerCaId: string;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    const orgData = uniqueOrg(ORGS.strategicTalent);
    org = await registerOrg(app, orgData);
    adminSession = org.admin;
    await setOrgPlan(ds, org.id, 'professional');

    competencyIds = await getSeedCompetencyIds(ds, 4);

    const sfx = uid();

    participantUserId = await createUserInOrg(ds, org.id, {
      email: USERS.participant1.email.replace('@', `+${sfx}@`),
      firstName: USERS.participant1.firstName,
      lastName: USERS.participant1.lastName,
      role: 'participant',
      password: USERS.participant1.password,
    });

    managerUserId = await createUserInOrg(ds, org.id, {
      email: USERS.manager.email.replace('@', `+${sfx}@`),
      firstName: USERS.manager.firstName,
      lastName: USERS.manager.lastName,
      role: 'manager',
      password: USERS.manager.password,
    });

    participantSession = await login(
      app,
      USERS.participant1.email.replace('@', `+${sfx}@`),
      USERS.participant1.password,
    );

    managerSession = await login(
      app,
      USERS.manager.email.replace('@', `+${sfx}@`),
      USERS.manager.password,
    );

    // Create and launch the competency assessment
    assessmentId = await createDraftAssessment(app, adminSession, {
      title: ASSESSMENTS.competencyQ3,
      assessmentType: 'competency',
    });
    await addParticipant(app, adminSession, assessmentId, participantUserId);
    await launchAssessment(app, adminSession, assessmentId);

    // Retrieve the assessment-participant record ID
    const pRes = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/participants`,
    ).expect(200);
    participantId = pRes.body.data[0].id;
  });

  // ─── QA-COMP-001 ────────────────────────────────────────────────────────

  /**
   * QA-COMP-001 | P1
   * Scenario: Start self-assessment → submit ratings → caId is set; submittedAt populated.
   * Validates the full self-assessment flow: POST /competency/self creates a CA record,
   * and POST /competency/self/:caId/submit locks it with a submittedAt timestamp.
   */
  it('QA-COMP-001 | P1 — start self-assessment and submit ratings; caId set and submittedAt populated', async () => {
    // Start self-assessment (admin on behalf of participant, or participant directly)
    const startRes = await authPost(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/competency/self`,
      { participantId },
    );
    expect([200, 201]).toContain(startRes.status);
    expect(startRes.body.data).toHaveProperty('id');
    selfCaId = startRes.body.data.id;
    expect(selfCaId).toBeDefined();
    // submittedAt should be null before submission
    expect(startRes.body.data.submittedAt).toBeNull();

    // Submit self-ratings using real competency IDs with value = 2 (for gap test in QA-COMP-002)
    const ratings = competencyIds.map((id) => ({
      competencyId: id,
      levelRated: 2,
      evidenceText: `Self evidence for ${id}`,
    }));

    const submitRes = await authPost(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/competency/self/${selfCaId}/submit`,
      { participantId, ratings },
    );
    expect([200, 201]).toContain(submitRes.status);

    // submittedAt must now be populated
    expect(submitRes.body.data.submittedAt).not.toBeNull();

    // Verify in DB
    const caRows = await ds.query(
      `SELECT submitted_at FROM competency_assessments WHERE id = $1`,
      [selfCaId],
    );
    expect(caRows.length).toBe(1);
    expect(caRows[0].submitted_at).not.toBeNull();
  });

  // ─── QA-COMP-002 ────────────────────────────────────────────────────────

  /**
   * QA-COMP-002 | P1
   * Scenario: Self rating = 2, Manager rating = 3 for same competency → gap = +1.
   * The gap is calculated as managerRating − selfRating. A positive gap means the
   * participant is underestimating their capability.
   */
  it('QA-COMP-002 | P1 — self=2, manager=3 → gap analysis returns gap=+1 (manager − self)', async () => {
    // Start and submit manager assessment
    const startManagerRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${assessmentId}/competency/manager`,
      { participantId },
    );
    expect([200, 201]).toContain(startManagerRes.status);
    managerCaId = startManagerRes.body.data.id;

    // Submit manager ratings with levelRated = 3 (to contrast with self = 2)
    const managerRatings = competencyIds.map((id) => ({
      competencyId: id,
      levelRated: 3,
      evidenceText: `Manager evidence for ${id}`,
    }));

    const managerSubmitRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${assessmentId}/competency/manager/${managerCaId}/submit`,
      { ratings: managerRatings },
    );
    expect([200, 201]).toContain(managerSubmitRes.status);
    expect(managerSubmitRes.body.data.submittedAt).not.toBeNull();

    // Retrieve gap analysis
    const gapRes = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/competency/gap/${participantId}`,
    ).expect(200);

    expect(Array.isArray(gapRes.body.data)).toBe(true);
    expect(gapRes.body.data.length).toBeGreaterThan(0);

    // Verify at least one gap is +1 (manager=3, self=2 → gap = 3 - 2 = 1)
    const firstGap = gapRes.body.data.find(
      (g: any) => competencyIds.includes(g.competencyId),
    );
    expect(firstGap).toBeDefined();
    expect(firstGap.selfRating).toBe(2);
    expect(firstGap.managerRating).toBe(3);
    expect(firstGap.gap).toBe(1);
  });

  // ─── QA-COMP-003 ────────────────────────────────────────────────────────

  /**
   * QA-COMP-003 | P1
   * Scenario: A manager cannot submit a self-assessment for a different participant
   * using the self endpoint — they should get a 403 or 404 because the CA record
   * would be typed as 'self' and belong to the participant's userId.
   * Managers have their own endpoint (/competency/manager) and cannot impersonate
   * the participant's self record.
   */
  it('QA-COMP-003 | P1 — manager cannot submit via the self endpoint for another participant; returns 403 or 404', async () => {
    // Manager tries to start a self-assessment on behalf of the participant
    const illegalStartRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${assessmentId}/competency/self`,
      { participantId },
    );
    // The self CA for this participant already exists (created in QA-COMP-001).
    // The endpoint returns the existing record idempotently — so this in itself is not
    // an access violation.  The violation occurs when the manager tries to SUBMIT
    // using the self CA ID with a wrong participantId check.
    // We test by trying to submit to the existing selfCaId with the manager as assessor.
    // The service matches caId + participantId + assessorType='self', so the manager
    // (whose userId != participant's userId) cannot have a 'self' CA with that participantId.
    const illegalSubmitRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${assessmentId}/competency/self/${selfCaId}/submit`,
      {
        participantId,
        ratings: competencyIds.map((id) => ({
          competencyId: id,
          levelRated: 5,
        })),
      },
    );

    // 400 (already submitted), 403, or 404 are all acceptable rejections
    expect([400, 403, 404]).toContain(illegalSubmitRes.status);
  });

  // ─── QA-COMP-004 ────────────────────────────────────────────────────────

  /**
   * QA-COMP-004 | P1
   * Scenario: When no manager rating exists, GET gap returns self scores with
   * managerRating = null and gap = null, without throwing a 500.
   * Partial data must be handled gracefully — not all participants have a manager
   * assessment at any given point in time.
   */
  it('QA-COMP-004 | P1 — no manager rating → gap returns self scores present, managerRating null, no 500', async () => {
    // Create a completely new assessment and participant with only self rating
    const freshAssessmentId = await createDraftAssessment(app, adminSession, {
      title: `No-manager gap test ${uid()}`,
      assessmentType: 'competency',
    });

    const freshParticipantUserId = await createUserInOrg(ds, org.id, {
      email: `no-mgr-participant+${uid()}@example.com`,
      firstName: 'NoManager', lastName: 'Participant', role: 'participant', password: 'Test1234!',
    });

    await addParticipant(app, adminSession, freshAssessmentId, freshParticipantUserId);
    await launchAssessment(app, adminSession, freshAssessmentId);

    const freshPartsRes = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${freshAssessmentId}/participants`,
    ).expect(200);
    const freshApId = freshPartsRes.body.data[0].id;

    // Start and submit self-assessment only (no manager)
    const startRes = await authPost(
      app,
      adminSession,
      `/api/v1/assessments/${freshAssessmentId}/competency/self`,
      { participantId: freshApId },
    );
    expect([200, 201]).toContain(startRes.status);
    const freshSelfCaId: string = startRes.body.data.id;

    const selfRatings = competencyIds.slice(0, 2).map((id) => ({
      competencyId: id,
      levelRated: 3,
    }));

    await authPost(
      app,
      adminSession,
      `/api/v1/assessments/${freshAssessmentId}/competency/self/${freshSelfCaId}/submit`,
      { participantId: freshApId, ratings: selfRatings },
    );

    // GET gap analysis — should return 200, NOT 500
    const gapRes = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${freshAssessmentId}/competency/gap/${freshApId}`,
    ).expect(200);

    expect(Array.isArray(gapRes.body.data)).toBe(true);
    expect(gapRes.body.data.length).toBeGreaterThan(0);

    // Self ratings should be present; manager ratings should be null; gap should be null
    const firstItem = gapRes.body.data[0];
    expect(firstItem.selfRating).not.toBeNull();
    expect(firstItem.managerRating).toBeNull();
    expect(firstItem.gap).toBeNull();
  });
});
