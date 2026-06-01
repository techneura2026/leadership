import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from './entities/assessment.entity';
import { AssessmentParticipant } from './entities/assessment-participant.entity';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { EngineService } from './engine.service';
import { EngineController } from './engine.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Assessment, AssessmentParticipant, Organisation])],
  providers: [EngineService],
  controllers: [EngineController],
  exports: [EngineService],
})
export class EngineModule {}
