import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { UserRole } from '@leaderprism/shared';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentOrgId } from '../../shared/decorators/current-user.decorator';
import { AuditService } from './audit.service';

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  // Quote everything containing separators; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

@ApiTags('Audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit log, newest first (cursor-paged)' })
  list(
    @CurrentOrgId() orgId: string,
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(orgId, {
      action: action || undefined,
      actorType: actorType || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      cursor: cursor || undefined,
      limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });
  }

  @Get('export.csv')
  @ApiOperation({ summary: 'Export the audit log as CSV (most recent 10,000 entries)' })
  async exportCsv(@CurrentOrgId() orgId: string, @Res() res: Response) {
    const { data } = await this.audit.list(orgId, { limit: 10_000 });
    const header = 'created_at,actor_type,actor_id,action,entity_type,entity_id,reason';
    const lines = data.map((l) =>
      [l.createdAt, l.actorType, l.actorId, l.action, l.entityType, l.entityId, l.reason].map(csvCell).join(','),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send([header, ...lines].join('\n'));
  }
}
