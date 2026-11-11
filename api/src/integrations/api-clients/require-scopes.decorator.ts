import { SetMetadata } from '@nestjs/common';
import type { IntegrationScope } from '@leaderprism/shared';

export const REQUIRED_SCOPES_KEY = 'integrationScopes';

/** Scopes the calling API client must hold; enforced by ApiKeyGuard. */
export const RequireScopes = (...scopes: IntegrationScope[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes);
