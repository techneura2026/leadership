import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WEBHOOK_QUEUE, WebhooksService } from './webhooks.service';

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly webhooks: WebhooksService) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<void> {
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await this.webhooks.deliver(job.data.deliveryId, isFinalAttempt);
  }
}
