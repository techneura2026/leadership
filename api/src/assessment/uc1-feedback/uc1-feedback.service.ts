import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  Answer,
  AssessmentConfig,
  FormQuestion,
  QuestionType,
  RaterRelationship,
  UserRole,
  resolveQuestionMode,
} from '@leaderprism/shared';
import { assertOwnerOrPrivileged } from '../../shared/ownership.util';
import { RaterNomination } from './entities/rater-nomination.entity';
import { RaterResponse } from './entities/rater-response.entity';
import { Assessment } from '../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { Competency } from '../items/entities/competency.entity';
import { User } from '../../core/users/entities/user.entity';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { EngineService } from '../engine/engine.service';
import { v4 as uuidv4 } from 'uuid';

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

export interface CompetencyCluster {
  id: string;
  name: string;
  description?: string;
  behaviours: Array<{ id: string; statement: string; displayOrder: number }>;
}

interface BehaviourRating {
  behaviourId: string;
  score: number;
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

export interface CustomQuestionSummary {
  questionId: string;
  title: string;
  type: QuestionType;
  tally?: Array<{ optionId: string; optionText: string; count: number }>;
  responses?: string[];
  totalResponses: number;
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
    @InjectRepository(Competency)
    private readonly competencyRepo: Repository<Competency>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly engineService: EngineService,
  ) {}

  async getNominations(
    assessmentId: string,
    participantId: string | undefined,
    orgId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<Array<RaterNomination & { raterAvatarUrl: string | null; raterUserId: string | null }>> {
    // Validate assessment belongs to org
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const isPrivileged = [UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN].includes(
      requestingUserRole,
    );
    if (!isPrivileged) {
      // A non-privileged caller (PARTICIPANT) must specify their own participantId — omitting
      // it would otherwise return every participant's nominations org-wide.
      if (!participantId) {
        throw new ForbiddenException('participantId is required.');
      }
      const participant = await this.participantRepo.findOne({
        where: { id: participantId, assessmentId },
      });
      if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
      assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);
    }

    const nominations = await this.nominationRepo.find({
      where: participantId ? { assessmentId, participantId } : { assessmentId },
      relations: ['participant', 'participant.user'],
      order: { createdAt: 'ASC' },
    });

    // Raters are stored as free-form email/name (they aren't necessarily linked to a User
    // row), so resolve avatars via a best-effort email match against org users instead of a
    // real relation.
    const emails = [...new Set(nominations.map((n) => n.raterEmail.toLowerCase()))];
    const matchedUsers = emails.length
      ? await this.userRepo.find({ where: { organisationId: orgId, email: In(emails) } })
      : [];
    const userByEmail = new Map(matchedUsers.map((u) => [u.email.toLowerCase(), u]));

    return nominations.map((n) => {
      const matched = userByEmail.get(n.raterEmail.toLowerCase());
      return Object.assign(n, {
        raterAvatarUrl: matched?.avatarUrl ?? null,
        raterUserId: matched?.id ?? null,
      });
    });
  }

  async nominateRaters(
    assessmentId: string,
    participantId: string,
    raters: NominateRaterDto[],
    orgId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
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
    assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);

    // HR Managers and Managers may only ever be the 360 *subject*, never a rater — reject
    // the whole batch up front (rather than silently skipping) so the admin gets clear
    // feedback about which email caused it.
    for (const rater of raters) {
      const matchedUser = await this.userRepo.findOne({
        where: { email: rater.raterEmail.toLowerCase(), organisationId: orgId },
      });
      if (matchedUser && (matchedUser.role === UserRole.HR_MANAGER || matchedUser.role === UserRole.MANAGER)) {
        throw new BadRequestException(
          `${rater.raterEmail} cannot be added as a feedback giver — HR Managers and Managers can only be assessed, not rate others`,
        );
      }
    }

    // Load existing nominations to check for duplicates
    const existing = await this.nominationRepo.find({
      where: { assessmentId, participantId },
    });
    const existingEmails = new Set(existing.map((n) => n.raterEmail.toLowerCase()));

    const created: RaterNomination[] = [];

