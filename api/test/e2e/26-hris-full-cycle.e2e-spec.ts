/**
 * E2E: one complete HRIS review cycle through the integration API only (plan Task 19, spec §9).
 *   sync → request competency + 360 → ratings → close → webhook → results → report → SSO
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as http from 'http';
import { AddressInfo } from 'net';
import { getApp } from './setup/app';
import { authPost, getSeedCompetencyIds, login, registerOrg, req } from './setup/helpers';
import { uniqueHrisOrg } from './setup/hris';

const waitFor = async (cond: () => boolean | Promise<boolean>, ms = 45_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

describe('[HRIS-CYCLE] full review cycle', () => {
  let app: INestApplication;
  let ds: DataSource;
  let server: http.Server;
  const received: Array<{ event: string; body: any }> = [];

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    server = http.createServer((rq, rs) => {
      let b = '';
      rq.on('data', (c) => (b += c));
      rq.on('end', () => {
        received.push({ event: String(rq.headers['x-leaderprism-event']), body: JSON.parse(b || '{}') });
        rs.end('ok');
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  });
  afterAll(() => server.close());

  it('runs a cycle end to end', async () => {
    // ── Set-up by the org admin: plan, API key, webhook endpoint ──
    const org = await registerOrg(app, uniqueHrisOrg());
    await ds.query(`UPDATE organisations SET plan = 'professional' WHERE id = $1`, [org.id]);
    const key = (await authPost(app, org.admin, '/api/v1/integrations/api-clients', {
      name: 'HRIS', scopes: ['employees:write', 'assessments:write', 'results:read', 'reports:read', 'sso:issue'],
    }).expect(201)).body.data.rawKey as string;
    const hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    await authPost(app, org.admin, '/api/v1/integrations/webhooks', { url: hookUrl, events: ['assessment.closed', 'results.ready'] }).expect(201);
    const hris = (method: 'get' | 'post' | 'put', path: string) => req(app)[method](`/api/v1/integrations/hris${path}`).set('X-Api-Key', key);

    // ── 1. Sync org structure ──
    await hris('put', '/departments').send({ departments: [{ departmentRef: 'D-ENG', name: 'Engineering' }] }).expect(200);
    const stamp = Date.now();
    await hris('put', '/employees').send({
      employees: [
        { employeeRef: 'M-1', email: `m1.${stamp}@hris.lk`, firstName: 'Nimal', lastName: 'Perera', departmentRef: 'D-ENG', employmentStatus: 'active' },
        { employeeRef: 'E-1', email: `e1.${stamp}@hris.lk`, firstName: 'Kavinda', lastName: 'Silva', departmentRef: 'D-ENG', managerRef: 'M-1', employmentStatus: 'active' },
      ],
    }).expect(200);

    // ── 2. Request the cycle's leadership assessments ──
    const competencyIds = await getSeedCompetencyIds(ds, 2);
    const reqRes = await hris('post', '/assessment-requests').send({
      cycleRef: '2027-H1', title: 'H1 2027 review', types: ['competency', '360_feedback'],
      startDate: '2027-01-01', endDate: '2027-06-30', employeeRefs: ['E-1'], competencyIds,
      raters: { 'E-1': [1, 2, 3].map((i) => ({ email: `peer${i}.${stamp}@clientorg.lk`, name: `Peer ${i}`, relationship: 'peer' })) },
    }).expect(201);
    const [competencyId, feedbackId] = reqRes.body.data.assessments.map((a: any) => a.assessmentId);

    // ── 3. Employee and manager sign in through SSO and rate ──
    const ssoSession = async (ref: string) => {
      const url = (await hris('post', '/sso-tickets').send({ employeeRef: ref }).expect(201)).body.data.url;
      const ex = await req(app).post('/api/v1/auth/sso/hris/exchange').send({ ticket: new URL(url).searchParams.get('ticket') }).expect(200);
      return { accessToken: ex.body.data.accessToken as string };
    };
    const employee = await ssoSession('E-1');
    const manager = await ssoSession('M-1');
    const participantId = (await ds.query(`SELECT id FROM assessment_participants WHERE assessment_id = $1`, [competencyId]))[0].id;
    const self = await authPost(app, employee, `/api/v1/assessments/${competencyId}/competency/self`, { participantId });
    await authPost(app, employee, `/api/v1/assessments/${competencyId}/competency/self/${self.body.data.id}/submit`, {
      participantId, ratings: competencyIds.map((id) => ({ competencyId: id, levelRated: 3 })),
    }).expect((r) => expect([200, 201]).toContain(r.status));
    const mgr = await authPost(app, manager, `/api/v1/assessments/${competencyId}/competency/manager`, { participantId });
    await authPost(app, manager, `/api/v1/assessments/${competencyId}/competency/manager/${mgr.body.data.id}/submit`, {
      ratings: competencyIds.map((id) => ({ competencyId: id, levelRated: 4 })),
    }).expect((r) => expect([200, 201]).toContain(r.status));

    // 360 raters (anonymous token links) — three peers plus the employee's self view
    const tokens = await ds.query(`SELECT token FROM rater_nominations WHERE assessment_id = $1`, [feedbackId]);
    for (const { token } of tokens) {
      for (const cid of competencyIds) {
        const behaviours = await ds.query(`SELECT id FROM competency_behaviours WHERE competency_id = $1`, [cid]);
        await req(app).post(`/api/v1/rater/${token}/responses`).send({
          competencyId: cid, ratings: behaviours.map((b: any) => ({ behaviourId: b.id, score: 4 })), comment: '',
        }).expect(201);
      }
      await req(app).post(`/api/v1/rater/${token}/overall`).send({ overallRating: 8 }).expect(201);
    }

    // ── 4. HR closes the competency assessment (the 360 auto-closed when the last rater finished) ──
    const status = async (id: string) => (await ds.query(`SELECT status FROM assessments WHERE id = $1`, [id]))[0].status;
    if ((await status(competencyId)) === 'active') await authPost(app, org.admin, `/api/v1/assessments/${competencyId}/close`);
    expect(await status(feedbackId)).toBe('closed');

    // ── 5. Webhooks tell the HRIS ──
    expect(await waitFor(() => received.some((r) => r.event === 'results.ready' && r.body.employeeRefs?.includes('E-1')))).toBe(true);
    expect(await waitFor(() => received.filter((r) => r.event === 'assessment.closed' && r.body.cycleRef === '2027-H1').length >= 2)).toBe(true);

    // ── 6. HRIS pulls final results ──
    const result = (await hris('get', '/results?cycleRef=2027-H1&employeeRef=E-1').expect(200)).body.data;
    expect(result.status).toBe('final');
    expect(result.competency.items.every((i: any) => i.selfLevel === 3 && i.managerLevel === 4)).toBe(true);
    expect(result.competency.summary.managerAvgPct).toBe(100);
    expect(result.feedback360.status).toBe('ok');
    expect(result.feedback360.items[0].byGroup.peer.n).toBe(3);
    expect(result.feedback360.overallOthersPct).toBe(75);

    // ── 7. HRIS requests the PDF and downloads it through the signed link ──
    await hris('post', '/reports').send({ cycleRef: '2027-H1', employeeRef: 'E-1', type: 'competency' }).expect((r) => expect([200, 201]).toContain(r.status));
    let links: any[] = [];
    expect(await waitFor(async () => {
      links = (await hris('get', '/results?cycleRef=2027-H1&employeeRef=E-1').expect(200)).body.data.reports;
      return links.length > 0;
    })).toBe(true);
    const u = new URL(links[0].url);
    const pdf = await req(app).get(u.pathname + u.search).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });
});
