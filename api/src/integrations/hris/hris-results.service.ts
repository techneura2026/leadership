import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssessmentStatus, AssessmentType, ReadinessRating, ReportType } from '@leaderprism/shared';
import { SuccessionService } from '../../succession/succession.service';
import { ReportingService } from '../../reporting/reporting.service';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';
import { signReportUrl, verifyReportSignature } from './signed-url';
import type { AssessmentConfig, EmployeeResultDto, ResultsPageDto } from '@leaderprism/shared';
import { EngineService } from '../../assessment/engine/engine.service';
import { Assessment } from '../../assessment/engine/entities/assessment.entity';
import { Uc1FeedbackService } from '../../assessment/uc1-feedback/uc1-feedback.service';
import { Uc2CompetencyService } from '../../assessment/uc2-competency/uc2-competency.service';
import { Uc4ReadinessService } from '../../assessment/uc4-readiness/uc4-readiness.service';
import { ItemsService } from '../../assessment/items/items.service';
import { UsersService } from '../../core/users/users.service';
import { buildCompetencyBlock, ExportRoleProfile } from './competency-export';
import { ExportNomination, toOthersAggregate } from './feedback-export';

const DEFAULT_RATER_THRESHOLD = 3;
const DEFAULT_360_SCALE = 5;
const FINAL_STATUSES: AssessmentStatus[] = [AssessmentStatus.CLOSED, AssessmentStatus.ARCHIVED];
const REPORT_LINK_TTL_SECONDS = 900;

/** Builds the spec §6 results payload (O-1, O-2, O-3) for an HRIS review cycle. */
@Injectable()
export class HrisResultsService {
  private readonly logger = new Logger(HrisResultsService.name);

  constructor(
    private readonly engine: EngineService,
    private readonly users: UsersService,
    private readonly feedback: Uc1FeedbackService,
    private readonly competency: Uc2CompetencyService,
    private readonly readiness: Uc4ReadinessService,
    private readonly items: ItemsService,
    private readonly reporting: ReportingService,
    private readonly config: ConfigService,
    private readonly succession: SuccessionService,
  ) {}

  /** `talent` (scope talent:read) adds readiness and 9-box placement (O-4, O-5); otherwise those keys are absent. */
  async getEmployeeResult(
    orgId: string,
    cycleRef: string,
    employeeRef: string,
    opts: { talent: boolean } = { talent: false },
  ): Promise<EmployeeResultDto> {
    const cycle = await this.loadCycle(orgId, cycleRef);
    const userId = cycle.userIdByRef.get(employeeRef);
    if (!userId) throw new NotFoundException(`Employee ${employeeRef} is not part of cycle ${cycleRef}`);
    const result = await this.build(orgId, cycleRef, employeeRef, userId, cycle.assessments, new Map());
    if (opts.talent) await this.attachTalent(orgId, [[userId, result]]);
    return result;
  }

  async getResultsPage(
    orgId: string,
    cycleRef: string,
    cursor: string | undefined,
    limit: number,
    opts: { talent: boolean } = { talent: false },
  ): Promise<ResultsPageDto> {
    const cycle = await this.loadCycle(orgId, cycleRef);
    const refs = [...cycle.userIdByRef.keys()].sort().filter((r) => cursor === undefined || r > cursor);
    const page = refs.slice(0, limit);
    const profiles = new Map<string, ExportRoleProfile | null>();
    const built: Array<[string, EmployeeResultDto]> = [];
    for (const ref of page) {
      const userId = cycle.userIdByRef.get(ref) as string;
      built.push([userId, await this.build(orgId, cycleRef, ref, userId, cycle.assessments, profiles)]);
    }
    if (opts.talent) await this.attachTalent(orgId, built);
    return { data: built.map(([, r]) => r), nextCursor: refs.length > limit ? page[page.length - 1] : null };
  }

