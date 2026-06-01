import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadinessRating } from '@leaderprism/shared';
import { RoleProfile } from './entities/role-profile.entity';
import { SjtResponse } from './entities/sjt-response.entity';
import { LearningAgilityResponse } from './entities/learning-agility-response.entity';
import { ReadinessScore } from './entities/readiness-score.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Item } from '../items/entities/item.entity';
import { ReadinessScoringService } from './readiness-scoring.service';

export interface CreateRoleProfileDto {
  title: string;
  level?: string;
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
    private readonly readinessScoringService: ReadinessScoringService,
  ) {}

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
    });

    const saved = await this.roleProfileRepo.save(profile);
    this.logger.log(`Created role profile ${saved.id} for org ${orgId}`);
    return saved;
  }

  async getSjtQuestionnaire(
    assessmentId: string,
    participantId: string,
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
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

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
    itemId: string,
    selectedOption: number,
  ): Promise<SjtResponse> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

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
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

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
    itemId: string,
    value: number,
  ): Promise<LearningAgilityResponse> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

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
  ): Promise<ReadinessScore> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    const score = await this.readinessScoringService.calculateReadiness(
      assessmentId,
      participantId,
      roleProfileId,
    );

    this.logger.log(
      `Computed readiness for participant ${participantId}: rating=${score.readinessRating} composite=${score.compositeScore}`,
    );

    return score;
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
        participantId: string;
        name: string;
        readinessRating: ReadinessRating;
        compositeScore: number;
        gridPerformance: string;
        gridPotential: string;
      }>;
    }>;
  }> {
    const qb = this.readinessScoreRepo
      .createQueryBuilder('rs')
      .innerJoin('rs.participant', 'p')
      .innerJoin('p.user', 'u')
      .innerJoin('p.assessment', 'a')
      .where('a.organisation_id = :orgId', { orgId })
      .select([
        'rs.id',
        'rs.participantId',
        'rs.roleProfileId',
        'rs.readinessRating',
        'rs.compositeScore',
        'rs.gridPerformance',
        'rs.gridPotential',
        'u.firstName',
        'u.lastName',
      ]);

    if (assessmentId) {
      qb.andWhere('rs.assessment_id = :assessmentId', { assessmentId });
    }

    const scores = await qb.getMany();
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
        const user = (c.participant as any)?.user;
        return {
          participantId: c.participantId,
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          readinessRating: c.readinessRating,
          compositeScore: Number(c.compositeScore),
          gridPerformance: c.gridPerformance,
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
}
