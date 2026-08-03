import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Uc1FeedbackService, AggregatedScore, CustomQuestionSummary } from './uc1-feedback.service';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';
import { NominateRatersDto } from './dto/nominate-raters.dto';
import { SaveRaterBehaviourResponsesDto } from './dto/save-rater-behaviour-responses.dto';
import { SaveRaterCustomResponseDto } from './dto/save-rater-custom-response.dto';
import { SubmitRaterOverallDto } from './dto/submit-rater-overall.dto';

@ApiTags('360 Feedback')
@Controller()
export class Uc1FeedbackController {
  constructor(private readonly uc1Service: Uc1FeedbackService) {}

  // ── Protected endpoints ─────────────────────────────────────────────────

  @Get('assessments/:id/360/nominations')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get nominations for a participant (all participants if omitted)' })
  getNominations(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Query('participantId') participantId?: string,
  ) {
    return this.uc1Service.getNominations(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('assessments/:id/360/nominations')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
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
      req.user.sub,
      req.user.role,
    );
  }

  @Post('assessments/:id/360/nominations/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin approves all pending nominations and sends invitations' })
  approveNominations(@Request() req: any, @Param('id', ParseUUIDPipe) assessmentId: string) {
    return this.uc1Service.approveNominations(assessmentId, req.user.orgId, req.user.sub);
  }

  @Get('assessments/:id/360/scores/:participantId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get aggregated 360 scores per competency per perspective' })
  get360Scores(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<AggregatedScore[]> {
    return this.uc1Service.get360Scores(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('assessments/:id/360/custom-summary/:participantId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get aggregated custom-question summary (tallies + anonymised quotes)' })
  getCustomQuestionSummary(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<CustomQuestionSummary[]> {
    return this.uc1Service.getCustomQuestionSummary(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('assessments/:id/360/reminders')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send reminders to incomplete raters' })
  sendReminders(@Request() req: any, @Param('id', ParseUUIDPipe) assessmentId: string) {
    return this.uc1Service.sendReminders(assessmentId, req.user.orgId);
  }

  @Post('assessments/:id/360/nominations/:nominationId/remind')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send a targeted reminder to a single outstanding rater' })
  remindNomination(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
  ) {
    return this.uc1Service.remindNomination(assessmentId, nominationId, req.user.orgId);
  }

  @Delete('assessments/:id/360/nominations/:nominationId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an outstanding rater nomination' })
  removeNomination(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
  ) {
    return this.uc1Service.removeNomination(assessmentId, nominationId, req.user.orgId);
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

  @Get('rater/:token/questions')
  @ApiOperation({ summary: 'Get custom questions for this rater token (custom-question mode only)' })
  getRaterQuestions(@Param('token') token: string) {
    return this.uc1Service.getRaterQuestions(token);
  }

  @Post('rater/:token/custom-responses')
  @ApiOperation({ summary: 'Save one custom-question answer (auto-save, idempotent)' })
  saveRaterCustomResponses(
    @Param('token') token: string,
    @Body() body: SaveRaterCustomResponseDto,
  ) {
    return this.uc1Service.saveRaterCustomResponses(token, body.questionId, body.answer);
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
