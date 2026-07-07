import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentStatus, ReadinessRating } from '@leaderprism/shared';
import { Assessment } from '../assessment/engine/entities/assessment.entity';
import { AssessmentParticipant } from '../assessment/engine/entities/assessment-participant.entity';
import { Report } from '../reporting/report.entity';
import { RaterNomination } from '../assessment/uc1-feedback/entities/rater-nomination.entity';
import { CompetencyRating } from '../assessment/uc2-competency/entities/competency-rating.entity';
import { CompetencyAssessment } from '../assessment/uc2-competency/entities/competency-assessment.entity';
import { ReadinessScore } from '../assessment/uc4-readiness/entities/readiness-score.entity';
import { Competency } from '../assessment/items/entities/competency.entity';
import { RoleProfile } from '../assessment/uc4-readiness/entities/role-profile.entity';
import { PersonalityScore } from '../assessment/uc3-personality/entities/personality-score.entity';

export interface OrgDashboardData {
  activeAssessments: number;
  totalParticipants: number;
  reportsGenerated: number;
  pendingResponses: number;
  assessmentsByType: Record<string, number>;
  assessmentsByStatus: Record<string, number>;
  recentAssessments: Assessment[];
}

export interface HeatmapEntry {
  competencyId: string;
  competencyName: string;
  domainName: string;
  averageScore: number;
  participantCount: number;
  scoreRange: { min: number; max: number };
}

export interface RadarAggregate {
  competencyRadar: Array<{ key: string; label: string; value: number }>;
  personalityRadar: Array<{ key: string; label: string; value: number }>;
}

export interface SuccessionOverview {
  totalCandidates: number;
  byRating: Record<ReadinessRating, number>;
  byRole: Array<{
    roleProfileId: string;
    roleTitle: string;
    totalCandidates: number;
    readyNow: number;
    pipeline: number; // 1_2_years + developing
    candidates: Array<{ participantId: string; readinessRating: string }>;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(RaterNomination)
    private readonly nominationRepo: Repository<RaterNomination>,
    @InjectRepository(CompetencyRating)
    private readonly competencyRatingRepo: Repository<CompetencyRating>,
    @InjectRepository(CompetencyAssessment)
    private readonly caRepo: Repository<CompetencyAssessment>,
    @InjectRepository(ReadinessScore)
    private readonly readinessScoreRepo: Repository<ReadinessScore>,
    @InjectRepository(Competency)
    private readonly competencyRepo: Repository<Competency>,
    @InjectRepository(RoleProfile)
    private readonly roleProfileRepo: Repository<RoleProfile>,
    @InjectRepository(PersonalityScore)
    private readonly personalityScoreRepo: Repository<PersonalityScore>,
  ) {}

