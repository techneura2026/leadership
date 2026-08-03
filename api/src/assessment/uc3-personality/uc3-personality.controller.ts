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
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';
import { SaveResponseDto } from './dto/save-response.dto';

@ApiTags('Personality Assessment — Big Five (UC3)')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.PARTICIPANT, UserRole.HR_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
@Controller('assessments')
export class Uc3PersonalityController {
  constructor(private readonly uc3Service: Uc3PersonalityService) {}

  @Get(':id/personality/questionnaire/:participantId')
  @ApiOperation({ summary: 'Get Big Five questionnaire with progress state' })
  getQuestionnaire(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
    @Query('language') language = 'en',
  ): Promise<QuestionnaireProgress> {
    return this.uc3Service.getQuestionnaire(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
      language,
    );
  }

  @Post(':id/personality/responses/:participantId')
  @ApiOperation({ summary: 'Save a single item response (auto-save)' })
  saveResponse(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
    @Body() body: SaveResponseDto,
  ) {
    return this.uc3Service.saveResponse(
      assessmentId,
      participantId,
      req.user.orgId,
      body.itemId,
      body.value,
      req.user.sub,
      req.user.role,
    );
  }

  @Post(':id/personality/submit/:participantId')
  @ApiOperation({ summary: 'Submit completed questionnaire and trigger scoring' })
  submit(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.uc3Service.submitQuestionnaire(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }

  @Get(':id/personality/scores/:participantId')
  @ApiOperation({ summary: 'Get Big Five scores with T-scores, percentiles, and narratives' })
  getScores(
    @Request() req: any,
    @Param('id') assessmentId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.uc3Service.getScores(
      assessmentId,
      participantId,
      req.user.orgId,
      req.user.sub,
      req.user.role,
    );
  }
}
