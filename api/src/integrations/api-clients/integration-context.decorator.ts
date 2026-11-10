import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IntegrationPrincipal } from './api-clients.service';

/** The authenticated API client (set by ApiKeyGuard). */
export const IntegrationContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IntegrationPrincipal =>
    ctx.switchToHttp().getRequest().integration as IntegrationPrincipal,
);

/** Organisation of the authenticated API client — never taken from the request body. */
export const IntegrationOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    (ctx.switchToHttp().getRequest().integration as IntegrationPrincipal).orgId,
);
