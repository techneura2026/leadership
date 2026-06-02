import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from '../assessment/engine/entities/assessment.entity';
import { AssessmentParticipant } from '../assessment/engine/entities/assessment-participant.entity';
import { Report } from '../reporting/report.entity';
import { RaterNomination } from '../assessment/uc1-feedback/entities/rater-nomination.entity';
import { CompetencyRating } from '../assessment/uc2-competency/entities/competency-rating.entity';
import { CompetencyAssessment } from '../assessment/uc2-competency/entities/competency-assessment.entity';
import { ReadinessScore } from '../assessment/uc4-readiness/entities/readiness-score.entity';
import { Competency } from '../assessment/items/entities/competency.entity';
import { RoleProfile } from '../assessment/uc4-readiness/entities/role-profile.entity';
import { PersonalityScore } from '../assessment/uc3-personality/entities/personality-score.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assessment,
      AssessmentParticipant,
      Report,
      RaterNomination,
      CompetencyRating,
      CompetencyAssessment,
      ReadinessScore,
      Competency,
      RoleProfile,
      PersonalityScore,
    ]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
