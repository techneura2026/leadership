/**
 * E2E: HRIS assessment requests — POST /integrations/hris/assessment-requests (plan Tasks 8–9).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authPost, getSeedCompetencyIds, req, TestOrg } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';

describe('[HRIS-REQ] assessment requests', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;
  let competencyIds: string[];

  const post = (k: string, body: any) => req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', k).send(body);
  const competencyRequest = (employeeRefs: string[], cycleRef = '2027-H1') => ({
    cycleRef,
    title: 'H1 2027 Leadership Competency',
    types: ['competency'],
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    employeeRefs,
    competencyIds,
  });
  const participantCount = async (assessmentId: string) =>
    Number((await ds.query(`SELECT COUNT(*) AS c FROM assessment_participants WHERE assessment_id = $1`, [assessmentId]))[0].c);

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org, key } = await setupHrisOrg(app, ds, ['M-1', 'R-1', 'R-2', 'R-3']));
    competencyIds = await getSeedCompetencyIds(ds, 3);
  });

  let competencyAssessmentId: string;

  it('creates and launches a competency assessment tagged with the cycleRef', async () => {
    const res = await post(key, competencyRequest(['M-1', 'R-1', 'R-2'])).expect(201);
    expect(res.body.data.assessments).toHaveLength(1);
    const a = res.body.data.assessments[0];
    expect(a).toMatchObject({ type: 'competency', created: true, employeeRefs: ['M-1', 'R-1', 'R-2'] });
    competencyAssessmentId = a.assessmentId;
    const row = (await ds.query(`SELECT * FROM assessments WHERE id = $1`, [a.assessmentId]))[0];
    expect(row).toMatchObject({ organisation_id: org.id, cycle_ref: '2027-H1', source: 'hris', status: 'active' });
    expect(row.config.competencyIds).toEqual(competencyIds);
    expect(await participantCount(a.assessmentId)).toBe(3);
  });

  it('a repeated identical request returns 200 with the same assessment and no duplicates', async () => {
    const res = await post(key, competencyRequest(['M-1', 'R-1', 'R-2'])).expect(200);
    expect(res.body.data.assessments[0]).toMatchObject({ assessmentId: competencyAssessmentId, created: false });
    expect(await participantCount(competencyAssessmentId)).toBe(3);
  });

  it('a repeat with one extra employee adds only that late joiner', async () => {
    await post(key, competencyRequest(['M-1', 'R-1', 'R-2', 'R-3'])).expect(200);
    expect(await participantCount(competencyAssessmentId)).toBe(4);
  });

  it('unknown employeeRefs → 422 with the list, and nothing is created', async () => {
    const res = await post(key, competencyRequest(['M-1', 'NOPE-1', 'NOPE-2'], '2027-H2')).expect(422);
    expect(res.body.error.code).toBe('UNKNOWN_EMPLOYEES');
    expect(res.body.error.details).toEqual({ employeeRefs: ['NOPE-1', 'NOPE-2'] });
    const rows = await ds.query(`SELECT id FROM assessments WHERE organisation_id = $1 AND cycle_ref = '2027-H2'`, [org.id]);
    expect(rows).toHaveLength(0);
  });

  it('another organisation using the same cycleRef gets its own assessment', async () => {
    const other = await setupHrisOrg(app, ds, ['M-1']);
    const res = await post(other.key, competencyRequest(['M-1'])).expect(201);
    expect(res.body.data.assessments[0].assessmentId).not.toBe(competencyAssessmentId);
    expect(await participantCount(competencyAssessmentId)).toBe(4);
  });

  it('validates the request', async () => {
    await post(key, { ...competencyRequest(['M-1']), types: ['astrology'] }).expect(400);
    await post(key, { ...competencyRequest(['M-1']), employeeRefs: [] }).expect(400);
  });

  describe('360 requests (Task 9)', () => {
    const peers = (tag: string) => [1, 2, 3].map((i) => ({ email: `peer${i}.${tag}@client.lk`, name: `Peer ${i}`, relationship: 'peer' }));
    const request360 = (employeeRefs: string[], raters?: Record<string, any[]>, cycleRef = '2027-H1') => ({
      cycleRef,
      title: 'H1 2027 360',
      types: ['360_feedback'],
      startDate: '2027-01-01',
      endDate: '2027-06-30',
      employeeRefs,
      competencyIds,
      ...(raters ? { raters } : {}),
    });
    const nominations = async (assessmentId: string) =>
      ds.query(`SELECT rater_email, relationship, status FROM rater_nominations WHERE assessment_id = $1 ORDER BY rater_email`, [assessmentId]);

    let first: any[];

    it('creates one 360 assessment per employee, tagged with subjectRef', async () => {
      const res = await post(key, request360(['R-1', 'R-2'], { 'R-1': peers('r1') })).expect(201);
      first = res.body.data.assessments;
      expect(first.map((a: any) => [a.type, a.employeeRefs])).toEqual([
        ['360_feedback', ['R-1']],
        ['360_feedback', ['R-2']],
      ]);
      const rows = await ds.query(
        `SELECT subject_ref, cycle_ref, status FROM assessments WHERE id = ANY($1) ORDER BY subject_ref`,
        [first.map((a: any) => a.assessmentId)],
      );
      expect(rows).toEqual([
        { subject_ref: 'R-1', cycle_ref: '2027-H1', status: 'active' },
        { subject_ref: 'R-2', cycle_ref: '2027-H1', status: 'active' },
      ]);
    });

    it('nominates the given raters as approved, plus the self perspective', async () => {
      const rows = await nominations(first[0].assessmentId);
      expect(rows.filter((r: any) => r.relationship === 'peer')).toHaveLength(3);
      expect(rows.every((r: any) => r.status === 'approved')).toBe(true);
      expect(rows.filter((r: any) => r.relationship === 'self')).toHaveLength(1);
    });

    it('a repeat call creates nothing new and does not duplicate raters', async () => {
      const res = await post(key, request360(['R-1', 'R-2'], { 'R-1': peers('r1') })).expect(200);
      expect(res.body.data.assessments.map((a: any) => a.assessmentId)).toEqual(first.map((a: any) => a.assessmentId));
      expect(res.body.data.assessments.every((a: any) => a.created === false)).toBe(true);
      expect(await nominations(first[0].assessmentId)).toHaveLength(4);
    });

    it('mixed types return one competency entry plus one 360 entry per employee', async () => {
      const res = await post(key, { ...request360(['M-1', 'R-3'], undefined, '2027-Q3'), types: ['competency', '360_feedback'] }).expect(201);
      expect(res.body.data.assessments.map((a: any) => a.type)).toEqual(['competency', '360_feedback', '360_feedback']);
    });

    it('raters who are LeaderPrism managers are rejected up front with 422 RATERS_NOT_ALLOWED', async () => {
      const managerEmail = (await ds.query(`SELECT email FROM users WHERE organisation_id = $1 AND external_ref = 'M-1'`, [org.id]))[0].email;
      const res = await post(key, request360(['R-3'], { 'R-3': [{ email: managerEmail, name: 'Boss', relationship: 'supervisor' }] }, '2027-Q4')).expect(422);
      expect(res.body.error.code).toBe('RATERS_NOT_ALLOWED');
      expect(res.body.error.details).toEqual({ emails: [managerEmail] });
      const rows = await ds.query(`SELECT id FROM assessments WHERE organisation_id = $1 AND cycle_ref = '2027-Q4'`, [org.id]);
      expect(rows).toHaveLength(0);
    });
  });

  it('requires the assessments:write scope', async () => {
    const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'RO', scopes: ['results:read'] }).expect(201);
    await post(res.body.data.rawKey, competencyRequest(['M-1'])).expect(403);
  });
});
