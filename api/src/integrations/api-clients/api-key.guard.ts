import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IntegrationScope } from '@leaderprism/shared';
import { ApiClientsService } from './api-clients.service';
import { REQUIRED_SCOPES_KEY } from './require-scopes.decorator';

/**
 * Authenticates integration routes by the `X-Api-Key` header and enforces @RequireScopes.
 * User JWTs are deliberately not accepted here.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiClients: ApiClientsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.['x-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) throw new UnauthorizedException('Missing X-Api-Key header');

    const principal = await this.apiClients.authenticate(raw);
    if (!principal) throw new UnauthorizedException('Invalid or revoked API key');

    const required =
      this.reflector.getAllAndOverride<IntegrationScope[]>(REQUIRED_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const missing = required.filter((s) => !principal.scopes.includes(s));
    if (missing.length > 0) {
      throw new ForbiddenException({
        message: `API key is missing required scope(s): ${missing.join(', ')}`,
        error: 'INSUFFICIENT_SCOPE',
      });
    }

    request.integration = principal;
    return true;
  }
}
