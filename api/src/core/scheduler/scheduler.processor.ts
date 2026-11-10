import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCHEDULER_QUEUE, SchedulerService } from './scheduler.service';

@Processor(SCHEDULER_QUEUE)
export class SchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulerProcessor.name);

  constructor(private readonly scheduler: SchedulerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'auto-reminders':
        await this.scheduler.runAutoReminders();
        return;
      case 'purge-sso-tickets':
        await this.scheduler.purgeSsoTickets();
        return;
      default:
        this.logger.warn(`Unknown scheduled job ${job.name}`);
    }
  }
}
