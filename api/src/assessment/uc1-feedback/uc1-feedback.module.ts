import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaterNomination } from './entities/rater-nomination.entity';
import { RaterResponse } from './entities/rater-response.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Uc1FeedbackService } from './uc1-feedback.service';
import { Uc1FeedbackController } from './uc1-feedback.controller';
import { NotificationsModule } from '../../core/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RaterNomination, RaterResponse, Assessment, AssessmentParticipant]),
    NotificationsModule,
  ],
  providers: [Uc1FeedbackService],
  controllers: [Uc1FeedbackController],
  exports: [Uc1FeedbackService],
})
export class Uc1FeedbackModule {}
