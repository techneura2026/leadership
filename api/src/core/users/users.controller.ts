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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentOrgId } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@leaderprism/shared';

@ApiTags('Users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Create a user within the organisation' })
  create(@CurrentOrgId() orgId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create({
      organisationId: orgId,
      email: dto.email,
      password: dto.password ?? '12345678',
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role as UserRole,
      jobTitle: dto.jobTitle,
      departmentId: dto.departmentId,
    });
  }

  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'List all active users in the organisation' })
  findAll(@CurrentOrgId() orgId: string) {
    return this.usersService.findAll(orgId);
  }

  @Get(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get a user by ID' })
  findOne(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id, orgId);
  }

  @Patch(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ summary: 'Update user profile or role' })
  update(
    @CurrentOrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, orgId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Deactivate a user (soft delete)' })
  async deactivate(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.update(id, orgId, { isActive: false });
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a user' })
  async hardDelete(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.hardDelete(id, orgId);
  }
}
