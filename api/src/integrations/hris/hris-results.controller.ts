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
import { AuditService } from '../../core/audit/audit.service';

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
  constructor(
    private readonly results: HrisResultsService,
    private readonly audit: AuditService,
  ) {}

  @Get('results')
  @RequireScopes('results:read')
  @ApiOperation({ summary: 'Competency and 360 results for a review cycle — one employee (employeeRef) or a page (cursor, limit ≤ 100)' })
  async getResults(@IntegrationContext() principal: IntegrationPrincipal, @Query() q: ResultsQueryDto) {
    const opts = { talent: principal.scopes.includes('talent:read') };
    const body = q.employeeRef
      ? await this.results.getEmployeeResult(principal.orgId, q.cycleRef, q.employeeRef, opts)
      : await this.results.getResultsPage(principal.orgId, q.cycleRef, q.cursor, q.limit ?? 50, opts);
    await this.audit.record({
      orgId: principal.orgId, actorType: 'api_client', actorId: principal.clientId, action: 'integration.results.read',
      entityType: 'cycle', entityId: q.cycleRef,
      metadata: { cycleRef: q.cycleRef, employees: 'data' in body ? body.data.length : 1, talent: opts.talent, employeeRef: q.employeeRef ?? null },
    });
    return body;
  }

  @Get('succession')
  @RequireScopes('talent:read')
  @ApiOperation({ summary: 'Key roles and nominated successors by employeeRef (O-6)' })
  getSuccession(@IntegrationOrgId() orgId: string) {
    return this.results.getSuccession(orgId);
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
  constructor(
    private readonly results: HrisResultsService,
    private readonly audit: AuditService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Download a report PDF through a signed link from results.reports' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const { path, orgId } = await this.results.resolveSignedReport(id, exp, sig);
    await this.audit.record({ orgId, actorType: 'system', action: 'integration.report.downloaded', entityType: 'report', entityId: id, metadata: { via: 'signed_link' } });
    if (path.startsWith('http')) return res.redirect(path);
    if (!fs.existsSync(path)) throw new NotFoundException('Report file not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
    fs.createReadStream(path).pipe(res);
  }
}
