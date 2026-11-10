// ── HRIS integration ─────────────────────────────────────────
// Types only: shared/src ships pre-compiled .js files that are resolved before the .ts sources,
// so runtime constants added here would not be visible. Runtime values live in the API
// (api/src/integrations/api-clients/scopes.ts) and the web app.

/** Scopes an integration API client can be granted. */
export type IntegrationScope =
  | 'employees:write'
  | 'assessments:write'
  | 'results:read'
  | 'reports:read'
  | 'sso:issue'
  | 'scores:write'
  | 'talent:read'
  | 'personality:read';

export interface ApiClientDto {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: IntegrationScope[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Returned once, on creation only. */
export interface CreatedApiClientDto extends ApiClientDto {
  rawKey: string;
}
