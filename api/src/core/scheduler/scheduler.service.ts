import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AssessmentType } from '@leaderprism/shared';
import { EngineService } from '../../assessment/engine/engine.service';
import { Uc1FeedbackService } from '../../assessment/uc1-feedback/uc1-feedback.service';
import { SsoTicketService } from '../auth/sso/sso-ticket.service';
import { REMINDER_TIME_ZONE } from '../../assessment/shared/reminder-schedule';

export const SCHEDULER_QUEUE = 'scheduler';

/** Daily background jobs, run on BullMQ job schedulers (one schedule per job id, so restarts never duplicate). */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(SCHEDULER_QUEUE) private readonly queue: Queue,
    private readonly engine: EngineService,
    private readonly feedback: Uc1FeedbackService,
    private readonly ssoTickets: SsoTicketService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerJobs().catch((err) => this.logger.error(`Could not register scheduled jobs: ${err?.message ?? err}`));
  }

  async registerJobs(): Promise<void> {
    await this.queue.upsertJobScheduler('auto-reminders', { pattern: '0 8 * * *', tz: REMINDER_TIME_ZONE }, { name: 'auto-reminders' });
    await this.queue.upsertJobScheduler('purge-sso-tickets', { pattern: '0 3 * * *', tz: REMINDER_TIME_ZONE }, { name: 'purge-sso-tickets' });
  }

  async listRepeatableJobs(): Promise<Array<{ name: string }>> {
    return (await this.queue.getJobSchedulers()).map((j) => ({ name: j.name }));
  }

  /** Sends reminders for every active assessment whose reminderDays fall on `today`. */
  async runAutoReminders(today: Date = new Date()): Promise<{ assessments: number; sent: number }> {
    const due = await this.engine.findDueForReminder(today);
    let sent = 0;
    for (const a of due) {
      try {
        const res =
          a.assessmentType === AssessmentType.FEEDBACK_360
            ? await this.feedback.sendReminders(a.id, a.organisationId)
            : await this.engine.sendReminders(a.id, a.organisationId);
        sent += res.sent;
      } catch (err: any) {
        this.logger.warn(`Auto-reminders failed for assessment ${a.id}: ${err?.message ?? err}`);
      }
    }
    this.logger.log(`Auto-reminders: ${due.length} assessment(s), ${sent} reminder(s)`);
    return { assessments: due.length, sent };
  }

  async purgeSsoTickets(): Promise<number> {
    const removed = await this.ssoTickets.purgeExpired();
    this.logger.log(`Purged ${removed} expired SSO ticket(s)`);
    return removed;
  }
}
