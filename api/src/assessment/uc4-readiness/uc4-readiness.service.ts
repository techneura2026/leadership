import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentType, ReadinessRating, UserRole } from '@leaderprism/shared';
import { RoleProfile } from './entities/role-profile.entity';
import { SjtResponse } from './entities/sjt-response.entity';
import { LearningAgilityResponse } from './entities/learning-agility-response.entity';
import { ReadinessScore, effectiveGridPerformance, performanceSource } from './entities/readiness-score.entity';
import { ExternalPerformanceScore } from './entities/external-performance-score.entity';
import { DomainEvent, DomainEventBus, ReadinessComputedPayload } from '../../shared/events/domain-events';
import { AuditService } from '../../core/audit/audit.service';

export interface TalentSnapshot {
  readiness: {
    rating: ReadinessRating;
    compositeScore: number;
    components: { competency: number; feedback: number; sjt: number; learningAgility: number; personalityFit: number };
    roleProfile: { ref: string; title: string } | null;
  };
  nineBox: {
    performance: 'high' | 'medium' | 'low';
    potential: 'high' | 'medium' | 'low';
    performanceSource: 'manual' | 'hris' | 'feedback360';
    overrideNote: string | null;
  };
}
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Item } from '../items/entities/item.entity';
import { ReadinessScoringService, CrossAssessmentRefs } from './readiness-scoring.service';
import { assertOwnerOrPrivileged } from '../../shared/ownership.util';
import { EngineService } from '../engine/engine.service';

export interface CreateRoleProfileDto {
  title: string;
  level?: string;
  /** HRIS designation codes this profile applies to. */
  designationRefs?: string[];
  requiredCompetencies?: Array<{
    competencyId: string;
    minLevel: number;
    weight: number;
  }>;
  personalityFit?: Record<
    string,
    {
      minTScore?: number;
      maxTScore?: number;
      idealTScore?: number;
      weight: number;
    }
  >;
}

@Injectable()
export class Uc4ReadinessService {
  private readonly logger = new Logger(Uc4ReadinessService.name);

