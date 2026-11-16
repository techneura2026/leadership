import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@leaderprism/shared';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationOrgId } from '../api-clients/integration-context.decorator';
import { UsersService } from '../../core/users/users.service';
import { SAFE_REDIRECT_PATH, SsoTicketService } from '../../core/auth/sso/sso-ticket.service';
import { getWebBaseUrl } from '../../shared/public-urls';
import { AuditService } from '../../core/audit/audit.service';
import { IntegrationContext } from '../api-clients/integration-context.decorator';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { parseSuiteHeader, SUITE_HEADER } from './suite';

class SsoTicketRequestDto {
  @IsString() @MinLength(1) @MaxLength(100)
  employeeRef: string;

  @IsOptional() @IsString() @MaxLength(500)
  @Matches(SAFE_REDIRECT_PATH, { message: 'redirectPath must be a same-site path starting with a single "/"' })
  redirectPath?: string;
}

@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisSsoController {
  constructor(
    private readonly users: UsersService,
    private readonly tickets: SsoTicketService,
  ) {}

  @Post('sso-tickets')
  @RequireScopes('sso:issue')
  @ApiOperation({ summary: 'Issue a one-time sign-in link (valid 60 s) that opens LeaderPrism as the employee' })
  async issue(@IntegrationOrgId() orgId: string, @Body() dto: SsoTicketRequestDto, @Headers(SUITE_HEADER) suiteHeader?: string) {
    const [user] = await this.users.findByExternalRefs(orgId, [dto.employeeRef]);
    if (!user || !user.isActive || user.employmentStatus === 'left') {
      throw new NotFoundException(`No active employee ${dto.employeeRef}`);
    }
    // A leaked HRIS key must never be able to open the organisation's admin accounts.
    if (user.role === UserRole.ORG_ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        message: 'Single sign-on is not available for organisation admin accounts; they sign in with their password.',
        error: 'SSO_NOT_ALLOWED',
      });
    }
    // BizOS Suite Sign-in plan 2.4: the suite BizOS sends with the request, kept on the person for the Apps menu.
    const suite = parseSuiteHeader(suiteHeader);
    if (suite) await this.users.setSuite(orgId, user.id, suite as unknown as Record<string, unknown>);
    const { ticket, expiresAt } = await this.tickets.issue(orgId, user.id, dto.redirectPath ?? '/my-assessments');
    return { url: `${getWebBaseUrl()}/sso/hris?ticket=${ticket}`, expiresAt: expiresAt.toISOString() };
  }
}

class SessionsRevokeDto {
  @IsString() @MinLength(1) @MaxLength(100)
  employeeRef: string;
}

/**
 * BizOS Suite Sign-in plan 2.5: the person signed out of BizOS (or HR ended their access), so their LeaderPrism sessions end too.
 * Their refresh tokens are deleted; an access token already issued lapses at its short expiry. Found even when deactivated or left.
 */
@ApiTags('HRIS Integration')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('integrations/hris')
export class HrisSessionsController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Post('sessions/revoke')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('sso:issue')
  @ApiOperation({ summary: "End every LeaderPrism session of the employee (signed out of the HRIS, or a leaver). Idempotent." })
  async revoke(@IntegrationContext() client: IntegrationPrincipal, @Body() dto: SessionsRevokeDto) {
    const [user] = await this.users.findByExternalRefs(client.orgId, [dto.employeeRef]);
    if (!user) throw new NotFoundException({ message: `No employee ${dto.employeeRef}`, error: 'user_not_found' });
    const revoked = await this.users.revokeUserSessions(user.id);
    await this.audit.record({ orgId: client.orgId, actorType: 'api_client', actorId: null, action: 'auth.sessions_revoked', entityType: 'user', entityId: user.id, metadata: { revoked, clientId: client.clientId } });
    return { revoked };
  }
}
