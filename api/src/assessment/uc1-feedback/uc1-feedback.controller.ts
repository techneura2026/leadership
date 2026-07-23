import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Uc1FeedbackService, AggregatedScore } from './uc1-feedback.service';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';
import { NominateRatersDto } from './dto/nominate-raters.dto';
import { SaveParticipantResponsesDto } from './dto/save-participant-responses.dto';
import { SaveRaterBehaviourResponsesDto } from './dto/save-rater-behaviour-responses.dto';
import { SubmitRaterOverallDto } from './dto/submit-rater-overall.dto';

@ApiTags('360 Feedback')
@Controller()
export class Uc1FeedbackController {
  constructor(private readonly uc1Service: Uc1FeedbackService) {}

  // ── Protected endpoints ─────────────────────────────────────────────────

  @Get('assessments/:id/360/nominations')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOperation({ summary: 'Get nominations for a participant' })
  getNominations(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body('participantId') participantId: string,
  ) {
    return this.uc1Service.getNominations(assessmentId, participantId, req.user.orgId);
  }

  @Post('assessments/:id/360/nominations')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOperation({ summary: 'Nominate raters (participant nominates)' })
  nominateRaters(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body() body: NominateRatersDto,
  ) {
    return this.uc1Service.nominateRaters(
      assessmentId,
      body.participantId,
      body.raters,
      req.user.orgId,
    );
  }

  @Post('assessments/:id/360/nominations/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Admin approves all pending nominations and sends invitations' })
  approveNominations(@Request() req: any, @Param('id', ParseUUIDPipe) assessmentId: string) {
    return this.uc1Service.approveNominations(assessmentId, req.user.orgId, req.user.sub);
  }

  @Get('assessments/:id/360/scores/:participantId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOperation({ summary: 'Get aggregated 360 scores per competency per perspective' })
  get360Scores(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<AggregatedScore[]> {
    return this.uc1Service.get360Scores(assessmentId, participantId, req.user.orgId);
  }

  @Post('assessments/:id/360/participant-responses/:participantId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOperation({ summary: 'Submit custom question responses for a 360 feedback assessment' })
  saveParticipantResponses(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() body: SaveParticipantResponsesDto,
  ) {
    return this.uc1Service.saveParticipantResponses(
      assessmentId,
      participantId,
      req.user.orgId,
      body.responses,
    );
  }

  @Post('assessments/:id/360/reminders')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Send reminders to incomplete raters' })
  sendReminders(@Request() req: any, @Param('id', ParseUUIDPipe) assessmentId: string) {
    return this.uc1Service.sendReminders(assessmentId, req.user.orgId);
  }

  // ── Public rater endpoints (no JWT) ───────────────────────────────────

  @Get('rater/:token')
  @ApiOperation({ summary: 'Rater landing page — validate token and get assessment info' })
  getRaterLanding(@Param('token') token: string) {
    return this.uc1Service.getRaterLanding(token);
  }

  @Get('rater/:token/competencies')
  @ApiOperation({ summary: 'Get competency clusters with behaviours for this rater token' })
  getRaterCompetencies(@Param('token') token: string) {
    return this.uc1Service.getRaterCompetencies(token);
  }

  @Post('rater/:token/responses')
  @ApiOperation({ summary: 'Save per-competency behaviour ratings (auto-save, idempotent)' })
  saveRaterBehaviourResponses(
    @Param('token') token: string,
    @Body() body: SaveRaterBehaviourResponsesDto,
  ) {
    return this.uc1Service.saveRaterBehaviourResponses(
      token,
      body.competencyId,
      body.ratings,
      body.comment,
    );
  }

  @Post('rater/:token/overall')
  @ApiOperation({ summary: 'Submit overall rating and mark feedback as complete' })
  submitRaterOverall(
    @Param('token') token: string,
    @Body() body: SubmitRaterOverallDto,
  ) {
    return this.uc1Service.submitRaterOverall(token, body.overallRating, body.developmentComment);
  }
}
