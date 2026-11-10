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

/** Per-row outcome of an HRIS sync call. The call returns 200 even when some rows fail. */
export interface SyncRowResult {
  ref: string;
  status: 'created' | 'updated' | 'unchanged' | 'error';
  id?: string;
  error?: string;
  warnings?: string[];
}

export interface DepartmentSyncRow {
  departmentRef: string;
  name: string;
  parentRef?: string | null;
  isActive?: boolean;
}

export interface EmployeeSyncRow {
  employeeRef: string;
  email: string;
  firstName: string;
  lastName: string;
  departmentRef?: string | null;
  managerRef?: string | null;
  designationRef?: string | null;
  jobTitle?: string | null;
  employmentStatus: 'active' | 'probation' | 'left';
  joiningDate?: string;
  language?: 'en' | 'si' | 'ta';
  role?: 'participant' | 'manager' | 'hr_manager';
}

/** Returned once, on creation only. */
export interface CreatedApiClientDto extends ApiClientDto {
  rawKey: string;
}
