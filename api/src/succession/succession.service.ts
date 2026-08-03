import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadinessRating } from '@leaderprism/shared';
import { KeyRole } from './entities/key-role.entity';
import { Successor } from './entities/successor.entity';
import { CreateKeyRoleDto } from './dto/create-key-role.dto';
import { UpdateKeyRoleDto } from './dto/update-key-role.dto';
import { Uc4ReadinessService } from '../assessment/uc4-readiness/uc4-readiness.service';
import { Uc2CompetencyService } from '../assessment/uc2-competency/uc2-competency.service';
import { UsersService } from '../core/users/users.service';
import { OrganisationsService } from '../core/organisations/organisations.service';

export interface SuccessionCandidate {
  readinessScoreId: string;
  participantId: string;
  userId: string;
  name: string;
  title: string | null;
  department: string | null;
  roleProfileId: string;
  roleTitle: string;
  readinessRating: ReadinessRating;
  compositeScore: number;
  gridPerformance: string;
  manualGridPerformance: string | null;
  effectiveGridPerformance: string;
  gridPotential: string;
  keyStrengths: string[];
  developmentAreas: string[];
}

interface UserLookupEntry {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentName: string | null;
  managerId: string | null;
  isActive: boolean;
}

@Injectable()
export class SuccessionService {
  private readonly logger = new Logger(SuccessionService.name);

