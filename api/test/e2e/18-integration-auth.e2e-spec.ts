/**
 * E2E: per-organisation API clients and the X-Api-Key guard (plan Task 2).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authDelete, authGet, authPost, createUserInOrg, deactivateOrg, login, registerOrg, req, TestOrg } from './setup/helpers';
import { ORGS } from './setup/factories';

let _n = 0;
const uid = () => `${Date.now()}${++_n}`;
function uniqueOrg() {
  const s = uid();
  const b = ORGS.strategicTalent;
  return { ...b, orgName: `${b.orgName} ${s}`, orgSlug: `${b.orgSlug}-${s}`, email: b.email.replace('@', `+${s}@`) };
}

describe('[HRIS-AUTH] integration API clients', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    org = await registerOrg(app, uniqueOrg());
  });

  async function createKey(o: TestOrg, scopes: string[]): Promise<{ id: string; rawKey: string }> {
    const res = await authPost(app, o.admin, '/api/v1/integrations/api-clients', { name: 'HRIS', scopes }).expect(201);
    return res.body.data;
  }

  it('ORG_ADMIN creates a client and receives the raw key exactly once', async () => {
    const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', {
      name: 'Main HRIS',
      scopes: ['results:read', 'employees:write'],
    }).expect(201);
    expect(res.body.data.rawKey).toMatch(/^lpk_/);
    expect(res.body.data.keyPrefix).toHaveLength(8);

    const list = await authGet(app, org.admin, '/api/v1/integrations/api-clients').expect(200);
    const body = JSON.stringify(list.body);
    expect(body).not.toContain(res.body.data.rawKey);
    expect(body).not.toMatch(/secretHash|secret_hash/);
    expect(list.body.data.find((c: any) => c.id === res.body.data.id)).toMatchObject({
      name: 'Main HRIS',
      keyPrefix: res.body.data.keyPrefix,
      scopes: ['results:read', 'employees:write'],
    });
  });

  it('rejects unknown scopes', async () => {
    await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'x', scopes: ['everything'] }).expect(400);
  });

  it('ping with a valid key returns the key’s own orgId', async () => {
    const { rawKey } = await createKey(org, ['results:read']);
    const res = await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', rawKey).expect(200);
    expect(res.body.data).toEqual({ orgId: org.id });
  });

  it('ping without a key → 401', async () => {
    await req(app).get('/api/v1/integrations/hris/ping').expect(401);
  });

  it('ping with a malformed or unknown key → 401', async () => {
    await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', 'nope').expect(401);
    const { rawKey } = await createKey(org, ['results:read']);
    const tampered = rawKey.slice(0, -1) + (rawKey.endsWith('A') ? 'B' : 'A');
    await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', tampered).expect(401);
  });

  it('ping with a revoked key → 401', async () => {
    const { id, rawKey } = await createKey(org, ['results:read']);
    await authDelete(app, org.admin, `/api/v1/integrations/api-clients/${id}`).expect(204);
    await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', rawKey).expect(401);
  });

  it('client without results:read → 403 INSUFFICIENT_SCOPE', async () => {
    const { rawKey } = await createKey(org, ['employees:write']);
    const res = await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', rawKey).expect(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('a JWT bearer token is not accepted on integration routes → 401', async () => {
    await req(app).get('/api/v1/integrations/hris/ping').set('Authorization', `Bearer ${org.admin.accessToken}`).expect(401);
  });

  it('PARTICIPANT cannot manage API clients → 403', async () => {
    const email = `p${uid()}@stp.lk`;
    await createUserInOrg(ds, org.id, { email, firstName: 'P', lastName: 'Q', role: 'participant', password: 'Participant1!' });
    const p = await login(app, email, 'Participant1!');
    await authPost(app, p, '/api/v1/integrations/api-clients', { name: 'x', scopes: ['results:read'] }).expect(403);
    await authGet(app, p, '/api/v1/integrations/api-clients').expect(403);
  });

  it('an admin cannot revoke another organisation’s key', async () => {
    const other = await registerOrg(app, uniqueOrg());
    const { id, rawKey } = await createKey(org, ['results:read']);
    await authDelete(app, other.admin, `/api/v1/integrations/api-clients/${id}`).expect(404);
    await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', rawKey).expect(200);
  });

  it('key of a deactivated organisation → 401', async () => {
    const o = await registerOrg(app, uniqueOrg());
    const { rawKey } = await createKey(o, ['results:read']);
    await deactivateOrg(ds, o.id);
    await req(app).get('/api/v1/integrations/hris/ping').set('X-Api-Key', rawKey).expect(401);
  });
});
