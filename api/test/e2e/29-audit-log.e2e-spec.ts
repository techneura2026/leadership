/**
 * E2E: audit log for integration and talent changes (plan Task 23).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authGet, authPatch, createUserInOrg, getSeedCompetencyIds, login, req, TestOrg } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';

describe('[AUDIT] audit log', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;

  const logs = async (query = '') => (await authGet(app, org.admin, `/api/v1/audit-logs${query}`).expect(200)).body.data;

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org, key } = await setupHrisOrg(app, ds, ['M-1', 'E-1']));
  });

  it('employee sync writes integration.employees.synced with the API client as actor', async () => {
    const page = await logs('?action=integration.employees.synced');
    expect(page.data).toHaveLength(1);
    const clientId = (await ds.query(`SELECT id FROM api_clients WHERE organisation_id = $1`, [org.id]))[0].id;
    expect(page.data[0]).toMatchObject({
      actorType: 'api_client',
      actorId: clientId,
      entityType: 'employee_sync',
      metadata: expect.objectContaining({ rows: 2, created: 2, errors: 0 }),
    });
  });

  it('API key creation is logged with the admin as actor', async () => {
    const page = await logs('?action=integration.api_client.created');
    expect(page.data[0]).toMatchObject({ actorType: 'user', actorId: org.admin.userId, entityType: 'api_client' });
  });

  it('reading results is logged', async () => {
    const competencyIds = await getSeedCompetencyIds(ds, 1);
    await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef: 'AU-1', title: 'Audit', types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30',
      employeeRefs: ['E-1'], competencyIds,
    }).expect(201);
    await req(app).get('/api/v1/integrations/hris/results?cycleRef=AU-1&employeeRef=E-1').set('X-Api-Key', key).expect(200);
    const page = await logs('?action=integration.results.read');
    expect(page.data[0]).toMatchObject({ actorType: 'api_client', metadata: expect.objectContaining({ cycleRef: 'AU-1', employees: 1 }) });
    expect((await logs('?action=integration.assessments.requested')).data).toHaveLength(1);
  });

  it('a 9-box performance override records before and after', async () => {
    const userId = (await ds.query(`SELECT id FROM users WHERE organisation_id = $1 AND external_ref = 'E-1'`, [org.id]))[0].id;
    const [a] = await ds.query(
      `INSERT INTO assessments (organisation_id, created_by, title, assessment_type, status) VALUES ($1, $2, 'R', 'readiness', 'closed') RETURNING id`,
      [org.id, org.admin.userId]);
    const [p] = await ds.query(`INSERT INTO assessment_participants (assessment_id, user_id, status) VALUES ($1, $2, 'completed') RETURNING id`, [a.id, userId]);
    const [rs] = await ds.query(
      `INSERT INTO readiness_scores (assessment_id, participant_id, readiness_rating, composite_score, grid_performance, grid_potential)
       VALUES ($1, $2, 'developing', 50, 'low', 'medium') RETURNING id`, [a.id, p.id]);
    await authPatch(app, org.admin, `/api/v1/readiness-scores/${rs.id}/performance-override`, { gridPerformance: 'high', note: 'Strong year' })
      .expect((r) => expect([200, 201]).toContain(r.status));
    const entry = (await logs('?action=talent.performance_override.set')).data[0];
    expect(entry).toMatchObject({
      actorType: 'user', actorId: org.admin.userId, entityType: 'readiness_score', entityId: rs.id,
      before: { manualGridPerformance: null }, after: { manualGridPerformance: 'high' }, reason: 'Strong year',
    });
  });

  it('is paged newest first and exports CSV', async () => {
    const page = await logs('?limit=2');
    expect(page.data).toHaveLength(2);
    expect(new Date(page.data[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(page.data[1].createdAt).getTime());
    expect(page.nextCursor).toBeTruthy();
    const next = await logs(`?limit=2&cursor=${encodeURIComponent(page.nextCursor)}`);
    expect(next.data[0].id).not.toBe(page.data[0].id);

    const csv = await authGet(app, org.admin, '/api/v1/audit-logs/export.csv').expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n')[0]).toBe('created_at,actor_type,actor_id,action,entity_type,entity_id,reason');
  });

  it('only org admins can read it, and only their own organisation’s entries', async () => {
    const email = `hr${Date.now()}@stp.lk`;
    await createUserInOrg(ds, org.id, { email, firstName: 'H', lastName: 'R', role: 'hr_manager', password: 'HrMgr2026!' });
    const hr = await login(app, email, 'HrMgr2026!');
    await authGet(app, hr, '/api/v1/audit-logs').expect(403);
    const other = await setupHrisOrg(app, ds, ['X-1']);
    const theirs = (await authGet(app, other.org.admin, '/api/v1/audit-logs?limit=100').expect(200)).body.data.data;
    expect(theirs.every((e: any) => e.organisationId === other.org.id)).toBe(true);
  });
});
