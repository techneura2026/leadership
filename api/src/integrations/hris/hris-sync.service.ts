import { Injectable, Logger } from '@nestjs/common';
import { Language, UserRole } from '@leaderprism/shared';
import type { DepartmentSyncRow, EmployeeSyncRow, SyncRowResult } from '@leaderprism/shared';
import { OrganisationsService } from '../../core/organisations/organisations.service';
import { EmployeeUpsertRow, UsersService } from '../../core/users/users.service';

@Injectable()
export class HrisSyncService {
  private readonly logger = new Logger(HrisSyncService.name);

  constructor(
    private readonly orgsService: OrganisationsService,
    private readonly usersService: UsersService,
  ) {}

  async syncDepartments(orgId: string, rows: DepartmentSyncRow[]): Promise<{ results: SyncRowResult[] }> {
    const results = await this.orgsService.upsertDepartmentsByRef(orgId, rows);
    this.logSummary('Department', orgId, rows.length, results);
    return { results };
  }

  async syncEmployees(orgId: string, rows: EmployeeSyncRow[], fullSync: boolean): Promise<{ results: SyncRowResult[] }> {
    const deptRefs = rows.map((r) => r.departmentRef).filter((r): r is string => !!r);
    const deptIds = await this.orgsService.getDepartmentIdsByRefs(orgId, deptRefs);

    const upserts: EmployeeUpsertRow[] = rows.map((r) => {
      const warnings: string[] = [];
      let departmentId: string | null | undefined;
      if (r.departmentRef === null) departmentId = null;
      else if (r.departmentRef !== undefined) {
        departmentId = deptIds.get(r.departmentRef) ?? null;
        if (!deptIds.has(r.departmentRef)) warnings.push('department_not_found');
      }
      return {
        employeeRef: r.employeeRef,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        departmentId,
        managerRef: r.managerRef,
        designationRef: r.designationRef,
        jobTitle: r.jobTitle,
        employmentStatus: r.employmentStatus,
        language: r.language as Language | undefined,
        role: r.role as UserRole | undefined,
        warnings,
      };
    });

    const results = await this.usersService.upsertEmployeesByRef(orgId, upserts, { fullSync });
    this.logSummary('Employee', orgId, rows.length, results);
    return { results };
  }

  private logSummary(kind: string, orgId: string, rows: number, results: SyncRowResult[]): void {
    const errors = results.filter((r) => r.status === 'error').length;
    this.logger.log(`${kind} sync org=${orgId} rows=${rows} errors=${errors}`);
  }
}
