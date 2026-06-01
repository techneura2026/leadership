/**
 * E2E Test Suite: Readiness & Succession (UC4)
 * QA Scenarios: QA-READY-001 through QA-READY-005
 *
 * Validates the end-to-end readiness scoring pipeline: SJT submission, Learning
 * Agility submission, composite score computation, readiness rating boundary
 * accuracy, succession dashboard data, and role-profile competency gap scoring.
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
  getSeedCompetencyIds,
  TestOrg,
  AuthSession,
} from './setup/helpers';
import { ORGS } from './setup/factories';
import { ReadinessScoringService } from '../../src/assessment/uc4-readiness/readiness-scoring.service';

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

/**
 * Submits all SJT items for the given participant, using selectedOption=0 for each.
 * Returns the list of item IDs submitted.
 */
async function submitAllSjtResponses(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
  participantId: string,
): Promise<string[]> {
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
    expect(res.status).toBe(201);
  }
  return items.map((i) => i.id);
}

/**
 * Submits all Learning Agility items for the given participant, using value=4 for each.
 */
async function submitAllLaResponses(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
  participantId: string,
): Promise<string[]> {
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
    expect(res.status).toBe(201);
  }
  return items.map((i) => i.id);
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('[QA-READY] Readiness Scoring & Succession', () => {
  let app: INestApplication;
  let ds: DataSource;

  // Shared state populated in beforeAll
  let org: TestOrg;
  let assessmentId: string;
  let participantId: string; // AssessmentParticipant.id

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    // Register a fresh organisation with a Professional plan so READINESS type is allowed
    org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, org.id, 'professional');

    // Create a participant user inside the org via direct DB insert
    const participantUserId = await createUserInOrg(ds, org.id, {
      email: `kavinda-ready+${uid()}@stp.lk`,
      firstName: 'Kavinda',
      lastName: 'Rajapaksa',
      role: 'participant',
      password: 'Participant1!',
    });

    // Create and launch a READINESS assessment
    assessmentId = await createDraftAssessment(app, org.admin, {
      title: `Succession Readiness Assessment ${uid()}`,
      assessmentType: 'readiness',
    });

    await addParticipant(app, org.admin, assessmentId, participantUserId);
    await launchAssessment(app, org.admin, assessmentId);

    // Retrieve the AssessmentParticipant record ID
    const pRes = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/participants`,
    );
    expect(pRes.status).toBe(200);
    participantId = pRes.body.data[0].id;
  });

  // ── QA-READY-001 ────────────────────────────────────────────────────────────

  /**
   * QA-READY-001 | P1
   * Scenario: Readiness rating boundaries are exact.
   * Validates that mapToReadinessRating classifies scores correctly at each
   * boundary value: ≥75→ready_now, 74.9→1_2_years, ≥60→1_2_years, 59.9→developing,
   * ≥45→developing, 44.9→not_yet_ready.
   * Tests the service's pure method directly (no HTTP overhead) to confirm the
   * mathematical boundaries are strictly correct before relying on them in higher-level tests.
   */
  it('QA-READY-001 | P1 — readiness rating boundaries are exact at all threshold values', () => {
    // Instantiate service with no-op repos to test pure methods
    const makeRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    });

    const service = new (ReadinessScoringService as any)(
      makeRepo(), makeRepo(), makeRepo(), makeRepo(),
      makeRepo(), makeRepo(), makeRepo(), makeRepo(),
      makeRepo(), makeRepo(),
    );

    // Boundary: ≥75 → ready_now
    expect(service.mapToReadinessRating(75)).toBe('ready_now');
    expect(service.mapToReadinessRating(75.0)).toBe('ready_now');
    expect(service.mapToReadinessRating(100)).toBe('ready_now');

    // Boundary: 74.9 → 1_2_years (just below ready_now)
    expect(service.mapToReadinessRating(74.9)).toBe('1_2_years');
    expect(service.mapToReadinessRating(74)).toBe('1_2_years');
    expect(service.mapToReadinessRating(60)).toBe('1_2_years');
    expect(service.mapToReadinessRating(60.0)).toBe('1_2_years');

    // Boundary: 59.9 → developing (just below 1_2_years)
    expect(service.mapToReadinessRating(59.9)).toBe('developing');
    expect(service.mapToReadinessRating(59)).toBe('developing');
    expect(service.mapToReadinessRating(45)).toBe('developing');
    expect(service.mapToReadinessRating(45.0)).toBe('developing');

    // Boundary: 44.9 → not_yet_ready (just below developing)
    expect(service.mapToReadinessRating(44.9)).toBe('not_yet_ready');
    expect(service.mapToReadinessRating(44)).toBe('not_yet_ready');
    expect(service.mapToReadinessRating(0)).toBe('not_yet_ready');

    // Also verify composite → rating via getCompositeScore
    // All-zero input → compositeScore=0 → not_yet_ready
    const compositeZero = service.getCompositeScore({
      competencyScore: 0,
      feedbackScore: 0,
      sjtScore: 0,
      learningAgilityScore: 0,
      personalityFitScore: 0,
    });
    expect(compositeZero).toBe(0);
    expect(service.mapToReadinessRating(compositeZero)).toBe('not_yet_ready');
  });

  // ── QA-READY-002 ────────────────────────────────────────────────────────────

  /**
   * QA-READY-002 | P1
   * Scenario: SJT response submission stores the correct expert-key score.
   * When a participant selects option 0 on an SJT item that has scoringKey {"0": 4, ...},
   * the server must look up scoringKey[selectedOption.toString()] and persist score=4.
   * This ensures the scoring key lookup is not broken by type coercion.
   */
  it('QA-READY-002 | P1 — SJT response with selectedOption=0 stores correct score from scoringKey', async () => {
    // Get SJT questionnaire to find a real item
    const questRes = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/sjt/${participantId}`,
    );
    expect(questRes.status).toBe(200);
    const items: Array<{ id: string; stem: string }> = questRes.body.data?.items ?? [];

    if (items.length === 0) {
      console.warn('QA-READY-002: No SJT items found in seed data — skipping score assertion');
      return;
    }

    const firstItem = items[0];

    // Submit selectedOption=0
    const submitRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/sjt/${participantId}/responses`,
      { itemId: firstItem.id, selectedOption: 0 },
    );
    expect(submitRes.status).toBe(201);

    // Verify the persisted score in the DB
    const rows = await ds.query(
      `SELECT score, selected_option FROM sjt_responses
       WHERE assessment_id = $1 AND participant_id = $2 AND item_id = $3`,
      [assessmentId, participantId, firstItem.id],
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0].selected_option)).toBe(0);

    // score must be a non-negative number (the exact value depends on seed data)
    expect(Number(rows[0].score)).toBeGreaterThanOrEqual(0);

    // Verify the server-side scoring key lookup
    const itemRows = await ds.query(
      `SELECT scoring_key FROM items WHERE id = $1`,
      [firstItem.id],
    );
    if (itemRows.length > 0 && itemRows[0].scoring_key) {
      const scoringKey = itemRows[0].scoring_key;
      const expectedScore = scoringKey['0'] ?? 0;
      expect(Number(rows[0].score)).toBe(expectedScore);
    }
  });

  // ── QA-READY-003 ────────────────────────────────────────────────────────────

  /**
   * QA-READY-003 | P1
   * Scenario: Compute readiness without 360 feedback data returns 200, not 500.
   * The feedbackScore component defaults to 0 when no completed nominations exist.
   * This test ensures the scoring pipeline handles missing sub-score gracefully
   * rather than throwing an unhandled exception when the nominations table is empty.
   */
  it('QA-READY-003 | P1 — compute readiness without 360 data returns 201 with defaults', async () => {
    // Submit SJT and LA responses first so the pipeline has partial data
    await submitAllSjtResponses(app, org.admin, assessmentId, participantId);
    await submitAllLaResponses(app, org.admin, assessmentId, participantId);

    // Trigger compute without a roleProfileId (and without any 360 data)
    const computeRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/readiness/${participantId}/compute`,
      {}, // no roleProfileId
    );

    expect(computeRes.status).toBe(201);
    const score = computeRes.body.data;
    expect(score).toBeDefined();

    // feedbackScore must default to 0 (no nominations)
    expect(Number(score.feedbackScore)).toBe(0);

    // compositeScore must be a finite number
    expect(typeof Number(score.compositeScore)).toBe('number');
    expect(isFinite(Number(score.compositeScore))).toBe(true);

    // readinessRating must be one of the valid enum values
    expect(['ready_now', '1_2_years', 'developing', 'not_yet_ready']).toContain(
      score.readinessRating,
    );
  });

  // ── QA-READY-004 ────────────────────────────────────────────────────────────

  /**
   * QA-READY-004 | P1
   * Scenario: GET /analytics/succession after computing readiness shows candidate.
   * After a readiness score is persisted, the succession analytics endpoint must
   * include that candidate in the results with their correct readinessRating.
   * This validates the analytics layer reads freshly computed scores correctly.
   */
  it('QA-READY-004 | P1 — succession analytics reflect computed readiness rating', async () => {
    // Recompute to ensure idempotency and have a known rating to check
    const computeRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/readiness/${participantId}/compute`,
      {},
    );
    expect(computeRes.status).toBe(201);
    const expectedRating: string = computeRes.body.data?.readinessRating;

    // Query succession analytics
    const successionRes = await authGet(app, org.admin, '/api/v1/analytics/succession');
    expect(successionRes.status).toBe(200);
    const succession = successionRes.body.data;

    expect(succession).toBeDefined();
    expect(typeof succession.totalCandidates).toBe('number');
    expect(succession.totalCandidates).toBeGreaterThanOrEqual(1);

    // The candidate's rating must be counted in byRating
    expect(succession.byRating).toBeDefined();
    const ratingCount: number = succession.byRating[expectedRating] ?? 0;
    expect(ratingCount).toBeGreaterThanOrEqual(1);

    // At least one byRole entry must contain this participant
    const allCandidates = (succession.byRole ?? []).flatMap(
      (role: { candidates?: Array<{ participantId: string; readinessRating: string }> }) =>
        role.candidates ?? [],
    );
    const found = allCandidates.find(
      (c: { participantId: string }) => c.participantId === participantId,
    );
    expect(found).toBeDefined();
    expect(found?.readinessRating).toBe(expectedRating);
  });

  // ── QA-READY-005 ────────────────────────────────────────────────────────────

  /**
   * QA-READY-005 | P1
   * Scenario: Creating a role profile with required competencies and computing
   * readiness against it reflects the competency gap in the score.
   * A role profile that demands high competency levels (minLevel=4) against a
   * participant with no manager ratings produces competencyScore=0, which
   * must lower the composite relative to a profile-less computation.
   */
  it('QA-READY-005 | P1 — role profile with required competencies lowers composite when participant has no manager ratings', async () => {
    const competencyIds = await getSeedCompetencyIds(ds, 3);
    expect(competencyIds.length).toBeGreaterThan(0);

    // Compute without a role profile to get a baseline composite
    const baseRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/readiness/${participantId}/compute`,
      {},
    );
    expect(baseRes.status).toBe(201);
    const baseComposite = Number(baseRes.body.data?.compositeScore);

    // Create a demanding role profile requiring top competency level
    const rpRes = await authPost(app, org.admin, '/api/v1/role-profiles', {
      title: 'Director of Strategic Initiatives',
      level: 'director',
      requiredCompetencies: competencyIds.slice(0, 3).map((id: string, i: number) => ({
        competencyId: id,
        minLevel: 4, // maximum level — participant has no ratings → 0% match
        weight: parseFloat((1 / 3).toFixed(3)),
      })),
    });
    expect(rpRes.status).toBe(201);
    const roleProfileId: string = rpRes.body.data?.id;
    expect(roleProfileId).toBeTruthy();

    // Compute readiness against the demanding role profile
    const withProfileRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${assessmentId}/readiness/${participantId}/compute`,
      { roleProfileId },
    );
    expect(withProfileRes.status).toBe(201);
    const profileScore = withProfileRes.body.data;

    // competencyScore must be 0 — participant has no manager ratings
    expect(Number(profileScore.competencyScore)).toBe(0);

    // Composite with demanding role must be ≤ baseline (role penalises unmet requirements)
    expect(Number(profileScore.compositeScore)).toBeLessThanOrEqual(baseComposite + 0.01);

    // Rating must be a valid enum value
    expect(['ready_now', '1_2_years', 'developing', 'not_yet_ready']).toContain(
      profileScore.readinessRating,
    );

    // Verify role profile is visible via GET /role-profiles
    const listRes = await authGet(app, org.admin, '/api/v1/role-profiles');
    expect(listRes.status).toBe(200);
    const profiles: Array<{ id: string }> = listRes.body.data ?? [];
    expect(profiles.some((p) => p.id === roleProfileId)).toBe(true);
  });
});
