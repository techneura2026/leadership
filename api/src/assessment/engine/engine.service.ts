import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsOptional, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentStatus, AssessmentType, Plan } from '@leaderprism/shared';
import type { AssessmentConfig, PlanLimits } from '@leaderprism/shared';
import { Assessment } from './entities/assessment.entity';
import { AssessmentParticipant } from './entities/assessment-participant.entity';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { RaterNomination } from '../uc1-feedback/entities/rater-nomination.entity';
import { User } from '../../core/users/entities/user.entity';

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
  ) {}

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

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT assessments can be updated');
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
    const assessment = await this.findOne(id, orgId);

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT assessments can be launched');
    }

    const participantCount = await this.participantRepo.count({
      where: { assessmentId: id },
    });

    if (participantCount === 0) {
      throw new BadRequestException('Cannot launch assessment with no participants');
    }

    // Validate plan participant limits
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organisation not found');
    const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[Plan.TRIAL];

    if (participantCount > limits.maxParticipants) {
      throw new ForbiddenException(
        `Participant count (${participantCount}) exceeds plan limit (${limits.maxParticipants})`,
      );
    }

    // Check active assessment count
    const activeCount = await this.assessmentRepo.count({
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

    const saved = await this.assessmentRepo.save(assessment);
    this.logger.log(`Launched assessment ${id} org=${orgId} participants=${participantCount}`);
    return saved;
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

    // Check for existing participant
    const existing = await this.participantRepo.findOne({
      where: { assessmentId, userId },
    });
    if (existing) {
      throw new BadRequestException(`User is already a participant in this assessment`);
    }

    // Plan limits check (only checked during addParticipant for active/non-draft assessments)
    if (assessment.status !== AssessmentStatus.DRAFT) {
      const org = await this.orgRepo.findOne({ where: { id: orgId } });
      if (!org) throw new NotFoundException('Organisation not found');
      const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[Plan.TRIAL];

      const currentCount = await this.participantRepo.count({ where: { assessmentId } });
      if (currentCount >= limits.maxParticipants) {
        throw new ForbiddenException(
          `Participant limit (${limits.maxParticipants}) reached for plan ${org.plan}`,
        );
      }
    }

    const participant = this.participantRepo.create({
      assessmentId,
      userId,
      status: 'invited',
    });

    const saved = await this.participantRepo.save(participant);
    this.logger.log(`Added participant ${userId} to assessment ${assessmentId}`);
    return saved;
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
      }
    >
  > {
    const participations = await this.participantRepo.find({
      where: { userId },
      relations: ['assessment'],
      order: { createdAt: 'DESC' },
    });

    const participantItems = participations
      .filter(
        (p) =>
          p.assessment &&
          p.assessment.organisationId === orgId &&
          p.assessment.status === AssessmentStatus.ACTIVE,
      )
      .map((p) => ({
        ...p.assessment,
        participantStatus: p.status as any,
        completionPercentage: p.status === 'completed' ? 100 : p.status === 'in_progress' ? 50 : 0,
      }));

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
}
