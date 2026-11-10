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

/**
 * Everything an external HRIS touches: API clients, sync, assessment requests, results export,
 * report links, SSO tickets and webhooks. Talks to other modules through their exported services only.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiClient]), OrganisationsModule, UsersModule, EngineModule],
  providers: [ApiClientsService, ApiKeyGuard, HrisSyncService, HrisAssessmentsService],
  controllers: [ApiClientsController, HrisPingController, HrisSyncController, HrisAssessmentsController],
})
export class IntegrationsModule {}
