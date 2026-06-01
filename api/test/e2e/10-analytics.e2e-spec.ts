/**
 * E2E Test Suite: Analytics
 * QA Scenarios: QA-ANA-001 through QA-ANA-003
 *
 * Validates tenant-isolated analytics: the dashboard counts are scoped to the
 * calling organisation, the competency heatmap returns average scores per
 * competency, and a fresh org with no data returns zero-value metrics.
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

describe('[QA-ANA] Analytics', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();
  });

  // ── QA-ANA-001 ────────────────────────────────────────────────────────────

  /**
   * QA-ANA-001 | P1
   * Scenario: Dashboard activeAssessments count is scoped to the calling org.
   * orgA has 3 launched assessments and orgB has 1. When orgA calls
   * GET /analytics/dashboard, it must see activeAssessments=3, not 4.
   * This is the primary tenant isolation assertion for the analytics layer.
   */
  it('QA-ANA-001 | P1 — dashboard activeAssessments counts only the calling org\'s active assessments', async () => {
    // ── Set up orgA ────────────────────────────────────────────────────────
    const orgA = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, orgA.id, 'professional');

    // Create a participant user in orgA
    const userAId = await createUserInOrg(ds, orgA.id, {
      email: `kavinda-ana001a+${uid()}@stp.lk`,
      firstName: 'Kavinda',
      lastName: 'Rajapaksa',
      role: 'participant',
      password: 'Participant1!',
    });

    // Create and launch 3 assessments in orgA
    for (let i = 1; i <= 3; i++) {
      const asmId = await createDraftAssessment(app, orgA.admin, {
        title: `OrgA Personality Assessment ${i} ${uid()}`,
        assessmentType: 'personality',
      });
      await addParticipant(app, orgA.admin, asmId, userAId);
      await launchAssessment(app, orgA.admin, asmId);
    }

    // ── Set up orgB ────────────────────────────────────────────────────────
    const orgB = await registerOrg(app, uniqueOrg(ORGS.nexusLeadership));
    await setOrgPlan(ds, orgB.id, 'professional');

    const userBId = await createUserInOrg(ds, orgB.id, {
      email: `pradeep-ana001b+${uid()}@nexus.lk`,
      firstName: 'Pradeep',
      lastName: 'Kariyawasam',
      role: 'participant',
      password: 'Participant1!',
    });

    // Create and launch 1 assessment in orgB
    const asmBId = await createDraftAssessment(app, orgB.admin, {
      title: `OrgB Assessment ${uid()}`,
      assessmentType: 'personality',
    });
    await addParticipant(app, orgB.admin, asmBId, userBId);
    await launchAssessment(app, orgB.admin, asmBId);

    // ── Assert orgA dashboard ──────────────────────────────────────────────
    const dashRes = await authGet(app, orgA.admin, '/api/v1/analytics/dashboard');
    expect(dashRes.status).toBe(200);
    const dashboard = dashRes.body.data;

    expect(dashboard).toBeDefined();
    expect(dashboard.activeAssessments).toBe(3);

    // Must NOT include orgB's active assessment
    expect(dashboard.activeAssessments).not.toBe(4);
  });

  // ── QA-ANA-002 ────────────────────────────────────────────────────────────

  /**
   * QA-ANA-002 | P1
   * Scenario: Competency heatmap returns average scores per competency.
   * A competency assessment with manager ratings of 3 for all competencies
   * produces a heatmap where each entry's averageScore is approximately 3
   * (on the 1-4 scale), confirming the aggregation is correct.
   */
  it('QA-ANA-002 | P1 — competency heatmap averageScore reflects submitted ratings', async () => {
    const org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, org.id, 'professional');

    // Create participant user
    const userId = await createUserInOrg(ds, org.id, {
      email: `kavinda-ana002+${uid()}@stp.lk`,
      firstName: 'Kavinda',
      lastName: 'Rajapaksa',
      role: 'participant',
      password: 'Participant1!',
    });

    // Create and launch competency assessment
    const asmId = await createDraftAssessment(app, org.admin, {
      title: `Competency Heatmap ${uid()}`,
      assessmentType: 'competency',
    });

    await addParticipant(app, org.admin, asmId, userId);
    await launchAssessment(app, org.admin, asmId);

    // Retrieve participant ID
    const pRes = await authGet(app, org.admin, `/api/v1/assessments/${asmId}/participants`);
    const participantId: string = pRes.body.data[0].id;

    // Get seed competency IDs
    const competencyIds = await getSeedCompetencyIds(ds, 5);
    if (competencyIds.length === 0) {
      console.warn('QA-ANA-002: No seed competencies found — skipping heatmap assertion');
      return;
    }

    const ratings = competencyIds.slice(0, 5).map((competencyId: string) => ({
      competencyId,
      levelRated: 3,
      evidenceText: 'Consistent demonstration observed at this level.',
    }));

    // Start self-assessment and submit ratings
    const selfStartRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asmId}/competency/self`,
      { participantId },
    );
    expect(selfStartRes.status).toBe(201);
    const selfCaId: string = selfStartRes.body.data?.id;

    await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asmId}/competency/self/${selfCaId}/submit`,
      { participantId, ratings },
    );

    // Start manager assessment and submit ratings
    const managerStartRes = await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asmId}/competency/manager`,
      { participantId },
    );
    expect(managerStartRes.status).toBe(201);
    const managerCaId: string = managerStartRes.body.data?.id;

    await authPost(
      app,
      org.admin,
      `/api/v1/assessments/${asmId}/competency/manager/${managerCaId}/submit`,
      { ratings },
    );

    // Fetch the heatmap
    const heatmapRes = await authGet(
      app,
      org.admin,
      `/api/v1/analytics/heatmap?assessmentId=${asmId}`,
    );
    expect(heatmapRes.status).toBe(200);
    const heatmap: Array<{
      competencyId: string;
      averageScore: number;
      participantCount: number;
    }> = heatmapRes.body.data ?? [];

    // Must have at least one entry
    expect(heatmap.length).toBeGreaterThan(0);

    // Every entry must have averageScore ≈ 3 (we submitted 3 for all)
    for (const entry of heatmap) {
      expect(Number(entry.averageScore)).toBeCloseTo(3, 0); // within ±0.5
      expect(Number(entry.participantCount)).toBeGreaterThanOrEqual(1);
    }
  });

  // ── QA-ANA-003 ────────────────────────────────────────────────────────────

  /**
   * QA-ANA-003 | P1
   * Scenario: A fresh organisation with no data returns HTTP 200 with all numeric
   * fields equal to 0.
   * Validates that the analytics service handles zero-data orgs gracefully
   * without returning nulls, undefined, or HTTP errors.
   */
  it('QA-ANA-003 | P1 — fresh org with no data returns 200 with all zeros', async () => {
    const org = await registerOrg(app, uniqueOrg(ORGS.nexusLeadership));

    const dashRes = await authGet(app, org.admin, '/api/v1/analytics/dashboard');
    expect(dashRes.status).toBe(200);
    const dashboard = dashRes.body.data;

    expect(dashboard).toBeDefined();

    // All numeric counters must be 0
    expect(dashboard.activeAssessments).toBe(0);
    expect(dashboard.totalParticipants).toBe(0);
    expect(dashboard.reportsGenerated).toBe(0);
    expect(dashboard.pendingResponses).toBe(0);

    // assessmentsByType and assessmentsByStatus must be objects (possibly empty)
    expect(typeof dashboard.assessmentsByType).toBe('object');
    expect(typeof dashboard.assessmentsByStatus).toBe('object');
  });
});
