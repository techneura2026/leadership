import { AssessmentStatus, AssessmentType, Language, Plan, RaterRelationship, ReadinessRating, ReportType, UserRole } from '../enums';

// ── API Response envelope ────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    nextCursor?: string;
  };
}

// ── Organisation ─────────────────────────────────────────────

export interface OrganisationDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColour: string;
  plan: Plan;
  trialEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DepartmentDto {
  id: string;
  organisationId: string;
  name: string;
  parentId: string | null;
}

// ── User ─────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  organisationId: string;
  departmentId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  jobTitle: string | null;
  avatarUrl: string | null;
  languagePref: Language;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

// ── Auth ─────────────────────────────────────────────────────

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
  organisation: OrganisationDto;
}

export interface AccessTokenPayload {
  sub: string;
  orgId: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

// ── Assessment ───────────────────────────────────────────────

export interface AssessmentDto {
  id: string;
  organisationId: string;
  title: string;
  assessmentType: AssessmentType;
  status: AssessmentStatus;
  config: AssessmentConfig;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface AssessmentConfig {
  competencyIds?: string[];
  ratingScale?: number;
  openEndedEnabled?: boolean;
  raterMinThreshold?: number;
  reminderDays?: number[];
  instructions?: string;
  targetRoleId?: string;
  isRatingMandatory?: boolean;
}

// ── 360 Feedback ─────────────────────────────────────────────

export interface RaterNominationDto {
  id: string;
  assessmentId: string;
  participantId: string;
  raterEmail: string;
  raterName: string | null;
  relationship: RaterRelationship;
  status: string;
  completedAt: string | null;
}

// ── Competency ───────────────────────────────────────────────

export interface CompetencyDto {
  id: string;
  domainId: string;
  name: string;
  description: string | null;
  levels: CompetencyLevelDto[];
  behaviours: CompetencyBehaviourDto[];
}

export interface CompetencyLevelDto {
  level: number;
  label: string;
  description: string;
  indicators: string[];
}

export interface CompetencyBehaviourDto {
  id: string;
  statement: string;
  displayOrder: number;
}

// ── Readiness ────────────────────────────────────────────────

export interface ReadinessScoreDto {
  participantId: string;
  readinessRating: ReadinessRating;
  compositeScore: number;
  competencyScore: number;
  feedbackScore: number;
  sjtScore: number;
  learningAgilityScore: number;
  personalityFitScore: number;
  gridPerformance: 'high' | 'medium' | 'low';
  gridPotential: 'high' | 'medium' | 'low';
}

// ── Report ───────────────────────────────────────────────────

export interface ReportDto {
  id: string;
  assessmentId: string;
  participantId: string | null;
  reportType: ReportType;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  language: Language;
  generatedAt: string | null;
  downloadUrl?: string;
}

// ── Plan limits ──────────────────────────────────────────────

export interface PlanLimits {
  maxParticipants: number;
  maxActiveAssessments: number;
  allowedUcs: AssessmentType[];
}
