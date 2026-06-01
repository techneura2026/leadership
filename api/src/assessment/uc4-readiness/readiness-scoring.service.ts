import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadinessRating } from '@leaderprism/shared';
import { SjtResponse } from './entities/sjt-response.entity';
import { LearningAgilityResponse } from './entities/learning-agility-response.entity';
import { ReadinessScore } from './entities/readiness-score.entity';
import { RoleProfile } from './entities/role-profile.entity';
import { CompetencyRating } from '../uc2-competency/entities/competency-rating.entity';
import { CompetencyAssessment } from '../uc2-competency/entities/competency-assessment.entity';
import { PersonalityScore } from '../uc3-personality/entities/personality-score.entity';
import { RaterNomination } from '../uc1-feedback/entities/rater-nomination.entity';
import { RaterResponse } from '../uc1-feedback/entities/rater-response.entity';
import { Item } from '../items/entities/item.entity';

interface ComponentScores {
  competencyScore: number;
  feedbackScore: number;
  sjtScore: number;
  learningAgilityScore: number;
  personalityFitScore: number;
}

@Injectable()
export class ReadinessScoringService {
  private readonly logger = new Logger(ReadinessScoringService.name);

  // Composite weights
  private readonly WEIGHTS = {
    competency: 0.30,
    feedback: 0.25,
    sjt: 0.25,
    la: 0.15,
    personality: 0.05,
  };

  constructor(
    @InjectRepository(SjtResponse)
    private readonly sjtResponseRepo: Repository<SjtResponse>,
    @InjectRepository(LearningAgilityResponse)
    private readonly laResponseRepo: Repository<LearningAgilityResponse>,
    @InjectRepository(ReadinessScore)
    private readonly readinessScoreRepo: Repository<ReadinessScore>,
    @InjectRepository(RoleProfile)
    private readonly roleProfileRepo: Repository<RoleProfile>,
    @InjectRepository(CompetencyRating)
    private readonly competencyRatingRepo: Repository<CompetencyRating>,
    @InjectRepository(CompetencyAssessment)
    private readonly caRepo: Repository<CompetencyAssessment>,
    @InjectRepository(PersonalityScore)
    private readonly personalityScoreRepo: Repository<PersonalityScore>,
    @InjectRepository(RaterNomination)
    private readonly nominationRepo: Repository<RaterNomination>,
    @InjectRepository(RaterResponse)
    private readonly raterResponseRepo: Repository<RaterResponse>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
  ) {}

  /**
   * Orchestrates all sub-scores and persists the final readiness score.
   */
  async calculateReadiness(
    assessmentId: string,
    participantId: string,
    roleProfileId: string | null,
  ): Promise<ReadinessScore> {
    const roleProfile = roleProfileId
      ? await this.roleProfileRepo.findOne({ where: { id: roleProfileId } })
      : null;

    const competencyScore = await this.getCompetencyScore(assessmentId, participantId, roleProfile);
    const feedbackScore = await this.getFeedbackScore(assessmentId, participantId);
    const sjtScore = await this.getSjtScore(assessmentId, participantId);
    const learningAgilityScore = await this.getLearningAgilityScore(assessmentId, participantId);
    const personalityFitScore = await this.getPersonalityFitScore(participantId, assessmentId, roleProfile);

    const compositeScore = this.getCompositeScore({
      competencyScore,
      feedbackScore,
      sjtScore,
      learningAgilityScore,
      personalityFitScore,
    });

    const readinessRating = this.mapToReadinessRating(compositeScore);

    // Derive 9-box grid dimensions
    const gridPerformance = this.scoreToGrid(feedbackScore);
    const gridPotential = this.scoreToGrid(
      (learningAgilityScore * 0.5 + personalityFitScore * 0.3 + sjtScore * 0.2),
    );

    // Persist / update
    const existing = await this.readinessScoreRepo.findOne({
      where: { assessmentId, participantId, roleProfileId: roleProfileId ?? (null as any) },
    });

    const scoreData = {
      assessmentId,
      participantId,
      roleProfileId: roleProfileId ?? null,
      readinessRating,
      compositeScore,
      competencyScore,
      feedbackScore,
      sjtScore,
      learningAgilityScore,
      personalityFitScore,
      gridPerformance,
      gridPotential,
    };

    if (existing) {
      Object.assign(existing, scoreData);
      return this.readinessScoreRepo.save(existing);
    }

    const score = this.readinessScoreRepo.create(scoreData);
    return this.readinessScoreRepo.save(score);
  }

  /**
   * Compares UC2 manager ratings against role profile requirements.
   * Returns 0-100 weighted score.
   */
  async getCompetencyScore(
    assessmentId: string,
    participantId: string,
    roleProfile: RoleProfile | null,
  ): Promise<number> {
    if (!roleProfile || !roleProfile.requiredCompetencies?.length) {
      // Fall back to simple average of manager ratings normalised to 0-100
      const managerCA = await this.caRepo.findOne({
        where: { assessmentId, participantId, assessorType: 'manager' },
        relations: ['ratings'],
      });

      if (!managerCA?.ratings?.length) return 0;

      const avg =
        managerCA.ratings.reduce((sum, r) => sum + r.levelRated, 0) / managerCA.ratings.length;
      // Normalise from 1-4 scale to 0-100
      return Math.round(((avg - 1) / 3) * 100);
    }

    const managerCA = await this.caRepo.findOne({
      where: { assessmentId, participantId, assessorType: 'manager' },
      relations: ['ratings'],
    });

    if (!managerCA?.ratings?.length) return 0;

    const ratingMap = new Map<string, number>(
      managerCA.ratings.map((r) => [r.competencyId, r.levelRated]),
    );

    let weightedTotal = 0;
    let totalWeight = 0;

    for (const req of roleProfile.requiredCompetencies) {
      const actualLevel = ratingMap.get(req.competencyId) ?? 0;
      // Score = actual / required, capped at 1.0, scaled to 0-100
      const rawFraction = Math.min(1, actualLevel / req.minLevel);
      weightedTotal += rawFraction * 100 * req.weight;
      totalWeight += req.weight;
    }

    return totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0;
  }

