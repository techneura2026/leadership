import { Body, Controller, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { SyncRowResult } from '@leaderprism/shared';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationOrgId } from '../api-clients/integration-context.decorator';
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
  ) {}

  @Put('performance-scores')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('scores:write')
  @ApiOperation({ summary: 'Final calibrated performance scores per employee for a cycle — sets the 9-box performance axis' })
  async put(@IntegrationOrgId() orgId: string, @Body() dto: PerformanceScoresDto): Promise<{ results: SyncRowResult[] }> {
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
    return { results };
  }
}
