import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalityResponse } from './entities/personality-response.entity';
import { PersonalityScore } from './entities/personality-score.entity';
import { NormativeDatum } from './entities/normative-datum.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Item } from '../items/entities/item.entity';
import { BigFiveScoringService } from './big-five-scoring.service';
import { Uc3PersonalityService } from './uc3-personality.service';
import { Uc3PersonalityController } from './uc3-personality.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonalityResponse,
      PersonalityScore,
      NormativeDatum,
      Assessment,
      AssessmentParticipant,
      Item,
    ]),
  ],
  providers: [BigFiveScoringService, Uc3PersonalityService],
  controllers: [Uc3PersonalityController],
  exports: [BigFiveScoringService, Uc3PersonalityService],
})
export class Uc3PersonalityModule {}
