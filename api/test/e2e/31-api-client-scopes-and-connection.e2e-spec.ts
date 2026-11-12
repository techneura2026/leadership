/**
 * E2E: editing an API key's scopes (PATCH) and the one-time HRIS connection string on create.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authDelete, authGet, authPatch, authPost, req, registerOrg, TestOrg } from './setup/helpers';
import { setupHrisOrg, uniqueHrisOrg } from './setup/hris';

describe('[API-CLIENTS] scope editing and connection string', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;

  const create = (scopes: string[], who = org) =>
    authPost(app, who.admin, '/api/v1/integrations/api-clients', { name: 'HRIS', scopes }).expect(201);
  const ticket = (key: string) =>
    req(app).post('/api/v1/integrations/hris/sso-tickets').set('X-Api-Key', key).send({ employeeRef: 'E-1', redirectPath: '/dashboard' });

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org } = await setupHrisOrg(app, ds, ['M-1', 'E-1']));
  });

  describe('connection string', () => {
    it('create returns a connectionString with the key as user name and API_PUBLIC_URL as host', async () => {
      const res = await create(['employees:write']);
      const { rawKey, connectionString } = res.body.data;
      const u = new URL(connectionString);
      expect(decodeURIComponent(u.username)).toBe(rawKey);
      expect(u.host).toBe(new URL(process.env.API_PUBLIC_URL ?? 'http://localhost:3001').host);
      expect(u.protocol).toBe(new URL(process.env.API_PUBLIC_URL ?? 'http://localhost:3001').protocol);
    });

    it('list never contains a key or connection string', async () => {
      const res = await authGet(app, org.admin, '/api/v1/integrations/api-clients').expect(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('rawKey');
      expect(body).not.toContain('connectionString');
      for (const c of res.body.data) {
        expect(c.rawKey).toBeUndefined();
        expect(c.connectionString).toBeUndefined();
      }
    });
  });

  describe('PATCH /integrations/api-clients/:id', () => {
    let id: string;
    let key: string;

    beforeAll(async () => {
      // Make E-1 a plain (non-admin) employee so a ticket can be issued.
      const res = await create(['employees:write']);
      id = res.body.data.id;
      key = res.body.data.rawKey;
      await req(app).put('/api/v1/integrations/hris/employees').set('X-Api-Key', key).send({
        employees: [{ employeeRef: 'E-1', email: `e1.${Date.now()}@hris.lk`, firstName: 'E', lastName: 'One', employmentStatus: 'active' }],
      }).expect(200);
    });

    it('a key without sso:issue is refused, then accepted after PATCH, with the same secret', async () => {
      await ticket(key).expect(403);
      const res = await authPatch(app, org.admin, `/api/v1/integrations/api-clients/${id}`, { scopes: ['employees:write', 'sso:issue'] }).expect(200);
      expect(res.body.data.scopes.sort()).toEqual(['employees:write', 'sso:issue']);
      expect(res.body.data.keyPrefix).toBeDefined();
      expect(res.body.data.rawKey).toBeUndefined();
      expect(res.body.data.connectionString).toBeUndefined();
      await ticket(key).expect(201);
    });

    it('removing a scope takes effect on the next request', async () => {
      await authPatch(app, org.admin, `/api/v1/integrations/api-clients/${id}`, { scopes: ['employees:write'] }).expect(200);
      await ticket(key).expect(403);
    });

    it('unknown or empty scopes → 400', async () => {
      await authPatch(app, org.admin, `/api/v1/integrations/api-clients/${id}`, { scopes: ['nope:write'] }).expect(400);
      await authPatch(app, org.admin, `/api/v1/integrations/api-clients/${id}`, { scopes: [] }).expect(400);
    });

    it("another organisation's key → 404", async () => {
      const other = await registerOrg(app, uniqueHrisOrg());
      await authPatch(app, other.admin, `/api/v1/integrations/api-clients/${id}`, { scopes: ['results:read'] }).expect(404);
    });

    it('writes an audit row with before/after scopes and no secret', async () => {
      await authPatch(app, org.admin, `/api/v1/integrations/api-clients/${id}`, { scopes: ['employees:write', 'results:read'] }).expect(200);
      const rows = await ds.query(
        `SELECT * FROM audit_logs WHERE organisation_id = $1 AND action = 'integration.api_client.scopes_updated' AND entity_id = $2 ORDER BY created_at DESC`,
        [org.id, id],
      );
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[0];
      expect(row.actor_id).toBe(org.admin.userId);
      expect(JSON.stringify(row)).not.toContain(key);
      expect(row.before.scopes).toEqual(['employees:write']);
      expect(row.after.scopes.sort()).toEqual(['employees:write', 'results:read']);
    });

    it('a revoked key cannot be edited → 409', async () => {
      const r = await create(['employees:write']);
      await authDelete(app, org.admin, `/api/v1/integrations/api-clients/${r.body.data.id}`).expect(204);
      await authPatch(app, org.admin, `/api/v1/integrations/api-clients/${r.body.data.id}`, { scopes: ['results:read'] }).expect(409);
    });
  });
});
