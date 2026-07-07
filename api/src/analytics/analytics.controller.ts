import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService, OrgDashboardData, HeatmapEntry, SuccessionOverview, RadarAggregate } from './analytics.service';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';

@ApiTags('Analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get key organisational metrics dashboard' })
  getDashboard(@Request() req: any): Promise<OrgDashboardData> {
    return this.analyticsService.getOrgDashboard(req.user.orgId);
  }

  @Get('heatmap')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get average competency scores heatmap for an assessment' })
  getHeatmap(@Request() req: any, @Query('assessmentId') assessmentId: string): Promise<HeatmapEntry[]> {
    return this.analyticsService.getCompetencyHeatmap(req.user.orgId, assessmentId);
  }

  @Get('succession')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get succession pipeline overview by readiness rating and role' })
  getSuccession(@Request() req: any): Promise<SuccessionOverview> {
    return this.analyticsService.getSuccessionOverview(req.user.orgId);
  }

  @Get('radar/me')
  @ApiOperation({ summary: 'Get aggregate radar chart data for the logged-in user' })
  getMeRadar(@Request() req: any): Promise<RadarAggregate> {
    return this.analyticsService.getUserAggregateRadar(req.user.sub);
  }

  @Get('radar/org')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get aggregate radar chart data for the organisation' })
  getOrgRadar(@Request() req: any): Promise<RadarAggregate> {
    return this.analyticsService.getOrgAggregateRadar(req.user.orgId);
  }

  @Get('radar/user/:userId')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get aggregate radar chart data for a specific user' })
  getUserRadar(@Param('userId') userId: string): Promise<RadarAggregate> {
    return this.analyticsService.getUserAggregateRadar(userId);
  }


  @Get('activity/monthly')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get monthly activity metrics for the organisation' })
  getMonthlyActivity(@Request() req: any): Promise<any> {
    return this.analyticsService.getMonthlyActivity(req.user.orgId);
  }

  @Get('activity/participants')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get participant activity metrics for the organisation' })
  getParticipantActivity(@Request() req: any): Promise<any> {
    return this.analyticsService.getParticipantActivity(req.user.orgId);
  }
}
