/**
 * E2E: readiness, 9-box and succession exports for the HRIS (plan Task 21).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as http from 'http';
import { AddressInfo } from 'net';
import { getApp } from './setup/app';
import { authPost, getSeedCompetencyIds, req, TestOrg } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';
import { DomainEvent, DomainEventBus } from '../../src/shared/events/domain-events';

describe('[HRIS-TALENT] talent exports', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;
  let userId: string;

  const results = (k: string) => req(app).get('/api/v1/integrations/hris/results?cycleRef=2027-H1&employeeRef=E-1').set('X-Api-Key', k);

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org, key } = await setupHrisOrg(app, ds, ['M-1', 'E-1']));
    const competencyIds = await getSeedCompetencyIds(ds, 1);
    await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef: '2027-H1', title: 'H1', types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30',
      employeeRefs: ['E-1'], competencyIds,
    }).expect(201);

    userId = (await ds.query(`SELECT id FROM users WHERE organisation_id = $1 AND external_ref = 'E-1'`, [org.id]))[0].id;
    const [rp] = await ds.query(
      `INSERT INTO role_profiles (organisation_id, title, level) VALUES ($1, 'Engineering Manager', 'L5') RETURNING id`, [org.id]);
    const [a] = await ds.query(
      `INSERT INTO assessments (organisation_id, created_by, title, assessment_type, status) VALUES ($1, $2, 'Readiness', 'readiness', 'closed') RETURNING id`,
      [org.id, org.admin.userId]);
    const [p] = await ds.query(
      `INSERT INTO assessment_participants (assessment_id, user_id, status) VALUES ($1, $2, 'completed') RETURNING id`, [a.id, userId]);
    await ds.query(
      `INSERT INTO readiness_scores (assessment_id, participant_id, role_profile_id, readiness_rating, composite_score,
         competency_score, feedback_score, sjt_score, learning_agility_score, personality_fit_score, grid_performance, grid_potential)
       VALUES ($1, $2, $3, '1_2_years', 62, 70, 55, 60, 65, 50, 'low', 'high')`,
      [a.id, p.id, rp.id]);
  });

  it('talent fields are absent without the talent:read scope', async () => {
    const ro = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'RO', scopes: ['results:read'] }).expect(201);
    const body = (await results(ro.body.data.rawKey).expect(200)).body.data;
    expect('readiness' in body).toBe(false);
    expect('nineBox' in body).toBe(false);
  });

  it('with talent:read the result carries readiness and the 9-box placement', async () => {
    const body = (await results(key).expect(200)).body.data;
    expect(body.readiness).toEqual({
      rating: '1_2_years',
      compositeScore: 62,
      components: { competency: 70, feedback: 55, sjt: 60, learningAgility: 65, personalityFit: 50 },
      roleProfile: { ref: expect.any(String), title: 'Engineering Manager' },
    });
    expect(body.nineBox).toEqual({ performance: 'low', potential: 'high', performanceSource: 'feedback360', overrideNote: null });
  });

  it('after the HRIS pushes a final score the 9-box performance comes from the HRIS', async () => {
    await req(app).put('/api/v1/integrations/hris/performance-scores').set('X-Api-Key', key).send({
      cycleRef: '2027-H1', scores: [{ employeeRef: 'E-1', finalScore: 85, finalisedAt: '2027-07-20T10:00:00Z' }],
    }).expect(200);
    const body = (await results(key).expect(200)).body.data;
    expect(body.nineBox).toMatchObject({ performance: 'high', performanceSource: 'hris' });
  });

  it('GET succession lists key roles with successors by employeeRef', async () => {
    const kr = await authPost(app, org.admin, '/api/v1/succession/key-roles', { title: 'Head of Engineering', criticality: 'critical' }).expect(201);
    await authPost(app, org.admin, `/api/v1/succession/key-roles/${kr.body.data.id}/successors`, { candidateUserId: userId })
      .expect((r) => expect([200, 201]).toContain(r.status));
    const res = await req(app).get('/api/v1/integrations/hris/succession').set('X-Api-Key', key).expect(200);
    expect(res.body.data.keyRoles).toEqual([
      expect.objectContaining({
        id: kr.body.data.id,
        title: 'Head of Engineering',
        criticality: 'critical',
        readyNowCount: 0,
        successors: [expect.objectContaining({ employeeRef: 'E-1', readinessRating: '1_2_years' })],
      }),
    ]);
    const ro = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'RO2', scopes: ['results:read'] }).expect(201);
    await req(app).get('/api/v1/integrations/hris/succession').set('X-Api-Key', ro.body.data.rawKey).expect(403);
  });

  it('readiness.computed is delivered as a webhook with employeeRefs', async () => {
    const got: any[] = [];
    const server = http.createServer((rq, rs) => {
      let b = '';
      rq.on('data', (c) => (b += c));
      rq.on('end', () => { got.push(JSON.parse(b)); rs.end('ok'); });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    try {
      await authPost(app, org.admin, '/api/v1/integrations/webhooks', {
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/h`, events: ['readiness.computed'],
      }).expect(201);
      app.get(DomainEventBus).emit(DomainEvent.ReadinessComputed, {
        orgId: org.id, assessmentId: 'a-1', cycleRef: null, userId, occurredAt: new Date().toISOString(),
      });
      const end = Date.now() + 15_000;
      while (got.length === 0 && Date.now() < end) await new Promise((r) => setTimeout(r, 250));
      expect(got[0]).toMatchObject({ event: 'readiness.computed', employeeRefs: ['E-1'] });
    } finally {
      server.close();
    }
  });
});
