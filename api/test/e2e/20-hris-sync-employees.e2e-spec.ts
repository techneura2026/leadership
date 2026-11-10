/**
 * E2E: HRIS employee sync — PUT /integrations/hris/employees (plan Task 5).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authPost, createUserInOrg, login, registerOrg, req, TestOrg } from './setup/helpers';
import { ORGS } from './setup/factories';

let _n = 0;
const uid = () => `${Date.now()}${++_n}`;
function uniqueOrg() {
  const s = uid();
  const b = ORGS.strategicTalent;
  return { ...b, orgName: `${b.orgName} ${s}`, orgSlug: `${b.orgSlug}-${s}`, email: b.email.replace('@', `+${s}@`) };
}

const emp = (ref: string, extra: Record<string, unknown> = {}) => ({
  employeeRef: ref,
  email: `${ref.toLowerCase()}.${_n}@hris.lk`,
  firstName: 'First',
  lastName: ref,
  employmentStatus: 'active',
  ...extra,
});

describe('[HRIS-EMP] employee sync', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;

  const put = (body: any) => req(app).put('/api/v1/integrations/hris/employees').set('X-Api-Key', key).send(body);
  const userByRef = async (ref: string) =>
    (await ds.query(`SELECT * FROM users WHERE organisation_id = $1 AND external_ref = $2`, [org.id, ref]))[0];

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    org = await registerOrg(app, uniqueOrg());
    const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'HRIS', scopes: ['employees:write'] }).expect(201);
    key = res.body.data.rawKey;
    await req(app).put('/api/v1/integrations/hris/departments').set('X-Api-Key', key)
      .send({ departments: [{ departmentRef: 'D-ENG', name: 'Engineering' }] }).expect(200);
  });

  it('creates employees and links a manager listed after the report', async () => {
    const res = await put({
      employees: [
        emp('E-100', { managerRef: 'E-001', departmentRef: 'D-ENG', jobTitle: 'Engineer' }),
        emp('E-001', { departmentRef: 'D-ENG', jobTitle: 'Engineering Manager' }),
      ],
    }).expect(200);
    expect(res.body.data.results.map((r: any) => [r.ref, r.status])).toEqual([['E-100', 'created'], ['E-001', 'created']]);
    const report = await userByRef('E-100');
    const manager = await userByRef('E-001');
    expect(report.manager_id).toBe(manager.id);
    expect(report.department_id).not.toBeNull();
    expect(report.hris_managed).toBe(true);
    expect(report.must_change_password).toBe(false);
  });

  it('a participant with direct reports becomes a manager', async () => {
    expect((await userByRef('E-001')).role).toBe('manager');
    expect((await userByRef('E-100')).role).toBe('participant');
  });

  it('warns manager_not_found, then links the manager once it arrives in a later batch', async () => {
    const first = await put({ employees: [emp('E-200', { managerRef: 'E-002' })] }).expect(200);
    expect(first.body.data.results[0]).toMatchObject({ status: 'created', warnings: ['manager_not_found'] });
    expect((await userByRef('E-200')).manager_id).toBeNull();

    await put({ employees: [emp('E-002')] }).expect(200);
    const second = await put({ employees: [emp('E-200', { managerRef: 'E-002' })] }).expect(200);
    expect(second.body.data.results[0].status).toBe('updated');
    expect((await userByRef('E-200')).manager_id).toBe((await userByRef('E-002')).id);
  });

  it('an unknown departmentRef warns department_not_found', async () => {
    const res = await put({ employees: [emp('E-300', { departmentRef: 'D-NOPE' })] }).expect(200);
    expect(res.body.data.results[0]).toMatchObject({ status: 'created', warnings: ['department_not_found'] });
  });

  it('links an existing app user by email instead of duplicating them', async () => {
    const email = `linked${uid()}@stp.lk`;
    const id = await createUserInOrg(ds, org.id, { email, firstName: 'L', lastName: 'U', role: 'participant', password: 'Linked2026!' });
    const res = await put({ employees: [emp('E-400', { email })] }).expect(200);
    expect(res.body.data.results[0]).toMatchObject({ status: 'updated', id });
    const rows = await ds.query(`SELECT external_ref FROM users WHERE organisation_id = $1 AND email = $2`, [org.id, email]);
    expect(rows).toEqual([{ external_ref: 'E-400' }]);
  });

  it('an email owned by a different employeeRef is a row error; other rows still succeed', async () => {
    const taken = (await userByRef('E-100')).email;
    const res = await put({ employees: [emp('E-500', { email: taken }), emp('E-501')] }).expect(200);
    expect(res.body.data.results[0]).toMatchObject({ ref: 'E-500', status: 'error', error: 'email_conflict' });
    expect(res.body.data.results[1]).toMatchObject({ ref: 'E-501', status: 'created' });
  });

  it('never changes an org_admin role', async () => {
    const res = await put({ employees: [emp('E-ADMIN', { email: org.admin.email, role: 'participant' })] }).expect(200);
    expect(res.body.data.results[0].status).toBe('updated');
    expect((await userByRef('E-ADMIN')).role).toBe('org_admin');
  });

  it('rejects a management cycle within the batch', async () => {
    const res = await put({ employees: [emp('E-C1', { managerRef: 'E-C2' }), emp('E-C2', { managerRef: 'E-C1' })] }).expect(200);
    expect(res.body.data.results.map((r: any) => r.error)).toEqual(['manager_cycle', 'manager_cycle']);
  });

  it('employmentStatus left deactivates the user and revokes their sessions', async () => {
    const email = `leaver${uid()}@stp.lk`;
    await createUserInOrg(ds, org.id, { email, firstName: 'Leaving', lastName: 'Soon', role: 'participant', password: 'Leaver2026!' });
    await put({ employees: [emp('E-600', { email })] }).expect(200);
    const session = await login(app, email, 'Leaver2026!');

    const res = await put({ employees: [emp('E-600', { email, employmentStatus: 'left' })] }).expect(200);
    expect(res.body.data.results[0].status).toBe('updated');
    const row = await userByRef('E-600');
    expect(row.is_active).toBe(false);
    expect(row.employment_status).toBe('left');
    await req(app).post('/api/v1/auth/refresh').set('Cookie', session.refreshCookie).expect(401);
  });

  it('fullSync deactivates HRIS-managed users missing from the payload but not app-created users', async () => {
    const appEmail = `apponly${uid()}@stp.lk`;
    await createUserInOrg(ds, org.id, { email: appEmail, firstName: 'App', lastName: 'Only', role: 'participant', password: 'AppOnly2026!' });
    const res = await put({ fullSync: true, employees: [emp('E-001'), emp('E-100', { managerRef: 'E-001' })] }).expect(200);
    const missing = res.body.data.results.find((r: any) => r.ref === 'E-200');
    expect(missing).toMatchObject({ status: 'updated', warnings: ['deactivated_missing_from_full_sync'] });
    expect((await userByRef('E-200')).is_active).toBe(false);
    const appUser = (await ds.query(`SELECT is_active FROM users WHERE email = $1`, [appEmail]))[0];
    expect(appUser.is_active).toBe(true);
    expect((await userByRef('E-001')).is_active).toBe(true);
  });

  it('a synced user cannot log in with a password', async () => {
    const email = (await userByRef('E-001')).email;
    await req(app).post('/api/v1/auth/login').send({ email, password: 'Anything1!' }).expect(401);
  });

  it('validates the payload', async () => {
    await put({ employees: [{ employeeRef: 'E-X', email: 'not-an-email', firstName: 'a', lastName: 'b', employmentStatus: 'active' }] }).expect(400);
    await put({ employees: [emp('E-X', { employmentStatus: 'retired' })] }).expect(400);
  });
});
