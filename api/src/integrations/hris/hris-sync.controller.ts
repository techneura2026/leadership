import { Body, Controller, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationContext } from '../api-clients/integration-context.decorator';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { HrisSyncService } from './hris-sync.service';
import { SyncDepartmentsDto } from './dto/sync-departments.dto';
import { SyncEmployeesDto } from './dto/sync-employees.dto';

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
  syncDepartments(@IntegrationContext() principal: IntegrationPrincipal, @Body() dto: SyncDepartmentsDto) {
    return this.sync.syncDepartments(principal, dto.departments);
  }

  @Put('employees')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('employees:write')
  @ApiOperation({ summary: 'Upsert employees by employeeRef (max 1000 rows); leavers are deactivated; returns per-row results' })
  syncEmployees(@IntegrationContext() principal: IntegrationPrincipal, @Body() dto: SyncEmployeesDto) {
    return this.sync.syncEmployees(principal, dto.employees, dto.fullSync ?? false);
  }
}
