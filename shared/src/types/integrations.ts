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

// ── Results export (spec §6) ─────────────────────────────────

export interface CompetencyItemDto {
  competencyRef: string;
  name: string;
  domain: string;
  selfLevel: number | null;
  managerLevel: number | null;
  requiredLevel: number | null;
  weightInRole: number | null;
  gapSelfVsManager: number | null;
  gapVsRequired: number | null;
  managerEvidence: string | null;
  developmentComment: string | null;
}

export interface CompetencyBlockDto {
  scaleMax: 4;
  roleProfile: { ref: string; title: string } | null;
  items: CompetencyItemDto[];
  summary: { managerAvgPct: number | null; achievementVsRequiredPct: number | null };
}

export type RaterGroup = 'supervisor' | 'peer' | 'direct_report' | 'stakeholder';

export type Feedback360BlockDto =
  | {
      status: 'ok';
      scaleMax: number;
      minRaterThreshold: number;
      items: Array<{
        competencyId: string;
        othersMean: number;
        self: number | null;
        gapVsSelf: number | null;
        byGroup: Partial<Record<RaterGroup, { mean: number; n: number }>>;
      }>;
      overallOthersPct: number;
    }
  | { status: 'insufficient_raters'; minRaterThreshold: number };

export interface ReportLinkDto {
  reportId: string;
  type: string;
  url: string;
  expiresAt: string;
}

export interface EmployeeResultDto {
  employeeRef: string;
  cycleRef: string;
  status: 'in_progress' | 'final';
  assessmentIds: string[];
  competency: CompetencyBlockDto | null;
  feedback360: Feedback360BlockDto | null;
  reports: ReportLinkDto[];
  /** Only present for API keys with the talent:read scope. */
  readiness?: {
    rating: string;
    compositeScore: number;
    components: { competency: number; feedback: number; sjt: number; learningAgility: number; personalityFit: number };
    roleProfile: { ref: string; title: string } | null;
  } | null;
  /** Only present for API keys with the talent:read scope. */
  nineBox?: {
    performance: 'high' | 'medium' | 'low';
    potential: 'high' | 'medium' | 'low';
    performanceSource: 'manual' | 'hris' | 'feedback360';
    overrideNote: string | null;
  } | null;
}

export interface ResultsPageDto {
  data: EmployeeResultDto[];
  nextCursor: string | null;
}

/** Returned once, on creation only. */
export interface CreatedApiClientDto extends ApiClientDto {
  rawKey: string;
}
