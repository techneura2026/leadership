import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaterNomination } from './entities/rater-nomination.entity';
import { RaterResponse } from './entities/rater-response.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Competency } from '../items/entities/competency.entity';
import { User } from '../../core/users/entities/user.entity';
import { Uc1FeedbackService } from './uc1-feedback.service';
import { Uc1FeedbackController } from './uc1-feedback.controller';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RaterNomination, RaterResponse, Assessment, AssessmentParticipant, Competency, User]),
    NotificationsModule,
    EngineModule,
  ],
  providers: [Uc1FeedbackService],
  controllers: [Uc1FeedbackController],
  exports: [Uc1FeedbackService],
})
export class Uc1FeedbackModule {}