  constructor(
    @InjectRepository(KeyRole)
    private readonly keyRoleRepo: Repository<KeyRole>,
    @InjectRepository(Successor)
    private readonly successorRepo: Repository<Successor>,
    private readonly uc4Service: Uc4ReadinessService,
    private readonly uc2Service: Uc2CompetencyService,
    private readonly usersService: UsersService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  /** Shared org-scoped user lookup (jobTitle/department/managerId) reused by getCandidates and getOrgChart. */
  private async getUserLookup(orgId: string): Promise<Map<string, UserLookupEntry>> {
    const [result, departments] = await Promise.all([
      this.usersService.findAll(orgId),
      this.organisationsService.getDepartments(orgId),
    ]);
    const users = Array.isArray(result) ? result : result.data;
    const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

    return new Map(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          jobTitle: u.jobTitle,
          departmentName: u.departmentId ? (departmentNameById.get(u.departmentId) ?? null) : null,
          managerId: u.managerId,
          isActive: u.isActive,
        },
      ]),
    );
  }

  // ── Candidates (9-box / talent pool) ────────────────────────────────────

  async getCandidates(orgId: string, assessmentId?: string): Promise<SuccessionCandidate[]> {
    const [dashboard, userLookup] = await Promise.all([
      this.uc4Service.getSuccessionDashboard(orgId, assessmentId),
      this.getUserLookup(orgId),
    ]);

    const candidates: SuccessionCandidate[] = [];
    for (const role of dashboard.byRole) {
      for (const c of role.candidates) {
        let keyStrengths: string[] = [];
        let developmentAreas: string[] = [];
        try {
          const profile = await this.uc2Service.getCompetencyProfile(c.assessmentId, c.participantId, orgId);
          const allCompetencies = profile
            .flatMap((d) => d.competencies)
            .map((comp) => ({
              name: comp.name,
              rating: comp.managerRating ?? comp.selfRating,
            }))
            .filter((comp): comp is { name: string; rating: number } => comp.rating !== null)
            .sort((a, b) => b.rating - a.rating);

          keyStrengths = allCompetencies.slice(0, 2).map((c) => c.name);
          developmentAreas = allCompetencies.slice(-2).reverse().map((c) => c.name);
        } catch {
          // No competency assessment for this participant yet — degrade gracefully to [].
        }

        const userInfo = userLookup.get(c.userId);
        candidates.push({
          readinessScoreId: c.readinessScoreId,
          participantId: c.participantId,
          userId: c.userId,
          name: c.name,
          title: userInfo?.jobTitle ?? null,
          department: userInfo?.departmentName ?? null,
          roleProfileId: role.roleProfileId,
          roleTitle: role.roleTitle,
          readinessRating: c.readinessRating,
          compositeScore: c.compositeScore,
          gridPerformance: c.gridPerformance,
          manualGridPerformance: c.manualGridPerformance,
          effectiveGridPerformance: c.effectiveGridPerformance,
          gridPotential: c.gridPotential,
          keyStrengths,
          developmentAreas,
        });
      }
    }

    return candidates;
  }

  // ── Key Roles CRUD ───────────────────────────────────────────────────────

  async listKeyRoles(orgId: string): Promise<
    Array<{
      id: string;
      title: string;
      departmentId: string | null;
      departmentName: string | null;
      criticality: 'critical' | 'high' | 'medium';
      incumbentId: string | null;
      incumbentName: string | null;
      incumbentSince: string | null;
      flightRisk: 'high' | 'medium' | 'low';
      successors: Array<{
        id: string;
        candidateUserId: string | null;
        candidateName: string;
        readinessRating: ReadinessRating | null;
        compositeScore: number | null;
        notes: string | null;
      }>;
    }>
  > {
    const keyRoles = await this.keyRoleRepo.find({
      where: { organisationId: orgId },
      relations: ['department', 'incumbent', 'successors', 'successors.candidate'],
      order: { title: 'ASC' },
    });

    const candidateUserIds = Array.from(
      new Set(
        keyRoles.flatMap((kr) => kr.successors?.map((s) => s.candidateUserId).filter((id): id is string => !!id) ?? []),
      ),
    );
    const readinessMap = await this.uc4Service.getLatestReadinessForUsers(orgId, candidateUserIds);

    return keyRoles.map((kr) => ({
      id: kr.id,
      title: kr.title,
      departmentId: kr.departmentId,
      departmentName: kr.department?.name ?? null,
      criticality: kr.criticality,
      incumbentId: kr.incumbentId,
      incumbentName: kr.incumbent ? `${kr.incumbent.firstName} ${kr.incumbent.lastName}` : null,
      incumbentSince: kr.incumbentSince,
      flightRisk: kr.flightRisk,
      successors: (kr.successors ?? []).map((s) => {
        const readiness = s.candidateUserId ? readinessMap.get(s.candidateUserId) : undefined;
        return {
          id: s.id,
          candidateUserId: s.candidateUserId,
          candidateName: s.candidate ? `${s.candidate.firstName} ${s.candidate.lastName}` : 'Former candidate (user removed)',
          readinessRating: readiness?.readinessRating ?? null,
          compositeScore: readiness?.compositeScore ?? null,
          notes: s.notes,
        };
      }),
    }));
  }

  async createKeyRole(orgId: string, dto: CreateKeyRoleDto): Promise<KeyRole> {
    const keyRole = this.keyRoleRepo.create({
      organisationId: orgId,
      title: dto.title,
      departmentId: dto.departmentId ?? null,
      criticality: dto.criticality ?? 'medium',
      incumbentId: dto.incumbentId ?? null,
      incumbentSince: dto.incumbentSince ?? null,
      flightRisk: dto.flightRisk ?? 'medium',
    });
    const saved = await this.keyRoleRepo.save(keyRole);
    this.logger.log(`Created key role ${saved.id} (${saved.title}) for org ${orgId}`);
    return saved;
  }

  async updateKeyRole(orgId: string, id: string, dto: UpdateKeyRoleDto): Promise<KeyRole> {
    const keyRole = await this.keyRoleRepo.findOne({ where: { id, organisationId: orgId } });
    if (!keyRole) throw new NotFoundException(`Key role ${id} not found`);

    Object.assign(keyRole, dto);
    return this.keyRoleRepo.save(keyRole);
  }

  async deleteKeyRole(orgId: string, id: string): Promise<void> {
    const keyRole = await this.keyRoleRepo.findOne({ where: { id, organisationId: orgId } });
    if (!keyRole) throw new NotFoundException(`Key role ${id} not found`);
    await this.keyRoleRepo.remove(keyRole);
  }

  // ── Successor nominations ───────────────────────────────────────────────

  async nominateSuccessor(
    orgId: string,
    keyRoleId: string,
    candidateUserId: string,
    nominatedById: string,
    notes?: string,
  ): Promise<Successor> {
    const keyRole = await this.keyRoleRepo.findOne({ where: { id: keyRoleId, organisationId: orgId } });
    if (!keyRole) throw new NotFoundException(`Key role ${keyRoleId} not found`);

    const candidate = await this.usersService.findById(candidateUserId, orgId);
    if (!candidate) throw new NotFoundException(`Candidate ${candidateUserId} not found`);

    const existing = await this.successorRepo.findOne({ where: { keyRoleId, candidateUserId } });
    if (existing) {
      throw new ConflictException('This candidate is already nominated as a successor for this role.');
    }

    const successor = this.successorRepo.create({
      keyRoleId,
      candidateUserId,
      nominatedById,
      notes: notes ?? null,
    });
    return this.successorRepo.save(successor);
  }

  async removeSuccessor(orgId: string, keyRoleId: string, successorId: string): Promise<void> {
    const keyRole = await this.keyRoleRepo.findOne({ where: { id: keyRoleId, organisationId: orgId } });
    if (!keyRole) throw new NotFoundException(`Key role ${keyRoleId} not found`);

    const successor = await this.successorRepo.findOne({ where: { id: successorId, keyRoleId } });
    if (!successor) throw new NotFoundException(`Successor ${successorId} not found`);

    await this.successorRepo.remove(successor);
  }

  // ── Department bench strength ───────────────────────────────────────────

  async getBench(orgId: string): Promise<
    Array<{
      departmentId: string | null;
      departmentName: string;
      totalRoles: number;
      coveredRoles: number;
      readinessBreakdown: Record<string, number>;
    }>
  > {
    const keyRoles = await this.keyRoleRepo.find({
      where: { organisationId: orgId },
      relations: ['department', 'successors'],
    });

    const candidateUserIds = Array.from(
      new Set(
        keyRoles.flatMap((kr) => kr.successors?.map((s) => s.candidateUserId).filter((id): id is string => !!id) ?? []),
      ),
    );
    const readinessMap = await this.uc4Service.getLatestReadinessForUsers(orgId, candidateUserIds);

    const byDept = new Map<
      string,
      { departmentId: string | null; departmentName: string; totalRoles: number; coveredRoles: number; readinessBreakdown: Record<string, number> }
    >();

    for (const kr of keyRoles) {
      const deptId = kr.departmentId ?? 'none';
      const deptName = kr.department?.name ?? 'Unassigned';

      if (!byDept.has(deptId)) {
        byDept.set(deptId, {
          departmentId: kr.departmentId,
          departmentName: deptName,
          totalRoles: 0,
          coveredRoles: 0,
          readinessBreakdown: {},
        });
      }

      const entry = byDept.get(deptId)!;
      entry.totalRoles++;
      if (kr.successors && kr.successors.length > 0) {
        entry.coveredRoles++;
      }

      for (const successor of kr.successors ?? []) {
        const bucket = successor.candidateUserId
          ? (readinessMap.get(successor.candidateUserId)?.readinessRating ?? 'not_yet_assessed')
          : 'not_yet_assessed';
        entry.readinessBreakdown[bucket] = (entry.readinessBreakdown[bucket] ?? 0) + 1;
      }
    }

    return Array.from(byDept.values());
  }

  // ── Org chart (real reporting hierarchy) ────────────────────────────────

  async getOrgChart(orgId: string): Promise<
    Array<{ id: string; name: string; title: string | null; department: string | null; managerId: string | null }>
  > {
    const userLookup = await this.getUserLookup(orgId);

    return Array.from(userLookup.values())
      .filter((u) => u.isActive)
      .map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        title: u.jobTitle,
        department: u.departmentName,
        managerId: u.managerId,
      }));
  }
}
