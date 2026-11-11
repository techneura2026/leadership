import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface AuditEntry {
  orgId: string;
  actorType: 'user' | 'api_client' | 'system';
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  action?: string;
  actorType?: string;
  from?: Date;
  to?: Date;
  /** Opaque cursor from a previous page: "<createdAt ISO>|<id>". */
  cursor?: string;
  limit: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /** Never throws: an audit failure must not break the action being audited. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.save(this.repo.create({
        organisationId: entry.orgId,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        reason: entry.reason ?? null,
        metadata: entry.metadata ?? {},
      }));
    } catch (err: any) {
      this.logger.warn(`Audit record failed (${entry.action}): ${err?.message ?? err}`);
    }
  }

  async list(orgId: string, q: AuditQuery): Promise<{ data: AuditLog[]; nextCursor: string | null }> {
    const qb = this.repo
      .createQueryBuilder('l')
      .where('l.organisation_id = :orgId', { orgId })
      .orderBy('l.created_at', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .take(q.limit + 1);
    if (q.action) qb.andWhere('l.action = :action', { action: q.action });
    if (q.actorType) qb.andWhere('l.actor_type = :actorType', { actorType: q.actorType });
    if (q.from) qb.andWhere('l.created_at >= :from', { from: q.from });
    if (q.to) qb.andWhere('l.created_at <= :to', { to: q.to });
    if (q.cursor) {
      const [at, id] = q.cursor.split('|');
      if (at && id) qb.andWhere('(l.created_at, l.id) < (:at, :id)', { at: new Date(at), id });
    }
    const rows = await qb.getMany();
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return { data: page, nextCursor: rows.length > q.limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null };
  }
}
