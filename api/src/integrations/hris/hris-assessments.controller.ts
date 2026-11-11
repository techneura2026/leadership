import { Body, Controller, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationContext } from '../api-clients/integration-context.decorator';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { HrisAssessmentsService } from './hris-assessments.service';
import { AssessmentRequestDto } from './dto/assessment-request.dto';

@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisAssessmentsController {
  constructor(private readonly assessments: HrisAssessmentsService) {}

  @Post('assessment-requests')
  @RequireScopes('assessments:write')
  @ApiOperation({
    summary: 'Create/extend the assessments for an HRIS review cycle (idempotent per cycleRef + type). 201 if anything was created, else 200.',
  })
  async request(
    @IntegrationContext() principal: IntegrationPrincipal,
    @Body() dto: AssessmentRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.assessments.request(principal, dto);
    res.status(result.assessments.some((a) => a.created) ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }
}
