import { AssessmentStatus, AssessmentType, Language, Plan, RaterRelationship, ReadinessRating, ReportType, UserRole } from '../enums';
import { FormQuestion } from './formQuestion';
export * from './formQuestion';
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
    description: string | null;
    isActive: boolean;
    parentId: string | null;
    createdAt: string;
}
export interface UserDto {
    id: string;
    organisationId: string;
    departmentId: string | null;
    managerId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    jobTitle: string | null;
    avatarUrl: string | null;
    languagePref: Language;
    isActive: boolean;
    emailVerified: boolean;
    mustChangePassword: boolean;
    createdAt: string;
}
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
    questionMode?: 'competency' | 'custom';
    questions?: FormQuestion[];
    ratingScale?: number;
    openEndedEnabled?: boolean;
    raterMinThreshold?: number;
    reminderDays?: number[];
    instructions?: string;
    targetRoleId?: string;
    isRatingMandatory?: boolean;
    includeSelfAssessment?: boolean;
}
export interface RaterNominationDto {
    id: string;
    assessmentId: string;
    participantId: string;
    raterEmail: string;
    raterName: string | null;
    relationship: RaterRelationship;
    status: string;
    completedAt: string | null;
    raterAvatarUrl: string | null;
    raterUserId: string | null;
}
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
export interface ReportDto {
    id: string;
    assessmentId: string;
    participantId: string | null;
    reportType: ReportType;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    language: Language;
    generatedAt: string | null;
    downloadUrl?: string;
    error?: string | null;
}
export interface PlanLimits {
    maxParticipants: number;
    maxActiveAssessments: number;
    allowedUcs: AssessmentType[];
}
