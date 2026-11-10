import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { SsoTicket } from './sso-ticket.entity';

export const SSO_TICKET_TTL_MS = 60_000;
/** Same-origin absolute path only: starts with one "/", no "//" or "/\" (open-redirect guard). */
export const SAFE_REDIRECT_PATH = /^\/(?![/\\])[A-Za-z0-9/_\-?=&.%]*$/;

const hash = (ticket: string) => createHash('sha256').update(ticket).digest('hex');

@Injectable()
export class SsoTicketService {
  constructor(@InjectRepository(SsoTicket) private readonly tickets: Repository<SsoTicket>) {}

  async issue(orgId: string, userId: string, redirectPath: string): Promise<{ ticket: string; expiresAt: Date }> {
    const ticket = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SSO_TICKET_TTL_MS);
    await this.tickets.save(
      this.tickets.create({ organisationId: orgId, userId, tokenHash: hash(ticket), redirectPath, expiresAt }),
    );
    return { ticket, expiresAt };
  }

  /** Atomically marks the ticket used; null when unknown, already used or expired. */
  async consume(ticket: string): Promise<{ userId: string; orgId: string; redirectPath: string } | null> {
    if (typeof ticket !== 'string' || ticket.length < 20 || ticket.length > 100) return null;
    const rows: Array<{ user_id: string; organisation_id: string; redirect_path: string }> = await this.tickets.query(
      `UPDATE sso_tickets SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id, organisation_id, redirect_path`,
      [hash(ticket)],
    ).then((r: any) => (Array.isArray(r[0]) ? r[0] : r));
    const row = rows[0];
    return row ? { userId: row.user_id, orgId: row.organisation_id, redirectPath: row.redirect_path } : null;
  }

  /** Deletes tickets more than a day past expiry. */
  async purgeExpired(): Promise<number> {
    const res = await this.tickets.delete({ expiresAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)) });
    return res.affected ?? 0;
  }
}
