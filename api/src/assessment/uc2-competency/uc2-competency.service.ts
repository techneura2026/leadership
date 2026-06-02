import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetencyAssessment } from './entities/competency-assessment.entity';
import { CompetencyRating } from './entities/competency-rating.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Competency } from '../items/entities/competency.entity';
import { CompetencyDomain } from '../items/entities/competency-domain.entity';

interface RatingDto {
  competencyId: string;
  levelRated: number;
  evidenceText?: string;
  developmentComment?: string;
}

export interface GapResult {
  competencyId: string;
  competencyName: string;
  domainId: string;
  domainName: string;
  selfRating: number | null;
  managerRating: number | null;
  gap: number | null; // managerRating - selfRating
}

export interface CompetencyProfileResult {
  domainId: string;
  domainName: string;
  domainColour: string;
  averageSelfRating: number | null;
  averageManagerRating: number | null;
  competencies: Array<{
    competencyId: string;
    name: string;
    selfRating: number | null;
    managerRating: number | null;
    gap: number | null;
  }>;
}

@Injectable()
export class Uc2CompetencyService {
  private readonly logger = new Logger(Uc2CompetencyService.name);

  constructor(
    @InjectRepository(CompetencyAssessment)
    private readonly caRepo: Repository<CompetencyAssessment>,
    @InjectRepository(CompetencyRating)
    private readonly ratingRepo: Repository<CompetencyRating>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    @InjectRepository(Competency)
    private readonly competencyRepo: Repository<Competency>,
    @InjectRepository(CompetencyDomain)
    private readonly domainRepo: Repository<CompetencyDomain>,
  ) {}

  async startSelfAssessment(
    assessmentId: string,
    participantId: string,
    orgId: string,
  ): Promise<CompetencyAssessment> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    // Return existing if already started
    const existing = await this.caRepo.findOne({
      where: {
        assessmentId,
        participantId,
        assessorId: participant.userId,
        assessorType: 'self',
      },
    });
    if (existing) return existing;

    const ca = this.caRepo.create({
      assessmentId,
      participantId,
      assessorId: participant.userId,
      assessorType: 'self',
    });

