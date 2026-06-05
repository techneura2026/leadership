import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentOrgId, CurrentUser } from '../../shared/decorators/current-user.decorator';
import { OrganisationsService } from './organisations.service';
import { UserRole } from '@leaderprism/shared';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateOrgDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  primaryColour?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  brandingName?: string;
}

class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;
}

class UpdateDepartmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;
}

@ApiTags('organisations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly orgsService: OrganisationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user\'s organisation' })
  getMyOrg(@CurrentOrgId() orgId: string) {
    return this.orgsService.findById(orgId);
  }

  @Patch('me')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update organisation settings' })
  updateMyOrg(@CurrentOrgId() orgId: string, @Body() dto: UpdateOrgDto) {
    return this.orgsService.update(orgId, dto);
  }

  @Get('me/departments')
  @ApiOperation({ summary: 'List departments in current organisation' })
  getDepartments(@CurrentOrgId() orgId: string) {
    return this.orgsService.getDepartments(orgId);
  }

  @Post('me/departments')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Create a department' })
  createDepartment(@CurrentOrgId() orgId: string, @Body() dto: CreateDepartmentDto) {
    return this.orgsService.createDepartment(orgId, dto.name, dto.description, dto.parentId);
  }

  @Patch('me/departments/:id')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Update a department' })
  updateDepartment(
    @CurrentOrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.orgsService.updateDepartment(orgId, id, dto);
  }

  @Delete('me/departments/:id')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department' })
  deleteDepartment(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.orgsService.deleteDepartment(orgId, id);
  }

  @Get('me/users')
  @ApiOperation({ summary: 'List users in the current user\'s organisation' })
  getMyOrgUsers(@CurrentOrgId() orgId: string) {
    return this.orgsService.getUsers(orgId);
  }
}