  /** O-6: key roles with their nominated successors, identified by employeeRef. */
  async getSuccession(orgId: string) {
    const keyRoles = await this.succession.listKeyRoles(orgId);
    const userIds = keyRoles.flatMap((k) => k.successors.map((s) => s.candidateUserId).filter((id): id is string => !!id));
    const refs = await this.users.getExternalRefs(orgId, userIds);
    return {
      keyRoles: keyRoles.map((k) => ({
        id: k.id,
        title: k.title,
        criticality: k.criticality,
        departmentName: k.departmentName,
        incumbentRef: k.incumbentId ? (refs.get(k.incumbentId) ?? null) : null,
        readyNowCount: k.successors.filter((s) => s.readinessRating === ReadinessRating.READY_NOW).length,
        successors: k.successors.map((s) => ({
          employeeRef: s.candidateUserId ? (refs.get(s.candidateUserId) ?? null) : null,
          readinessRating: s.readinessRating,
          compositeScore: s.compositeScore,
        })),
      })),
    };
  }

  private async attachTalent(orgId: string, rows: Array<[string, EmployeeResultDto]>): Promise<void> {
    const snapshots = await this.readiness.getTalentSnapshots(orgId, rows.map(([userId]) => userId));
    for (const [userId, result] of rows) {
      const snap = snapshots.get(userId);
      result.readiness = snap?.readiness ?? null;
      result.nineBox = snap?.nineBox ?? null;
    }
  }

