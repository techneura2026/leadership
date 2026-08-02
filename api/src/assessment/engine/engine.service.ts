import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsOptional, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AssessmentStatus, AssessmentType, Plan, RaterRelationship } from '@leaderprism/shared';
import type { AssessmentConfig, PlanLimits } from '@leaderprism/shared';
import { Assessment } from './entities/assessment.entity';
import { AssessmentParticipant } from './entities/assessment-participant.entity';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { RaterNomination } from '../uc1-feedback/entities/rater-nomination.entity';
import { User } from '../../core/users/entities/user.entity';
import { NotificationsService } from '../../core/notifications/notifications.service';

// Plan limits map
const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.TRIAL]: {
    maxParticipants: 10,
    maxActiveAssessments: 2,
    allowedUcs: [AssessmentType.FEEDBACK_360, AssessmentType.PERSONALITY],
  },
  [Plan.STARTER]: {
    maxParticipants: 50,
    maxActiveAssessments: 5,
    allowedUcs: [AssessmentType.FEEDBACK_360, AssessmentType.COMPETENCY, AssessmentType.PERSONALITY],
  },
  [Plan.PROFESSIONAL]: {
    maxParticipants: 200,
    maxActiveAssessments: 20,
    allowedUcs: [
      AssessmentType.FEEDBACK_360,
      AssessmentType.COMPETENCY,
      AssessmentType.PERSONALITY,
      AssessmentType.READINESS,
    ],
  },
  [Plan.ENTERPRISE]: {
    maxParticipants: 99999,
    maxActiveAssessments: 99999,
    allowedUcs: [
      AssessmentType.FEEDBACK_360,
      AssessmentType.COMPETENCY,
      AssessmentType.PERSONALITY,
      AssessmentType.READINESS,
    ],
  },
};

export class CreateAssessmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: AssessmentType })
  @IsEnum(AssessmentType)
  @IsNotEmpty()
  assessmentType: AssessmentType;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  config?: AssessmentConfig;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  endDate?: string;
}

export class UpdateAssessmentDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  config?: AssessmentConfig;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  endDate?: string;
}

