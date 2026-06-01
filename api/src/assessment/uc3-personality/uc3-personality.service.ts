import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalityResponse } from './entities/personality-response.entity';
import { PersonalityScore } from './entities/personality-score.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Item } from '../items/entities/item.entity';
import { BigFiveScoringService, FactorScore } from './big-five-scoring.service';

export interface ItemWithProgress {
  id: string;
  factor: string;
  stem: string;
  options: Array<{ value: number; label: string }>;
  isReverse: boolean;
  answered: boolean;
  responseValue: number | null;
}

export interface QuestionnaireProgress {
  total: number;
  answered: number;
  percentComplete: number;
  items: ItemWithProgress[];
}

@Injectable()
export class Uc3PersonalityService {
  private readonly logger = new Logger(Uc3PersonalityService.name);

  constructor(
    @InjectRepository(PersonalityResponse)
    private readonly responseRepo: Repository<PersonalityResponse>,
    @InjectRepository(PersonalityScore)
    private readonly scoreRepo: Repository<PersonalityScore>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    private readonly bigFiveScoring: BigFiveScoringService,
  ) {}

  async getQuestionnaire(
    assessmentId: string,
    participantId: string,
    language = 'en',
  ): Promise<QuestionnaireProgress> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    const items = await this.itemRepo.find({
      where: { module: 'personality', language, isActive: true },
      order: { createdAt: 'ASC' },
    });

    const existingResponses = await this.responseRepo.find({
      where: { assessmentId, participantId },
    });

    const responseMap = new Map<string, number>(
      existingResponses.map((r) => [r.itemId, r.responseValue]),
    );

    const itemsWithProgress: ItemWithProgress[] = items.map((item) => ({
      id: item.id,
      factor: item.factor ?? '',
      stem: item.stem,
      options: item.options ?? [],
      isReverse: item.isReverse,
      answered: responseMap.has(item.id),
      responseValue: responseMap.get(item.id) ?? null,
    }));

    return {
      total: items.length,
      answered: existingResponses.length,
      percentComplete:
        items.length > 0
          ? Math.round((existingResponses.length / items.length) * 100)
          : 0,
      items: itemsWithProgress,
    };
  }

  async saveResponse(
    assessmentId: string,
    participantId: string,
    itemId: string,
    value: number,
  ): Promise<PersonalityResponse> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    const item = await this.itemRepo.findOne({ where: { id: itemId, module: 'personality' } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    if (value < 1 || value > 5) {
      throw new BadRequestException('Response value must be between 1 and 5');
    }

    // Upsert response
    const existing = await this.responseRepo.findOne({
      where: { assessmentId, participantId, itemId },
    });

    if (existing) {
      existing.responseValue = value;
      return this.responseRepo.save(existing);
    }

    const response = this.responseRepo.create({
      assessmentId,
      participantId,
      itemId,
      responseValue: value,
    });

    return this.responseRepo.save(response);
  }

  async submitQuestionnaire(
    assessmentId: string,
    participantId: string,
  ): Promise<FactorScore[]> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

    // Check all items answered
    const totalItems = await this.itemRepo.count({
      where: { module: 'personality', isActive: true },
    });
    const answeredCount = await this.responseRepo.count({
      where: { assessmentId, participantId },
    });

    if (answeredCount < totalItems) {
      throw new BadRequestException(
        `Incomplete questionnaire: ${answeredCount}/${totalItems} items answered`,
      );
    }

    // Trigger scoring
    const scores = await this.bigFiveScoring.scoreParticipant(assessmentId, participantId);

    // Mark participant as completed
    participant.status = 'completed';
    participant.completedAt = new Date();
    await this.participantRepo.save(participant);

    this.logger.log(`Personality questionnaire submitted for participant ${participantId}`);
    return scores;
  }

  async getScores(
    assessmentId: string,
    participantId: string,
    orgId: string,
  ): Promise<
    Array<{
      factor: string;
      rawScore: number;
      tScore: number;
      percentile: number;
      narrative: string;
    }>
  > {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    const scores = await this.scoreRepo.find({
      where: { assessmentId, participantId },
      order: { factor: 'ASC' },
    });

    if (scores.length === 0) {
      throw new NotFoundException(`No scores found — questionnaire not yet submitted`);
    }

    return scores.map((s) => ({
      factor: s.factor,
      rawScore: Number(s.rawScore),
      tScore: Number(s.tScore),
      percentile: Number(s.percentile),
      narrative: this.bigFiveScoring.getFactorNarrative(s.factor, Number(s.tScore)),
    }));
  }
}
