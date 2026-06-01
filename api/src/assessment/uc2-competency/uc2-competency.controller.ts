import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Uc2CompetencyService, GapResult, CompetencyProfileResult } from './uc2-competency.service';

@ApiTags('Competency Assessment (UC2)')
@UseGuards(AuthGuard('jwt'))
@Controller('assessments')
export class Uc2CompetencyController {
  constructor(private readonly uc2Service: Uc2CompetencyService) {}

  @Post(':id/competency/self')
  @ApiOperation({ summary: 'Start self-assessment (creates CA record)' })
  startSelf(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Body('participantId') participantId: string,
  ) {
    return this.uc2Service.startSelfAssessment(assessmentId, participantId, req.user.orgId);
  }

  @Post(':id/competency/self/:caId/submit')
  @ApiOperation({ summary: 'Submit self-assessment ratings' })
  submitSelf(
    @Request() req: any,
    @Param('caId') caId: string,
    @Body()
    body: {
      participantId: string;
      ratings: Array<{
        competencyId: string;
        levelRated: number;
        evidenceText?: string;
        developmentComment?: string;
      }>;
    },
  ) {
    return this.uc2Service.submitSelfRatings(caId, body.participantId, body.ratings);
  }

  @Post(':id/competency/manager')
  @ApiOperation({ summary: 'Start manager assessment' })
  startManager(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Body('participantId') participantId: string,
  ) {
    return this.uc2Service.startManagerAssessment(
      assessmentId,
      req.user.sub,
      participantId,
      req.user.orgId,
    );
  }

  @Post(':id/competency/manager/:caId/submit')
  @ApiOperation({ summary: 'Submit manager ratings' })
  submitManager(
    @Request() req: any,
    @Param('caId') caId: string,
    @Body()
    body: {
      ratings: Array<{
        competencyId: string;
        levelRated: number;
        evidenceText?: string;
        developmentComment?: string;
      }>;
    },
  ) {
    return this.uc2Service.submitManagerRatings(caId, req.user.sub, body.ratings);
  }

  @Get(':id/competency/gap/:participantId')
  @ApiOperation({ summary: 'Get self vs manager gap analysis per competency' })
  getGapAnalysis(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
  ): Promise<GapResult[]> {
    return this.uc2Service.getGapAnalysis(assessmentId, participantId, req.user.orgId);
  }

  @Get(':id/competency/profile/:participantId')
  @ApiOperation({ summary: 'Get full competency profile with domain summaries' })
  getProfile(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
  ): Promise<CompetencyProfileResult[]> {
    return this.uc2Service.getCompetencyProfile(assessmentId, participantId, req.user.orgId);
  }
}
