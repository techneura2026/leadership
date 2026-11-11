import { Body, Controller, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { SyncRowResult } from '@leaderprism/shared';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationContext } from '../api-clients/integration-context.decorator';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { AuditService } from '../../core/audit/audit.service';
import { UsersService } from '../../core/users/users.service';
import { Uc4ReadinessService } from '../../assessment/uc4-readiness/uc4-readiness.service';

class ScoreRowDto {
  @IsString() @MinLength(1) @MaxLength(100)
  employeeRef: string;

  /** 0–100; out-of-range values are reported per row as invalid_score. */
  @IsNumber()
  finalScore: number;

  @IsOptional() @IsString() @MaxLength(50)
  ratingBand?: string | null;

  @IsDateString()
  finalisedAt: string;
}

class PerformanceScoresDto {
  @IsString() @MinLength(1) @MaxLength(100)
  cycleRef: string;

  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ScoreRowDto)
  scores: ScoreRowDto[];
}

@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisScoresController {
  constructor(
    private readonly users: UsersService,
    private readonly readiness: Uc4ReadinessService,
    private readonly audit: AuditService,
  ) {}

  @Put('performance-scores')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('scores:write')
  @ApiOperation({ summary: 'Final calibrated performance scores per employee for a cycle — sets the 9-box performance axis' })
  async put(@IntegrationContext() principal: IntegrationPrincipal, @Body() dto: PerformanceScoresDto): Promise<{ results: SyncRowResult[] }> {
    const orgId = principal.orgId;
    const found = await this.users.findByExternalRefs(orgId, dto.scores.map((s) => s.employeeRef));
    const byRef = new Map(found.map((u) => [u.externalRef as string, u.id]));
    const results: SyncRowResult[] = [];
    const rows: Parameters<Uc4ReadinessService['upsertExternalPerformanceScores']>[1] = [];
    for (const s of dto.scores) {
      const userId = byRef.get(s.employeeRef);
      if (!userId) results.push({ ref: s.employeeRef, status: 'error', error: 'employee_not_found' });
      else if (!(s.finalScore >= 0 && s.finalScore <= 100)) results.push({ ref: s.employeeRef, status: 'error', error: 'invalid_score' });
      else {
        rows.push({ userId, cycleRef: dto.cycleRef, finalScore: s.finalScore, ratingBand: s.ratingBand ?? null, finalisedAt: new Date(s.finalisedAt) });
        results.push({ ref: s.employeeRef, status: 'updated', id: userId });
      }
    }
    await this.readiness.upsertExternalPerformanceScores(orgId, rows);
    await this.audit.record({
      orgId, actorType: 'api_client', actorId: principal.clientId, action: 'integration.performance_scores.received',
      entityType: 'cycle', entityId: dto.cycleRef,
      metadata: { rows: dto.scores.length, applied: rows.length, errors: results.filter((r) => r.status === 'error').length },
    });
    return { results };
  }
}
