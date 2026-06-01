import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetencyAssessment } from './entities/competency-assessment.entity';
import { CompetencyRating } from './entities/competency-rating.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Competency } from '../items/entities/competency.entity';
import { CompetencyDomain } from '../items/entities/competency-domain.entity';
import { Uc2CompetencyService } from './uc2-competency.service';
import { Uc2CompetencyController } from './uc2-competency.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompetencyAssessment,
      CompetencyRating,
      Assessment,
      AssessmentParticipant,
      Competency,
      CompetencyDomain,
    ]),
  ],
  providers: [Uc2CompetencyService],
  controllers: [Uc2CompetencyController],
  exports: [Uc2CompetencyService],
})
export class Uc2CompetencyModule {}