  /**
   * Returns key organisational dashboard metrics.
   */
  async getOrgDashboard(orgId: string): Promise<OrgDashboardData> {
    // Active assessments
    const activeAssessments = await this.assessmentRepo.count({
      where: { organisationId: orgId, status: AssessmentStatus.ACTIVE },
    });

    // Total unique participants across all assessments
    const totalParticipants = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .select('COUNT(DISTINCT p.user_id)', 'count')
      .getRawOne()
      .then((r) => parseInt(r?.count ?? '0', 10));

    // Reports generated this org
    const reportsGenerated = await this.reportRepo.count({
      where: { organisationId: orgId, status: 'ready' },
    });

    // Pending rater responses (approved nominations not completed)
    const pendingResponses = await this.nominationRepo
      .createQueryBuilder('n')
      .innerJoin('n.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere("n.status IN ('approved', 'sent')")
      .getCount();

    // Assessments by type
    const byTypeRaw = await this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .select('a.assessment_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.assessment_type')
      .getRawMany();

    const assessmentsByType = Object.fromEntries(
      byTypeRaw.map((r) => [r.type, parseInt(r.count, 10)]),
    );

    // Assessments by status
    const byStatusRaw = await this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status')
      .getRawMany();

    const assessmentsByStatus = Object.fromEntries(
      byStatusRaw.map((r) => [r.status, parseInt(r.count, 10)]),
    );

    const recentAssessments = await this.assessmentRepo.find({
      where: { organisationId: orgId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      activeAssessments,
      totalParticipants,
      reportsGenerated,
      pendingResponses,
      assessmentsByType,
      assessmentsByStatus,
      recentAssessments,
    };
  }

  /**
   * Returns average competency scores per competency across all participants in an assessment.
   */
  async getCompetencyHeatmap(
    orgId: string,
    assessmentId: string,
  ): Promise<HeatmapEntry[]> {
    // Validate assessment belongs to org
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });

    if (!assessment) {
      return [];
    }

    const raw = await this.competencyRatingRepo
      .createQueryBuilder('cr')
      .innerJoin('cr.competencyAssessment', 'ca')
      .innerJoin('cr.competency', 'comp')
      .innerJoin('comp.domain', 'domain')
      .where('ca.assessment_id = :assessmentId', { assessmentId })
      .select('cr.competency_id', 'competencyId')
      .addSelect('comp.name', 'competencyName')
      .addSelect('domain.name', 'domainName')
      .addSelect('AVG(cr.level_rated)', 'averageScore')
      .addSelect('COUNT(DISTINCT ca.participant_id)', 'participantCount')
      .addSelect('MIN(cr.level_rated)', 'minScore')
      .addSelect('MAX(cr.level_rated)', 'maxScore')
      .groupBy('cr.competency_id')
      .addGroupBy('comp.name')
      .addGroupBy('domain.name')
      .orderBy('"averageScore"', 'ASC')
      .getRawMany();

    return raw.map((r) => ({
      competencyId: r.competencyId,
      competencyName: r.competencyName,
      domainName: r.domainName,
      averageScore: Math.round(parseFloat(r.averageScore) * 100) / 100,
      participantCount: parseInt(r.participantCount, 10),
      scoreRange: {
        min: parseFloat(r.minScore),
        max: parseFloat(r.maxScore),
      },
    }));
  }

  /**
   * Returns succession pipeline overview with counts per readiness rating and role.
   */
  async getSuccessionOverview(orgId: string): Promise<SuccessionOverview> {
    const scores = await this.readinessScoreRepo
      .createQueryBuilder('rs')
      .innerJoin('rs.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .select([
        'rs.participantId',
        'rs.roleProfileId',
        'rs.readinessRating',
      ])
      .getMany();

    const byRating: Record<ReadinessRating, number> = {
      [ReadinessRating.READY_NOW]: 0,
      [ReadinessRating.ONE_TWO_YEARS]: 0,
      [ReadinessRating.DEVELOPING]: 0,
      [ReadinessRating.NOT_YET_READY]: 0,
    };

    for (const s of scores) {
      byRating[s.readinessRating] = (byRating[s.readinessRating] ?? 0) + 1;
    }

    const roleProfiles = await this.roleProfileRepo.find({
      where: { organisationId: orgId },
    });

    const roleProfileMap = new Map<string, RoleProfile>(
      roleProfiles.map((rp) => [rp.id, rp]),
    );

    // Group by role profile
    const byRoleMap = new Map<
      string,
      { roleProfileId: string; roleTitle: string; scores: typeof scores }
    >();

    for (const s of scores) {
      const roleId = s.roleProfileId ?? 'none';
      const roleTitle =
        s.roleProfileId && roleProfileMap.has(s.roleProfileId)
          ? roleProfileMap.get(s.roleProfileId)!.title
          : 'Unassigned';

      if (!byRoleMap.has(roleId)) {
        byRoleMap.set(roleId, { roleProfileId: roleId, roleTitle, scores: [] });
      }
      byRoleMap.get(roleId)!.scores.push(s);
    }

    const byRole = Array.from(byRoleMap.values()).map((role) => ({
      roleProfileId: role.roleProfileId,
      roleTitle: role.roleTitle,
      totalCandidates: role.scores.length,
      readyNow: role.scores.filter((s) => s.readinessRating === ReadinessRating.READY_NOW).length,
      pipeline: role.scores.filter(
        (s) =>
          s.readinessRating === ReadinessRating.ONE_TWO_YEARS ||
          s.readinessRating === ReadinessRating.DEVELOPING,
      ).length,
      candidates: role.scores.map((s) => ({
        participantId: s.participantId,
        readinessRating: s.readinessRating,
      })),
    }));

    return {
      totalCandidates: scores.length,
      byRating,
      byRole,
    };
  }

