import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Response } from 'express';
import * as fs from 'fs';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationContext, IntegrationOrgId } from '../api-clients/integration-context.decorator';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { HrisResultsService } from './hris-results.service';

class ReportRequestDto {
  @IsString() @MinLength(1) @MaxLength(100)
  cycleRef: string;

  @IsString() @MinLength(1) @MaxLength(100)
  employeeRef: string;

  @IsIn(['competency', 'individual_360'])
  type: 'competency' | 'individual_360';
}

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

  @Post('reports')
  @RequireScopes('reports:read')
  @ApiOperation({ summary: 'Queue a PDF report for an employee in a cycle; it appears in results.reports once ready' })
  requestReport(@IntegrationContext() principal: IntegrationPrincipal, @Body() dto: ReportRequestDto) {
    return this.results.requestReport(principal, dto);
  }
}

/** Signed report links — no API key: the HMAC signature is the credential. */
@ApiTags('HRIS Integration')
@Controller('integrations/hris/report-files')
export class HrisReportFilesController {
  constructor(private readonly results: HrisResultsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Download a report PDF through a signed link from results.reports' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const path = await this.results.resolveSignedReport(id, exp, sig);
    if (path.startsWith('http')) return res.redirect(path);
    if (!fs.existsSync(path)) throw new NotFoundException('Report file not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
    fs.createReadStream(path).pipe(res);
  }
}
