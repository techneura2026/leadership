/**
 * E2E: HRIS department sync — PUT /integrations/hris/departments (plan Task 4).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authGet, authPost, registerOrg, req, TestOrg } from './setup/helpers';
import { ORGS } from './setup/factories';

let _n = 0;
const uid = () => `${Date.now()}${++_n}`;
function uniqueOrg() {
  const s = uid();
  const b = ORGS.strategicTalent;
  return { ...b, orgName: `${b.orgName} ${s}`, orgSlug: `${b.orgSlug}-${s}`, email: b.email.replace('@', `+${s}@`) };
}

describe('[HRIS-DEPT] department sync', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;

  const put = (k: string, departments: any[]) =>
    req(app).put('/api/v1/integrations/hris/departments').set('X-Api-Key', k).send({ departments });

  const byRef = async (orgId: string, ref: string) =>
    (await ds.query(`SELECT * FROM departments WHERE organisation_id = $1 AND external_ref = $2`, [orgId, ref]))[0];

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    org = await registerOrg(app, uniqueOrg());
    const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'HRIS', scopes: ['employees:write'] }).expect(201);
    key = res.body.data.rawKey;
  });

  it('creates departments and links a child listed before its parent', async () => {
    const res = await put(key, [
      { departmentRef: 'D-ENG-PLAT', name: 'Platform', parentRef: 'D-ENG' },
      { departmentRef: 'D-ENG', name: 'Engineering' },
    ]).expect(200);
    expect(res.body.data.results.map((r: any) => [r.ref, r.status])).toEqual([
      ['D-ENG-PLAT', 'created'],
      ['D-ENG', 'created'],
    ]);
    const parent = await byRef(org.id, 'D-ENG');
    const child = await byRef(org.id, 'D-ENG-PLAT');
    expect(child.parent_id).toBe(parent.id);
    expect(child.hris_managed).toBe(true);
  });

  it('an identical second call reports unchanged', async () => {
    const res = await put(key, [
      { departmentRef: 'D-ENG-PLAT', name: 'Platform', parentRef: 'D-ENG' },
      { departmentRef: 'D-ENG', name: 'Engineering' },
    ]).expect(200);
    expect(res.body.data.results.map((r: any) => r.status)).toEqual(['unchanged', 'unchanged']);
  });

  it('a rename reports updated', async () => {
    const res = await put(key, [{ departmentRef: 'D-ENG', name: 'Engineering & Product' }]).expect(200);
    expect(res.body.data.results[0].status).toBe('updated');
    expect((await byRef(org.id, 'D-ENG')).name).toBe('Engineering & Product');
  });

  it('an unknown parentRef creates the department with a parent_not_found warning', async () => {
    const res = await put(key, [{ departmentRef: 'D-ORPHAN', name: 'Orphan', parentRef: 'D-NOPE' }]).expect(200);
    expect(res.body.data.results[0]).toMatchObject({ status: 'created', warnings: ['parent_not_found'] });
    expect((await byRef(org.id, 'D-ORPHAN')).parent_id).toBeNull();
  });

  it('a parent cycle rejects both rows and still processes the others', async () => {
    const res = await put(key, [
      { departmentRef: 'D-A', name: 'A', parentRef: 'D-B' },
      { departmentRef: 'D-B', name: 'B', parentRef: 'D-A' },
      { departmentRef: 'D-OK', name: 'OK' },
    ]).expect(200);
    const results = res.body.data.results;
    expect(results[0]).toMatchObject({ ref: 'D-A', status: 'error', error: 'parent_cycle' });
    expect(results[1]).toMatchObject({ ref: 'D-B', status: 'error', error: 'parent_cycle' });
    expect(results[2]).toMatchObject({ ref: 'D-OK', status: 'created' });
    expect(await byRef(org.id, 'D-A')).toBeUndefined();
  });

  it('rejects more than 1000 rows and invalid rows with 400', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ departmentRef: `X${i}`, name: 'x' }));
    await put(key, many).expect(400);
    await put(key, [{ departmentRef: '', name: 'x' }]).expect(400);
  });

  it('departments land in the key’s own organisation only', async () => {
    const other = await registerOrg(app, uniqueOrg());
    const list = await authGet(app, other.admin, '/api/v1/organisations/me/departments').expect(200);
    expect(JSON.stringify(list.body)).not.toContain('Platform');
    const mine = await authGet(app, org.admin, '/api/v1/organisations/me/departments').expect(200);
    expect(JSON.stringify(mine.body)).toContain('Platform');
  });

  it('requires the employees:write scope', async () => {
    const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'RO', scopes: ['results:read'] }).expect(201);
    await put(res.body.data.rawKey, [{ departmentRef: 'D-X', name: 'X' }]).expect(403);
  });
});
