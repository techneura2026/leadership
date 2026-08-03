import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Report } from './report.entity';
import { Assessment } from '../assessment/engine/entities/assessment.entity';
import { AssessmentParticipant } from '../assessment/engine/entities/assessment-participant.entity';
import { User } from '../core/users/entities/user.entity';
import { Organisation } from '../core/organisations/entities/organisation.entity';
import { ReadinessScore } from '../assessment/uc4-readiness/entities/readiness-score.entity';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import { ReportProcessor } from './report.processor';
import { PdfService } from './pdf.service';
import { Uc1FeedbackModule } from '../assessment/uc1-feedback/uc1-feedback.module';
import { Uc2CompetencyModule } from '../assessment/uc2-competency/uc2-competency.module';
import { Uc3PersonalityModule } from '../assessment/uc3-personality/uc3-personality.module';
import { Uc4ReadinessModule } from '../assessment/uc4-readiness/uc4-readiness.module';
import { NotificationsModule } from '../core/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Assessment, AssessmentParticipant, User, Organisation, ReadinessScore]),
    BullModule.registerQueue({
      name: 'reports',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 500 },
        removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
      },
    }),
    Uc1FeedbackModule,
    Uc2CompetencyModule,
    Uc3PersonalityModule,
    Uc4ReadinessModule,
    NotificationsModule,
  ],
  providers: [ReportingService, ReportProcessor, PdfService],
  controllers: [ReportingController],
  exports: [ReportingService, PdfService],
})
export class ReportingModule {}
