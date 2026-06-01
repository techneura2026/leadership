import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalityScore } from './entities/personality-score.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import { NormativeDatum } from './entities/normative-datum.entity';
import { Item } from '../items/entities/item.entity';

const BIG_FIVE_FACTORS = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'emotional_stability',
];

// T-score distribution lookup: maps T-score integer to percentile
const T_TO_PERCENTILE = (() => {
  const table: Record<number, number> = {};
  for (let t = 20; t <= 80; t++) {
    const z = (t - 50) / 10;
    table[t] = Math.round(normalCDF(z) * 1000) / 10;
  }
  return table;
})();

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.7814779 + t * (-1.8212559 + t * 1.3302744))));
  return z > 0 ? 1 - prob : prob;
}

const FACTOR_NARRATIVES: Record<string, Record<string, string>> = {
  openness: {
    high: 'You score high on Openness, reflecting strong intellectual curiosity and creativity. You actively seek novel ideas, thrive in ambiguous environments, and challenge conventional thinking — a significant advantage in strategic and innovative leadership roles.',
    medium: 'Your Openness score is in the moderate range, indicating a balanced approach between creativity and pragmatism. You appreciate new ideas but ground them in practical reality — effective in most leadership contexts.',
    low: 'Your Openness score suggests a preference for structure, proven methods, and concrete results. You excel in roles that demand consistency and reliable execution, though you may benefit from deliberately seeking out diverse perspectives.',
  },
  conscientiousness: {
    high: 'You demonstrate exceptionally high Conscientiousness. You are organised, disciplined, and highly dependable — consistently delivering on commitments. Leaders like you build strong cultures of accountability and execution.',
    medium: 'Your Conscientiousness is at a moderate level, indicating solid organisational skills balanced with flexibility. You meet most commitments while adapting when priorities shift — a practical strength in dynamic environments.',
    low: 'Your Conscientiousness score indicates a more spontaneous and flexible style. While this supports adaptability, you may benefit from strengthening structured planning and follow-through to maximise your leadership impact.',
  },
  extraversion: {
    high: 'You are highly Extraverted — energetic, socially confident, and naturally engaging. You thrive in team environments, networking settings, and high-visibility leadership roles. Your enthusiasm motivates those around you.',
    medium: 'Your Extraversion is moderate, suggesting a flexible social style. You can engage effectively in group settings while also working productively independently. This versatility serves you well across different leadership demands.',
    low: 'Your Extraversion score suggests a more introverted orientation. You work best in focused, independent contexts and build deep rather than broad relationships. Many highly effective leaders are introverted — your thoughtful style is an asset in reflective, analytical roles.',
  },
  agreeableness: {
    high: 'You score high on Agreeableness, reflecting a genuine collaborative orientation. You build trust readily, manage conflict diplomatically, and create environments where people feel valued and motivated.',
    medium: 'Your Agreeableness is balanced — you cooperate effectively while maintaining appropriate assertiveness. You can advocate for your views while remaining open to others, an effective combination for leadership.',
    low: 'Your Agreeableness score indicates a more direct, task-focused style. You are comfortable with debate and may challenge ideas that others accept. This directness is valuable in high-stakes decisions, though attention to relationship dynamics will enhance your leadership effectiveness.',
  },
  emotional_stability: {
    high: 'Your Emotional Stability score is high, indicating strong resilience and composure under pressure. You maintain clear thinking and positive energy even in adversity — a vital attribute for leaders navigating complex challenges.',
    medium: 'Your Emotional Stability is in the moderate range, reflecting generally sound emotional regulation with occasional sensitivity to stress. Building deliberate practices around self-regulation will strengthen your leadership under pressure.',
    low: 'Your Emotional Stability score suggests higher sensitivity to stressors and emotional variability. This awareness can actually be a strength when channelled effectively. Developing resilience strategies and stress management practices will meaningfully enhance your leadership presence.',
  },
};

export interface FactorScore {
  factor: string;
  rawScore: number;
  tScore: number;
  percentile: number;
  narrative: string;
}

@Injectable()
export class BigFiveScoringService {
  private readonly logger = new Logger(BigFiveScoringService.name);

