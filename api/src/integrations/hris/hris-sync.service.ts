import { Injectable, Logger } from '@nestjs/common';
import { Language, UserRole } from '@leaderprism/shared';
import type { DepartmentSyncRow, EmployeeSyncRow, SyncRowResult } from '@leaderprism/shared';
import { OrganisationsService } from '../../core/organisations/organisations.service';
import { EmployeeUpsertRow, UsersService } from '../../core/users/users.service';
import { AuditService } from '../../core/audit/audit.service';
import type { IntegrationPrincipal } from '../api-clients/api-clients.service';

@Injectable()
export class HrisSyncService {
  private readonly logger = new Logger(HrisSyncService.name);

  constructor(
    private readonly orgsService: OrganisationsService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  async syncDepartments(principal: IntegrationPrincipal, rows: DepartmentSyncRow[]): Promise<{ results: SyncRowResult[] }> {
    const orgId = principal.orgId;
    const results = await this.orgsService.upsertDepartmentsByRef(orgId, rows);
    this.logSummary('Department', orgId, rows.length, results);
    await this.auditBatch(principal, 'integration.departments.synced', 'department_sync', rows.length, results, false);
    return { results };
  }

  async syncEmployees(principal: IntegrationPrincipal, rows: EmployeeSyncRow[], fullSync: boolean): Promise<{ results: SyncRowResult[] }> {
    const orgId = principal.orgId;
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
    await this.auditBatch(principal, 'integration.employees.synced', 'employee_sync', rows.length, results, fullSync);
    const leftRefs = new Set(rows.filter((r) => r.employmentStatus === 'left').map((r) => r.employeeRef));
    for (const r of results) {
      const deactivated = (r.status === 'updated' && leftRefs.has(r.ref) && !r.warnings?.includes('protected_role_not_deactivated'))
        || r.warnings?.includes('deactivated_missing_from_full_sync');
      if (deactivated && r.id) {
        await this.audit.record({ orgId, actorType: 'api_client', actorId: principal.clientId, action: 'user.deactivated_by_hris', entityType: 'user', entityId: r.id, metadata: { employeeRef: r.ref } });
      }
    }
    return { results };
  }

  private async auditBatch(principal: IntegrationPrincipal, action: string, entityType: string, rows: number, results: SyncRowResult[], fullSync: boolean) {
    const count = (s: string) => results.filter((r) => r.status === s).length;
    await this.audit.record({
      orgId: principal.orgId, actorType: 'api_client', actorId: principal.clientId, action, entityType,
      metadata: { rows, created: count('created'), updated: count('updated'), unchanged: count('unchanged'), errors: count('error'), fullSync },
    });
  }

  private logSummary(kind: string, orgId: string, rows: number, results: SyncRowResult[]): void {
    const errors = results.filter((r) => r.status === 'error').length;
    this.logger.log(`${kind} sync org=${orgId} rows=${rows} errors=${errors}`);
  }
}