  /**
   * Returns 360 overall effectiveness score as 0-100.
   * Uses mean of all completed rater scores across all competencies.
   */
  async getFeedbackScore(assessmentId: string, participantId: string): Promise<number> {
    const nominations = await this.nominationRepo.find({
      where: { assessmentId, participantId, status: 'completed' },
      relations: ['responses'],
    });

    if (!nominations.length) return 0;

    const allScores: number[] = [];
    for (const nomination of nominations) {
      for (const response of nomination.responses ?? []) {
        if (response.score !== null && response.score !== undefined) {
          allScores.push(Number(response.score));
        }
      }
    }

    if (!allScores.length) return 0;

    const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    // Assume 5-point scale → normalise to 0-100
    return Math.round(((mean - 1) / 4) * 100);
  }

  /**
   * Returns mean SJT scenario score normalised to 0-100.
   */
  async getSjtScore(assessmentId: string, participantId: string): Promise<number> {
    const responses = await this.sjtResponseRepo.find({
      where: { assessmentId, participantId },
    });

    if (!responses.length) return 0;

    const mean = responses.reduce((sum, r) => sum + Number(r.score), 0) / responses.length;
    // SJT scores are typically 0-4 → normalise to 0-100
    return Math.round((mean / 4) * 100);
  }

  /**
   * Calculates mean per LA dimension and overall, normalised to 0-100.
   */
  async getLearningAgilityScore(assessmentId: string, participantId: string): Promise<number> {
    const responses = await this.laResponseRepo.find({
      where: { assessmentId, participantId },
      relations: ['item'],
    });

    if (!responses.length) return 0;

    // Group by factor/dimension
    const byDimension = new Map<string, number[]>();
    for (const r of responses) {
      const dimension = r.item?.factor ?? 'general';
      if (!byDimension.has(dimension)) {
        byDimension.set(dimension, []);
      }
      byDimension.get(dimension)!.push(r.responseValue);
    }

    const dimensionMeans: number[] = [];
    for (const [, values] of byDimension) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      dimensionMeans.push(mean);
    }

    const overallMean =
      dimensionMeans.reduce((a, b) => a + b, 0) / dimensionMeans.length;

    // Assume 1-5 scale → normalise to 0-100
    return Math.round(((overallMean - 1) / 4) * 100);
  }

  /**
   * Compares personality T-scores against role profile fit requirements.
   * Returns 0-100 fit score.
   */
  async getPersonalityFitScore(
    participantId: string,
    assessmentId: string,
    roleProfile: RoleProfile | null,
  ): Promise<number> {
    if (!roleProfile || !Object.keys(roleProfile.personalityFit ?? {}).length) {
      return 50; // Neutral if no role requirements defined
    }

    const scores = await this.personalityScoreRepo.find({
      where: { assessmentId, participantId },
    });

    if (!scores.length) return 50;

    const scoreMap = new Map<string, number>(
      scores.map((s) => [s.factor, Number(s.tScore)]),
    );

    let totalFit = 0;
    let totalWeight = 0;

    for (const [factor, req] of Object.entries(roleProfile.personalityFit)) {
      const actualTScore = scoreMap.get(factor);
      if (actualTScore === undefined) continue;

      let fit = 0;

      if (req.idealTScore) {
        // Fit = 100 - (distance from ideal * 2), floored at 0
        const distance = Math.abs(actualTScore - req.idealTScore);
        fit = Math.max(0, 100 - distance * 2);
      } else if (req.minTScore !== undefined && req.maxTScore !== undefined) {
        if (actualTScore >= req.minTScore && actualTScore <= req.maxTScore) {
          fit = 100;
        } else {
          const underMin = Math.max(0, req.minTScore - actualTScore);
          const overMax = Math.max(0, actualTScore - req.maxTScore);
          fit = Math.max(0, 100 - (underMin + overMax) * 3);
        }
      } else {
        fit = 50; // No specific requirement
      }

      totalFit += fit * req.weight;
      totalWeight += req.weight;
    }

    return totalWeight > 0 ? Math.round(totalFit / totalWeight) : 50;
  }

  /**
   * Maps composite score to a ReadinessRating.
   */
  mapToReadinessRating(compositeScore: number): ReadinessRating {
    if (compositeScore >= 75) return ReadinessRating.READY_NOW;
    if (compositeScore >= 60) return ReadinessRating.ONE_TWO_YEARS;
    if (compositeScore >= 45) return ReadinessRating.DEVELOPING;
    return ReadinessRating.NOT_YET_READY;
  }

  /**
   * Calculates weighted composite score (all inputs normalised 0-100).
   */
  getCompositeScore(scores: ComponentScores): number {
    const composite =
      scores.competencyScore * this.WEIGHTS.competency +
      scores.feedbackScore * this.WEIGHTS.feedback +
      scores.sjtScore * this.WEIGHTS.sjt +
      scores.learningAgilityScore * this.WEIGHTS.la +
      scores.personalityFitScore * this.WEIGHTS.personality;

    return Math.round(composite * 100) / 100;
  }

  private scoreToGrid(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}
