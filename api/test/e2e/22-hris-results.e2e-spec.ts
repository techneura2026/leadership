/**
 * E2E: HRIS results export — GET /integrations/hris/results and /framework (plan Task 12).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authPost, getSeedCompetencyIds, login, req, AuthSession, TestOrg } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';

async function setPassword(ds: DataSource, orgId: string, ref: string, password: string): Promise<string> {
  const bcrypt = require('bcrypt');
  const rows = await ds.query(
    `UPDATE users SET password_hash = $1 WHERE organisation_id = $2 AND external_ref = $3 RETURNING email`,
    [await bcrypt.hash(password, 4), orgId, ref],
  );
  return rows[0][0]?.email ?? rows[0].email;
}

describe('[HRIS-RES] results export', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;
  let competencyIds: string[];
  let competencyAssessmentId: string;
  let feedbackAssessmentId: string;
  let reportSession: AuthSession;
  let managerSession: AuthSession;

  const getResults = (k: string, query: string) => req(app).get(`/api/v1/integrations/hris/results?${query}`).set('X-Api-Key', k);
  const tokens = async (relationship: string) =>
    (await ds.query(
      `SELECT token FROM rater_nominations WHERE assessment_id = $1 AND relationship = $2 ORDER BY rater_email`,
      [feedbackAssessmentId, relationship],
    )).map((r: any) => r.token);
  /** Current rater flow: per-competency behaviour ratings (1–5, averaged), then the overall submission. */
  const rate = async (token: string, score: number) => {
    for (const competencyId of competencyIds) {
      const behaviours = await ds.query(`SELECT id FROM competency_behaviours WHERE competency_id = $1`, [competencyId]);
      await req(app).post(`/api/v1/rater/${token}/responses`).send({
        competencyId,
        ratings: behaviours.map((b: any) => ({ behaviourId: b.id, score })),
        comment: '',
      }).expect(201);
    }
    await req(app).post(`/api/v1/rater/${token}/overall`).send({ overallRating: 7 }).expect(201);
  };

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org, key } = await setupHrisOrg(app, ds, ['M-1', 'R-1', 'R-2']));
    competencyIds = await getSeedCompetencyIds(ds, 2);

    const res = await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef: '2027-H1',
      title: 'H1 2027',
      types: ['competency', '360_feedback'],
      startDate: '2027-01-01',
      endDate: '2027-06-30',
      employeeRefs: ['R-1', 'R-2'],
      competencyIds,
      raters: { 'R-1': [1, 2, 3].map((i) => ({ email: `peer${i}@clientorg.lk`, name: `Peer ${i}`, relationship: 'peer' })) },
    }).expect(201);
    competencyAssessmentId = res.body.data.assessments[0].assessmentId;
    feedbackAssessmentId = res.body.data.assessments[1].assessmentId;

    reportSession = await login(app, await setPassword(ds, org.id, 'R-1', 'Report2026!'), 'Report2026!');
    managerSession = await login(app, await setPassword(ds, org.id, 'M-1', 'Manager2026!'), 'Manager2026!');

    const participantId = (await ds.query(
      `SELECT p.id FROM assessment_participants p JOIN users u ON u.id = p.user_id WHERE p.assessment_id = $1 AND u.external_ref = 'R-1'`,
      [competencyAssessmentId],
    ))[0].id;
    const self = await authPost(app, reportSession, `/api/v1/assessments/${competencyAssessmentId}/competency/self`, { participantId });
    await authPost(app, reportSession, `/api/v1/assessments/${competencyAssessmentId}/competency/self/${self.body.data.id}/submit`, {
      participantId,
      ratings: competencyIds.map((id) => ({ competencyId: id, levelRated: 3 })),
    }).expect((r) => expect([200, 201]).toContain(r.status));
    const mgr = await authPost(app, managerSession, `/api/v1/assessments/${competencyAssessmentId}/competency/manager`, { participantId });
    await authPost(app, managerSession, `/api/v1/assessments/${competencyAssessmentId}/competency/manager/${mgr.body.data.id}/submit`, {
      ratings: competencyIds.map((id) => ({ competencyId: id, levelRated: 2, evidenceText: 'Delivered the platform migration' })),
    }).expect((r) => expect([200, 201]).toContain(r.status));
  });

  it('framework lists seeded competencies with 4 levels', async () => {
    const res = await req(app).get('/api/v1/integrations/hris/framework').set('X-Api-Key', key).expect(200);
    const comps = res.body.data.domains.flatMap((d: any) => d.competencies);
    expect(comps.length).toBeGreaterThan(0);
    expect(comps.find((c: any) => c.competencyRef === competencyIds[0]).levels).toHaveLength(4);
    expect(Array.isArray(res.body.data.roleProfiles)).toBe(true);
  });

  it('single-employee result has competency levels and status in_progress', async () => {
    const res = await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200);
    const r = res.body.data;
    expect(r).toMatchObject({ employeeRef: 'R-1', cycleRef: '2027-H1', status: 'in_progress' });
    expect(r.assessmentIds.sort()).toEqual([competencyAssessmentId, feedbackAssessmentId].sort());
    expect(r.competency.scaleMax).toBe(4);
    expect(r.competency.items).toHaveLength(2);
    expect(r.competency.items[0]).toMatchObject({ selfLevel: 3, managerLevel: 2, gapSelfVsManager: -1, managerEvidence: 'Delivered the platform migration' });
    expect(r.competency.summary.managerAvgPct).toBe(50);
  });

  it('360 with only 2 completed raters returns insufficient_raters and no numbers', async () => {
    const peerTokens = await tokens('peer');
    await rate(peerTokens[0], 4);
    await rate(peerTokens[1], 4);
    const res = await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200);
    expect(res.body.data.feedback360).toEqual({ status: 'insufficient_raters', minRaterThreshold: 3 });
  });

  it('360 with 3 peers and a self-rating returns othersMean that excludes self', async () => {
    await rate((await tokens('self'))[0], 5);
    await rate((await tokens('peer'))[2], 1);
    const res = await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200);
    const f = res.body.data.feedback360;
    expect(f.status).toBe('ok');
    expect(f.items[0]).toMatchObject({ othersMean: 3, self: 5, gapVsSelf: -2, byGroup: { peer: { mean: 3, n: 3 } } });
  });

  it('never exposes rater emails, names or tokens', async () => {
    const res = await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/clientorg\.lk|Peer \d|token/i);
  });

  it('after closing every cycle assessment the status is final', async () => {
    await authPost(app, org.admin, `/api/v1/assessments/${competencyAssessmentId}/close`).expect((r) => expect([200, 201]).toContain(r.status));
    const status = (await ds.query(`SELECT status FROM assessments WHERE id = $1`, [feedbackAssessmentId]))[0].status;
    if (status === 'active') await authPost(app, org.admin, `/api/v1/assessments/${feedbackAssessmentId}/close`);
    const res = await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200);
    expect(res.body.data.status).toBe('final');
  });

  it('bulk paging walks employees in employeeRef order', async () => {
    const p1 = await getResults(key, 'cycleRef=2027-H1&limit=1').expect(200);
    expect(p1.body.data.data.map((r: any) => r.employeeRef)).toEqual(['R-1']);
    expect(p1.body.data.nextCursor).toBe('R-1');
    const p2 = await getResults(key, 'cycleRef=2027-H1&limit=1&cursor=R-1').expect(200);
    expect(p2.body.data.data.map((r: any) => r.employeeRef)).toEqual(['R-2']);
    expect(p2.body.data.data[0].competency.items).toEqual([]);
    expect(p2.body.data.data[0].feedback360).toEqual({ status: 'insufficient_raters', minRaterThreshold: 3 });
    expect(p2.body.data.nextCursor).toBeNull();
  });

  it('unknown cycle or employee → 404, and another organisation cannot read this cycle', async () => {
    await getResults(key, 'cycleRef=NOPE&employeeRef=R-1').expect(404);
    await getResults(key, 'cycleRef=2027-H1&employeeRef=M-1').expect(404);
    const other = await setupHrisOrg(app, ds, ['R-1']);
    await getResults(other.key, 'cycleRef=2027-H1&employeeRef=R-1').expect(404);
  });

  describe('report links (Task 13)', () => {
    let reportUrl: string;

    it('POST reports queues a competency report; once ready, results.reports carries a signed URL', async () => {
      const res = await req(app).post('/api/v1/integrations/hris/reports').set('X-Api-Key', key)
        .send({ cycleRef: '2027-H1', employeeRef: 'R-1', type: 'competency' });
      expect([200, 201]).toContain(res.status);
      expect(res.body.data.reportId).toBeDefined();

      const deadline = Date.now() + 45_000;
      let links: any[] = [];
      while (Date.now() < deadline) {
        links = (await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200)).body.data.reports;
        if (links.length > 0) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({ reportId: res.body.data.reportId, type: 'competency' });
      expect(links[0].url).toMatch(/\/api\/v1\/integrations\/hris\/report-files\/.+\?exp=\d+&sig=[0-9a-f]{64}$/);
      expect(new Date(links[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
      reportUrl = links[0].url;
    });

    it('the signed URL downloads the PDF without an API key', async () => {
      const u = new URL(reportUrl);
      const res = await req(app).get(u.pathname + u.search).expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('a tampered signature → 403', async () => {
      const u = new URL(reportUrl);
      const sig = u.searchParams.get('sig')!;
      u.searchParams.set('sig', (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1));
      await req(app).get(u.pathname + u.search).expect(403);
    });

    it('an unknown employee for a report request → 404, and reports:read is required', async () => {
      await req(app).post('/api/v1/integrations/hris/reports').set('X-Api-Key', key)
        .send({ cycleRef: '2027-H1', employeeRef: 'M-1', type: 'competency' }).expect(404);
      const ro = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'R', scopes: ['results:read'] }).expect(201);
      await req(app).post('/api/v1/integrations/hris/reports').set('X-Api-Key', ro.body.data.rawKey)
        .send({ cycleRef: '2027-H1', employeeRef: 'R-1', type: 'competency' }).expect(403);
    });
  });

  describe('role profiles linked to HRIS designations (Task 22)', () => {
    it('an employee whose designationRef is linked to a role profile gets requiredLevel from it', async () => {
      const profile = await authPost(app, org.admin, '/api/v1/role-profiles', {
        title: 'Senior Engineer',
        designationRefs: ['SE-2'],
        requiredCompetencies: competencyIds.map((id) => ({ competencyId: id, minLevel: 3, weight: 0.5 })),
      }).expect(201);
      expect(profile.body.data.designationRefs).toEqual(['SE-2']);

      const email = (await ds.query(`SELECT email FROM users WHERE organisation_id = $1 AND external_ref = 'R-1'`, [org.id]))[0].email;
      await req(app).put('/api/v1/integrations/hris/employees').set('X-Api-Key', key).send({
        employees: [{ employeeRef: 'R-1', email, firstName: 'Emp', lastName: 'R-1', designationRef: 'SE-2', employmentStatus: 'active' }],
      }).expect(200);

      const r = (await getResults(key, 'cycleRef=2027-H1&employeeRef=R-1').expect(200)).body.data;
      expect(r.competency.roleProfile).toEqual({ ref: profile.body.data.id, title: 'Senior Engineer' });
      expect(r.competency.items[0]).toMatchObject({ requiredLevel: 3, weightInRole: 0.5, gapVsRequired: -1 });
      expect(r.competency.summary.achievementVsRequiredPct).toBe(66.7);
    });

    it('an explicit roleProfileId on the cycle wins over the designation link', async () => {
      const explicit = await authPost(app, org.admin, '/api/v1/role-profiles', {
        title: 'Principal Engineer',
        requiredCompetencies: competencyIds.map((id) => ({ competencyId: id, minLevel: 4, weight: 1 })),
      }).expect(201);
      await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
        cycleRef: '2027-H2', title: 'H2', types: ['competency'], startDate: '2027-07-01', endDate: '2027-12-31',
        employeeRefs: ['R-1'], competencyIds, roleProfileId: explicit.body.data.id,
      }).expect(201);
      const r = (await getResults(key, 'cycleRef=2027-H2&employeeRef=R-1').expect(200)).body.data;
      expect(r.competency.roleProfile.title).toBe('Principal Engineer');
    });
  });

  it('requires the results:read scope', async () => {
    const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'W', scopes: ['employees:write'] }).expect(201);
    await getResults(res.body.data.rawKey, 'cycleRef=2027-H1&employeeRef=R-1').expect(403);
  });
});
