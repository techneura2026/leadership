/**
 * E2E: scheduled reminders and SSO ticket cleanup (plan Task 24). Calls the job handlers directly.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { getSeedCompetencyIds, req } from './setup/helpers';
import { setupHrisOrg } from './setup/hris';
import { SchedulerService } from '../../src/core/scheduler/scheduler.service';
import { NotificationsService } from '../../src/core/notifications/notifications.service';

describe('[SCHED] scheduled jobs', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
  });

  it('auto-reminders remind only participants of assessments due today (reminderDays before endDate)', async () => {
    const { key, emails } = await setupHrisOrg(app, ds, ['M-1', 'E-1', 'E-2']);
    const competencyIds = await getSeedCompetencyIds(ds, 1);
    const request = (cycleRef: string, ref: string) =>
      req(app).post('/api/v1/integrations/hris/assessment-requests').set('X-Api-Key', key).send({
        cycleRef, title: cycleRef, types: ['competency'], startDate: '2027-01-01', endDate: '2027-06-30T18:00:00Z',
        employeeRefs: [ref], competencyIds,
      }).expect(201);
    const due = (await request('SC-DUE', 'E-1')).body.data.assessments[0].assessmentId;
    const notDue = (await request('SC-LATER', 'E-2')).body.data.assessments[0].assessmentId;
    await ds.query(`UPDATE assessments SET config = config || '{"reminderDays":[3]}'::jsonb WHERE id = $1`, [due]);
    await ds.query(`UPDATE assessments SET config = config || '{"reminderDays":[5]}'::jsonb WHERE id = $1`, [notDue]);

    const spy = jest.spyOn(app.get(NotificationsService), 'sendReminder');
    try {
      const result = await app.get(SchedulerService).runAutoReminders(new Date('2027-06-27T03:00:00Z'));
      const recipients = spy.mock.calls.map((c) => c[0]);
      expect(recipients).toContain(emails['E-1']);
      expect(recipients).not.toContain(emails['E-2']);
      expect(result.assessments).toBeGreaterThanOrEqual(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('purge removes SSO tickets more than a day past expiry and keeps recent ones', async () => {
    const { org, key } = await setupHrisOrg(app, ds, ['M-1', 'E-1']);
    await req(app).post('/api/v1/integrations/hris/sso-tickets').set('X-Api-Key', key).send({ employeeRef: 'E-1' }).expect(201);
    await req(app).post('/api/v1/integrations/hris/sso-tickets').set('X-Api-Key', key).send({ employeeRef: 'E-1' }).expect(201);
    const [old] = await ds.query(`SELECT id FROM sso_tickets WHERE organisation_id = $1 LIMIT 1`, [org.id]);
    await ds.query(`UPDATE sso_tickets SET expires_at = now() - interval '2 days' WHERE id = $1`, [old.id]);

    const removed = await app.get(SchedulerService).purgeSsoTickets();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await ds.query(`SELECT id FROM sso_tickets WHERE organisation_id = $1`, [org.id])).toHaveLength(1);
  });

  it('registers both repeatable jobs once, even if registration runs twice', async () => {
    const scheduler = app.get(SchedulerService);
    await scheduler.registerJobs();
    await scheduler.registerJobs();
    const names = (await scheduler.listRepeatableJobs()).map((j) => j.name).sort();
    expect(names).toEqual(['auto-reminders', 'purge-sso-tickets']);
  });
});
