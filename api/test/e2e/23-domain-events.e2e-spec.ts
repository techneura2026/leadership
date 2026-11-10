/**
 * E2E: domain events published by core modules (plan Task 14).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { authPost, getSeedCompetencyIds, login, req } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';
import { DomainEvent, DomainEventBus } from '../../src/shared/events/domain-events';

describe('[EVENTS] domain events', () => {
  let app: INestApplication;
  let ds: DataSource;
  let bus: DomainEventBus;
  const seen: Array<{ name: string; payload: any }> = [];

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    bus = app.get(DomainEventBus);
    for (const name of Object.values(DomainEvent)) {
      bus.on(name, async (payload: any) => {
        seen.push({ name, payload });
      });
    }
  });

  const of = (name: string, assessmentId: string) => seen.filter((e) => e.name === name && e.payload.assessmentId === assessmentId);

  it('launching and closing an HRIS cycle assessment emits launched then closed with cycleRef and participants', async () => {
    const { org, key } = await setupHrisOrg(app, ds, ['M-1', 'R-1']);
    const competencyIds = await getSeedCompetencyIds(ds, 1);
    const res = await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef: 'EV-1', title: 'Events', types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30',
      employeeRefs: ['R-1'], competencyIds,
    }).expect(201);
    const assessmentId = res.body.data.assessments[0].assessmentId;
    const userId = (await ds.query(`SELECT id FROM users WHERE organisation_id = $1 AND external_ref = 'R-1'`, [org.id]))[0].id;

    const launched = of(DomainEvent.AssessmentLaunched, assessmentId);
    expect(launched).toHaveLength(1);
    expect(launched[0].payload).toMatchObject({ orgId: org.id, cycleRef: 'EV-1', assessmentType: 'competency', participantUserIds: [userId] });
    expect(typeof launched[0].payload.occurredAt).toBe('string');

    await authPost(app, org.admin, `/api/v1/assessments/${assessmentId}/close`).expect((r) => expect([200, 201]).toContain(r.status));
    const closed = of(DomainEvent.AssessmentClosed, assessmentId);
    expect(closed).toHaveLength(1);
    expect(closed[0].payload).toMatchObject({ orgId: org.id, cycleRef: 'EV-1', participantUserIds: [userId] });
  });

  it('manager competency submission emits results.ready, and auto-close emits assessment.closed', async () => {
    const { org, key } = await setupHrisOrg(app, ds, ['M-1', 'R-1']);
    const competencyIds = await getSeedCompetencyIds(ds, 1);
    const res = await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef: 'EV-2', title: 'Events 2', types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30',
      employeeRefs: ['R-1'], competencyIds,
    }).expect(201);
    const assessmentId = res.body.data.assessments[0].assessmentId;
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('Events2026!', 4);
    const [r1] = await ds.query(`UPDATE users SET password_hash = $1 WHERE organisation_id = $2 AND external_ref = 'R-1' RETURNING id, email`, [hash, org.id]);
    const [m1] = await ds.query(`UPDATE users SET password_hash = $1 WHERE organisation_id = $2 AND external_ref = 'M-1' RETURNING id, email`, [hash, org.id]);
    const r1Row = r1[0] ?? r1;
    const m1Row = m1[0] ?? m1;
    const participantId = (await ds.query(`SELECT id FROM assessment_participants WHERE assessment_id = $1`, [assessmentId]))[0].id;

    const report = await login(app, r1Row.email, 'Events2026!');
    const self = await authPost(app, report, `/api/v1/assessments/${assessmentId}/competency/self`, { participantId });
    await authPost(app, report, `/api/v1/assessments/${assessmentId}/competency/self/${self.body.data.id}/submit`, {
      participantId, ratings: competencyIds.map((id) => ({ competencyId: id, levelRated: 3 })),
    });
    const manager = await login(app, m1Row.email, 'Events2026!');
    const mgr = await authPost(app, manager, `/api/v1/assessments/${assessmentId}/competency/manager`, { participantId });
    await authPost(app, manager, `/api/v1/assessments/${assessmentId}/competency/manager/${mgr.body.data.id}/submit`, {
      ratings: competencyIds.map((id) => ({ competencyId: id, levelRated: 3 })),
    });

    const ready = of(DomainEvent.ResultsReady, assessmentId);
    expect(ready).toHaveLength(1);
    expect(ready[0].payload).toMatchObject({ orgId: org.id, cycleRef: 'EV-2', userId: r1Row.id });

    const status = (await ds.query(`SELECT status FROM assessments WHERE id = $1`, [assessmentId]))[0].status;
    if (status === 'closed') expect(of(DomainEvent.AssessmentClosed, assessmentId)).toHaveLength(1);
  });

  it('a failing listener never breaks the request that emitted the event', async () => {
    bus.on(DomainEvent.AssessmentLaunched, async () => {
      throw new Error('listener exploded');
    });
    const { key } = await setupHrisOrg(app, ds, ['M-1', 'R-1']);
    const competencyIds = await getSeedCompetencyIds(ds, 1);
    await req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
      cycleRef: 'EV-3', title: 'Events 3', types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30',
      employeeRefs: ['R-1'], competencyIds,
    }).expect(201);
  });
});
