import { Body, Controller, ForbiddenException, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@leaderprism/shared';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiKeyGuard } from '../api-clients/api-key.guard';
import { RequireScopes } from '../api-clients/require-scopes.decorator';
import { IntegrationOrgId } from '../api-clients/integration-context.decorator';
import { UsersService } from '../../core/users/users.service';
import { SAFE_REDIRECT_PATH, SsoTicketService } from '../../core/auth/sso/sso-ticket.service';
import { getWebBaseUrl } from '../../shared/public-urls';

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
  async issue(@IntegrationOrgId() orgId: string, @Body() dto: SsoTicketRequestDto) {
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
    const { ticket, expiresAt } = await this.tickets.issue(orgId, user.id, dto.redirectPath ?? '/my-assessments');
    return { url: `${getWebBaseUrl()}/sso/hris?ticket=${ticket}`, expiresAt: expiresAt.toISOString() };
  }
}
