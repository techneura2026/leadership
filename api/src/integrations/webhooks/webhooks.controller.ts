import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import { UserRole } from '@leaderprism/shared';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentOrgId } from '../../shared/decorators/current-user.decorator';
import { WebhooksService } from './webhooks.service';
import { DomainEventListener } from './domain-event.listener';

class CreateWebhookDto {
  @IsString() @MaxLength(2000)
  url: string;

  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  events: string[];
}

@ApiTags('Integrations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
@Controller('integrations/webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly listener: DomainEventListener,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint (the signing secret is returned only once)' })
  create(@CurrentOrgId() orgId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  list(@CurrentOrgId() orgId: string) {
    return this.webhooks.list(orgId);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Recent webhook deliveries' })
  deliveries(@CurrentOrgId() orgId: string, @Query('limit') limit?: string) {
    return this.webhooks.listDeliveries(orgId, Number(limit) || 50);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a ping to the endpoint' })
  async test(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.sendTest(orgId, id, await this.listener.orgRef(orgId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  async remove(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.webhooks.remove(orgId, id);
  }
}
