import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReportType } from '@leaderprism/shared';
import { ReportingService } from './reporting.service';

export interface ReportJobData {
  orgId: string;
  assessmentId: string;
  participantId: string | null;
  reportType: ReportType;
  language: string;
  requestedBy: string;
}

@Processor('reports')
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly reportingService: ReportingService) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const { orgId, assessmentId, participantId, reportType, language, requestedBy } = job.data;

    this.logger.log(
      `Processing report job ${job.id}: type=${reportType} assessment=${assessmentId} participant=${participantId}`,
    );

    try {
      await this.reportingService.generateReport(
        orgId,
        assessmentId,
        participantId,
        reportType,
        language,
        requestedBy,
      );
      this.logger.log(`Report job ${job.id} completed successfully`);
    } catch (err) {
      this.logger.error(`Report job ${job.id} failed:`, err);
      throw err; // BullMQ will retry based on job options
    }
  }
}