  /**
   * Returns aggregate radar chart data for a specific user.
   */
  async getUserAggregateRadar(userId: string): Promise<RadarAggregate> {
    const competencyData = await this.competencyRatingRepo
      .createQueryBuilder('cr')
      .innerJoin('cr.competencyAssessment', 'ca')
      .innerJoin('ca.participant', 'p')
      .innerJoin('cr.competency', 'comp')
      .innerJoin('comp.domain', 'domain')
      .where('p.user_id = :userId', { userId })
      .select('domain.id', 'domainId')
      .addSelect('domain.name', 'domainName')
      .addSelect('AVG(cr.level_rated)', 'averageScore')
      .groupBy('domain.id')
      .addGroupBy('domain.name')
      .getRawMany();

    const competencyRadar = competencyData.map((r) => ({
      key: r.domainId,
      label: r.domainName,
      value: Math.round((parseFloat(r.averageScore) / 4) * 100),
    }));

    const personalityData = await this.personalityScoreRepo
      .createQueryBuilder('ps')
      .innerJoin('ps.participant', 'p')
      .where('p.user_id = :userId', { userId })
      .select('ps.factor', 'factor')
      .addSelect('AVG(ps.percentile)', 'averagePercentile')
      .groupBy('ps.factor')
      .getRawMany();

    const personalityRadar = personalityData.map((r) => ({
      key: r.factor,
      label: r.factor.replace('_', ' '), // e.g. 'emotional_stability' -> 'emotional stability'
      value: Math.round(parseFloat(r.averagePercentile)),
    }));

    return { competencyRadar, personalityRadar };
  }

  /**
   * Returns aggregate radar chart data for an organisation.
   */
  async getOrgAggregateRadar(orgId: string): Promise<RadarAggregate> {
    const competencyData = await this.competencyRatingRepo
      .createQueryBuilder('cr')
      .innerJoin('cr.competencyAssessment', 'ca')
      .innerJoin('ca.assessment', 'a')
      .innerJoin('cr.competency', 'comp')
      .innerJoin('comp.domain', 'domain')
      .where('a.organisation_id = :orgId', { orgId })
      .select('domain.id', 'domainId')
      .addSelect('domain.name', 'domainName')
      .addSelect('AVG(cr.level_rated)', 'averageScore')
      .groupBy('domain.id')
      .addGroupBy('domain.name')
      .getRawMany();

    const competencyRadar = competencyData.map((r) => ({
      key: r.domainId,
      label: r.domainName,
      value: Math.round((parseFloat(r.averageScore) / 4) * 100),
    }));

    const personalityData = await this.personalityScoreRepo
      .createQueryBuilder('ps')
      .innerJoin('ps.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .select('ps.factor', 'factor')
      .addSelect('AVG(ps.percentile)', 'averagePercentile')
      .groupBy('ps.factor')
      .getRawMany();

    const personalityRadar = personalityData.map((r) => ({
      key: r.factor,
      label: r.factor.replace('_', ' '),
      value: Math.round(parseFloat(r.averagePercentile)),
    }));

    return { competencyRadar, personalityRadar };
  }


  async getMonthlyActivity(orgId: string): Promise<any> {
    const raw = await this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('a.created_at >= NOW() - INTERVAL \'12 months\'')
      .select("TO_CHAR(a.created_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(a.created_at, 'YYYY-MM')")
      .orderBy("TO_CHAR(a.created_at, 'YYYY-MM')")
      .getRawMany();
      
      console.log("---------getMonthlyActivity-----------------");
      console.log(raw);
      console.log("--------------------------");

    return raw.map((r) => ({
      month: r.month,
      count: parseInt(r.count, 10),
    }));
  }

  async getParticipantActivity(orgId: string): Promise<any> {
    const raw =  await this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('a.created_at >= NOW() - INTERVAL \'12 months\'')
      .select("TO_CHAR(a.created_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(DISTINCT a.participant_id)', 'count')
      .groupBy("TO_CHAR(a.created_at, 'YYYY-MM')")
      .orderBy("TO_CHAR(a.created_at, 'YYYY-MM')")
      .getRawMany();

      console.log("---------getParticipantActivity-----------------");
      console.log(raw);
      console.log("--------------------------");
      
    return raw.map((r) => ({
      month: r.month,
      count: parseInt(r.count, 10),
    }));
  }
}
