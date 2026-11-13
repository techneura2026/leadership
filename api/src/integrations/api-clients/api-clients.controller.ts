import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ArrayMinSize, IsArray, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessTokenPayload, IntegrationScope, UserRole } from '@leaderprism/shared';
import { INTEGRATION_SCOPES } from './scopes';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentOrgId, CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ApiClientsService } from './api-clients.service';

class CreateApiClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...INTEGRATION_SCOPES], { each: true })
  scopes: IntegrationScope[];
}

class UpdateApiClientScopesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...INTEGRATION_SCOPES], { each: true })
  scopes: IntegrationScope[];
}

@ApiTags('Integrations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
@Controller('integrations/api-clients')
export class ApiClientsController {
  constructor(private readonly apiClients: ApiClientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an integration API client (the raw key is returned only once)' })
  create(@CurrentOrgId() orgId: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: CreateApiClientDto) {
    return this.apiClients.create(orgId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List integration API clients' })
  list(@CurrentOrgId() orgId: string) {
    return this.apiClients.list(orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Replace the scopes of an integration API client (secret unchanged)' })
  updateScopes(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiClientScopesDto,
  ) {
    return this.apiClients.updateScopes(orgId, id, dto.scopes, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an integration API client' })
  async revoke(@CurrentOrgId() orgId: string, @CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.apiClients.revoke(orgId, id, user.sub);
  }
}
