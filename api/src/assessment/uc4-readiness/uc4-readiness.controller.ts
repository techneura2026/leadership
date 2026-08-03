import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Uc4ReadinessService } from './uc4-readiness.service';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';
import { SubmitSjtResponseDto } from './dto/submit-sjt-response.dto';
import { SubmitLearningAgilityResponseDto } from './dto/submit-learning-agility-response.dto';
import { CreateRoleProfileDto } from './dto/create-role-profile.dto';
import { SetPerformanceOverrideDto } from './dto/set-performance-override.dto';

@ApiTags('Readiness & Succession (UC4)')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class Uc4ReadinessController {
  constructor(private readonly uc4Service: Uc4ReadinessService) {}

  // ── Role Profiles ───────────────────────────────────────────────────────

  @Get('role-profiles')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List role profiles for the organisation' })
  getRoleProfiles(@Request() req: any) {
    return this.uc4Service.getRoleProfiles(req.user.orgId);
  }

  @Post('role-profiles')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a target role profile' })
  createRoleProfile(@Request() req: any, @Body() dto: CreateRoleProfileDto) {
    return this.uc4Service.createRoleProfile(req.user.orgId, dto);
  }

  // ── SJT ─────────────────────────────────────────────────────────────────

  @Get('assessments/:id/sjt/:participantId')
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get SJT questionnaire with progress state' })
  getSjtQuestionnaire(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.uc4Service.getSjtQuestionnaire(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('assessments/:id/sjt/:participantId/responses')
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Submit a SJT scenario response' })
  submitSjtResponse(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() body: SubmitSjtResponseDto,
  ) {
    return this.uc4Service.submitSjtResponse(
      assessmentId,
      participantId,
      req.user.orgId,
      body.itemId,
      body.selectedOption,
      req.user.sub,
      req.user.role,
    );
  }

  // ── Learning Agility ────────────────────────────────────────────────────

  @Get('assessments/:id/learning-agility/:participantId')
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get learning agility questionnaire' })
  getLearningAgilityQuestionnaire(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.uc4Service.getLearningAgilityQuestionnaire(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('assessments/:id/learning-agility/:participantId/responses')
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Submit a learning agility response' })
  submitLearningAgilityResponse(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() body: SubmitLearningAgilityResponseDto,
  ) {
    return this.uc4Service.submitLearningAgilityResponse(
      assessmentId,
      participantId,
      req.user.orgId,
      body.itemId,
      body.value,
      req.user.sub,
      req.user.role,
    );
  }

  // ── Readiness Scoring ────────────────────────────────────────────────────

  @Post('assessments/:id/readiness/:participantId/compute')
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Compute readiness score for a participant against a role profile' })
  computeReadiness(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body('roleProfileId') roleProfileId: string,
  ) {
    return this.uc4Service.computeReadiness(
      assessmentId,
      participantId,
      roleProfileId ?? null,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('assessments/:id/readiness/:participantId/scores')
  @ApiOperation({ summary: "Get the participant's own readiness score(s), including 9-box placement" })
  getMyReadinessScores(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.uc4Service.getMyReadinessScores(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  // ── Performance override (9-box) ────────────────────────────────────────

  @Patch('readiness-scores/:id/performance-override')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Set or clear a manual override for a candidate's 9-box performance placement" })
  setPerformanceOverride(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetPerformanceOverrideDto,
  ) {
    return this.uc4Service.setPerformanceOverride(
      id,
      req.user.orgId,
      req.user.sub,
      body.gridPerformance ?? null,
      body.note ?? null,
    );
  }

  // ── Succession Dashboard ─────────────────────────────────────────────────

  @Get('succession/dashboard')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get succession dashboard with 9-box talent map' })
  getSuccessionDashboard(
    @Request() req: any,
    @Query('assessmentId') assessmentId?: string,
  ) {
    return this.uc4Service.getSuccessionDashboard(req.user.orgId, assessmentId);
  }
}
