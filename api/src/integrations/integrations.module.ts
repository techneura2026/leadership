import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationsModule } from '../core/organisations/organisations.module';
import { UsersModule } from '../core/users/users.module';
import { ApiClient } from './api-clients/api-client.entity';
import { ApiClientsService } from './api-clients/api-clients.service';
import { ApiClientsController } from './api-clients/api-clients.controller';
import { ApiKeyGuard } from './api-clients/api-key.guard';
import { HrisPingController } from './hris/hris-ping.controller';
import { HrisSyncController } from './hris/hris-sync.controller';
import { HrisSyncService } from './hris/hris-sync.service';
import { HrisAssessmentsController } from './hris/hris-assessments.controller';
import { HrisAssessmentsService } from './hris/hris-assessments.service';
import { EngineModule } from '../assessment/engine/engine.module';
import { Uc1FeedbackModule } from '../assessment/uc1-feedback/uc1-feedback.module';
import { Uc2CompetencyModule } from '../assessment/uc2-competency/uc2-competency.module';
import { Uc4ReadinessModule } from '../assessment/uc4-readiness/uc4-readiness.module';
import { ItemsModule } from '../assessment/items/items.module';
import { HrisReportFilesController, HrisResultsController } from './hris/hris-results.controller';
import { ReportingModule } from '../reporting/reporting.module';
import { HrisResultsService } from './hris/hris-results.service';

/**
 * Everything an external HRIS touches: API clients, sync, assessment requests, results export,
 * report links, SSO tickets and webhooks. Talks to other modules through their exported services only.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiClient]), OrganisationsModule, UsersModule, EngineModule, Uc1FeedbackModule,
    Uc2CompetencyModule, Uc4ReadinessModule, ItemsModule, ReportingModule],
  providers: [ApiClientsService, ApiKeyGuard, HrisSyncService, HrisAssessmentsService, HrisResultsService],
  controllers: [ApiClientsController, HrisPingController, HrisSyncController, HrisAssessmentsController, HrisResultsController,
    HrisReportFilesController],
})
export class IntegrationsModule {}
