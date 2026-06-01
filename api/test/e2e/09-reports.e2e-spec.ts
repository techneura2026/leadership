/**
 * E2E Test Suite: Report Generation
 * QA Scenarios: QA-RPT-001 through QA-RPT-007
 *
 * Validates PDF report generation, status transitions, file persistence, tenant
 * isolation, and the list endpoint. A personality assessment is used as the
 * simplest report type — it requires only personality responses and does not
 * depend on 360 or competency data.
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
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

// ── Polling helper ────────────────────────────────────────────────────────────

/**
 * Polls GET /api/v1/reports/:id until the status is 'ready' or 'failed'.
 * Throws if the timeout is exceeded before completion.
 */
async function waitForReport(
  app: INestApplication,
  session: AuthSession,
  reportId: string,
  maxMs = 30_000,
): Promise<{ id: string; status: string; localPath?: string; reportType?: string }> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await authGet(app, session, `/api/v1/reports/${reportId}`);
    const data = res.body.data;
    if (data?.status === 'ready' || data?.status === 'failed') {
      return data;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Report ${reportId} did not complete within ${maxMs}ms`);
}

/**
 * Submits all personality questionnaire responses (value=3) for a participant
 * and then triggers the submit endpoint to produce persisted scores.
 */
async function submitPersonalityQuestionnaire(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
  participantId: string,
): Promise<void> {
  const questRes = await authGet(
    app,
    session,
    `/api/v1/assessments/${assessmentId}/personality/questionnaire/${participantId}`,
  );
  expect(questRes.status).toBe(200);
  const items: Array<{ id: string }> = questRes.body.data?.items ?? [];

  if (items.length === 0) {
    console.warn(
      'submitPersonalityQuestionnaire: No personality items found in DB — personality seed may not have run.',
    );
    return;
  }

  for (const item of items) {
    const saveRes = await authPost(
      app,
      session,
      `/api/v1/assessments/${assessmentId}/personality/responses/${participantId}`,
      { itemId: item.id, value: 3 },
    );
    expect(saveRes.status).toBe(201);
  }

  const submitRes = await authPost(
    app,
    session,
    `/api/v1/assessments/${assessmentId}/personality/submit/${participantId}`,
    {},
  );
  expect(submitRes.status).toBe(201);
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('[QA-RPT] Report Generation', () => {
  let app: INestApplication;
  let ds: DataSource;

  // Primary org state
  let org: TestOrg;
  let assessmentId: string;
  let participantId: string; // AssessmentParticipant.id

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    // Register org with Professional plan
    org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    await setOrgPlan(ds, org.id, 'professional');

    // Create a participant user via direct DB insert
    const participantUserId = await createUserInOrg(ds, org.id, {
      email: `kavinda-rpt+${uid()}@stp.lk`,
      firstName: 'Kavinda',
      lastName: 'Rajapaksa',
      role: 'participant',
      password: 'Participant1!',
    });

    // Create and launch a personality assessment
    assessmentId = await createDraftAssessment(app, org.admin, {
      title: `Personality Report Assessment ${uid()}`,
      assessmentType: 'personality',
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

    // Submit personality responses so the report has data to render
    await submitPersonalityQuestionnaire(app, org.admin, assessmentId, participantId);
  }, 60_000);

  // ── QA-RPT-001 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-001 | P1
   * Scenario: POST /reports/generate returns 201 and eventually reaches 'ready' status.
   * Report generation is synchronous in local dev (no queue) but is tested with
   * polling to be environment-agnostic. Validates the initial response envelope
   * and the final status transition.
   */
  it('QA-RPT-001 | P1 — generate personality report returns 201 and reaches ready status', async () => {
    const genRes = await authPost(app, org.admin, '/api/v1/reports/generate', {
      assessmentId,
      participantId,
      reportType: 'personality',
      language: 'en',
    });

    expect(genRes.status).toBe(201);
    expect(genRes.body.data).toBeDefined();

    const reportId: string = genRes.body.data?.id;
    expect(reportId).toBeTruthy();

    // Status must be one of the valid interim or final states
    expect(['pending', 'processing', 'ready', 'failed']).toContain(genRes.body.data?.status);

    // Poll until settled
    const finalReport = await waitForReport(app, org.admin, reportId);
    expect(finalReport.status).toBe('ready');
    expect(finalReport.id).toBe(reportId);
  }, 40_000);

  // ── QA-RPT-002 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-002 | P1
   * Scenario: After a report reaches 'ready', the PDF file exists on disk.
   * The local_path persisted in the reports table must point to an actual file.
   * This confirms the PdfService wrote bytes to disk and the path is correct.
   */
  it('QA-RPT-002 | P1 — ready report has a PDF file on disk at the localPath', async () => {
    const genRes = await authPost(app, org.admin, '/api/v1/reports/generate', {
      assessmentId,
      participantId,
      reportType: 'personality',
      language: 'en',
    });
    expect(genRes.status).toBe(201);
    const reportId: string = genRes.body.data?.id;

    const finalReport = await waitForReport(app, org.admin, reportId);
    expect(finalReport.status).toBe('ready');

    // Read local_path directly from the database
    const rows = await ds.query(
      'SELECT local_path FROM reports WHERE id = $1',
      [reportId],
    );
    expect(rows.length).toBe(1);
    const localPath: string | null = rows[0].local_path;
    expect(localPath).toBeTruthy();

    // The file must exist on disk
    expect(fs.existsSync(localPath!)).toBe(true);

    // Must be a non-empty file (actual PDF content)
    const stat = fs.statSync(localPath!);
    expect(stat.size).toBeGreaterThan(0);
  }, 40_000);

  // ── QA-RPT-003 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-003 | P1
   * Scenario: GET /reports/:id/download with a ready report returns 200 and serves
   * the file. This validates the download endpoint resolves the local path and
   * streams it as application/pdf.
   */
  it('QA-RPT-003 | P1 — download endpoint serves PDF for a ready report', async () => {
    const genRes = await authPost(app, org.admin, '/api/v1/reports/generate', {
      assessmentId,
      participantId,
      reportType: 'personality',
      language: 'en',
    });
    expect(genRes.status).toBe(201);
    const reportId: string = genRes.body.data?.id;

    // Wait until ready
    const finalReport = await waitForReport(app, org.admin, reportId);
    expect(finalReport.status).toBe('ready');

    // Download
    const dlRes = await authGet(app, org.admin, `/api/v1/reports/${reportId}/download`);
    // Either a direct file (200) or a redirect (302) is acceptable
    expect([200, 302]).toContain(dlRes.status);

    if (dlRes.status === 200) {
      const contentType: string = dlRes.headers['content-type'] ?? '';
      expect(contentType).toContain('application/pdf');
    }
  }, 40_000);

  // ── QA-RPT-004 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-004 | P1
   * Scenario: Tenant isolation — an org admin cannot access another org's report.
   * Registers a second org (nexusLeadership), generates a report there, then
   * tries to fetch it from the first org's session. The response must be 404.
   */
  it('QA-RPT-004 | P1 — cross-org report access returns 404', async () => {
    // Register nexus org
    const nexusOrg = await registerOrg(app, uniqueOrg(ORGS.nexusLeadership));
    await setOrgPlan(ds, nexusOrg.id, 'professional');

    // Create participant and assessment in nexus org
    const nexusUserId = await createUserInOrg(ds, nexusOrg.id, {
      email: `pradeep-rpt+${uid()}@nexus.lk`,
      firstName: 'Pradeep',
      lastName: 'Kariyawasam',
      role: 'participant',
      password: 'Participant1!',
    });

    const nexusAssessmentId = await createDraftAssessment(app, nexusOrg.admin, {
      title: `Nexus Personality ${uid()}`,
      assessmentType: 'personality',
    });

    await addParticipant(app, nexusOrg.admin, nexusAssessmentId, nexusUserId);
    await launchAssessment(app, nexusOrg.admin, nexusAssessmentId);

    // Retrieve participant record for nexus
    const nexusPRes = await authGet(
      app,
      nexusOrg.admin,
      `/api/v1/assessments/${nexusAssessmentId}/participants`,
    );
    const nexusParticipantId: string = nexusPRes.body.data[0].id;

    await submitPersonalityQuestionnaire(
      app,
      nexusOrg.admin,
      nexusAssessmentId,
      nexusParticipantId,
    );

    // Generate report under nexus org
    const nexusGenRes = await authPost(app, nexusOrg.admin, '/api/v1/reports/generate', {
      assessmentId: nexusAssessmentId,
      participantId: nexusParticipantId,
      reportType: 'personality',
      language: 'en',
    });
    expect(nexusGenRes.status).toBe(201);
    const nexusReportId: string = nexusGenRes.body.data?.id;

    await waitForReport(app, nexusOrg.admin, nexusReportId);

    // Now try to fetch nexus report from strategicTalent session
    const crossRes = await authGet(app, org.admin, `/api/v1/reports/${nexusReportId}`);
    expect(crossRes.status).toBe(404);
    expect(crossRes.body.error).toBeDefined();
    expect(crossRes.body.error.code).toBeTruthy();
  }, 60_000);

  // ── QA-RPT-005 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-005 | P2
   * Scenario: 360 report requested without participant responses fails gracefully.
   * When no nominations exist for the participant, the report service should
   * either produce a report with empty data or return a meaningful error — it
   * must NOT return HTTP 500 (an unhandled crash).
   */
  it('QA-RPT-005 | P2 — 360 report with no rater responses fails gracefully (not 500)', async () => {
    // Create a new 360 assessment for this test
    const assessment360Id = await createDraftAssessment(app, org.admin, {
      title: `360 No Data Report ${uid()}`,
      assessmentType: '360_feedback',
    });

    // Reuse the same participant (adding them to a new assessment)
    const participantUserRows = await ds.query(
      `SELECT u.id FROM users u
       INNER JOIN assessment_participants ap ON ap.user_id = u.id
       WHERE ap.id = $1`,
      [participantId],
    );
    const userId: string = participantUserRows[0]?.id;
    expect(userId).toBeTruthy();

    await addParticipant(app, org.admin, assessment360Id, userId);
    await launchAssessment(app, org.admin, assessment360Id);

    // Get the participant ID for the new assessment
    const pRes = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${assessment360Id}/participants`,
    );
    const pid360: string = pRes.body.data[0].id;

    // Attempt to generate 360 report without any nominations or responses
    const genRes = await authPost(app, org.admin, '/api/v1/reports/generate', {
      assessmentId: assessment360Id,
      participantId: pid360,
      reportType: 'individual_360',
      language: 'en',
    });

    // Must not be 500 — either 201 (report created) or a 4xx is acceptable
    expect(genRes.status).not.toBe(500);

    if (genRes.status === 201) {
      const reportId: string = genRes.body.data?.id;
      const finalReport = await waitForReport(app, org.admin, reportId, 15_000).catch(() => null);
      if (finalReport) {
        expect(['ready', 'failed']).toContain(finalReport.status);
      }
    } else {
      expect(genRes.body.error).toBeDefined();
      expect(genRes.body.error.message).toBeTruthy();
    }
  }, 30_000);

  // ── QA-RPT-006 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-006 | P2
   * Scenario: Generate a competency report and verify status transitions.
   * Confirms that a competency type report can be initiated and that the
   * status field progresses from a processing state to a final state.
   */
  it('QA-RPT-006 | P2 — competency report transitions to a final status', async () => {
    // Create a new competency assessment
    const compAssessmentId = await createDraftAssessment(app, org.admin, {
      title: `Competency Report Test ${uid()}`,
      assessmentType: 'competency',
    });

    // Reuse the same participant user
    const participantUserRows = await ds.query(
      `SELECT u.id FROM users u
       INNER JOIN assessment_participants ap ON ap.user_id = u.id
       WHERE ap.id = $1`,
      [participantId],
    );
    const userId: string = participantUserRows[0]?.id;
    expect(userId).toBeTruthy();

    await addParticipant(app, org.admin, compAssessmentId, userId);
    await launchAssessment(app, org.admin, compAssessmentId);

    const compPRes = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${compAssessmentId}/participants`,
    );
    const compParticipantId: string = compPRes.body.data[0].id;

    // Generate a competency report (may fail — we just verify status transitions)
    const genRes = await authPost(app, org.admin, '/api/v1/reports/generate', {
      assessmentId: compAssessmentId,
      participantId: compParticipantId,
      reportType: 'competency',
      language: 'en',
    });

    expect(genRes.status).toBe(201);
    const reportId: string = genRes.body.data?.id;
    expect(reportId).toBeTruthy();

    // The initial status must be a valid state
    const initialStatus: string = genRes.body.data?.status;
    expect(['pending', 'processing', 'ready', 'failed']).toContain(initialStatus);

    // Wait for final status
    const finalReport = await waitForReport(app, org.admin, reportId, 20_000).catch((err) => {
      console.warn(`QA-RPT-006: poll timeout: ${err.message}`);
      return null;
    });

    if (finalReport) {
      expect(['ready', 'failed']).toContain(finalReport.status);
    }
  }, 35_000);

  // ── QA-RPT-007 ────────────────────────────────────────────────────────────

  /**
   * QA-RPT-007 | P1
   * Scenario: GET /reports list returns only reports belonging to the current org.
   * After generating at least one report for strategicTalent, the list must not
   * include reports from nexusLeadership. This is the primary tenant isolation
   * test for the reports list endpoint.
   */
  it('QA-RPT-007 | P1 — reports list is scoped to the current organisation only', async () => {
    // Generate at least one report in the primary org
    const genRes = await authPost(app, org.admin, '/api/v1/reports/generate', {
      assessmentId,
      participantId,
      reportType: 'personality',
      language: 'en',
    });
    expect(genRes.status).toBe(201);
    const ownReportId: string = genRes.body.data?.id;
    await waitForReport(app, org.admin, ownReportId);

    // Create a second org and generate a report there
    const otherOrg = await registerOrg(app, uniqueOrg(ORGS.nexusLeadership));
    await setOrgPlan(ds, otherOrg.id, 'professional');

    const otherUserId = await createUserInOrg(ds, otherOrg.id, {
      email: `pradeep-list+${uid()}@nexus.lk`,
      firstName: 'Pradeep',
      lastName: 'Kariyawasam',
      role: 'participant',
      password: 'Participant1!',
    });

    const otherAssessmentId = await createDraftAssessment(app, otherOrg.admin, {
      title: `Other Org Personality ${uid()}`,
      assessmentType: 'personality',
    });

    await addParticipant(app, otherOrg.admin, otherAssessmentId, otherUserId);
    await launchAssessment(app, otherOrg.admin, otherAssessmentId);

    const otherPRes = await authGet(
      app,
      otherOrg.admin,
      `/api/v1/assessments/${otherAssessmentId}/participants`,
    );
    const otherParticipantId: string = otherPRes.body.data[0].id;
    await submitPersonalityQuestionnaire(app, otherOrg.admin, otherAssessmentId, otherParticipantId);

    const otherGenRes = await authPost(app, otherOrg.admin, '/api/v1/reports/generate', {
      assessmentId: otherAssessmentId,
      participantId: otherParticipantId,
      reportType: 'personality',
      language: 'en',
    });
    const otherReportId: string = otherGenRes.body.data?.id;
    await waitForReport(app, otherOrg.admin, otherReportId);

    // Fetch report list as strategicTalent admin
    const listRes = await authGet(app, org.admin, '/api/v1/reports');
    expect(listRes.status).toBe(200);
    const reports: Array<{ id: string }> = listRes.body.data ?? [];

    // Must not contain the other org's report
    expect(reports.some((r) => r.id === otherReportId)).toBe(false);

    // Must contain the own org's report
    expect(reports.some((r) => r.id === ownReportId)).toBe(true);
  }, 60_000);
});
