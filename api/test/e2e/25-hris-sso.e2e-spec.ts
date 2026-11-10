/**
 * E2E: one-time SSO tickets for the HRIS hand-off (plan Task 17).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authPost, extractRefreshCookie, req, TestOrg } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';

describe('[HRIS-SSO] SSO tickets', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;

  const issue = (body: any, k = key) => req(app).post('/api/v1/integrations/hris/sso-tickets').set('X-Api-Key', k).send(body);
  const exchange = (ticket: string) => req(app).post('/api/v1/auth/sso/hris/exchange').send({ ticket });
  const ticketOf = (url: string) => new URL(url).searchParams.get('ticket')!;

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org, key } = await setupHrisOrg(app, ds, ['M-1', 'R-1', 'R-2']));
  });

  it('issues a ticket URL on the web app that exchanges once for tokens and a refresh cookie', async () => {
    const res = await issue({ employeeRef: 'R-1', redirectPath: '/my-assessments' }).expect(201);
    expect(res.body.data.url).toMatch(/\/sso\/hris\?ticket=[A-Za-z0-9_-]{43}$/);
    expect(new Date(res.body.data.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(61_000);

    const ex = await exchange(ticketOf(res.body.data.url)).expect(200);
    expect(ex.body.data.accessToken).toBeDefined();
    expect(ex.body.data.user.lastName).toBe('R-1');
    expect(ex.body.data.redirectPath).toBe('/my-assessments');
    expect(ex.body.data.refreshToken).toBeUndefined();
    expect(extractRefreshCookie(ex)).toMatch(/^refresh_token=/);

    await req(app).get('/api/v1/assessments/mine').set('Authorization', `Bearer ${ex.body.data.accessToken}`).expect(200);
  });

  it('a ticket can only be used once', async () => {
    const t = ticketOf((await issue({ employeeRef: 'R-1' }).expect(201)).body.data.url);
    await exchange(t).expect(200);
    await exchange(t).expect(401);
  });

  it('defaults redirectPath to /my-assessments', async () => {
    const t = ticketOf((await issue({ employeeRef: 'R-1' }).expect(201)).body.data.url);
    expect((await exchange(t).expect(200)).body.data.redirectPath).toBe('/my-assessments');
  });

  it('an expired ticket → 401', async () => {
    const t = ticketOf((await issue({ employeeRef: 'R-1' }).expect(201)).body.data.url);
    await ds.query(`UPDATE sso_tickets SET expires_at = now() - interval '1 second' WHERE used_at IS NULL`);
    await exchange(t).expect(401);
  });

  it('rejects open-redirect paths', async () => {
    await issue({ employeeRef: 'R-1', redirectPath: '//evil.com' }).expect(400);
    await issue({ employeeRef: 'R-1', redirectPath: 'https://evil.com' }).expect(400);
    await issue({ employeeRef: 'R-1', redirectPath: '/\\evil.com' }).expect(400);
  });

  it('an unknown employee or one who has left → 404', async () => {
    await issue({ employeeRef: 'NOPE' }).expect(404);
    await req(app).put('/api/v1/integrations/hris/employees').set('X-Api-Key', key).send({
      employees: [{ employeeRef: 'R-2', email: (await ds.query(`SELECT email FROM users WHERE organisation_id = $1 AND external_ref = 'R-2'`, [org.id]))[0].email,
        firstName: 'Emp', lastName: 'R-2', employmentStatus: 'left' }],
    }).expect(200);
    await issue({ employeeRef: 'R-2' }).expect(404);
  });

  it('a garbage ticket → 401, and issuing requires sso:issue', async () => {
    await exchange('x'.repeat(43)).expect(401);
    const ro = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'RO', scopes: ['results:read'] }).expect(201);
    await issue({ employeeRef: 'R-1' }, ro.body.data.rawKey).expect(403);
  });

  it('never issues tickets for an org admin, even one linked to an employeeRef', async () => {
    await req(app).put('/api/v1/integrations/hris/employees').set('X-Api-Key', key).send({
      employees: [{ employeeRef: 'ADM-1', email: org.admin.email, firstName: 'Org', lastName: 'Admin', employmentStatus: 'active' }],
    }).expect(200);
    const res = await issue({ employeeRef: 'ADM-1' }).expect(403);
    expect(res.body.error.code).toBe('SSO_NOT_ALLOWED');
    expect(await ds.query(`SELECT 1 FROM sso_tickets WHERE user_id = $1`, [org.admin.userId])).toHaveLength(0);
  });

  it('another organisation’s key cannot issue tickets for this organisation’s employees', async () => {
    const other = await setupHrisOrg(app, ds, ['X-1']);
    await issue({ employeeRef: 'R-1' }, other.key).expect(404);
  });
});
