import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Uc4ReadinessService, CreateRoleProfileDto } from './uc4-readiness.service';

@ApiTags('Readiness & Succession (UC4)')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class Uc4ReadinessController {
  constructor(private readonly uc4Service: Uc4ReadinessService) {}

  // ── Role Profiles ───────────────────────────────────────────────────────

  @Get('role-profiles')
  @ApiOperation({ summary: 'List role profiles for the organisation' })
  getRoleProfiles(@Request() req: any) {
    return this.uc4Service.getRoleProfiles(req.user.orgId);
  }

  @Post('role-profiles')
  @ApiOperation({ summary: 'Create a target role profile' })
  createRoleProfile(@Request() req: any, @Body() dto: CreateRoleProfileDto) {
    return this.uc4Service.createRoleProfile(req.user.orgId, dto);
  }

  // ── SJT ─────────────────────────────────────────────────────────────────

  @Get('assessments/:id/sjt/:participantId')
  @ApiOperation({ summary: 'Get SJT questionnaire with progress state' })
  getSjtQuestionnaire(
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.uc4Service.getSjtQuestionnaire(assessmentId, participantId);
  }

  @Post('assessments/:id/sjt/:participantId/responses')
  @ApiOperation({ summary: 'Submit a SJT scenario response' })
  submitSjtResponse(
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() body: { itemId: string; selectedOption: number },
  ) {
    return this.uc4Service.submitSjtResponse(
      assessmentId,
      participantId,
      body.itemId,
      body.selectedOption,
    );
  }

  // ── Learning Agility ────────────────────────────────────────────────────

  @Get('assessments/:id/learning-agility/:participantId')
  @ApiOperation({ summary: 'Get learning agility questionnaire' })
  getLearningAgilityQuestionnaire(
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.uc4Service.getLearningAgilityQuestionnaire(assessmentId, participantId);
  }

  @Post('assessments/:id/learning-agility/:participantId/responses')
  @ApiOperation({ summary: 'Submit a learning agility response' })
  submitLearningAgilityResponse(
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() body: { itemId: string; value: number },
  ) {
    return this.uc4Service.submitLearningAgilityResponse(
      assessmentId,
      participantId,
      body.itemId,
      body.value,
    );
  }

  // ── Readiness Scoring ────────────────────────────────────────────────────

  @Post('assessments/:id/readiness/:participantId/compute')
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
    );
  }

  // ── Succession Dashboard ─────────────────────────────────────────────────

  @Get('succession/dashboard')
  @ApiOperation({ summary: 'Get succession dashboard with 9-box talent map' })
  getSuccessionDashboard(
    @Request() req: any,
    @Query('assessmentId') assessmentId?: string,
  ) {
    return this.uc4Service.getSuccessionDashboard(req.user.orgId, assessmentId);
  }
}