  constructor(
    @InjectRepository(RoleProfile)
    private readonly roleProfileRepo: Repository<RoleProfile>,
    @InjectRepository(SjtResponse)
    private readonly sjtResponseRepo: Repository<SjtResponse>,
    @InjectRepository(LearningAgilityResponse)
    private readonly laResponseRepo: Repository<LearningAgilityResponse>,
    @InjectRepository(ReadinessScore)
    private readonly readinessScoreRepo: Repository<ReadinessScore>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ExternalPerformanceScore)
    private readonly externalScoreRepo: Repository<ExternalPerformanceScore>,
    private readonly readinessScoringService: ReadinessScoringService,
    private readonly engineService: EngineService,
    private readonly events: DomainEventBus,
    private readonly audit: AuditService,
  ) {}

  /** HRIS final performance scores (one per employee per cycle; a repeat overwrites, e.g. after an appeal). */
  async upsertExternalPerformanceScores(
    orgId: string,
    rows: Array<{ userId: string; cycleRef: string; finalScore: number; ratingBand: string | null; finalisedAt: Date }>,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    await this.externalScoreRepo.upsert(
      rows.map((r) => ({ organisationId: orgId, ...r })),
      { conflictPaths: ['organisationId', 'userId', 'cycleRef'] },
    );
    return rows.length;
  }

  /**
   * Latest readiness score and effective 9-box placement per user (O-4, O-5) — for the HRIS talent
   * export. Users with no readiness score are absent from the map.
   */
  async getTalentSnapshots(orgId: string, userIds: string[]): Promise<Map<string, TalentSnapshot>> {
    const result = new Map<string, TalentSnapshot>();
    if (userIds.length === 0) return result;
    const scores = await this.readinessScoreRepo
      .createQueryBuilder('rs')
      .innerJoinAndSelect('rs.participant', 'p')
      .leftJoinAndSelect('rs.roleProfile', 'rp')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('p.user_id IN (:...userIds)', { userIds: [...new Set(userIds)] })
      .orderBy('rs.calculated_at', 'DESC')
      .getMany();
    const external = await this.getLatestExternalScores(orgId, userIds);
    for (const s of scores) {
      const userId = s.participant.userId;
      if (result.has(userId)) continue;
      const ext = external.get(userId);
      result.set(userId, {
        readiness: {
          rating: s.readinessRating,
          compositeScore: Number(s.compositeScore),
          components: {
            competency: Number(s.competencyScore),
            feedback: Number(s.feedbackScore),
            sjt: Number(s.sjtScore),
            learningAgility: Number(s.learningAgilityScore),
            personalityFit: Number(s.personalityFitScore),
          },
          roleProfile: s.roleProfile ? { ref: s.roleProfile.id, title: s.roleProfile.title } : null,
        },
        nineBox: {
          performance: effectiveGridPerformance(s, ext),
          potential: s.gridPotential,
          performanceSource: performanceSource(s, ext),
          overrideNote: s.manualGridPerformance ? s.manualPerformanceNote : null,
        },
      });
    }
    return result;
  }

  /** Most recently finalised HRIS score per user. */
  async getLatestExternalScores(orgId: string, userIds: string[]): Promise<Map<string, ExternalPerformanceScore>> {
    const result = new Map<string, ExternalPerformanceScore>();
    if (userIds.length === 0) return result;
    const rows = await this.externalScoreRepo
      .createQueryBuilder('s')
      .where('s.organisation_id = :orgId', { orgId })
      .andWhere('s.user_id IN (:...userIds)', { userIds: [...new Set(userIds)] })
      .orderBy('s.finalised_at', 'DESC')
      .getMany();
    for (const r of rows) {
      if (!result.has(r.userId)) result.set(r.userId, { ...r, finalScore: Number(r.finalScore) });
    }
    return result;
  }

  async getRoleProfiles(orgId: string): Promise<RoleProfile[]> {
    return this.roleProfileRepo.find({
      where: { organisationId: orgId },
      order: { title: 'ASC' },
    });
  }

  async createRoleProfile(orgId: string, dto: CreateRoleProfileDto): Promise<RoleProfile> {
    const profile = this.roleProfileRepo.create({
      organisationId: orgId,
      title: dto.title,
      level: dto.level ?? null,
      requiredCompetencies: dto.requiredCompetencies ?? [],
      personalityFit: dto.personalityFit ?? {},
      designationRefs: [...new Set(dto.designationRefs ?? [])],
    });

    const saved = await this.roleProfileRepo.save(profile);
    this.logger.log(`Created role profile ${saved.id} for org ${orgId}`);
    return saved;
  }

  private async assertAssessmentInOrg(assessmentId: string, orgId: string): Promise<void> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);
  }

  async getSjtQuestionnaire(
    assessmentId: string,
    participantId: string,
    orgId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<{
    items: Array<{
      id: string;
      stem: string;
      options: Array<{ value: number; label: string }>;
      answered: boolean;
      selectedOption: number | null;
    }>;
    total: number;
    answered: number;
  }> {
    await this.assertAssessmentInOrg(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
    assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);

    const items = await this.itemRepo.find({
      where: { module: 'sjt', isActive: true },
      order: { createdAt: 'ASC' },
    });

    const existingResponses = await this.sjtResponseRepo.find({
      where: { assessmentId, participantId },
    });

    const responseMap = new Map<string, number>(
      existingResponses.map((r) => [r.itemId, r.selectedOption]),
    );

    return {
      items: items.map((item) => ({
        id: item.id,
        stem: item.stem,
        options: item.options ?? [],
        answered: responseMap.has(item.id),
        selectedOption: responseMap.get(item.id) ?? null,
      })),
      total: items.length,
      answered: existingResponses.length,
    };
  }

  async submitSjtResponse(
    assessmentId: string,
    participantId: string,
    orgId: string,
    itemId: string,
    selectedOption: number,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<SjtResponse> {
    await this.assertAssessmentInOrg(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
    assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);

    const item = await this.itemRepo.findOne({ where: { id: itemId, module: 'sjt' } });
    if (!item) throw new NotFoundException(`SJT item ${itemId} not found`);

    // Score using the expert key: scoringKey[selectedOption]
    const scoringKey = item.scoringKey;
    const score = scoringKey ? (scoringKey[selectedOption.toString()] ?? 0) : 0;

    const existing = await this.sjtResponseRepo.findOne({
      where: { assessmentId, participantId, itemId },
    });

    if (existing) {
      existing.selectedOption = selectedOption;
      existing.score = score;
      return this.sjtResponseRepo.save(existing);
    }

    const response = this.sjtResponseRepo.create({
      assessmentId,
      participantId,
      itemId,
      selectedOption,
      score,
    });

    return this.sjtResponseRepo.save(response);
  }

  async getLearningAgilityQuestionnaire(
    assessmentId: string,
    participantId: string,
    orgId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<{
    items: Array<{
      id: string;
      factor: string;
      stem: string;
      options: Array<{ value: number; label: string }>;
      answered: boolean;
      responseValue: number | null;
    }>;
    total: number;
    answered: number;
  }> {
    await this.assertAssessmentInOrg(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
    assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);

    const items = await this.itemRepo.find({
      where: { module: 'learning_agility', isActive: true },
      order: { factor: 'ASC', createdAt: 'ASC' },
    });

    const existingResponses = await this.laResponseRepo.find({
      where: { assessmentId, participantId },
    });

    const responseMap = new Map<string, number>(
      existingResponses.map((r) => [r.itemId, r.responseValue]),
    );

    return {
      items: items.map((item) => ({
        id: item.id,
        factor: item.factor ?? '',
        stem: item.stem,
        options: item.options ?? [],
        answered: responseMap.has(item.id),
        responseValue: responseMap.get(item.id) ?? null,
      })),
      total: items.length,
      answered: existingResponses.length,
    };
  }

  async submitLearningAgilityResponse(
    assessmentId: string,
    participantId: string,
    orgId: string,
    itemId: string,
    value: number,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<LearningAgilityResponse> {
    await this.assertAssessmentInOrg(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
    assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);

    const item = await this.itemRepo.findOne({
      where: { id: itemId, module: 'learning_agility' },
    });
    if (!item) throw new NotFoundException(`LA item ${itemId} not found`);

    const existing = await this.laResponseRepo.findOne({
      where: { assessmentId, participantId, itemId },
    });

    if (existing) {
      existing.responseValue = value;
      return this.laResponseRepo.save(existing);
    }

    const response = this.laResponseRepo.create({
      assessmentId,
      participantId,
      itemId,
      responseValue: value,
    });

    return this.laResponseRepo.save(response);
  }

  async computeReadiness(
    assessmentId: string,
    participantId: string,
    roleProfileId: string | null,
    orgId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<ReadinessScore> {
    await this.assertAssessmentInOrg(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
    assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);

    await this.assertSjtAndLaComplete(assessmentId, participantId);

    // Readiness draws on the participant's competency/360/personality assessments,
    // which are separate Assessment/AssessmentParticipant rows for the same user —
    // resolve their latest completed instance of each rather than reusing this
    // assessment's own IDs (those never match those other tables).
    const refs: CrossAssessmentRefs = {
      competency: await this.engineService.findLatestParticipantByType(
        orgId,
        participant.userId,
        AssessmentType.COMPETENCY,
      ),
      feedback: await this.engineService.findLatestParticipantByType(
        orgId,
        participant.userId,
        AssessmentType.FEEDBACK_360,
      ),
      personality: await this.engineService.findLatestParticipantByType(
        orgId,
        participant.userId,
        AssessmentType.PERSONALITY,
      ),
    };

    const score = await this.readinessScoringService.calculateReadiness(
      assessmentId,
      participantId,
      roleProfileId,
      refs,
    );

    // Mark participant as completed so the frontend shows the correct status
    participant.status = 'completed';
    participant.completedAt = new Date();
    await this.participantRepo.save(participant);

    await this.engineService.maybeCloseAssessment(assessmentId);

    this.logger.log(
      `Computed readiness for participant ${participantId}: rating=${score.readinessRating} composite=${score.compositeScore}`,
    );

    const assessment = await this.assessmentRepo.findOne({ where: { id: assessmentId, organisationId: orgId } });
    const payload: ReadinessComputedPayload = {
      orgId,
      assessmentId,
      cycleRef: assessment?.cycleRef ?? null,
      userId: participant.userId,
      occurredAt: new Date().toISOString(),
    };
    this.events.emit(DomainEvent.ReadinessComputed, payload);

    return score;
  }

  /** Resolves a user's participant record in their latest completed assessment of a given type. */
  async resolveParticipantRef(
    orgId: string,
    userId: string,
    assessmentType: AssessmentType,
  ): Promise<{ assessmentId: string; participantId: string } | null> {
    return this.engineService.findLatestParticipantByType(orgId, userId, assessmentType);
  }

  /** Ensures every active SJT and learning-agility item has a recorded response before scoring. */
  private async assertSjtAndLaComplete(assessmentId: string, participantId: string): Promise<void> {
    const [sjtTotal, sjtAnswered, laTotal, laAnswered] = await Promise.all([
      this.itemRepo.count({ where: { module: 'sjt', isActive: true } }),
      this.sjtResponseRepo.count({ where: { assessmentId, participantId } }),
      this.itemRepo.count({ where: { module: 'learning_agility', isActive: true } }),
      this.laResponseRepo.count({ where: { assessmentId, participantId } }),
    ]);

    if (sjtAnswered < sjtTotal) {
      throw new BadRequestException(
        `SJT questionnaire incomplete: ${sjtAnswered}/${sjtTotal} scenarios answered`,
      );
    }
    if (laAnswered < laTotal) {
      throw new BadRequestException(
        `Learning agility questionnaire incomplete: ${laAnswered}/${laTotal} items answered`,
      );
    }
  }

  /**
   * Participant-facing: their own computed readiness score(s), including 9-box placement.
   * Previously admin-only (via getSuccessionDashboard) — participants had no way to see their
   * own result at all (see docs/frontend-backend-gap-remediation-plan.md Tier 0 item 0h).
   *
   * Restricted to the participant themselves (or an admin/HR manager) — without this check any
   * authenticated org member could view any OTHER participant's readiness/9-box placement by
   * participantId, which is meant to be admin-controlled (see Finding N in the audit).
   */
  async getMyReadinessScores(
    assessmentId: string,
    participantId: string,
    orgId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<ReadinessScore[]> {
    await this.assertAssessmentInOrg(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    assertOwnerOrPrivileged(
      participant.userId,
      requestingUserId,
      requestingUserRole,
      'You can only view your own readiness results.',
    );

    return this.readinessScoreRepo.find({
      where: { assessmentId, participantId },
      relations: ['roleProfile'],
      order: { calculatedAt: 'DESC' },
    });
  }

  async getSuccessionDashboard(
    orgId: string,
    assessmentId?: string,
  ): Promise<{
    totalCandidates: number;
    byRating: Record<ReadinessRating, number>;
    byRole: Array<{
      roleProfileId: string;
      roleTitle: string;
      candidates: Array<{
        readinessScoreId: string;
        assessmentId: string;
        participantId: string;
        userId: string;
        name: string;
        readinessRating: ReadinessRating;
        compositeScore: number;
        gridPerformance: string;
        manualGridPerformance: string | null;
        effectiveGridPerformance: string;
        performanceSource: 'manual' | 'hris' | 'feedback360';
        gridPotential: string;
      }>;
    }>;
  }> {
    const qb = this.readinessScoreRepo
      .createQueryBuilder('rs')
      .leftJoinAndSelect('rs.participant', 'p')
      .leftJoinAndSelect('p.user', 'u')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId });

    if (assessmentId) {
      qb.andWhere('rs.assessment_id = :assessmentId', { assessmentId });
    }

    const scores = await qb.getMany();
    const external = await this.getLatestExternalScores(
      orgId,
      scores.map((s) => s.participant?.userId).filter((id): id is string => !!id),
    );
    const roleProfiles = await this.roleProfileRepo.find({
      where: { organisationId: orgId },
    });

    const roleProfileMap = new Map<string, RoleProfile>(
      roleProfiles.map((rp) => [rp.id, rp]),
    );

    // Aggregate by rating
    const byRating = {
      [ReadinessRating.READY_NOW]: 0,
      [ReadinessRating.ONE_TWO_YEARS]: 0,
      [ReadinessRating.DEVELOPING]: 0,
      [ReadinessRating.NOT_YET_READY]: 0,
    } as Record<ReadinessRating, number>;

    for (const s of scores) {
      byRating[s.readinessRating] = (byRating[s.readinessRating] ?? 0) + 1;
    }

    // Group by role profile
    const byRoleMap = new Map<
      string,
      {
        roleProfileId: string;
        roleTitle: string;
        candidates: typeof scores;
      }
    >();

    for (const s of scores) {
      const roleId = s.roleProfileId ?? 'none';
      const roleTitle =
        s.roleProfileId && roleProfileMap.has(s.roleProfileId)
          ? roleProfileMap.get(s.roleProfileId)!.title
          : 'Unassigned';

      if (!byRoleMap.has(roleId)) {
        byRoleMap.set(roleId, { roleProfileId: roleId, roleTitle, candidates: [] });
      }
      byRoleMap.get(roleId)!.candidates.push(s);
    }

    const byRole = Array.from(byRoleMap.values()).map((role) => ({
      roleProfileId: role.roleProfileId,
      roleTitle: role.roleTitle,
      candidates: role.candidates.map((c) => {
        const user = c.participant?.user;
        return {
          readinessScoreId: c.id,
          assessmentId: c.assessmentId,
          participantId: c.participantId,
          userId: c.participant?.userId ?? '',
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          readinessRating: c.readinessRating,
          compositeScore: Number(c.compositeScore),
          gridPerformance: c.gridPerformance,
          manualGridPerformance: c.manualGridPerformance,
          effectiveGridPerformance: effectiveGridPerformance(c, external.get(c.participant?.userId ?? '')),
          performanceSource: performanceSource(c, external.get(c.participant?.userId ?? '')),
          gridPotential: c.gridPotential,
        };
      }),
    }));

    return {
      totalCandidates: scores.length,
      byRating,
      byRole,
    };
  }

  /**
   * Latest readiness score per user (by AssessmentParticipant.userId), for org-scoped users.
   * Used by the succession module to bucket successor-pipeline candidates by current
   * readiness without succession.service.ts needing to reach into the ReadinessScore repo
   * directly (module-boundary rule — cross-module access goes through exported services).
   */
  async getLatestReadinessForUsers(
    orgId: string,
    userIds: string[],
  ): Promise<Map<string, { readinessRating: ReadinessRating; compositeScore: number }>> {
    const result = new Map<string, { readinessRating: ReadinessRating; compositeScore: number }>();
    if (userIds.length === 0) return result;

    const scores = await this.readinessScoreRepo
      .createQueryBuilder('rs')
      .innerJoinAndSelect('rs.participant', 'p')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .andWhere('p.user_id IN (:...userIds)', { userIds })
      .orderBy('rs.calculated_at', 'DESC')
      .getMany();

    for (const score of scores) {
      const userId = score.participant?.userId;
      if (userId && !result.has(userId)) {
        result.set(userId, {
          readinessRating: score.readinessRating,
          compositeScore: Number(score.compositeScore),
        });
      }
    }

    return result;
  }

  /**
   * Sets or clears (gridPerformance: null) the manual performance-rating override on a
   * ReadinessScore row. The 9-box's performance axis defaults to the auto-derived value from
   * the 360-feedback score — this lets HR/ORG_ADMIN correct it when they have better data.
   */
  async setPerformanceOverride(
    readinessScoreId: string,
    orgId: string,
    setById: string,
    gridPerformance: 'high' | 'medium' | 'low' | null,
    note: string | null,
  ): Promise<ReadinessScore> {
    const score = await this.readinessScoreRepo.findOne({
      where: { id: readinessScoreId },
      relations: ['assessment'],
    });
    if (!score || score.assessment?.organisationId !== orgId) {
      throw new NotFoundException(`Readiness score ${readinessScoreId} not found`);
    }
    const before = { manualGridPerformance: score.manualGridPerformance, manualPerformanceNote: score.manualPerformanceNote };

    if (gridPerformance === null) {
      score.manualGridPerformance = null;
      score.manualPerformanceNote = null;
      score.manualPerformanceSetById = null;
      score.manualPerformanceSetAt = null;
    } else {
      score.manualGridPerformance = gridPerformance;
      score.manualPerformanceNote = note;
      score.manualPerformanceSetById = setById;
      score.manualPerformanceSetAt = new Date();
    }

    const saved = await this.readinessScoreRepo.save(score);
    this.logger.log(
      `${gridPerformance === null ? 'Cleared' : 'Set'} performance override on readiness score ${readinessScoreId}`,
    );
    await this.audit.record({
      orgId,
      actorType: 'user',
      actorId: setById,
      action: gridPerformance === null ? 'talent.performance_override.cleared' : 'talent.performance_override.set',
      entityType: 'readiness_score',
      entityId: readinessScoreId,
      before,
      after: { manualGridPerformance: saved.manualGridPerformance, manualPerformanceNote: saved.manualPerformanceNote },
      reason: note,
    });
    return saved;
  }
}