  /** O-9: the competency framework and role profiles the HRIS builds leadership KPIs from. */
  async getFramework(orgId: string) {
    const domains = await this.items.getCompetencyFramework(orgId);
    const roleProfiles = await this.readiness.getRoleProfiles(orgId);
    return {
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        competencies: (d.competencies ?? [])
          .filter((c) => c.isActive && (c.organisationId === null || c.organisationId === orgId))
          .map((c) => ({
            competencyRef: c.id,
            name: c.name,
            description: c.description,
            levels: (c.levels ?? [])
              .slice()
              .sort((a, b) => a.level - b.level)
              .map((l) => ({ level: l.level, label: l.label, description: l.description, indicators: l.indicators })),
          })),
      })),
      roleProfiles: roleProfiles.map((p) => ({
        ref: p.id,
        title: p.title,
        level: p.level,
        requiredCompetencies: (p.requiredCompetencies ?? []).map((r) => ({
          competencyRef: r.competencyId,
          minLevel: r.minLevel,
          weight: r.weight,
        })),
      })),
    };
  }

  private async loadCycle(orgId: string, cycleRef: string) {
    const assessments = await this.engine.findAllByCycleRef(orgId, cycleRef);
    if (assessments.length === 0) throw new NotFoundException(`Cycle ${cycleRef} not found`);
    const userIds = assessments.flatMap((a) => (a.participants ?? []).map((p) => p.userId));
    const refByUser = await this.users.getExternalRefs(orgId, userIds);
    const userIdByRef = new Map([...refByUser.entries()].map(([userId, ref]) => [ref, userId]));
    return { assessments, userIdByRef };
  }

  private async build(
    orgId: string,
    cycleRef: string,
    employeeRef: string,
    userId: string,
    assessments: Assessment[],
    profileCache: Map<string, ExportRoleProfile | null>,
  ): Promise<EmployeeResultDto> {
    const mine = assessments.filter((a) => (a.participants ?? []).some((p) => p.userId === userId));
    const participantIn = (a: Assessment) => (a.participants ?? []).find((p) => p.userId === userId)!;

    const comp = mine.find((a) => a.assessmentType === AssessmentType.COMPETENCY);
    let competency: EmployeeResultDto['competency'] = null;
    if (comp) {
      const ratings = await this.competency.getRatingsDetail(comp.id, participantIn(comp).id, orgId);
      const targetRoleId = (comp.config as AssessmentConfig | undefined)?.targetRoleId;
      competency = buildCompetencyBlock(ratings, targetRoleId ? await this.roleProfile(orgId, targetRoleId, profileCache) : null);
    }

    const fb = mine.find((a) => a.assessmentType === AssessmentType.FEEDBACK_360);
    let feedback360: EmployeeResultDto['feedback360'] = null;
    if (fb) {
      const config = (fb.config ?? {}) as AssessmentConfig;
      const nominations = await this.feedback.getCompletedNominationsForExport(fb.id, participantIn(fb).id, orgId);
      const exportable: ExportNomination[] = nominations.map((n) => ({
        relationship: n.relationship as ExportNomination['relationship'],
        status: n.status,
        responses: (n.responses ?? []).map((r) => ({
          competencyId: r.competencyId,
          score: r.score === null || r.score === undefined ? null : Number(r.score),
        })),
      }));
      feedback360 = toOthersAggregate(exportable, {
        minPerGroup: config.raterMinThreshold ?? DEFAULT_RATER_THRESHOLD,
        scaleMax: config.ratingScale ?? DEFAULT_360_SCALE,
      });
    }

    const reports: EmployeeResultDto['reports'] = [];
    for (const a of mine) {
      const participantId = participantIn(a).id;
      for (const r of await this.reporting.listReports(orgId, a.id)) {
        if (r.status !== 'ready' || r.participantId !== participantId) continue;
        const { url, expiresAt } = signReportUrl(this.publicUrl(), r.id, REPORT_LINK_TTL_SECONDS, this.signingSecret());
        reports.push({ reportId: r.id, type: r.reportType, url, expiresAt });
      }
    }

    return {
      employeeRef,
      cycleRef,
      status: mine.length > 0 && mine.every((a) => FINAL_STATUSES.includes(a.status)) ? 'final' : 'in_progress',
      assessmentIds: mine.map((a) => a.id),
      competency,
      feedback360,
      reports,
    };
  }

  /** Queues a PDF report for one employee in a cycle (O-8). It appears in `reports` once ready. */
  async requestReport(
    principal: IntegrationPrincipal,
    dto: { cycleRef: string; employeeRef: string; type: 'competency' | 'individual_360' },
  ): Promise<{ reportId: string; status: string }> {
    const orgId = principal.orgId;
    const cycle = await this.loadCycle(orgId, dto.cycleRef);
    const userId = cycle.userIdByRef.get(dto.employeeRef);
    if (!userId) throw new NotFoundException(`Employee ${dto.employeeRef} is not part of cycle ${dto.cycleRef}`);
    const assessmentType = dto.type === 'competency' ? AssessmentType.COMPETENCY : AssessmentType.FEEDBACK_360;
    const assessment = cycle.assessments.find(
      (a) => a.assessmentType === assessmentType && (a.participants ?? []).some((p) => p.userId === userId),
    );
    if (!assessment) throw new NotFoundException(`No ${dto.type} assessment for ${dto.employeeRef} in cycle ${dto.cycleRef}`);
    const participant = assessment.participants.find((p) => p.userId === userId)!;
    const generatedBy = principal.createdBy ?? (await this.users.findFirstOrgAdminId(orgId)) ?? assessment.createdBy;
    const reportType = dto.type === 'competency' ? ReportType.COMPETENCY : ReportType.INDIVIDUAL_360;
    const report = await this.reporting.requestReport(orgId, assessment.id, participant.id, reportType, 'en', generatedBy);
    return { reportId: report.id, status: report.status };
  }

  /** Resolves a verified signed link to the stored file (local path or blob URL). */
  async resolveSignedReport(reportId: string, exp: string, sig: string): Promise<string> {
    if (!verifyReportSignature(reportId, exp, sig, this.signingSecret())) {
      throw new ForbiddenException('Invalid or expired report link');
    }
    const path = await this.reporting.getDownloadPathForSignedLink(reportId);
    if (!path) throw new NotFoundException('Report not found');
    return path;
  }

  private signingSecret(): string {
    return this.config.getOrThrow<string>('INTEGRATION_URL_SIGNING_SECRET');
  }

  private publicUrl(): string {
    return this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3001');
  }

  private async roleProfile(orgId: string, id: string, cache: Map<string, ExportRoleProfile | null>) {
    if (!cache.has(id)) {
      const all = await this.readiness.getRoleProfiles(orgId);
      for (const p of all) cache.set(p.id, { id: p.id, title: p.title, requiredCompetencies: p.requiredCompetencies ?? [] });
      if (!cache.has(id)) cache.set(id, null);
    }
    return cache.get(id) ?? null;
  }
}
