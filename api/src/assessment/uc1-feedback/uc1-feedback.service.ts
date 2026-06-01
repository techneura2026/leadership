import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RaterRelationship } from '@leaderprism/shared';
import { RaterNomination } from './entities/rater-nomination.entity';
import { RaterResponse } from './entities/rater-response.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';

const MIN_RATERS = 3;

interface NominateRaterDto {
  raterEmail: string;
  raterName?: string;
  relationship: RaterRelationship;
}

interface CompetencyScoreDto {
  competencyId: string;
  score: number;
  openText?: string;
}

export interface AggregatedScore {
  competencyId: string;
  competencyName?: string;
  byPerspective: Record<
    string,
    { mean: number; count: number }
  >;
  overallMean: number;
  gapVsSelf: number | null;
}

@Injectable()
export class Uc1FeedbackService {
  private readonly logger = new Logger(Uc1FeedbackService.name);

  constructor(
    @InjectRepository(RaterNomination)
    private readonly nominationRepo: Repository<RaterNomination>,
    @InjectRepository(RaterResponse)
    private readonly responseRepo: Repository<RaterResponse>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getNominations(
    assessmentId: string,
    participantId: string,
    orgId: string,
  ): Promise<RaterNomination[]> {
    // Validate assessment belongs to org
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    return this.nominationRepo.find({
      where: { assessmentId, participantId },
      order: { createdAt: 'ASC' },
    });
  }

  async nominateRaters(
    assessmentId: string,
    participantId: string,
    raters: NominateRaterDto[],
    orgId: string,
  ): Promise<RaterNomination[]> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
    });
    if (!participant) {
      throw new NotFoundException(`Participant ${participantId} not found`);
    }

    // Load existing nominations to check for duplicates
    const existing = await this.nominationRepo.find({
      where: { assessmentId, participantId },
    });
    const existingEmails = new Set(existing.map((n) => n.raterEmail.toLowerCase()));

    const created: RaterNomination[] = [];

    for (const rater of raters) {
      const email = rater.raterEmail.toLowerCase();

      if (existingEmails.has(email)) {
        this.logger.warn(`Duplicate rater nomination skipped: ${email}`);
        continue;
      }

      const nomination = this.nominationRepo.create({
        assessmentId,
        participantId,
        raterEmail: email,
        raterName: rater.raterName ?? null,
        relationship: rater.relationship,
        token: uuidv4(),
        status: 'pending',
      });

      const saved = await this.nominationRepo.save(nomination);
      created.push(saved);
      existingEmails.add(email);
    }

    this.logger.log(
      `Nominated ${created.length} raters for participant ${participantId} in assessment ${assessmentId}`,
    );
    return created;
  }

  async approveNominations(
    assessmentId: string,
    orgId: string,
    approverId: string,
  ): Promise<{ approved: number }> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const pendingNominations = await this.nominationRepo.find({
      where: { assessmentId, status: 'pending' },
    });

    const tokenExpires = new Date();
    tokenExpires.setDate(tokenExpires.getDate() + 14); // 14-day expiry

    for (const nomination of pendingNominations) {
      nomination.status = 'approved';
      nomination.approvedBy = approverId;
      nomination.tokenExpires = tokenExpires;
      await this.nominationRepo.save(nomination);

      // Send rater invitation email
      const raterUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/rater/${nomination.token}`;
      await this.notificationsService.sendRaterInvitation(
        nomination.raterEmail,
        nomination.raterName ?? 'Colleague',
        assessment.title,
        raterUrl,
        'Your responses are completely anonymous (minimum 3 per rater group required).',
        { orgId },
      );
    }

    this.logger.log(
      `Approved ${pendingNominations.length} nominations for assessment ${assessmentId}`,
    );

    return { approved: pendingNominations.length };
  }

  async getRaterLanding(token: string): Promise<{
    nominationId: string;
    assessmentTitle: string;
    participantName: string;
    relationship: RaterRelationship;
    tokenExpires: Date | null;
  }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      throw new NotFoundException('Invalid rater token');
    }

    const nomination = await this.nominationRepo.findOne({
      where: { token },
      relations: ['assessment', 'participant', 'participant.user'],
    });

    if (!nomination) {
      throw new NotFoundException('Invalid rater token');
    }

    if (nomination.status === 'completed') {
      throw new BadRequestException('This feedback has already been submitted');
    }

    if (
      nomination.tokenExpires &&
      nomination.tokenExpires < new Date()
    ) {
      throw new ForbiddenException('Rater token has expired');
    }

    const user = (nomination.participant as any)?.user;
    const participantName = user
      ? `${user.firstName} ${user.lastName}`
      : 'the participant';

    return {
      nominationId: nomination.id,
      assessmentTitle: nomination.assessment?.title ?? '',
      participantName,
      relationship: nomination.relationship as RaterRelationship,
      tokenExpires: nomination.tokenExpires,
    };
  }

  async submitRaterResponse(
    token: string,
    competencyScores: CompetencyScoreDto[],
    overallScore: number,
    openComments: string[],
  ): Promise<{ nominationId: string }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      throw new NotFoundException('Invalid rater token');
    }

    const nomination = await this.nominationRepo.findOne({ where: { token } });

    if (!nomination) {
      throw new NotFoundException('Invalid rater token');
    }

    if (nomination.status === 'completed') {
      throw new BadRequestException('Feedback already submitted');
    }

    if (nomination.status !== 'approved') {
      throw new ForbiddenException('This nomination has not been approved yet');
    }

    if (nomination.tokenExpires && nomination.tokenExpires < new Date()) {
      throw new ForbiddenException('Rater token has expired');
    }

    // Save competency scores
    let lastSavedResponse: RaterResponse | null = null;
    for (const cs of competencyScores) {
      const response = this.responseRepo.create({
        nominationId: nomination.id,
        competencyId: cs.competencyId,
        score: cs.score,
        openText: cs.openText ?? null,
      });
      lastSavedResponse = await this.responseRepo.save(response);
    }

    // Save open comment: append to last saved response if available (avoiding duplicate score rows)
    if (openComments.length > 0) {
      if (lastSavedResponse) {
        lastSavedResponse.openText = lastSavedResponse.openText
          ? `${lastSavedResponse.openText}\n---\n${openComments.join('\n---\n')}`
          : openComments.join('\n---\n');
        await this.responseRepo.save(lastSavedResponse);
      } else {
        const overallResponse = this.responseRepo.create({
          nominationId: nomination.id,
          competencyId: nomination.id,
          score: overallScore,
          openText: openComments.join('\n---\n'),
        });
        await this.responseRepo.save(overallResponse).catch(() => {});
      }
    }

    // Mark nomination as completed
    nomination.status = 'completed';
    nomination.completedAt = new Date();
    await this.nominationRepo.save(nomination);

    this.logger.log(`Rater response submitted for nomination ${nomination.id}`);

    return { nominationId: nomination.id };
  }

  async get360Scores(
    assessmentId: string,
    participantId: string,
    orgId: string,
  ): Promise<AggregatedScore[]> {
    // Validate ownership
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const nominations = await this.nominationRepo.find({
      where: { assessmentId, participantId },
      relations: ['responses'],
    });

    // Anonymity threshold check
    const completedNominations = nominations.filter((n) => n.status === 'completed');
    const groupCounts = this.groupBy(completedNominations, 'relationship');

    for (const [rel, noms] of Object.entries(groupCounts)) {
      if (
        rel !== RaterRelationship.SUPERVISOR &&
        rel !== RaterRelationship.SELF &&
        (noms as any[]).length < MIN_RATERS
      ) {
        throw new ForbiddenException(
          `Insufficient ${rel} responses for anonymity (${(noms as any[]).length}/${MIN_RATERS})`,
        );
      }
    }

    return this.aggregateScores(completedNominations);
  }

  aggregateScores(nominations: RaterNomination[]): AggregatedScore[] {
    const competencyMap = new Map<
      string,
      { byGroup: Record<string, number[]>; allScores: number[] }
    >();

    for (const nomination of nominations) {
      const relationship = nomination.relationship;
      for (const response of nomination.responses ?? []) {
        if (!response.score) continue;

        const cId = response.competencyId;
        if (!competencyMap.has(cId)) {
          competencyMap.set(cId, { byGroup: {}, allScores: [] });
        }

        const entry = competencyMap.get(cId)!;
        if (!entry.byGroup[relationship]) {
          entry.byGroup[relationship] = [];
        }
        entry.byGroup[relationship].push(Number(response.score));
        entry.allScores.push(Number(response.score));
      }
    }

    const results: AggregatedScore[] = [];

    for (const [competencyId, data] of competencyMap) {
      const byPerspective: Record<string, { mean: number; count: number }> = {};

      for (const [group, scores] of Object.entries(data.byGroup)) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        byPerspective[group] = { mean: Math.round(mean * 100) / 100, count: scores.length };
      }

      const overallMean =
        data.allScores.reduce((a, b) => a + b, 0) / data.allScores.length;

      // Self score for gap calculation
      const selfNomination = nominations.find(
        (n) => n.relationship === RaterRelationship.SELF,
      );
      const selfScore =
        selfNomination?.responses?.find((r) => r.competencyId === competencyId)?.score ?? null;

      const gapVsSelf =
        selfScore !== null
          ? Math.round((overallMean - Number(selfScore)) * 100) / 100
          : null;

      results.push({
        competencyId,
        byPerspective,
        overallMean: Math.round(overallMean * 100) / 100,
        gapVsSelf,
      });
    }

    return results;
  }

  /**
   * Returns completed nominations with their responses for a participant.
   * Used by the reporting service to gather open comments.
   */
  async getCompletedNominationsWithResponses(
    assessmentId: string,
    participantId: string,
  ): Promise<RaterNomination[]> {
    return this.nominationRepo.find({
      where: { assessmentId, participantId, status: 'completed' },
      relations: ['responses'],
    });
  }

  async sendReminders(assessmentId: string, orgId: string): Promise<{ sent: number }> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const pendingNominations = await this.nominationRepo.find({
      where: [
        { assessmentId, status: 'approved' },
        { assessmentId, status: 'sent' },
      ],
    });

    let sent = 0;
    for (const nomination of pendingNominations) {
      await this.notificationsService.sendReminder(
        nomination.raterEmail,
        nomination.raterName ?? 'Colleague',
        assessment.title,
        assessment.endDate?.toLocaleDateString('en-GB') ?? 'soon',
        { orgId },
      );
      sent++;
    }

    this.logger.log(`Sent ${sent} reminders for assessment ${assessmentId}`);
    return { sent };
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce(
      (groups, item) => {
        const groupKey = String(item[key]);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
      },
      {} as Record<string, T[]>,
    );
  }
}
