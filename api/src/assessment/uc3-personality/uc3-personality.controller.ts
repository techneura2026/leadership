import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Uc3PersonalityService, QuestionnaireProgress } from './uc3-personality.service';

@ApiTags('Personality Assessment — Big Five (UC3)')
@UseGuards(AuthGuard('jwt'))
@Controller('assessments')
export class Uc3PersonalityController {
  constructor(private readonly uc3Service: Uc3PersonalityService) {}

  @Get(':id/personality/questionnaire/:participantId')
  @ApiOperation({ summary: 'Get Big Five questionnaire with progress state' })
  getQuestionnaire(
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
    @Query('language') language = 'en',
  ): Promise<QuestionnaireProgress> {
    return this.uc3Service.getQuestionnaire(assessmentId, participantId, language);
  }

  @Post(':id/personality/responses/:participantId')
  @ApiOperation({ summary: 'Save a single item response (auto-save)' })
  saveResponse(
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
    @Body() body: { itemId: string; value: number },
  ) {
    return this.uc3Service.saveResponse(
      assessmentId,
      participantId,
      body.itemId,
      body.value,
    );
  }

  @Post(':id/personality/submit/:participantId')
  @ApiOperation({ summary: 'Submit completed questionnaire and trigger scoring' })
  submit(
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.uc3Service.submitQuestionnaire(assessmentId, participantId);
  }

  @Get(':id/personality/scores/:participantId')
  @ApiOperation({ summary: 'Get Big Five scores with T-scores, percentiles, and narratives' })
  getScores(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.uc3Service.getScores(assessmentId, participantId, req.user.orgId);
  }
}
