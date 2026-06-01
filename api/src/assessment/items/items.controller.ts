import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ItemsService, CreateCompetencyDto, UpdateCompetencyDto } from './items.service';

@ApiTags('Items & Competency Library')
@UseGuards(AuthGuard('jwt'))
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('domains')
  @ApiOperation({ summary: 'Get all competency domains (system + org-specific)' })
  getDomains(@Request() req: any) {
    return this.itemsService.getDomains(req.user.orgId);
  }

  @Get('competencies')
  @ApiOperation({ summary: 'Get competencies with levels and behaviours' })
  getCompetencies(@Request() req: any, @Query('domainId') domainId?: string) {
    return this.itemsService.getCompetencies(req.user.orgId, domainId);
  }

  @Post('competencies')
  @ApiOperation({ summary: 'Create an org-specific competency' })
  createCompetency(@Request() req: any, @Body() dto: CreateCompetencyDto) {
    return this.itemsService.createCompetency(req.user.orgId, dto);
  }

  @Patch('competencies/:id')
  @ApiOperation({ summary: 'Update an org-specific competency' })
  updateCompetency(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCompetencyDto,
  ) {
    return this.itemsService.updateCompetency(req.user.orgId, id, dto);
  }

  @Get('personality')
  @ApiOperation({ summary: 'Get personality questionnaire items' })
  getPersonalityItems(
    @Query('language') language = 'en',
    @Query('factor') factor?: string,
  ) {
    return this.itemsService.getItems('personality', language, factor);
  }

  @Get('sjt')
  @ApiOperation({ summary: 'Get SJT scenario items' })
  getSjtItems(@Query('language') language = 'en') {
    return this.itemsService.getItems('sjt', language);
  }

  @Get('learning-agility')
  @ApiOperation({ summary: 'Get learning agility items' })
  getLearningAgilityItems(@Query('language') language = 'en') {
    return this.itemsService.getItems('learning_agility', language);
  }

  @Get('framework')
  @ApiOperation({ summary: 'Get full competency framework for 360 configuration' })
  getFramework(@Request() req: any) {
    return this.itemsService.getCompetencyFramework(req.user.orgId);
  }
}
