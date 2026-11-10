/**
 * E2E: signed webhooks with retries (plan Task 15). Uses a local HTTP receiver.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as http from 'http';
import { AddressInfo } from 'net';
import { createHmac } from 'crypto';
import { getApp } from './setup/app';
import { authDelete, authGet, authPost, getSeedCompetencyIds, registerOrg, req, TestOrg } from './setup/helpers';
import { setupHrisOrg, uniqueHrisOrg } from './setup/hris';

interface Received { headers: http.IncomingHttpHeaders; body: string }

function startReceiver(status = 200): Promise<{ url: string; received: Received[]; close: () => void }> {
  const received: Received[] = [];
  const server = http.createServer((rq, rs) => {
    let body = '';
    rq.on('data', (c) => (body += c));
    rq.on('end', () => {
      received.push({ headers: rq.headers, body });
      rs.statusCode = status;
      rs.end('ok');
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`, received, close: () => server.close() }),
    ),
  );
}

const waitFor = async (cond: () => boolean | Promise<boolean>, ms = 15_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

describe('[HRIS-WH] webhooks', () => {
  let app: INestApplication;
  let ds: DataSource;
  let org: TestOrg;
  let key: string;
  let competencyIds: string[];
  const receivers: Array<{ close: () => void }> = [];

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    ({ org, key } = await setupHrisOrg(app, ds, ['M-1', 'R-1']));
    competencyIds = await getSeedCompetencyIds(ds, 1);
  });
  afterAll(() => receivers.forEach((r) => r.close()));

  const addEndpoint = async (url: string, events: string[]) =>
    (await authPost(app, org.admin, '/api/v1/integrations/webhooks', { url, events }).expect(201)).body.data;
  const startCycle = async (cycleRef: string) =>
    (await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef, title: cycleRef, types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30',
      employeeRefs: ['R-1'], competencyIds,
    }).expect(201)).body.data.assessments[0].assessmentId as string;

  let primary: Awaited<ReturnType<typeof startReceiver>>;
  let primarySecret: string;
  let primaryId: string;

  it('creating an endpoint returns its secret once; the list never includes it', async () => {
    primary = await startReceiver();
    receivers.push(primary);
    const created = await addEndpoint(primary.url, ['assessment.launched', 'assessment.closed']);
    expect(created.secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    primarySecret = created.secret;
    primaryId = created.id;
    const list = await authGet(app, org.admin, '/api/v1/integrations/webhooks').expect(200);
    expect(JSON.stringify(list.body)).not.toContain(primarySecret);
    expect(list.body.data[0]).toMatchObject({ id: primaryId, url: primary.url, events: ['assessment.launched', 'assessment.closed'], isActive: true });
  });

  it('closing a cycle assessment delivers a signed assessment.closed with employeeRefs', async () => {
    const assessmentId = await startCycle('WH-1');
    await authPost(app, org.admin, `/api/v1/assessments/${assessmentId}/close`).expect((r) => expect([200, 201]).toContain(r.status));
    const ok = await waitFor(() => primary.received.some((r) => r.headers['x-leaderprism-event'] === 'assessment.closed'));
    expect(ok).toBe(true);
    const hit = primary.received.find((r) => r.headers['x-leaderprism-event'] === 'assessment.closed')!;
    const body = JSON.parse(hit.body);
    expect(body).toMatchObject({ event: 'assessment.closed', cycleRef: 'WH-1', assessmentId, employeeRefs: ['R-1'] });
    expect(typeof body.orgRef).toBe('string');
    const ts = hit.headers['x-leaderprism-timestamp'] as string;
    const expected = createHmac('sha256', primarySecret).update(`${ts}.${hit.body}`).digest('hex');
    expect(hit.headers['x-leaderprism-signature']).toBe(`sha256=${expected}`);
    expect(hit.headers['x-leaderprism-delivery']).toMatch(/^[0-9a-f-]{36}$/);
    expect(primary.received.some((r) => r.headers['x-leaderprism-event'] === 'assessment.launched')).toBe(true);
  });

  it('an endpoint not subscribed to an event receives nothing for it', async () => {
    const other = await startReceiver();
    receivers.push(other);
    await addEndpoint(other.url, ['report.ready']);
    const assessmentId = await startCycle('WH-2');
    await authPost(app, org.admin, `/api/v1/assessments/${assessmentId}/close`);
    await waitFor(() => primary.received.some((r) => JSON.parse(r.body).cycleRef === 'WH-2' && r.headers['x-leaderprism-event'] === 'assessment.closed'));
    await new Promise((r) => setTimeout(r, 1000));
    expect(other.received).toHaveLength(0);
  });

  it('a receiver answering 500 leaves the delivery pending with the attempt recorded', async () => {
    const failing = await startReceiver(500);
    receivers.push(failing);
    const ep = await addEndpoint(failing.url, ['assessment.launched']);
    await startCycle('WH-3');
    const recorded = await waitFor(async () => {
      const rows = await ds.query(`SELECT status, attempts, last_status_code FROM webhook_deliveries WHERE endpoint_id = $1`, [ep.id]);
      return rows.length === 1 && rows[0].attempts >= 1 && rows[0].last_status_code === 500;
    });
    expect(recorded).toBe(true);
    const row = (await ds.query(`SELECT status FROM webhook_deliveries WHERE endpoint_id = $1`, [ep.id]))[0];
    expect(row.status).toBe('pending');
  });

  it('the deliveries list shows recent deliveries; test sends a ping', async () => {
    const list = await authGet(app, org.admin, '/api/v1/integrations/webhooks/deliveries?limit=50').expect(200);
    expect(list.body.data.some((d: any) => d.event === 'assessment.closed' && d.status === 'succeeded')).toBe(true);
    await authPost(app, org.admin, `/api/v1/integrations/webhooks/${primaryId}/test`).expect((r) => expect([200, 201]).toContain(r.status));
    expect(await waitFor(() => primary.received.some((r) => r.headers['x-leaderprism-event'] === 'ping'))).toBe(true);
  });

  it('rejects invalid URLs and unknown events; another organisation cannot delete the endpoint', async () => {
    await authPost(app, org.admin, '/api/v1/integrations/webhooks', { url: 'not a url', events: ['assessment.closed'] }).expect(400);
    await authPost(app, org.admin, '/api/v1/integrations/webhooks', { url: primary.url, events: ['everything'] }).expect(400);
    const other = await registerOrg(app, uniqueHrisOrg());
    await authDelete(app, other.admin, `/api/v1/integrations/webhooks/${primaryId}`).expect(404);
    await authDelete(app, org.admin, `/api/v1/integrations/webhooks/${primaryId}`).expect(204);
  });
});
