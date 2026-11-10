import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationsModule } from '../core/organisations/organisations.module';
import { ApiClient } from './api-clients/api-client.entity';
import { ApiClientsService } from './api-clients/api-clients.service';
import { ApiClientsController } from './api-clients/api-clients.controller';
import { ApiKeyGuard } from './api-clients/api-key.guard';
import { HrisPingController } from './hris/hris-ping.controller';

/**
 * Everything an external HRIS touches: API clients, sync, assessment requests, results export,
 * report links, SSO tickets and webhooks. Talks to other modules through their exported services only.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiClient]), OrganisationsModule],
  providers: [ApiClientsService, ApiKeyGuard],
  controllers: [ApiClientsController, HrisPingController],
})
export class IntegrationsModule {}
