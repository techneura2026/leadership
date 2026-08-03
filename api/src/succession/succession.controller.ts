import {
  Body,
  Controller,
  Delete,
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
import { UserRole } from '@leaderprism/shared';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { CurrentOrgId } from '../shared/decorators/current-user.decorator';
import { SuccessionService } from './succession.service';
import { CreateKeyRoleDto } from './dto/create-key-role.dto';
import { UpdateKeyRoleDto } from './dto/update-key-role.dto';
import { NominateSuccessorDto } from './dto/nominate-successor.dto';

@ApiTags('Succession Planning')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
@Controller('succession')
export class SuccessionController {
  constructor(private readonly successionService: SuccessionService) {}

  @Get('candidates')
  @ApiOperation({ summary: '9-box/talent-pool candidates, enriched with real strengths/development areas' })
  getCandidates(@CurrentOrgId() orgId: string, @Query('assessmentId') assessmentId?: string) {
    return this.successionService.getCandidates(orgId, assessmentId);
  }

  @Get('key-roles')
  @ApiOperation({ summary: 'List key roles with incumbent and successor pipeline' })
  listKeyRoles(@CurrentOrgId() orgId: string) {
    return this.successionService.listKeyRoles(orgId);
  }

  @Post('key-roles')
  @ApiOperation({ summary: 'Create a key role' })
  createKeyRole(@CurrentOrgId() orgId: string, @Body() dto: CreateKeyRoleDto) {
    return this.successionService.createKeyRole(orgId, dto);
  }

  @Patch('key-roles/:id')
  @ApiOperation({ summary: 'Update a key role' })
  updateKeyRole(
    @CurrentOrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKeyRoleDto,
  ) {
    return this.successionService.updateKeyRole(orgId, id, dto);
  }

  @Delete('key-roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a key role' })
  async deleteKeyRole(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.successionService.deleteKeyRole(orgId, id);
  }

  @Post('key-roles/:id/successors')
  @ApiOperation({ summary: 'Nominate a successor for a key role' })
  nominateSuccessor(
    @Request() req: any,
    @CurrentOrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NominateSuccessorDto,
  ) {
    return this.successionService.nominateSuccessor(orgId, id, dto.candidateUserId, req.user.sub, dto.notes);
  }

  @Delete('key-roles/:id/successors/:successorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a successor nomination' })
  async removeSuccessor(
    @CurrentOrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('successorId', ParseUUIDPipe) successorId: string,
  ) {
    await this.successionService.removeSuccessor(orgId, id, successorId);
  }

  @Get('bench')
  @ApiOperation({ summary: 'Department bench-strength coverage' })
  getBench(@CurrentOrgId() orgId: string) {
    return this.successionService.getBench(orgId);
  }

  @Get('org-chart')
  @ApiOperation({ summary: 'Flat list of org users with real manager-based reporting lines' })
  getOrgChart(@CurrentOrgId() orgId: string) {
    return this.successionService.getOrgChart(orgId);
  }
}