    const tokenExpires = new Date();
    tokenExpires.setDate(tokenExpires.getDate() + 14);

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
        status: 'approved',
        tokenExpires,
      });

      const saved = await this.nominationRepo.save(nomination);
      created.push(saved);
      existingEmails.add(email);

      const raterUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/rater/${saved.token}`;
      try {
        await this.notificationsService.sendRaterInvitation(
          saved.raterEmail,
          saved.raterName ?? 'Colleague',
          assessment.title,
          raterUrl,
          'Your responses are completely anonymous (minimum 3 per rater group required).',
          { orgId },
        );
      } catch (err: any) {
        this.logger.warn(`Failed to send rater invitation to ${saved.raterEmail}: ${err?.message}`);
      }
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
    completionMinutes: number;
    language: string;
    relationship: RaterRelationship;
    tokenExpires: Date | null;
    questionMode: 'competency' | 'custom';
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

    const config = nomination.assessment?.config as AssessmentConfig | undefined;
    const mode = resolveQuestionMode(config);
    const completionMinutes =
      mode === 'custom'
        ? Math.max(5, (config?.questions?.length ?? 0) * 2)
        : Math.max(5, (config?.competencyIds?.length ?? 5) * 3);

    return {
      nominationId: nomination.id,
      assessmentTitle: nomination.assessment?.title ?? '',
      participantName,
      completionMinutes,
      language: 'en',
      relationship: nomination.relationship as RaterRelationship,
      tokenExpires: nomination.tokenExpires,
      questionMode: mode,
    };
  }

  async getRaterCompetencies(token: string): Promise<CompetencyCluster[]> {
    const nomination = await this.nominationRepo.findOne({
      where: { token },
      relations: ['assessment'],
    });

    if (!nomination) throw new NotFoundException('Invalid rater token');
    if (nomination.status === 'completed') throw new BadRequestException('Feedback already submitted');
    if (nomination.tokenExpires && nomination.tokenExpires < new Date()) {
      throw new ForbiddenException('Rater token has expired');
    }
    if (resolveQuestionMode(nomination.assessment?.config as AssessmentConfig | undefined) !== 'competency') {
      throw new BadRequestException('This assessment uses custom questions, not competencies.');
    }

    const competencyIds = (nomination.assessment?.config as AssessmentConfig | undefined)?.competencyIds;
    const orgId = nomination.assessment?.organisationId;

    let competencies: Competency[];
    if (competencyIds?.length) {
      competencies = await this.competencyRepo.find({
        where: { id: In(competencyIds) },
        relations: ['behaviours'],
        order: { displayOrder: 'ASC' },
      });
      const orderMap = new Map(competencyIds.map((id, i) => [id, i]));
      competencies.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    } else {
      competencies = await this.competencyRepo.find({
        where: [
          { organisationId: orgId, isActive: true },
          { organisationId: IsNull(), isActive: true },
        ],
        relations: ['behaviours'],
        order: { displayOrder: 'ASC' },
      });
    }

    return competencies.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? undefined,
      behaviours: (c.behaviours ?? [])
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((b) => ({ id: b.id, statement: b.statement, displayOrder: b.displayOrder })),
    }));
  }

  async getRaterQuestions(token: string): Promise<FormQuestion[]> {
    const nomination = await this.nominationRepo.findOne({
      where: { token },
      relations: ['assessment'],
    });

    if (!nomination) throw new NotFoundException('Invalid rater token');
    if (nomination.status === 'completed') throw new BadRequestException('Feedback already submitted');
    if (nomination.tokenExpires && nomination.tokenExpires < new Date()) {
      throw new ForbiddenException('Rater token has expired');
    }

    const config = nomination.assessment?.config as AssessmentConfig | undefined;
    if (resolveQuestionMode(config) !== 'custom') {
      throw new BadRequestException('This assessment does not use custom questions.');
    }

    return config?.questions ?? [];
  }

  async saveRaterCustomResponses(token: string, questionId: string, answer: Answer): Promise<void> {
    const nomination = await this.nominationRepo.findOne({
      where: { token },
      relations: ['assessment'],
    });
    if (!nomination) throw new NotFoundException('Invalid rater token');
    if (nomination.status === 'completed') throw new BadRequestException('Feedback already submitted');
    if (nomination.tokenExpires && nomination.tokenExpires < new Date()) {
      throw new ForbiddenException('Rater token has expired');
    }
    if (resolveQuestionMode(nomination.assessment?.config as AssessmentConfig | undefined) !== 'custom') {
      throw new BadRequestException('This assessment does not use custom questions.');
    }

    nomination.customAnswers = { ...(nomination.customAnswers ?? {}), [questionId]: answer };
    await this.nominationRepo.save(nomination);
  }

  async saveRaterBehaviourResponses(
    token: string,
    competencyId: string,
    ratings: BehaviourRating[],
    comment: string,
  ): Promise<void> {
    const nomination = await this.nominationRepo.findOne({
      where: { token },
      relations: ['assessment'],
    });
    if (!nomination) throw new NotFoundException('Invalid rater token');
    if (nomination.status === 'completed') throw new BadRequestException('Feedback already submitted');
    if (nomination.tokenExpires && nomination.tokenExpires < new Date()) {
      throw new ForbiddenException('Rater token has expired');
    }
    if (resolveQuestionMode(nomination.assessment?.config as AssessmentConfig | undefined) !== 'competency') {
      throw new BadRequestException('This assessment uses custom questions, not competencies.');
    }

    const avgScore =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length) * 100) / 100
        : null;

    const existing = await this.responseRepo.findOne({
      where: { nominationId: nomination.id, competencyId },
    });

    if (existing) {
      existing.score = avgScore;
      existing.behaviourScores = ratings;
      existing.openText = comment || null;
      await this.responseRepo.save(existing);
    } else {
      await this.responseRepo.save(
        this.responseRepo.create({
          nominationId: nomination.id,
          competencyId,
          score: avgScore,
          behaviourScores: ratings,
          openText: comment || null,
        }),
      );
    }
  }

  async submitRaterOverall(
    token: string,
    overallRating: number,
    developmentComment: string | undefined,
  ): Promise<{ nominationId: string }> {
    const nomination = await this.nominationRepo.findOne({ where: { token } });
    if (!nomination) throw new NotFoundException('Invalid rater token');
    if (nomination.status === 'completed') throw new BadRequestException('Feedback already submitted');
    if (nomination.tokenExpires && nomination.tokenExpires < new Date()) {
      throw new ForbiddenException('Rater token has expired');
    }

    nomination.overallRating = overallRating;
    nomination.developmentComment = developmentComment ?? null;
    nomination.status = 'completed';
    nomination.completedAt = new Date();
    await this.nominationRepo.save(nomination);
    await this.onNominationCompleted(nomination);

    this.logger.log(`Rater overall submitted for nomination ${nomination.id}`);
    return { nominationId: nomination.id };
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
    await this.onNominationCompleted(nomination);

    this.logger.log(`Rater response submitted for nomination ${nomination.id}`);

    return { nominationId: nomination.id };
  }

  /**
   * Runs after any nomination reaches 'completed': if it was the reviewee's own SELF
   * perspective, that's the signal the 360 Participants tab (and everything else keyed off
   * AssessmentParticipant.status) needs — it's otherwise never written for FEEDBACK_360.
   * Then checks whether the whole assessment can now auto-close.
   */
  private async onNominationCompleted(nomination: RaterNomination): Promise<void> {
    if (nomination.relationship === RaterRelationship.SELF) {
      const participant = await this.participantRepo.findOne({ where: { id: nomination.participantId } });
      if (participant && participant.status !== 'completed') {
        participant.status = 'completed';
        participant.completedAt = new Date();
        await this.participantRepo.save(participant);
      }
    }

    await this.engineService.maybeCloseAssessment(nomination.assessmentId);
  }

  /**
   * requestingUserId/requestingUserRole are optional: omitted when called internally by the
   * report-generation worker (no per-request caller), required (and enforced) when called
   * from the controller on behalf of a real user.
   */
  async get360Scores(
    assessmentId: string,
    participantId: string,
    orgId: string,
    requestingUserId?: string,
    requestingUserRole?: UserRole,
  ): Promise<AggregatedScore[]> {
    // Validate ownership
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    if (requestingUserId && requestingUserRole) {
      const participant = await this.participantRepo.findOne({
        where: { id: participantId, assessmentId },
      });
      if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
      assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);
    }

    const nominations = await this.nominationRepo.find({
      where: { assessmentId, participantId },
      relations: ['responses'],
    });

    const completedNominations = nominations.filter((n) => n.status === 'completed');

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

  /**
   * requestingUserId/requestingUserRole are optional for the same reason as get360Scores:
   * omitted when called internally by the report-generation worker.
   */
  async getCustomQuestionSummary(
    assessmentId: string,
    participantId: string,
    orgId: string,
    requestingUserId?: string,
    requestingUserRole?: UserRole,
  ): Promise<CustomQuestionSummary[]> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    if (requestingUserId && requestingUserRole) {
      const participant = await this.participantRepo.findOne({
        where: { id: participantId, assessmentId },
      });
      if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);
      assertOwnerOrPrivileged(participant.userId, requestingUserId, requestingUserRole);
    }

    const nominations = await this.nominationRepo.find({ where: { assessmentId, participantId } });
    const completedNominations = nominations.filter((n) => n.status === 'completed');

    const questions = ((assessment.config as AssessmentConfig)?.questions ?? []) as FormQuestion[];
    return this.aggregateCustomAnswers(questions, completedNominations);
  }

  aggregateCustomAnswers(
    questions: FormQuestion[],
    nominations: RaterNomination[],
  ): CustomQuestionSummary[] {
    return questions.map((q) => {
      const answers = nominations
        .map((n) => n.customAnswers?.[q.id])
        .filter((a): a is Answer => a !== undefined && a !== null);

      if (q.type === 'TRUE_FALSE') {
        // Stored answers are the literal strings 'true'/'false', not the authored
        // option ids ('opt-true'/'opt-false') — matches how the rater UI submits them.
        let trueCount = 0;
        let falseCount = 0;
        for (const a of answers) {
          if (a === 'true') trueCount++;
          else if (a === 'false') falseCount++;
        }
        return {
          questionId: q.id,
          title: q.title,
          type: q.type,
          totalResponses: answers.length,
          tally: [
            { optionId: 'true', optionText: 'True', count: trueCount },
            { optionId: 'false', optionText: 'False', count: falseCount },
          ],
        };
      }

      if (q.type === 'SHORT_ANSWER') {
        const texts = answers.filter(
          (a): a is string => typeof a === 'string' && a.trim().length > 0,
        );
        return {
          questionId: q.id,
          title: q.title,
          type: q.type,
          totalResponses: answers.length,
          responses: this.shuffle(texts),
        };
      }

      if (q.type === 'TABLE') {
        const flat = answers.flatMap((a) =>
          typeof a === 'object' && !Array.isArray(a)
            ? Object.entries(a as Record<string, string>).map(
                ([rowIdx, colIdx]) =>
                  `${q.tableRows[Number(rowIdx)] ?? rowIdx}: ${q.tableColumns[Number(colIdx)] ?? colIdx}`,
              )
            : [],
        );
        return {
          questionId: q.id,
          title: q.title,
          type: q.type,
          totalResponses: answers.length,
          responses: this.shuffle(flat),
        };
      }

      // SINGLE_CHOICE / MULTIPLE_CHOICE — stored answer values are option ids
      const counts = new Map<string, number>();
      for (const a of answers) {
        for (const id of Array.isArray(a) ? a : [a as string]) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
      return {
        questionId: q.id,
        title: q.title,
        type: q.type,
        totalResponses: answers.length,
        tally: q.options.map((o) => ({ optionId: o.id, optionText: o.text, count: counts.get(o.id) ?? 0 })),
      };
    });
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

  /** Reminds a single outstanding rater (targeted, 360 only). */
  async remindNomination(assessmentId: string, nominationId: string, orgId: string): Promise<{ sent: boolean }> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const nomination = await this.nominationRepo.findOne({
      where: { id: nominationId, assessmentId },
    });
    if (!nomination) {
      throw new NotFoundException(`Nomination ${nominationId} not found`);
    }
    if (nomination.status === 'completed' || nomination.status === 'declined') {
      throw new BadRequestException('Rater has already completed or declined — no reminder needed');
    }

    await this.notificationsService.sendReminder(
      nomination.raterEmail,
      nomination.raterName ?? 'Colleague',
      assessment.title,
      assessment.endDate?.toLocaleDateString('en-GB') ?? 'soon',
      { orgId },
    );

    this.logger.log(`Sent targeted reminder to nomination ${nominationId} for assessment ${assessmentId}`);
    return { sent: true };
  }

  /** Retracts an outstanding rater invitation. Cannot remove the reviewee's own self-assessment, or a rater who already submitted. */
  async removeNomination(assessmentId: string, nominationId: string, orgId: string): Promise<void> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }

    const nomination = await this.nominationRepo.findOne({
      where: { id: nominationId, assessmentId },
    });
    if (!nomination) {
      throw new NotFoundException(`Nomination ${nominationId} not found`);
    }

    if (nomination.relationship === RaterRelationship.SELF) {
      throw new BadRequestException("The participant's own self-assessment cannot be removed");
    }
    if (nomination.status === 'completed') {
      throw new BadRequestException('Cannot remove a rater who has already submitted feedback');
    }

    await this.nominationRepo.delete({ id: nominationId, assessmentId });
    this.logger.log(`Removed rater nomination ${nominationId} from assessment ${assessmentId}`);
  }
}
