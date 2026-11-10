import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationOrgId } from '../api-clients/integration-context.decorator';
import { HrisResultsService } from './hris-results.service';

class ResultsQueryDto {
  @IsString() @MinLength(1) @MaxLength(100)
  cycleRef: string;

  /** When given, returns that one employee's result; otherwise a page of results. */
  @IsOptional() @IsString() @MaxLength(100)
  employeeRef?: string;

  /** employeeRef to continue after (exclusive), from a previous page's nextCursor. */
  @IsOptional() @IsString() @MaxLength(100)
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisResultsController {
  constructor(private readonly results: HrisResultsService) {}

  @Get('results')
  @RequireScopes('results:read')
  @ApiOperation({ summary: 'Competency and 360 results for a review cycle — one employee (employeeRef) or a page (cursor, limit ≤ 100)' })
  getResults(@IntegrationOrgId() orgId: string, @Query() q: ResultsQueryDto) {
    if (q.employeeRef) return this.results.getEmployeeResult(orgId, q.cycleRef, q.employeeRef);
    return this.results.getResultsPage(orgId, q.cycleRef, q.cursor, q.limit ?? 50);
  }

  @Get('framework')
  @RequireScopes('results:read')
  @ApiOperation({ summary: 'Competency framework and role profiles, for building leadership KPIs (O-9)' })
  getFramework(@IntegrationOrgId() orgId: string) {
    return this.results.getFramework(orgId);
  }
}