    let saved: CompetencyAssessment;
    try {
      saved = await this.caRepo.save(ca);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('UQ_competency_assessment_unique')) {
        this.logger.warn(
          `Self-assessment already exists for participant ${participantId} due to concurrent race.`,
        );
        const existingAfterRace = await this.caRepo.findOne({
          where: {
            assessmentId,
            participantId,
            assessorId: participant.userId,
            assessorType: 'self',
          },
        });
        if (existingAfterRace) return existingAfterRace;
      }
      throw err;
    }

    if (participant.status === 'invited') {
      participant.status = 'in_progress';
      await this.participantRepo.save(participant);
    }

    this.logger.log(`Started self-assessment CA ${saved.id} for participant ${participantId}`);
    return saved;
  }

  async submitSelfRatings(
    caId: string,
    participantId: string,
    ratings: RatingDto[],
  ): Promise<CompetencyAssessment> {
    const ca = await this.caRepo.findOne({
      where: { id: caId, participantId, assessorType: 'self' },
    });
    if (!ca) throw new NotFoundException(`Self-assessment ${caId} not found`);

    if (ca.submittedAt) {
      throw new BadRequestException('Self-assessment already submitted');
    }

    // Upsert ratings
    for (const r of ratings) {
      const existing = await this.ratingRepo.findOne({
        where: { caId, competencyId: r.competencyId },
      });

      if (existing) {
        existing.levelRated = r.levelRated;
        existing.evidenceText = r.evidenceText ?? null;
        existing.developmentComment = r.developmentComment ?? null;
        await this.ratingRepo.save(existing);
      } else {
        const rating = this.ratingRepo.create({
          caId,
          competencyId: r.competencyId,
          levelRated: r.levelRated,
          evidenceText: r.evidenceText ?? null,
          developmentComment: r.developmentComment ?? null,
        });
        await this.ratingRepo.save(rating);
      }
    }

    ca.submittedAt = new Date();
    const saved = await this.caRepo.save(ca);

    const participant = await this.participantRepo.findOne({ where: { id: participantId } });
    if (participant && participant.status !== 'completed') {
      participant.status = 'completed';
      participant.completedAt = new Date();
      await this.participantRepo.save(participant);
    }

    this.logger.log(`Submitted self-ratings for CA ${caId}`);
    return saved;
  }

  async startManagerAssessment(
    assessmentId: string,
    managerId: string,
    participantId: string,
    orgId: string,
  ): Promise<CompetencyAssessment> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    // Return existing manager CA if present
    const existing = await this.caRepo.findOne({
      where: { assessmentId, participantId, assessorId: managerId, assessorType: 'manager' },
    });
    if (existing) return existing;

    const ca = this.caRepo.create({
      assessmentId,
      participantId,
      assessorId: managerId,
      assessorType: 'manager',
    });

    let saved: CompetencyAssessment;
    try {
      saved = await this.caRepo.save(ca);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('UQ_competency_assessment_unique')) {
        this.logger.warn(
          `Manager assessment already exists for participant ${participantId} due to concurrent race.`,
        );
        const existingAfterRace = await this.caRepo.findOne({
          where: { assessmentId, participantId, assessorId: managerId, assessorType: 'manager' },
        });
        if (existingAfterRace) return existingAfterRace;
      }
      throw err;
    }
    this.logger.log(`Started manager assessment CA ${saved.id} for participant ${participantId}`);
    return saved;
  }

  async submitManagerRatings(
    caId: string,
    managerId: string,
    ratings: RatingDto[],
  ): Promise<CompetencyAssessment> {
    const ca = await this.caRepo.findOne({
      where: { id: caId, assessorId: managerId, assessorType: 'manager' },
    });
    if (!ca) throw new NotFoundException(`Manager assessment ${caId} not found`);

    if (ca.submittedAt) {
      throw new BadRequestException('Manager assessment already submitted');
    }

    for (const r of ratings) {
      const existing = await this.ratingRepo.findOne({
        where: { caId, competencyId: r.competencyId },
      });

      if (existing) {
        existing.levelRated = r.levelRated;
        existing.evidenceText = r.evidenceText ?? null;
        existing.developmentComment = r.developmentComment ?? null;
        await this.ratingRepo.save(existing);
      } else {
        const rating = this.ratingRepo.create({
          caId,
          competencyId: r.competencyId,
          levelRated: r.levelRated,
          evidenceText: r.evidenceText ?? null,
          developmentComment: r.developmentComment ?? null,
        });
        await this.ratingRepo.save(rating);
      }
    }

    ca.submittedAt = new Date();
    const saved = await this.caRepo.save(ca);
    this.logger.log(`Submitted manager ratings for CA ${caId}`);
    return saved;
  }

  async getGapAnalysis(
    assessmentId: string,
    participantId: string,
    orgId: string,
  ): Promise<GapResult[]> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    const selfCA = await this.caRepo.findOne({
      where: { assessmentId, participantId, assessorType: 'self' },
      relations: ['ratings', 'ratings.competency', 'ratings.competency.domain'],
    });

    const managerCA = await this.caRepo.findOne({
      where: { assessmentId, participantId, assessorType: 'manager' },
      relations: ['ratings'],
    });

    const selfRatingsMap = new Map<string, CompetencyRating>();
    if (selfCA?.ratings) {
      for (const r of selfCA.ratings) {
        selfRatingsMap.set(r.competencyId, r);
      }
    }

    const managerRatingsMap = new Map<string, CompetencyRating>();
    if (managerCA?.ratings) {
      for (const r of managerCA.ratings) {
        managerRatingsMap.set(r.competencyId, r);
      }
    }

    // Get all competency IDs from both sets
    const allCompetencyIds = new Set([
      ...selfRatingsMap.keys(),
      ...managerRatingsMap.keys(),
    ]);

    const results: GapResult[] = [];

    for (const competencyId of allCompetencyIds) {
      const competency = await this.competencyRepo.findOne({
        where: { id: competencyId },
        relations: ['domain'],
      });

      const selfRating = selfRatingsMap.get(competencyId)?.levelRated ?? null;
      const managerRating = managerRatingsMap.get(competencyId)?.levelRated ?? null;
      const gap =
        selfRating !== null && managerRating !== null
          ? managerRating - selfRating
          : null;

      results.push({
        competencyId,
        competencyName: competency?.name ?? '',
        domainId: competency?.domainId ?? '',
        domainName: competency?.domain?.name ?? '',
        selfRating,
        managerRating,
        gap,
      });
    }

    return results;
  }

  async getCompetencyProfile(
    assessmentId: string,
    participantId: string,
    orgId: string,
  ): Promise<CompetencyProfileResult[]> {
    const gaps = await this.getGapAnalysis(assessmentId, participantId, orgId);

    // Group by domain
    const domainMap = new Map<
      string,
      {
        domainId: string;
        domainName: string;
        domainColour: string;
        competencies: typeof gaps;
      }
    >();

    for (const gap of gaps) {
      if (!domainMap.has(gap.domainId)) {
        const domain = await this.domainRepo.findOne({ where: { id: gap.domainId } });
        domainMap.set(gap.domainId, {
          domainId: gap.domainId,
          domainName: gap.domainName,
          domainColour: domain?.colour ?? '#6B7280',
          competencies: [],
        });
      }
      domainMap.get(gap.domainId)!.competencies.push(gap);
    }

    // Build profile with domain summaries
    const profile: CompetencyProfileResult[] = [];

    for (const [, domain] of domainMap) {
      const selfRatings = domain.competencies
        .filter((c) => c.selfRating !== null)
        .map((c) => c.selfRating as number);

      const managerRatings = domain.competencies
        .filter((c) => c.managerRating !== null)
        .map((c) => c.managerRating as number);

      const avgSelf =
        selfRatings.length > 0
          ? selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length
          : null;

      const avgManager =
        managerRatings.length > 0
          ? managerRatings.reduce((a, b) => a + b, 0) / managerRatings.length
          : null;

      profile.push({
        domainId: domain.domainId,
        domainName: domain.domainName,
        domainColour: domain.domainColour,
        averageSelfRating: avgSelf !== null ? Math.round(avgSelf * 100) / 100 : null,
        averageManagerRating: avgManager !== null ? Math.round(avgManager * 100) / 100 : null,
        competencies: domain.competencies.map((c) => ({
          competencyId: c.competencyId,
          name: c.competencyName,
          selfRating: c.selfRating,
          managerRating: c.managerRating,
          gap: c.gap,
        })),
      });
    }

    return profile;
  }
}
