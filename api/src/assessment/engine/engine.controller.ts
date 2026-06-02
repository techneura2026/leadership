import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  EngineService,
  CreateAssessmentDto,
  UpdateAssessmentDto,
  AssessmentFilters,
} from './engine.service';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@leaderprism/shared';

@ApiTags('Assessments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
@Controller('assessments')
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new assessment' })
  create(@Request() req: any, @Body() dto: CreateAssessmentDto) {
    return this.engineService.create(req.user.orgId, req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List assessments with optional filters' })
  findAll(@Request() req: any, @Query() filters: AssessmentFilters) {
    return this.engineService.findAll(req.user.orgId, filters);
  }

  @Get('mine')
  @Roles(UserRole.PARTICIPANT, UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get active assessments the current user is a participant in' })
  findMine(@Request() req: any) {
    return this.engineService.findMine(req.user.sub, req.user.orgId);
  }

  @Get(':id')
  @Roles(UserRole.PARTICIPANT, UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get assessment by ID' })
  findOne(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.engineService.findOne(id, req.user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update assessment (DRAFT only)' })
  update(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssessmentDto) {
    return this.engineService.update(id, req.user.orgId, dto);
  }

  @Post(':id/launch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Launch assessment (DRAFT → ACTIVE)' })
  launch(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.engineService.launch(id, req.user.orgId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close assessment (ACTIVE → CLOSED)' })
  close(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.engineService.close(id, req.user.orgId);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Add a participant to an assessment' })
  addParticipant(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('userId') userId: string,
  ) {
    return this.engineService.addParticipant(id, req.user.orgId, userId);
  }

  @Get(':id/participants')
  @Roles(UserRole.PARTICIPANT, UserRole.MANAGER, UserRole.HR_MANAGER, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get all participants with completion status' })
  getParticipants(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.engineService.getParticipants(id, req.user.orgId);
  }

  @Get(':id/response-rate')
  @ApiOperation({ summary: 'Get % completed per participant' })
  getResponseRate(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.engineService.getResponseRate(id, req.user.orgId);
  }
}
