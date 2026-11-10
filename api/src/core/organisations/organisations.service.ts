import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation } from './entities/organisation.entity';
import { Department } from './entities/department.entity';
import { Plan } from '@leaderprism/shared';
import type { DepartmentSyncRow, SyncRowResult } from '@leaderprism/shared';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation) private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    private readonly usersService: UsersService,
  ) {}

  async create(data: { name: string; slug: string }): Promise<Organisation> {
    const existing = await this.orgRepo.findOne({ where: { slug: data.slug } });
    if (existing) {
      throw new ConflictException(`Organisation slug '${data.slug}' is already taken`);
    }

    const trialDays = parseInt(process.env.TRIAL_DAYS ?? '30', 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const org = this.orgRepo.create({
      name: data.name,
      slug: data.slug,
      plan: Plan.TRIAL,
      trialEndsAt,
    });
    return this.orgRepo.save(org);
  }

  async findById(id: string): Promise<Organisation> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organisation not found');
    return org;
  }

  async findBySlug(slug: string): Promise<Organisation | null> {
    return this.orgRepo.findOne({ where: { slug } });
  }

  async update(
    id: string,
    data: Partial<Pick<Organisation, 'name' | 'logoUrl' | 'primaryColour' | 'brandingName'>>,
  ): Promise<Organisation> {
    await this.orgRepo.update(id, data as any);
    return this.findById(id);
  }

  async getDepartments(organisationId: string): Promise<Department[]> {
    return this.deptRepo.find({ where: { organisationId }, order: { name: 'ASC' } });
  }

  async createDepartment(organisationId: string, name: string, description?: string, parentId?: string): Promise<Department> {
    const dept = this.deptRepo.create({ organisationId, name, description: description ?? null, parentId: parentId ?? null });
    return this.deptRepo.save(dept);
  }

  async updateDepartment(
    organisationId: string,
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<Department> {
    const dept = await this.deptRepo.findOne({ where: { id, organisationId } });
    if (!dept) throw new NotFoundException('Department not found');
    Object.assign(dept, data);
    return this.deptRepo.save(dept);
  }

  /**
   * HRIS department sync. Upserts by external_ref inside one transaction. Pass 1 writes names and
   * status; pass 2 resolves parentRef against existing departments plus the batch. Rows that
   * would form a parent cycle are rejected before anything is written.
   */
  async upsertDepartmentsByRef(organisationId: string, rows: DepartmentSyncRow[]): Promise<SyncRowResult[]> {
    return this.deptRepo.manager.transaction(async (em) => {
      const repo = em.getRepository(Department);
      const all = await repo.find({ where: { organisationId } });
      const byRef = new Map(all.filter((d) => d.externalRef).map((d) => [d.externalRef as string, d]));
      const byId = new Map(all.map((d) => [d.id, d]));

      // Proposed parent graph by ref: batch rows use their parentRef; others keep their DB parent.
      const batchParent = new Map<string, string | null | undefined>(rows.map((r) => [r.departmentRef, r.parentRef]));
      const parentRefOf = (ref: string): string | null => {
        if (batchParent.has(ref)) {
          const p = batchParent.get(ref);
          if (p !== undefined) return p;
        }
        const d = byRef.get(ref);
        const parent = d?.parentId ? byId.get(d.parentId) : undefined;
        return parent?.externalRef ?? null;
      };
      const inCycle = (ref: string): boolean => {
        let cur = parentRefOf(ref);
        for (let i = 0; cur && i <= rows.length + all.length; i++) {
          if (cur === ref) return true;
          cur = parentRefOf(cur);
        }
        return false;
      };

      const results: SyncRowResult[] = [];
      const changed = new Set<string>();

      // Pass 1 — create/update without parents.
      for (const row of rows) {
        if (inCycle(row.departmentRef)) {
          results.push({ ref: row.departmentRef, status: 'error', error: 'parent_cycle' });
          continue;
        }
        let dept = byRef.get(row.departmentRef);
        if (!dept) {
          dept = await repo.save(
            repo.create({
              organisationId,
              name: row.name,
              externalRef: row.departmentRef,
              hrisManaged: true,
              isActive: row.isActive ?? true,
              parentId: null,
            }),
          );
          byRef.set(row.departmentRef, dept);
          byId.set(dept.id, dept);
          results.push({ ref: row.departmentRef, status: 'created', id: dept.id });
          continue;
        }
        const isActive = row.isActive ?? dept.isActive;
        if (dept.name !== row.name || dept.isActive !== isActive || !dept.hrisManaged) {
          dept.name = row.name;
          dept.isActive = isActive;
          dept.hrisManaged = true;
          await repo.save(dept);
          changed.add(row.departmentRef);
        }
        results.push({ ref: row.departmentRef, status: 'unchanged', id: dept.id });
      }

      // Pass 2 — parents.
      for (const [i, row] of rows.entries()) {
        const result = results[i];
        if (result.status === 'error' || row.parentRef === undefined) continue;
        const dept = byRef.get(row.departmentRef)!;
        let parentId: string | null = null;
        if (row.parentRef !== null) {
          const parent = byRef.get(row.parentRef);
          if (parent) parentId = parent.id;
          else result.warnings = [...(result.warnings ?? []), 'parent_not_found'];
        }
        if (dept.parentId !== parentId) {
          dept.parentId = parentId;
          await repo.update({ id: dept.id }, { parentId });
          changed.add(row.departmentRef);
        }
      }

      for (const r of results) {
        if (r.status === 'unchanged' && changed.has(r.ref)) r.status = 'updated';
      }
      return results;
    });
  }

  async deleteDepartment(organisationId: string, id: string): Promise<void> {
    const dept = await this.deptRepo.findOne({ where: { id, organisationId } });
    if (!dept) throw new NotFoundException('Department not found');

    const assignedUsers = await this.usersService.findAll(organisationId, { departmentId: id, limit: 1 });
    const userCount = Array.isArray(assignedUsers) ? assignedUsers.length : assignedUsers.total;
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete department '${dept.name}': ${userCount} user(s) are still assigned to it. Reassign or remove them first.`,
      );
    }

    const childCount = await this.deptRepo.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictException(
        `Cannot delete department '${dept.name}': it has ${childCount} sub-department(s). Delete or reassign them first.`,
      );
    }

    await this.deptRepo.remove(dept);
  }

  async getUsers(
    organisationId: string,
    filters?: {
      page?: number;
      limit?: number;
      search?: string;
      departmentId?: string;
    },
  ) {
    return this.usersService.findAll(organisationId, filters);
  }
}
