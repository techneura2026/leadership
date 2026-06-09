import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from './entities/assessment.entity';
import { AssessmentParticipant } from './entities/assessment-participant.entity';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { RaterNomination } from '../uc1-feedback/entities/rater-nomination.entity';
import { User } from '../../core/users/entities/user.entity';
import { EngineService } from './engine.service';
import { EngineController } from './engine.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Assessment, AssessmentParticipant, Organisation, RaterNomination, User])],
  providers: [EngineService],
  controllers: [EngineController],
  exports: [EngineService],
})
export class EngineModule {}
