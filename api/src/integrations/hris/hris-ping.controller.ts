import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationOrgId } from '../api-clients/integration-context.decorator';

@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisPingController {
  @Get('ping')
  @RequireScopes('results:read')
  @ApiOperation({ summary: 'Connection test — returns the organisation the API key belongs to' })
  ping(@IntegrationOrgId() orgId: string) {
    return { orgId };
  }
}
