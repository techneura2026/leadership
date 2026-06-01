import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService, OrgDashboardData, HeatmapEntry, SuccessionOverview } from './analytics.service';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';

@ApiTags('Analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get key organisational metrics dashboard' })
  getDashboard(@Request() req: any): Promise<OrgDashboardData> {
    return this.analyticsService.getOrgDashboard(req.user.orgId);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Get average competency scores heatmap for an assessment' })
  getHeatmap(@Request() req: any, @Query('assessmentId') assessmentId: string): Promise<HeatmapEntry[]> {
    return this.analyticsService.getCompetencyHeatmap(req.user.orgId, assessmentId);
  }

  @Get('succession')
  @ApiOperation({ summary: 'Get succession pipeline overview by readiness rating and role' })
  getSuccession(@Request() req: any): Promise<SuccessionOverview> {
    return this.analyticsService.getSuccessionOverview(req.user.orgId);
  }
}
