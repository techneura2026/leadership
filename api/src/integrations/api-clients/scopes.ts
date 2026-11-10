import type { IntegrationScope } from '@leaderprism/shared';

/** Every scope an integration API client can be granted. */
export const INTEGRATION_SCOPES: readonly IntegrationScope[] = [
  'employees:write',
  'assessments:write',
  'results:read',
  'reports:read',
  'sso:issue',
  'scores:write',
  'talent:read',
  'personality:read',
];
