import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleProfile } from './entities/role-profile.entity';
import { SjtResponse } from './entities/sjt-response.entity';
import { LearningAgilityResponse } from './entities/learning-agility-response.entity';
import { ReadinessScore } from './entities/readiness-score.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Item } from '../items/entities/item.entity';
import { CompetencyRating } from '../uc2-competency/entities/competency-rating.entity';
import { CompetencyAssessment } from '../uc2-competency/entities/competency-assessment.entity';
import { PersonalityScore } from '../uc3-personality/entities/personality-score.entity';
import { RaterNomination } from '../uc1-feedback/entities/rater-nomination.entity';
import { RaterResponse } from '../uc1-feedback/entities/rater-response.entity';
import { ReadinessScoringService } from './readiness-scoring.service';
import { Uc4ReadinessService } from './uc4-readiness.service';
import { Uc4ReadinessController } from './uc4-readiness.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleProfile,
      SjtResponse,
      LearningAgilityResponse,
      ReadinessScore,
      Assessment,
      AssessmentParticipant,
      Item,
      CompetencyRating,
      CompetencyAssessment,
      PersonalityScore,
      RaterNomination,
      RaterResponse,
    ]),
  ],
  providers: [ReadinessScoringService, Uc4ReadinessService],
  controllers: [Uc4ReadinessController],
  exports: [ReadinessScoringService, Uc4ReadinessService],
})
export class Uc4ReadinessModule {}
