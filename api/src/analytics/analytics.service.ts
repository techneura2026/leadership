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

export interface DashboardStatMetric {
  count: number;
  percentage_change: number;
}

export interface OrgDashboardData {
  active_assessments: DashboardStatMetric;
  total_participants: DashboardStatMetric;
  pending_responses: DashboardStatMetric;
  reports_generated: DashboardStatMetric;
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
  ) { }

  /** Compute percentage change: ((current - previous) / previous) * 100, rounded to 1 decimal. */
  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  /**
   * Returns key organisational dashboard metrics.
   */
  async getOrgDashboard(orgId: string): Promise<OrgDashboardData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // ── Active assessments (current count + change based on recently launched) ──
    const activeAssessments = await this.assessmentRepo.count({
      where: { organisationId: orgId, status: AssessmentStatus.ACTIVE },
    });

    const activeLaunchedRecent = await this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('a.status = :status', { status: AssessmentStatus.ACTIVE })
      .andWhere('a.start_date >= :since', { since: thirtyDaysAgo })
      .getCount();

    const activeLaunchedPrev = await this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('a.status = :status', { status: AssessmentStatus.ACTIVE })
      .andWhere('a.start_date >= :from', { from: sixtyDaysAgo })
      .andWhere('a.start_date < :to', { to: thirtyDaysAgo })
      .getCount();

    // ── Total unique participants ──
    const totalParticipants = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .select('COUNT(DISTINCT p.user_id)', 'count')
      .getRawOne()
      .then((r) => parseInt(r?.count ?? '0', 10));

    const participantsRecent = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('p.created_at >= :since', { since: thirtyDaysAgo })
      .select('COUNT(DISTINCT p.user_id)', 'count')
      .getRawOne()
      .then((r) => parseInt(r?.count ?? '0', 10));

    const participantsPrev = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('p.created_at >= :from', { from: sixtyDaysAgo })
      .andWhere('p.created_at < :to', { to: thirtyDaysAgo })
      .select('COUNT(DISTINCT p.user_id)', 'count')
      .getRawOne()
      .then((r) => parseInt(r?.count ?? '0', 10));

    // ── Pending rater responses ──
    const pendingResponses = await this.nominationRepo
      .createQueryBuilder('n')
      .innerJoin('n.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere("n.status IN ('approved', 'sent')")
      .getCount();

    const pendingRecent = await this.nominationRepo
      .createQueryBuilder('n')
      .innerJoin('n.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere("n.status IN ('approved', 'sent')")
      .andWhere('n.created_at >= :since', { since: thirtyDaysAgo })
      .getCount();

    const pendingPrev = await this.nominationRepo
      .createQueryBuilder('n')
      .innerJoin('n.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere("n.status IN ('approved', 'sent')")
      .andWhere('n.created_at >= :from', { from: sixtyDaysAgo })
      .andWhere('n.created_at < :to', { to: thirtyDaysAgo })
      .getCount();

    // ── Reports generated ──
    const reportsGenerated = await this.reportRepo.count({
      where: { organisationId: orgId, status: 'ready' },
    });

    const reportsRecent = await this.reportRepo
      .createQueryBuilder('r')
      .where('r.organisation_id = :orgId', { orgId })
      .andWhere('r.status = :status', { status: 'ready' })
      .andWhere('r.generated_at >= :since', { since: thirtyDaysAgo })
      .getCount();

    const reportsPrev = await this.reportRepo
      .createQueryBuilder('r')
      .where('r.organisation_id = :orgId', { orgId })
      .andWhere('r.status = :status', { status: 'ready' })
      .andWhere('r.generated_at >= :from', { from: sixtyDaysAgo })
      .andWhere('r.generated_at < :to', { to: thirtyDaysAgo })
      .getCount();

    // ── Assessments by type ──
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

    // ── Assessments by status ──
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
      active_assessments: {
        count: activeAssessments,
        percentage_change: this.pctChange(activeLaunchedRecent, activeLaunchedPrev),
      },
      total_participants: {
        count: totalParticipants,
        percentage_change: this.pctChange(participantsRecent, participantsPrev),
      },
      pending_responses: {
        count: pendingResponses,
        percentage_change: this.pctChange(pendingRecent, pendingPrev),
      },
      reports_generated: {
        count: reportsGenerated,
        percentage_change: this.pctChange(reportsRecent, reportsPrev),
      },
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
   * Returns aggregate radar chart data for a specific user, scoped to the
   * requesting org so a user from another organisation can never be queried.
   */
  async getUserAggregateRadar(orgId: string, userId: string): Promise<RadarAggregate> {
    const competencyData = await this.competencyRatingRepo
      .createQueryBuilder('cr')
      .innerJoin('cr.competencyAssessment', 'ca')
      .innerJoin('ca.assessment', 'a')
      .innerJoin('ca.participant', 'p')
      .innerJoin('cr.competency', 'comp')
      .innerJoin('comp.domain', 'domain')
      .where('p.user_id = :userId', { userId })
      .andWhere('a.organisation_id = :orgId', { orgId })
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
      .innerJoin('ps.participant', 'p')
      .where('p.user_id = :userId', { userId })
      .andWhere('a.organisation_id = :orgId', { orgId })
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
      .addSelect('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(a.created_at, 'YYYY-MM')")
      .addGroupBy('a.status')
      .orderBy("TO_CHAR(a.created_at, 'YYYY-MM')")
      .getRawMany();

    console.log("---------getMonthlyActivity-----------------\n\n\n\n\n\n/n/n/n/");
    console.log(raw);
    console.log("--------------------------");

    return raw.map((r) => ({
      month: r.month,
      count: parseInt(r.count, 10),
      status: r.status,
    }));
  }


  async getParticipantActivity(orgId: string) {
    const raw = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere("p.created_at >= NOW() - INTERVAL '12 months'")
      .select("TO_CHAR(p.created_at, 'Mon')", 'month')
      .addSelect('COUNT(DISTINCT p.user_id)', 'participants')
      .groupBy("TO_CHAR(p.created_at, 'Mon')")
      .addGroupBy("DATE_TRUNC('month', p.created_at)")
      .orderBy("DATE_TRUNC('month', p.created_at)")
      .getRawMany();

    return raw.map(r => ({
      month: r.month,
      participants: Number(r.participants),
    }));
  }
}