export interface AssessmentFilters {
  status?: AssessmentStatus;
  assessmentType?: AssessmentType;
  page?: number;
  limit?: number;
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(RaterNomination)
    private readonly nominationRepo: Repository<RaterNomination>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Serializes concurrent plan-limit-checking mutations for one org via a Postgres advisory
   * lock scoped to the transaction — held until commit/rollback. Without this, two concurrent
   * launch()/addParticipant() calls can both read the same "under the limit" count and both
   * proceed, pushing the org over its plan's active-assessment/participant cap.
   */
  private async withOrgLock<T>(orgId: string, work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [orgId]);
      return work(manager);
    });
  }

  async create(orgId: string, userId: string, dto: CreateAssessmentDto): Promise<Assessment> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }

    const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[Plan.TRIAL];

    // Check UC is allowed on this plan
    if (!limits.allowedUcs.includes(dto.assessmentType)) {
      throw new ForbiddenException(
        `Assessment type ${dto.assessmentType} is not available on plan ${org.plan}`,
      );
    }

    const assessment = this.assessmentRepo.create({
      organisationId: orgId,
      createdBy: userId,
      title: dto.title,
      assessmentType: dto.assessmentType,
      status: AssessmentStatus.DRAFT,
      config: dto.config ?? {},
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });

    const saved = await this.assessmentRepo.save(assessment);
    this.logger.log(`Created assessment ${saved.id} type=${saved.assessmentType} org=${orgId}`);
    return saved;
  }

  async findAll(
    orgId: string,
    filters: AssessmentFilters,
  ): Promise<{ data: Assessment[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const qb = this.assessmentRepo
      .createQueryBuilder('a')
      .where('a.organisation_id = :orgId', { orgId })
      .orderBy('a.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.assessmentType) {
      qb.andWhere('a.assessment_type = :type', { type: filters.assessmentType });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, orgId: string): Promise<Assessment> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id, organisationId: orgId },
      relations: ['participants', 'participants.user'],
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }

    return assessment;
  }

  async update(id: string, orgId: string, dto: UpdateAssessmentDto): Promise<Assessment> {
    const assessment = await this.findOne(id, orgId);

    if (assessment.status === AssessmentStatus.CLOSED) {
  throw new BadRequestException('Closed assessments cannot be updated');
}

    if (dto.title !== undefined) assessment.title = dto.title;
    if (dto.config !== undefined) assessment.config = dto.config;
    if (dto.startDate !== undefined) {
      assessment.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.endDate !== undefined) {
      assessment.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }

    const saved = await this.assessmentRepo.save(assessment);
    this.logger.log(`Updated assessment ${id} org=${orgId}`);
    return saved;
  }

  async launch(id: string, orgId: string): Promise<Assessment> {
    await this.findOne(id, orgId); // existence/ownership check

    return this.withOrgLock(orgId, async (manager) => {
      const assessment = await manager.findOne(Assessment, { where: { id, organisationId: orgId } });
      if (!assessment) throw new NotFoundException(`Assessment ${id} not found`);

      if (assessment.status !== AssessmentStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT assessments can be launched');
      }

      const participantCount = await manager.count(AssessmentParticipant, {
        where: { assessmentId: id },
      });

      if (participantCount === 0) {
        throw new BadRequestException('Cannot launch assessment with no participants');
      }

      // Validate plan participant limits
      const org = await manager.findOne(Organisation, { where: { id: orgId } });
      if (!org) throw new NotFoundException('Organisation not found');
      const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[Plan.TRIAL];

      if (participantCount > limits.maxParticipants) {
        throw new ForbiddenException(
          `Participant count (${participantCount}) exceeds plan limit (${limits.maxParticipants})`,
        );
      }

      // Check active assessment count
      const activeCount = await manager.count(Assessment, {
        where: { organisationId: orgId, status: AssessmentStatus.ACTIVE },
      });

      if (activeCount >= limits.maxActiveAssessments) {
        throw new ForbiddenException(
          `Plan limit reached: maximum ${limits.maxActiveAssessments} active assessments`,
        );
      }

      assessment.status = AssessmentStatus.ACTIVE;
      if (!assessment.startDate) {
        assessment.startDate = new Date();
      }

      const saved = await manager.save(assessment);
      this.logger.log(`Launched assessment ${id} org=${orgId} participants=${participantCount}`);
      return saved;
    });
  }

  async close(id: string, orgId: string): Promise<Assessment> {
    const assessment = await this.findOne(id, orgId);

    if (assessment.status !== AssessmentStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE assessments can be closed');
    }

    assessment.status = AssessmentStatus.CLOSED;
    const saved = await this.assessmentRepo.save(assessment);
    this.logger.log(`Closed assessment ${id} org=${orgId}`);
    return saved;
  }

  async addParticipant(
    assessmentId: string,
    orgId: string,
    emailOrUserId: string,
  ): Promise<AssessmentParticipant> {
    const assessment = await this.findOne(assessmentId, orgId);

    if (assessment.status === AssessmentStatus.CLOSED || assessment.status === AssessmentStatus.ARCHIVED) {
      throw new BadRequestException('Cannot add participants to a closed or archived assessment');
    }

    // Resolve to a userId — accept either a plain UUID or an email address
    let userId: string = emailOrUserId;
    if (emailOrUserId.includes('@')) {
      const user = await this.userRepo.findOne({
        where: { email: emailOrUserId.toLowerCase(), organisationId: orgId },
      });
      if (!user) {
        throw new NotFoundException(`No user found with email ${emailOrUserId} in this organisation`);
      }
      userId = user.id;
    }

    return this.withOrgLock(orgId, async (manager) => {
      // Check for existing participant
      const existing = await manager.findOne(AssessmentParticipant, {
        where: { assessmentId, userId },
      });
      if (existing) {
        throw new BadRequestException(`User is already a participant in this assessment`);
      }

      // Plan limits check (only checked during addParticipant for active/non-draft assessments)
      if (assessment.status !== AssessmentStatus.DRAFT) {
        const org = await manager.findOne(Organisation, { where: { id: orgId } });
        if (!org) throw new NotFoundException('Organisation not found');
        const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[Plan.TRIAL];

        const currentCount = await manager.count(AssessmentParticipant, { where: { assessmentId } });
        if (currentCount >= limits.maxParticipants) {
          throw new ForbiddenException(
            `Participant limit (${limits.maxParticipants}) reached for plan ${org.plan}`,
          );
        }
      }

      const participant = manager.create(AssessmentParticipant, {
        assessmentId,
        userId,
        status: 'invited',
      });

      const saved = await manager.save(participant);
      this.logger.log(`Added participant ${userId} to assessment ${assessmentId}`);
      return saved;
    });
  }

  async getParticipants(assessmentId: string, orgId: string): Promise<AssessmentParticipant[]> {
    await this.findOne(assessmentId, orgId); // Validate ownership

    return this.participantRepo.find({
      where: { assessmentId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getResponseRate(
    assessmentId: string,
    orgId: string,
  ): Promise<{ participantId: string; name: string; status: string; completedAt: Date | null }[]> {
    const participants = await this.getParticipants(assessmentId, orgId);

    return participants.map((p) => ({
      participantId: p.id,
      name: p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Unknown',
      status: p.status,
      completedAt: p.completedAt,
    }));
  }

  async findMine(
    userId: string,
    orgId: string,
    userEmail: string,
  ): Promise<
    Array<
      Assessment & {
        participantStatus: string;
        completionPercentage: number;
        isRater?: boolean;
        raterToken?: string;
        nominationStatus?: string;
        selfRaterToken?: string;
        selfNominationStatus?: string;
      }
    >
  > {
    const participations = await this.participantRepo.find({
      where: { userId },
      relations: ['assessment'],
      order: { createdAt: 'DESC' },
    });

    const activeParticipations = participations.filter(
      (p) =>
        p.assessment &&
        p.assessment.organisationId === orgId &&
        p.assessment.status === AssessmentStatus.ACTIVE,
    );

    // For 360 assessments, the reviewee's own "self" perspective is captured via a
    // SELF-relationship RaterNomination (same mechanism as every other rater), not the
    // generic participant-responses endpoint. Look these up so the frontend can route the
    // reviewee straight into the rater-response flow instead of a dead-end self form.
    const feedback360ParticipantIds = activeParticipations
      .filter((p) => p.assessment.assessmentType === AssessmentType.FEEDBACK_360)
      .map((p) => p.id);

    const selfNominationByParticipantId = new Map<string, RaterNomination>();
    if (feedback360ParticipantIds.length > 0) {
      const selfNominations = await this.nominationRepo.find({
        where: { participantId: In(feedback360ParticipantIds), relationship: RaterRelationship.SELF },
      });
      for (const nomination of selfNominations) {
        selfNominationByParticipantId.set(nomination.participantId, nomination);
      }
    }

    const participantItems = activeParticipations.map((p) => {
      const selfNomination = selfNominationByParticipantId.get(p.id);
      return {
        ...p.assessment,
        participantStatus: p.status as any,
        completionPercentage: p.status === 'completed' ? 100 : p.status === 'in_progress' ? 50 : 0,
        ...(selfNomination
          ? {
              selfRaterToken: selfNomination.token,
              selfNominationStatus: selfNomination.status,
            }
          : {}),
      };
    });

    // Also return 360 feedback assessments where user is a nominated rater
    const nominations = await this.nominationRepo.find({
      where: { raterEmail: userEmail.toLowerCase() },
      relations: ['assessment'],
      order: { createdAt: 'DESC' },
    });

    const participantAssessmentIds = new Set(participantItems.map((a) => a.id));

    const raterItems = nominations
      .filter(
        (n) =>
          n.assessment &&
          n.assessment.organisationId === orgId &&
          n.assessment.status === AssessmentStatus.ACTIVE &&
          n.status !== 'declined' &&
          n.status !== 'pending' &&
          // skip if user is already listed as a regular participant for same assessment
          !participantAssessmentIds.has(n.assessmentId),
      )
      .map((n) => ({
        ...n.assessment,
        participantStatus: n.status === 'completed' ? 'completed' : ('not_started' as any),
        completionPercentage: n.status === 'completed' ? 100 : 0,
        isRater: true,
        raterToken: n.token,
        nominationStatus: n.status,
      }));

    return [...participantItems, ...raterItems];
  }


  /**
   * Reminds every incomplete participant. For FEEDBACK_360 assessments the
   * relevant "incomplete" people are the raters, not the reviewee — use
   * Uc1FeedbackService.sendReminders for those instead.
   */
  async sendReminders(assessmentId: string, orgId: string): Promise<{ sent: number }> {
    const assessment = await this.findOne(assessmentId, orgId);

    if (assessment.status !== AssessmentStatus.ACTIVE) {
      throw new BadRequestException('Reminders can only be sent for active assessments');
    }

    const participants = await this.getParticipants(assessmentId, orgId);
    const incomplete = participants.filter((p) => p.status !== 'completed' && p.status !== 'withdrawn');

    let sent = 0;
    for (const p of incomplete) {
      if (!p.user?.email) {
        this.logger.warn(`Skipping reminder for participant ${p.userId}: missing email`);
        continue;
      }
      await this.notificationsService.sendReminder(
        p.user.email,
        p.user.firstName,
        assessment.title,
        assessment.endDate?.toLocaleDateString('en-GB') ?? 'soon',
        { orgId },
      );
      sent++;
    }

    this.logger.log(`Sent ${sent} reminders for assessment ${assessmentId}`);
    return { sent };
  }

  /** Reminds a single incomplete participant (targeted, non-360). */
  async remindParticipant(assessmentId: string, participantId: string, orgId: string): Promise<{ sent: boolean }> {
    const assessment = await this.findOne(assessmentId, orgId);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, assessmentId },
      relations: ['user'],
    });
    if (!participant) {
      throw new NotFoundException(`Participant ${participantId} not found`);
    }
    if (participant.status === 'completed' || participant.status === 'withdrawn') {
      throw new BadRequestException('Participant has already completed or withdrawn — no reminder needed');
    }
    if (!participant.user?.email) {
      throw new BadRequestException('Participant has no email on file');
    }

    await this.notificationsService.sendReminder(
      participant.user.email,
      participant.user.firstName,
      assessment.title,
      assessment.endDate?.toLocaleDateString('en-GB') ?? 'soon',
      { orgId },
    );

    this.logger.log(`Sent targeted reminder to participant ${participantId} for assessment ${assessmentId}`);
    return { sent: true };
  }

   async removeParticipant(assessmentId: string, participantId: string, orgId: string): Promise<void> {
      const assessment = await this.findOne(assessmentId, orgId);
  
      if (assessment.status === AssessmentStatus.CLOSED || assessment.status === AssessmentStatus.ARCHIVED) {
        throw new BadRequestException('Cannot remove participants from a closed or archived assessment');
      }
  
      const participant = await this.participantRepo.findOne({
        where: { id: participantId, assessmentId },
        relations: ['assessment', 'user'],
      });
  
      if (!participant) {
        throw new NotFoundException('Participant not found');
      }
  
      // Ensure the participant belongs to this assessment and organisation
      if (participant.assessment?.organisationId !== orgId) {
        throw new ForbiddenException('Participant does not belong to this organisation');
      }
  
      // Prevent removal of self if user is the creator (self-assessment exception)
      // if (participant.userId === assessment.creatorId) {
      //   throw new BadRequestException('You cannot remove yourself from a self-assessment');
      // }
  
      // // soft delete
      // participant.deletedAt = new Date();
      // await this.participantRepo.save(participant);
      //
      //hard delete
      await this.participantRepo.delete({ id: participantId, assessmentId });
  
      this.logger.log(`Removed participant ${participantId} from assessment ${assessmentId}`);
    }
}