  constructor(
    @InjectRepository(PersonalityScore)
    private readonly scoreRepo: Repository<PersonalityScore>,
    @InjectRepository(PersonalityResponse)
    private readonly responseRepo: Repository<PersonalityResponse>,
    @InjectRepository(NormativeDatum)
    private readonly normRepo: Repository<NormativeDatum>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
  ) {}

  /**
   * Main entry point: scores all 5 factors for a participant and persists results.
   */
  async scoreParticipant(
    assessmentId: string,
    participantId: string,
    population = 'sri_lanka_general',
  ): Promise<FactorScore[]> {
    const responses = await this.responseRepo.find({
      where: { assessmentId, participantId },
      relations: ['item'],
    });

    const results: FactorScore[] = [];

    for (const factor of BIG_FIVE_FACTORS) {
      const factorResponses = responses.filter(
        (r) => r.item && r.item.factor === factor,
      );

      if (factorResponses.length === 0) {
        this.logger.warn(`No responses for factor ${factor}, skipping`);
        continue;
      }

      const norm = await this.normRepo.findOne({
        where: { factor, population },
      });

      if (!norm) {
        this.logger.warn(`No normative data for factor=${factor} population=${population}`);
        continue;
      }

      const rawScore = this.calculateRawScore(
        factorResponses.map((r) => ({ value: r.responseValue, isReverse: r.item.isReverse })),
      );

      const tScore = this.toTScore(rawScore, {
        mean: Number(norm.mean),
        stdDev: Number(norm.stdDev),
      });

      const percentile = this.toPercentile(tScore);
      const narrative = this.getFactorNarrative(factor, tScore);

      // Persist / update score
      await this.persistScore(assessmentId, participantId, factor, rawScore, tScore, percentile);

      results.push({ factor, rawScore, tScore, percentile, narrative });
    }

    this.logger.log(
      `Scored ${results.length} factors for participant ${participantId} in assessment ${assessmentId}`,
    );

    return results;
  }

  /**
   * Calculates the raw score for a factor, handling reverse scoring.
   * For 1-5 scale: reversed value = 6 - original
   */
  calculateRawScore(
    responses: Array<{ value: number; isReverse: boolean }>,
  ): number {
    return responses.reduce((sum, r) => {
      const value = r.isReverse ? 6 - r.value : r.value;
      return sum + value;
    }, 0);
  }

  /**
   * Converts raw score to T-score using the normative mean and stdDev.
   * T = 50 + 10 * ((raw - mean) / stdDev), clamped to [20, 80].
   */
  toTScore(rawScore: number, norm: { mean: number; stdDev: number }): number {
    if (norm.stdDev === 0) return 50;
    const t = 50 + 10 * ((rawScore - norm.mean) / norm.stdDev);
    return Math.round(Math.min(80, Math.max(20, t)) * 100) / 100;
  }

  /**
   * Converts a T-score to a percentile using a standard normal approximation.
   */
  toPercentile(tScore: number): number {
    const rounded = Math.round(tScore);
    const clamped = Math.min(80, Math.max(20, rounded));

    // Use lookup table for integer T-scores
    if (T_TO_PERCENTILE[clamped] !== undefined) {
      return T_TO_PERCENTILE[clamped];
    }

    // Fallback: direct CDF calculation
    const z = (tScore - 50) / 10;
    return Math.round(normalCDF(z) * 1000) / 10;
  }

  /**
   * Returns a narrative description for a factor based on the T-score band.
   * High: T >= 60, Medium: 40-59, Low: T < 40
   */
  getFactorNarrative(factor: string, tScore: number): string {
    const narratives = FACTOR_NARRATIVES[factor];
    if (!narratives) return `Score: ${tScore}`;

    if (tScore >= 60) return narratives.high;
    if (tScore >= 40) return narratives.medium;
    return narratives.low;
  }

  private async persistScore(
    assessmentId: string,
    participantId: string,
    factor: string,
    rawScore: number,
    tScore: number,
    percentile: number,
  ): Promise<void> {
    const existing = await this.scoreRepo.findOne({
      where: { assessmentId, participantId, factor },
    });

    if (existing) {
      existing.rawScore = rawScore;
      existing.tScore = tScore;
      existing.percentile = percentile;
      await this.scoreRepo.save(existing);
    } else {
      const score = this.scoreRepo.create({
        assessmentId,
        participantId,
        factor,
        rawScore,
        tScore,
        percentile,
      });
      await this.scoreRepo.save(score);
    }
  }
}
