import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { AssessmentStatus, AssessmentType, RaterRelationship, UserRole } from '@leaderprism/shared';
import type { AssessmentConfig } from '@leaderprism/shared';
import { EngineService } from '../../assessment/engine/engine.service';
import { Uc1FeedbackService } from '../../assessment/uc1-feedback/uc1-feedback.service';
import { Assessment } from '../../assessment/engine/entities/assessment.entity';
import { User } from '../../core/users/entities/user.entity';
import { UsersService } from '../../core/users/users.service';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { AssessmentRequestDto, AssessmentRequestResult, RaterInput } from './dto/assessment-request.dto';

const RATER_RELATIONSHIPS: RaterInput['relationship'][] = ['supervisor', 'peer', 'direct_report', 'stakeholder'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class HrisAssessmentsService {
  private readonly logger = new Logger(HrisAssessmentsService.name);

  constructor(
    private readonly engine: EngineService,
    private readonly users: UsersService,
    private readonly feedback: Uc1FeedbackService,
  ) {}

  /** Creates (or extends, idempotently) the LeaderPrism assessments for one HRIS review cycle. */
  async request(principal: IntegrationPrincipal, dto: AssessmentRequestDto): Promise<AssessmentRequestResult> {
    const orgId = principal.orgId;
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    const found = await this.users.findByExternalRefs(orgId, dto.employeeRefs);
    const active = new Map(found.filter((u) => u.isActive).map((u) => [u.externalRef as string, u]));
    const unknown = dto.employeeRefs.filter((r) => !active.has(r));
    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        message: `Unknown or inactive employeeRefs: ${unknown.join(', ')}`,
        error: 'UNKNOWN_EMPLOYEES',
        details: { employeeRefs: unknown },
      });
    }
    const employees = dto.employeeRefs.map((r) => active.get(r) as User);
    const createdBy = principal.createdBy ?? (await this.users.findFirstOrgAdminId(orgId));
    if (!createdBy) throw new UnprocessableEntityException('Organisation has no active admin to own HRIS assessments');

    if (dto.types.includes('360_feedback')) await this.validateRaters(orgId, dto);

    const result: AssessmentRequestResult = { assessments: [] };
    if (dto.types.includes('competency')) {
      const { assessment, created } = await this.ensureAssessment(orgId, createdBy, dto, AssessmentType.COMPETENCY, employees, {
        title: dto.title,
        config: this.competencyConfig(dto),
      });
      result.assessments.push({ assessmentId: assessment.id, type: 'competency', employeeRefs: dto.employeeRefs, created });
    }

    if (dto.types.includes('360_feedback')) {
      // LeaderPrism allows exactly one subject per 360 assessment, so the cycle gets one per employee.
      for (const user of employees) {
        const ref = user.externalRef as string;
        const { assessment, created } = await this.ensureAssessment(orgId, createdBy, dto, AssessmentType.FEEDBACK_360, [user], {
          title: `${dto.title} — ${user.firstName} ${user.lastName}`,
          config: {
            ...this.competencyConfig(dto),
            ...(dto.includeSelfAssessment !== undefined ? { includeSelfAssessment: dto.includeSelfAssessment } : {}),
          },
          subjectRef: ref,
        });
        const raters = dto.raters?.[ref] ?? [];
        if (raters.length > 0) {
          const withParticipants = await this.engine.findByCycleRef(orgId, dto.cycleRef, AssessmentType.FEEDBACK_360, ref);
          const participant = withParticipants?.participants?.find((p) => p.userId === user.id);
          if (participant) {
            // Existing emails are skipped by nominateRaters, so repeats are idempotent.
            await this.feedback.nominateRaters(
              assessment.id,
              participant.id,
              raters.map((r) => ({ raterEmail: r.email, raterName: r.name, relationship: r.relationship as RaterRelationship })),
              orgId,
              createdBy,
              UserRole.ORG_ADMIN,
            );
          }
        }
        result.assessments.push({ assessmentId: assessment.id, type: '360_feedback', employeeRefs: [ref], created });
      }
    }

    this.logger.log(
      `HRIS assessment request org=${orgId} cycle=${dto.cycleRef} types=${dto.types.join(',')} employees=${employees.length}`,
    );
    return result;
  }

  /**
   * Checks every rater up front so a bad rater never leaves a half-created cycle behind.
   * LeaderPrism does not allow Managers/HR Managers to give 360 feedback (they can only be assessed).
   */
  private async validateRaters(orgId: string, dto: AssessmentRequestDto): Promise<void> {
    const raters = Object.entries(dto.raters ?? {});
    const all: RaterInput[] = [];
    for (const [ref, list] of raters) {
      if (!dto.employeeRefs.includes(ref)) throw new BadRequestException(`raters key ${ref} is not in employeeRefs`);
      if (!Array.isArray(list)) throw new BadRequestException(`raters.${ref} must be an array`);
      for (const r of list) {
        if (!r || typeof r.email !== 'string' || !EMAIL_PATTERN.test(r.email) || typeof r.name !== 'string') {
          throw new BadRequestException(`raters.${ref}: each rater needs a valid email and a name`);
        }
        if (!RATER_RELATIONSHIPS.includes(r.relationship)) {
          throw new BadRequestException(`raters.${ref}: relationship must be one of ${RATER_RELATIONSHIPS.join(', ')}`);
        }
        all.push(r);
      }
    }
    const blocked = (await this.users.findByEmails(orgId, all.map((r) => r.email)))
      .filter((u) => u.role === UserRole.MANAGER || u.role === UserRole.HR_MANAGER)
      .map((u) => u.email);
    if (blocked.length > 0) {
      throw new UnprocessableEntityException({
        message: `These raters are Managers/HR Managers in LeaderPrism and cannot give 360 feedback: ${blocked.join(', ')}`,
        error: 'RATERS_NOT_ALLOWED',
        details: { emails: blocked },
      });
    }
  }

  private competencyConfig(dto: AssessmentRequestDto): AssessmentConfig {
    return {
      ...(dto.competencyIds?.length ? { competencyIds: dto.competencyIds } : {}),
      ...(dto.roleProfileId ? { targetRoleId: dto.roleProfileId } : {}),
    };
  }

  /** Find-or-create the cycle's assessment, add missing participants, and launch it if still a draft. */
  private async ensureAssessment(
    orgId: string,
    createdBy: string,
    dto: AssessmentRequestDto,
    type: AssessmentType,
    employees: User[],
    spec: { title: string; config: AssessmentConfig; subjectRef?: string },
  ): Promise<{ assessment: Assessment; created: boolean }> {
    let assessment = await this.engine.findByCycleRef(orgId, dto.cycleRef, type, spec.subjectRef);
    const created = !assessment;
    if (!assessment) {
      assessment = await this.engine.create(
        orgId,
        createdBy,
        { title: spec.title, assessmentType: type, config: spec.config, startDate: dto.startDate, endDate: dto.endDate },
        { cycleRef: dto.cycleRef, subjectRef: spec.subjectRef ?? null, source: 'hris' },
      );
    }

    const existing = new Set((assessment.participants ?? []).map((p) => p.userId));
    for (const user of employees) {
      if (!existing.has(user.id)) await this.engine.addParticipant(assessment.id, orgId, user.id);
    }

    if (assessment.status === AssessmentStatus.DRAFT) {
      assessment = await this.engine.launch(assessment.id, orgId);
    }
    return { assessment, created };
  }
}
