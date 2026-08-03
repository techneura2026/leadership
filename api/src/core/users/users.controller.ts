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
import { UsersService, generateSecurePassword } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentOrgId } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@leaderprism/shared';

@ApiTags('Users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a user within the organisation' })
  async create(@CurrentOrgId() orgId: string, @Body() dto: CreateUserDto) {
    // Every admin-set-or-generated initial password is treated as temporary — the invited
    // user must choose their own on first login (Tier 0 fix: previously every user without
    // an explicit password got the same hardcoded '12345678').
    const password = dto.password ?? generateSecurePassword();

    const user = await this.usersService.create({
      organisationId: orgId,
      email: dto.email,
      password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role as UserRole,
      jobTitle: dto.jobTitle,
      departmentId: dto.departmentId,
      managerId: dto.managerId,
      avatarUrl: dto.avatarUrl,
      mustChangePassword: true,
    });

    const loginUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/login`;
    try {
      await this.notificationsService.sendUserWelcome(user.email, user.firstName, password, loginUrl, {
        orgId,
        userId: user.id,
      });
    } catch {
      // Account creation must succeed even if the welcome email fails to send —
      // the admin can still relay credentials manually as a fallback.
    }

    return user;
  }

  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all active users in the organisation' })
  findAll(@CurrentOrgId() orgId: string) {
    return this.usersService.findAll(orgId);
  }

  @Get(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a user by ID' })
  findOne(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id, orgId);
  }

  @Patch(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user profile or role' })
  update(
    @CurrentOrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, orgId, dto);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin-set a new password for a locked-out user (forces change on next login)' })
  async setPassword(
    @CurrentOrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPasswordDto,
  ) {
    await this.usersService.adminSetPassword(id, orgId, dto.password);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a user (soft delete)' })
  async deactivate(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.update(id, orgId, { isActive: false });
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a user' })
  async hardDelete(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.hardDelete(id, orgId);
  }
}
