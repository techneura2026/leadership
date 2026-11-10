/**
 * E2E: HRIS final performance scores drive the 9-box performance axis (plan Task 20).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authGet, authPost, req } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';

/** Seeds a readiness assessment + score (360-derived performance 'low') for one employee. */
async function seedReadiness(ds: DataSource, orgId: string, adminId: string, ref: string): Promise<void> {
  const userId = (await ds.query(`SELECT id FROM users WHERE organisation_id = $1 AND external_ref = $2`, [orgId, ref]))[0].id;
  const [a] = await ds.query(
    `INSERT INTO assessments (organisation_id, created_by, title, assessment_type, status) VALUES ($1, $2, 'Readiness', 'readiness', 'closed') RETURNING id`,
    [orgId, adminId],
  );
  const [p] = await ds.query(
    `INSERT INTO assessment_participants (assessment_id, user_id, status) VALUES ($1, $2, 'completed') RETURNING id`,
    [a.id, userId],
  );
  await ds.query(
    `INSERT INTO readiness_scores (assessment_id, participant_id, readiness_rating, composite_score, grid_performance, grid_potential)
     VALUES ($1, $2, '1_2_years', 62, 'low', 'high')`,
    [a.id, p.id],
  );
}

describe('[HRIS-PERF] performance scores → 9-box', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
  });

  const candidate = async (admin: any) => {
    const res = await authGet(app, admin, '/api/v1/succession/dashboard').expect(200);
    return res.body.data.byRole.flatMap((r: any) => r.candidates)[0];
  };

  it('a pushed final score changes the 9-box performance axis', async () => {
    const { org, key } = await setupHrisOrg(app, ds, ['M-1', 'E-1']);
    await seedReadiness(ds, org.id, org.admin.userId, 'E-1');
    expect(await candidate(org.admin)).toMatchObject({ effectiveGridPerformance: 'low', performanceSource: 'feedback360' });

    const res = await req(app).put('/api/v1/integrations/hris/performance-scores').set('X-Api-Key', key).send({
      cycleRef: '2027-H1',
      scores: [{ employeeRef: 'E-1', finalScore: 82.5, ratingBand: 'Exceeds', finalisedAt: '2027-07-20T10:00:00Z' }],
    }).expect(200);
    expect(res.body.data.results).toEqual([expect.objectContaining({ ref: 'E-1', status: 'updated' })]);
    expect(await candidate(org.admin)).toMatchObject({ effectiveGridPerformance: 'high', performanceSource: 'hris' });

    // A re-send for the same cycle (e.g. after an appeal) overwrites
    await req(app).put('/api/v1/integrations/hris/performance-scores').set('X-Api-Key', key).send({
      cycleRef: '2027-H1', scores: [{ employeeRef: 'E-1', finalScore: 45, ratingBand: 'Meets', finalisedAt: '2027-08-01T10:00:00Z' }],
    }).expect(200);
    expect(await candidate(org.admin)).toMatchObject({ effectiveGridPerformance: 'medium' });
    const rows = await ds.query(`SELECT final_score FROM external_performance_scores WHERE organisation_id = $1`, [org.id]);
    expect(rows.map((r: any) => Number(r.final_score))).toEqual([45]);
  });

  it('out-of-range scores and unknown employees are row errors; other rows still apply', async () => {
    const { org, key } = await setupHrisOrg(app, ds, ['M-1', 'E-1']);
    const res = await req(app).put('/api/v1/integrations/hris/performance-scores').set('X-Api-Key', key).send({
      cycleRef: '2027-H1',
      scores: [
        { employeeRef: 'E-1', finalScore: 140, finalisedAt: '2027-07-20T10:00:00Z' },
        { employeeRef: 'NOPE', finalScore: 50, finalisedAt: '2027-07-20T10:00:00Z' },
        { employeeRef: 'M-1', finalScore: 50, finalisedAt: '2027-07-20T10:00:00Z' },
      ],
    }).expect(200);
    expect(res.body.data.results.map((r: any) => [r.ref, r.status, r.error])).toEqual([
      ['E-1', 'error', 'invalid_score'],
      ['NOPE', 'error', 'employee_not_found'],
      ['M-1', 'updated', undefined],
    ]);
    expect(await ds.query(`SELECT 1 FROM external_performance_scores WHERE organisation_id = $1`, [org.id])).toHaveLength(1);
  });

  it('another organisation cannot push scores for this organisation’s employees', async () => {
    const a = await setupHrisOrg(app, ds, ['M-1', 'E-1']);
    const b = await setupHrisOrg(app, ds, ['X-1']);
    const res = await req(app).put('/api/v1/integrations/hris/performance-scores').set('X-Api-Key', b.key).send({
      cycleRef: '2027-H1', scores: [{ employeeRef: 'E-1', finalScore: 90, finalisedAt: '2027-07-20T10:00:00Z' }],
    }).expect(200);
    expect(res.body.data.results[0]).toMatchObject({ status: 'error', error: 'employee_not_found' });
    expect(await ds.query(`SELECT 1 FROM external_performance_scores WHERE organisation_id = $1`, [a.org.id])).toHaveLength(0);
  });

  it('requires scores:write', async () => {
    const { org } = await setupHrisOrg(app, ds, ['M-1'], ['employees:write']);
    const ro = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'RO', scopes: ['results:read'] }).expect(201);
    await req(app).put('/api/v1/integrations/hris/performance-scores').set('X-Api-Key', ro.body.data.rawKey)
      .send({ cycleRef: 'x', scores: [] }).expect(403);
  });
});
