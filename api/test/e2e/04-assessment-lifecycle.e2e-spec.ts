/**
 * E2E Test Suite: Assessment Lifecycle & Plan Enforcement
 * QA Scenarios: QA-ASS-001 through QA-ASS-010
 *
 * Tests the complete assessment state machine (draft → active → closed) and
 * validates that plan limits are enforced at create-time (allowed UC types),
 * at launch-time (participant count, active assessment cap), and that invalid
 * state transitions are rejected with 400 Bad Request.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp, http } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  authGet,
  authPost,
  authPatch,
  createDraftAssessment,
  addParticipant,
  launchAssessment,
  createUserInOrg,
  setOrgPlan,
  TestOrg,
  AuthSession,
} from './setup/helpers';
import { ORGS, ASSESSMENTS } from './setup/factories';

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

/** Creates n participant users in an org and returns their IDs. */
async function createParticipants(
  ds: DataSource,
  orgId: string,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = await createUserInOrg(ds, orgId, {
      email: `bulk-p${uid()}@example.com`,
      firstName: `Bulk`,
      lastName: `User${i}`,
      role: 'participant',
      password: 'BulkUser1!',
    });
    ids.push(id);
  }
  return ids;
}

describe('[QA-ASS] Assessment Lifecycle & Plan Enforcement', () => {
  let app: INestApplication;
  let ds: DataSource;

  // Professional-plan org — used for positive tests
  let proOrg: TestOrg;
  // Trial-plan org — used for plan-limit tests
  let trialOrg: TestOrg;

  // A handful of participants in the professional org
  let participantIds: string[];

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    // Setup professional org
    const proOrgData = uniqueOrg(ORGS.strategicTalent);
    proOrg = await registerOrg(app, proOrgData);
    await setOrgPlan(ds, proOrg.id, 'professional');

    participantIds = await createParticipants(ds, proOrg.id, 3);

    // Setup trial org (stays on trial)
    const trialOrgData = uniqueOrg(ORGS.peakPerformance);
    trialOrg = await registerOrg(app, trialOrgData);
    // plan = 'trial' by default — no setOrgPlan needed
  });

  // ─── QA-ASS-001 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-001 | P1
   * Scenario: Creating an assessment returns 201 with status=draft.
   * The initial state of any newly created assessment must be DRAFT.
   */
  it('QA-ASS-001 | P1 — creating an assessment returns 201 with status=draft', async () => {
    const res = await authPost(app, proOrg.admin, '/api/v1/assessments', {
      title: `${ASSESSMENTS.q3360} ${uid()}`,
      assessmentType: '360_feedback',
    }).expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.assessmentType).toBe('360_feedback');
    expect(res.body.data.title).toContain(ASSESSMENTS.q3360);
  });

  // ─── QA-ASS-002 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-002 | P1
   * Scenario: Trial plan blocks competency and readiness types; allows 360 and personality.
   * Plan-gating is enforced at create-time so clients can't bypass limits by
   * creating a draft and then launching it.
   */
  it('QA-ASS-002 | P1 — trial plan blocks competency/readiness types; allows 360_feedback/personality', async () => {
    // Competency type → 403
    const compRes = await authPost(app, trialOrg.admin, '/api/v1/assessments', {
      title: `Trial Competency ${uid()}`,
      assessmentType: 'competency',
    });
    expect(compRes.status).toBe(403);

    // Readiness type → 403
    const readinessRes = await authPost(app, trialOrg.admin, '/api/v1/assessments', {
      title: `Trial Readiness ${uid()}`,
      assessmentType: 'readiness',
    });
    expect(readinessRes.status).toBe(403);

    // 360_feedback type → 201 (allowed on trial)
    const feedbackRes = await authPost(app, trialOrg.admin, '/api/v1/assessments', {
      title: `Trial 360 ${uid()}`,
      assessmentType: '360_feedback',
    });
    expect(feedbackRes.status).toBe(201);

    // Personality type → 201 (allowed on trial)
    const personalityRes = await authPost(app, trialOrg.admin, '/api/v1/assessments', {
      title: `Trial Personality ${uid()}`,
      assessmentType: 'personality',
    });
    expect(personalityRes.status).toBe(201);
  });

  // ─── QA-ASS-003 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-003 | P1
   * Scenario: Trial plan allows max 2 active assessments; launching a 3rd returns 403.
   * The active-assessment cap is checked at launch-time so that drafts don't
   * count against the limit until they are actually activated.
   */
  it('QA-ASS-003 | P1 — trial plan blocks launching a 3rd active assessment with 403', async () => {
    // Create a dedicated trial org for this test so other tests don't interfere
    const localTrialOrg = await registerOrg(app, uniqueOrg(ORGS.peakPerformance));

    // Create participant users
    const p1 = await createUserInOrg(ds, localTrialOrg.id, {
      email: `ast003-p1+${uid()}@example.com`,
      firstName: 'P1', lastName: 'User', role: 'participant', password: 'TestPass1!',
    });
    const p2 = await createUserInOrg(ds, localTrialOrg.id, {
      email: `ast003-p2+${uid()}@example.com`,
      firstName: 'P2', lastName: 'User', role: 'participant', password: 'TestPass1!',
    });
    const p3 = await createUserInOrg(ds, localTrialOrg.id, {
      email: `ast003-p3+${uid()}@example.com`,
      firstName: 'P3', lastName: 'User', role: 'participant', password: 'TestPass1!',
    });

    // Launch first active assessment
    const id1 = await createDraftAssessment(app, localTrialOrg.admin, {
      title: `Trial Active 1 ${uid()}`,
      assessmentType: '360_feedback',
    });
    await addParticipant(app, localTrialOrg.admin, id1, p1);
    await launchAssessment(app, localTrialOrg.admin, id1);

    // Launch second active assessment
    const id2 = await createDraftAssessment(app, localTrialOrg.admin, {
      title: `Trial Active 2 ${uid()}`,
      assessmentType: '360_feedback',
    });
    await addParticipant(app, localTrialOrg.admin, id2, p2);
    await launchAssessment(app, localTrialOrg.admin, id2);

    // Attempt to launch third — must fail with 403
    const id3 = await createDraftAssessment(app, localTrialOrg.admin, {
      title: `Trial Active 3 ${uid()}`,
      assessmentType: '360_feedback',
    });
    await addParticipant(app, localTrialOrg.admin, id3, p3);

    const launchRes = await authPost(
      app,
      localTrialOrg.admin,
      `/api/v1/assessments/${id3}/launch`,
    );
    expect(launchRes.status).toBe(403);
  });

  // ─── QA-ASS-004 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-004 | P1
   * Scenario: Trial plan max participants is 10; adding 11 and launching returns 403.
   * Participant count is verified at launch-time against the plan's maxParticipants.
   */
  it('QA-ASS-004 | P1 — trial plan blocks launch when participant count exceeds 10', async () => {
    const localTrialOrg = await registerOrg(app, uniqueOrg(ORGS.peakPerformance));

    const assessmentId = await createDraftAssessment(app, localTrialOrg.admin, {
      title: `Over-limit participants ${uid()}`,
      assessmentType: '360_feedback',
    });

    // Add 11 participants (1 over trial limit of 10)
    for (let i = 0; i < 11; i++) {
      const userId = await createUserInOrg(ds, localTrialOrg.id, {
        email: `overlimit-p${i}+${uid()}@example.com`,
        firstName: `Over${i}`, lastName: 'User', role: 'participant', password: 'TestPass1!',
      });
      await addParticipant(app, localTrialOrg.admin, assessmentId, userId);
    }

    // Launch should fail with 403
    const launchRes = await authPost(
      app,
      localTrialOrg.admin,
      `/api/v1/assessments/${assessmentId}/launch`,
    );
    expect(launchRes.status).toBe(403);
  });

  // ─── QA-ASS-005 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-005 | P1
   * Scenario: PATCHing an active (non-draft) assessment returns 400.
   * Once an assessment is launched, its core configuration is locked to
   * preserve data integrity for ongoing participants.
   */
  it('QA-ASS-005 | P1 — PATCH on an active assessment returns 400', async () => {
    const assessmentId = await createDraftAssessment(app, proOrg.admin, {
      title: `Patch-lock test ${uid()}`,
      assessmentType: '360_feedback',
    });
    await addParticipant(app, proOrg.admin, assessmentId, participantIds[0]);
    await launchAssessment(app, proOrg.admin, assessmentId);

    // Attempt PATCH on active assessment — must be 400
    const patchRes = await authPatch(app, proOrg.admin, `/api/v1/assessments/${assessmentId}`, {
      title: 'New Title',
    });
    expect(patchRes.status).toBe(400);
  });

  // ─── QA-ASS-006 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-006 | P1
   * Scenario: Launching an assessment with 0 participants returns 400.
   * An assessment without participants cannot be meaningfully conducted;
   * the engine must guard against empty launches.
   */
  it('QA-ASS-006 | P1 — launching assessment with no participants returns 400', async () => {
    const assessmentId = await createDraftAssessment(app, proOrg.admin, {
      title: `Zero participants test ${uid()}`,
      assessmentType: '360_feedback',
    });

    // No participants added — launch must fail
    const launchRes = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/launch`,
    );
    expect(launchRes.status).toBe(400);
  });

  // ─── QA-ASS-007 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-007 | P2
   * Scenario: Adding the same user twice as a participant returns 400 on the second attempt.
   * Duplicate participants would corrupt response-rate calculations and nomination lists.
   */
  it('QA-ASS-007 | P2 — adding same participant twice returns 400 on second attempt', async () => {
    const assessmentId = await createDraftAssessment(app, proOrg.admin, {
      title: `Duplicate participant test ${uid()}`,
      assessmentType: '360_feedback',
    });

    // First add — should succeed
    await addParticipant(app, proOrg.admin, assessmentId, participantIds[0]);

    // Second add of the same user — should return 400
    const dupRes = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/participants`,
      { userId: participantIds[0] },
    );
    expect(dupRes.status).toBe(400);
  });

  // ─── QA-ASS-008 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-008 | P1
   * Scenario: Trying to close a DRAFT assessment returns 400.
   * The close operation is only valid from the ACTIVE state; closing a draft
   * must be rejected to preserve the correct state machine flow.
   */
  it('QA-ASS-008 | P1 — closing a DRAFT assessment returns 400', async () => {
    const assessmentId = await createDraftAssessment(app, proOrg.admin, {
      title: `Close-draft test ${uid()}`,
      assessmentType: '360_feedback',
    });

    // Try to close without launching first — must be 400
    const closeRes = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/close`,
    );
    expect(closeRes.status).toBe(400);
  });

  // ─── QA-ASS-009 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-009 | P1
   * Scenario: Adding a participant to a CLOSED assessment returns 400.
   * Closed assessments are read-only; no new participants can join after closure.
   */
  it('QA-ASS-009 | P1 — adding participant to closed assessment returns 400', async () => {
    const assessmentId = await createDraftAssessment(app, proOrg.admin, {
      title: `Closed add-participant test ${uid()}`,
      assessmentType: '360_feedback',
    });
    await addParticipant(app, proOrg.admin, assessmentId, participantIds[0]);
    await launchAssessment(app, proOrg.admin, assessmentId);

    // Close the assessment
    await authPost(app, proOrg.admin, `/api/v1/assessments/${assessmentId}/close`).expect(200);

    // Try to add a new participant to the closed assessment
    const addRes = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/participants`,
      { userId: participantIds[1] },
    );
    expect(addRes.status).toBe(400);
  });

  // ─── QA-ASS-010 ─────────────────────────────────────────────────────────

  /**
   * QA-ASS-010 | P1
   * Scenario: Full state machine — draft → active → closed; invalid transitions return 400.
   * Walks through every valid transition and verifies that all backwards/invalid
   * transitions (e.g. launch from active, close from draft, launch from closed)
   * are correctly rejected.
   */
  it('QA-ASS-010 | P1 — full state machine: draft→active→closed; all invalid transitions are 400', async () => {
    const assessmentId = await createDraftAssessment(app, proOrg.admin, {
      title: `State machine test ${uid()}`,
      assessmentType: '360_feedback',
    });
    await addParticipant(app, proOrg.admin, assessmentId, participantIds[2]);

    // State: DRAFT
    // Invalid: close from draft → 400
    const closeFromDraft = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/close`,
    );
    expect(closeFromDraft.status).toBe(400);

    // Valid: launch → ACTIVE
    await launchAssessment(app, proOrg.admin, assessmentId);

    // Verify state = active
    const activeRes = await authGet(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}`,
    ).expect(200);
    expect(activeRes.body.data.status).toBe('active');

    // Invalid: launch again from active → 400
    const relaunchRes = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/launch`,
    );
    expect(relaunchRes.status).toBe(400);

    // Invalid: PATCH from active → 400
    const patchActive = await authPatch(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}`,
      { title: 'Attempted edit' },
    );
    expect(patchActive.status).toBe(400);

    // Valid: close → CLOSED
    const closeRes = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/close`,
    ).expect(200);
    expect(closeRes.body.data.status).toBe('closed');

    // Invalid: launch from closed → 400
    const launchFromClosed = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/launch`,
    );
    expect(launchFromClosed.status).toBe(400);

    // Invalid: close from closed → 400
    const closeAgain = await authPost(
      app,
      proOrg.admin,
      `/api/v1/assessments/${assessmentId}/close`,
    );
    expect(closeAgain.status).toBe(400);
  });
});
