import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { AssessmentStatus, AssessmentType } from '@leaderprism/shared';
import type { AssessmentConfig } from '@leaderprism/shared';
import { EngineService } from '../../assessment/engine/engine.service';
import { Assessment } from '../../assessment/engine/entities/assessment.entity';
import { User } from '../../core/users/entities/user.entity';
import { UsersService } from '../../core/users/users.service';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { AssessmentRequestDto, AssessmentRequestResult } from './dto/assessment-request.dto';

@Injectable()
export class HrisAssessmentsService {
  private readonly logger = new Logger(HrisAssessmentsService.name);

  constructor(
    private readonly engine: EngineService,
    private readonly users: UsersService,
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

    const result: AssessmentRequestResult = { assessments: [] };
    if (dto.types.includes('competency')) {
      const { assessment, created } = await this.ensureAssessment(orgId, createdBy, dto, AssessmentType.COMPETENCY, employees, {
        title: dto.title,
        config: this.competencyConfig(dto),
      });
      result.assessments.push({ assessmentId: assessment.id, type: 'competency', employeeRefs: dto.employeeRefs, created });
    }

    this.logger.log(
      `HRIS assessment request org=${orgId} cycle=${dto.cycleRef} types=${dto.types.join(',')} employees=${employees.length}`,
    );
    return result;
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
