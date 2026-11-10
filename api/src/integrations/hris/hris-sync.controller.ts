import { Body, Controller, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationOrgId } from '../api-clients/integration-context.decorator';
import { HrisSyncService } from './hris-sync.service';
import { SyncDepartmentsDto } from './dto/sync-departments.dto';

@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisSyncController {
  constructor(private readonly sync: HrisSyncService) {}

  @Put('departments')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('employees:write')
  @ApiOperation({ summary: 'Upsert departments by departmentRef (max 1000 rows); returns per-row results' })
  syncDepartments(@IntegrationOrgId() orgId: string, @Body() dto: SyncDepartmentsDto) {
    return this.sync.syncDepartments(orgId, dto.departments);
  }
}
