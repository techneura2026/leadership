import { Injectable, Logger } from '@nestjs/common';
import type { DepartmentSyncRow, SyncRowResult } from '@leaderprism/shared';
import { OrganisationsService } from '../../core/organisations/organisations.service';

@Injectable()
export class HrisSyncService {
  private readonly logger = new Logger(HrisSyncService.name);

  constructor(private readonly orgsService: OrganisationsService) {}

  async syncDepartments(orgId: string, rows: DepartmentSyncRow[]): Promise<{ results: SyncRowResult[] }> {
    const results = await this.orgsService.upsertDepartmentsByRef(orgId, rows);
    this.logger.log(`Department sync org=${orgId} rows=${rows.length} errors=${results.filter((r) => r.status === 'error').length}`);
    return { results };
  }
}
