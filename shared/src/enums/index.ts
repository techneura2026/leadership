export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  HR_MANAGER = 'hr_manager',
  MANAGER = 'manager',
  PARTICIPANT = 'participant',
}

export enum Plan {
  TRIAL = 'trial',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum AssessmentType {
  FEEDBACK_360 = '360_feedback',
  COMPETENCY = 'competency',
  PERSONALITY = 'personality',
  READINESS = 'readiness',
}

export enum AssessmentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export enum RaterRelationship {
  SELF = 'self',
  SUPERVISOR = 'supervisor',
  PEER = 'peer',
  DIRECT_REPORT = 'direct_report',
  STAKEHOLDER = 'stakeholder',
}

export enum CompetencyDomain {
  PEOPLE = 'people',
  CONCEPTUAL = 'conceptual',
  BEHAVIOURAL = 'behavioural',
  TECHNICAL = 'technical',
}

export enum ReadinessRating {
  READY_NOW = 'ready_now',
  ONE_TWO_YEARS = '1_2_years',
  DEVELOPING = 'developing',
  NOT_YET_READY = 'not_yet_ready',
}

export enum ReportType {
  INDIVIDUAL_360 = 'individual_360',
  COMPETENCY = 'competency',
  PERSONALITY = 'personality',
  READINESS = 'readiness',
  ORG_SUMMARY = 'org_summary',
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORISED = 'UNAUTHORISED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  ASSESSMENT_CLOSED = 'ASSESSMENT_CLOSED',
  RATER_TOKEN_INVALID = 'RATER_TOKEN_INVALID',
  RATER_TOKEN_EXPIRED = 'RATER_TOKEN_EXPIRED',
  ANONYMITY_THRESHOLD_NOT_MET = 'ANONYMITY_THRESHOLD_NOT_MET',
  ORG_INACTIVE = 'ORG_INACTIVE',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
}

export enum Language {
  EN = 'en',
  SI = 'si',
  TA = 'ta',
}
