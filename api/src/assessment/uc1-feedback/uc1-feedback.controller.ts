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

@ApiTags('360 Feedback')
@Controller()
export class Uc1FeedbackController {
  constructor(private readonly uc1Service: Uc1FeedbackService) {}

  // ── Protected endpoints ─────────────────────────────────────────────────

  @Get('assessments/:id/360/nominations')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get nominations for a participant' })
  getNominations(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body('participantId') participantId: string,
  ) {
    return this.uc1Service.getNominations(assessmentId, participantId, req.user.orgId);
  }

  @Post('assessments/:id/360/nominations')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Nominate raters (participant nominates)' })
  nominateRaters(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body()
    body: {
      participantId: string;
      raters: Array<{
        raterEmail: string;
        raterName?: string;
        relationship: string;
      }>;
    },
  ) {
    return this.uc1Service.nominateRaters(
      assessmentId,
      body.participantId,
      body.raters as any,
      req.user.orgId,
    );
  }

  @Post('assessments/:id/360/nominations/approve')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin approves all pending nominations and sends invitations' })
  approveNominations(@Request() req: any, @Param('id', ParseUUIDPipe) assessmentId: string) {
    return this.uc1Service.approveNominations(assessmentId, req.user.orgId, req.user.sub);
  }

  @Get('assessments/:id/360/scores/:participantId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get aggregated 360 scores per competency per perspective' })
  get360Scores(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<AggregatedScore[]> {
    return this.uc1Service.get360Scores(assessmentId, participantId, req.user.orgId);
  }

  @Post('assessments/:id/360/reminders')
  @UseGuards(AuthGuard('jwt'))
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

  @Post('rater/:token/responses')
  @ApiOperation({ summary: 'Submit rater responses' })
  submitRaterResponse(
    @Param('token') token: string,
    @Body()
    body: {
      competencyScores: Array<{
        competencyId: string;
        score: number;
        openText?: string;
      }>;
      overallScore: number;
      openComments: string[];
    },
  ) {
    return this.uc1Service.submitRaterResponse(
      token,
      body.competencyScores,
      body.overallScore,
      body.openComments,
    );
  }
}
