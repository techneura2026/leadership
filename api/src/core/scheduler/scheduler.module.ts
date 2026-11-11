import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EngineModule } from '../../assessment/engine/engine.module';
import { Uc1FeedbackModule } from '../../assessment/uc1-feedback/uc1-feedback.module';
import { AuthModule } from '../auth/auth.module';
import { SCHEDULER_QUEUE, SchedulerService } from './scheduler.service';
import { SchedulerProcessor } from './scheduler.processor';

@Module({
  imports: [BullModule.registerQueue({ name: SCHEDULER_QUEUE }), EngineModule, Uc1FeedbackModule, AuthModule],
  providers: [SchedulerService, SchedulerProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
