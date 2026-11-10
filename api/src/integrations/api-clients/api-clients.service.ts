import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { timingSafeEqual } from 'crypto';
import type { ApiClientDto, CreatedApiClientDto, IntegrationScope } from '@leaderprism/shared';
import { ApiClient } from './api-client.entity';
import { generateApiKey, hashSecret, parseApiKey } from './key-format';
import { OrganisationsService } from '../../core/organisations/organisations.service';

export interface IntegrationPrincipal {
  orgId: string;
  clientId: string;
  scopes: IntegrationScope[];
  /** User who created the API key — records created by the HRIS are attributed to them. */
  createdBy: string | null;
}

const LAST_USED_WRITE_INTERVAL_MS = 60_000;

@Injectable()
export class ApiClientsService {
  private readonly logger = new Logger(ApiClientsService.name);

  constructor(
    @InjectRepository(ApiClient)
    private readonly clientRepo: Repository<ApiClient>,
    private readonly orgsService: OrganisationsService,
  ) {}

  async create(
    orgId: string,
    userId: string,
    dto: { name: string; scopes: IntegrationScope[] },
  ): Promise<CreatedApiClientDto> {
    const key = generateApiKey();
    const client = await this.clientRepo.save(
      this.clientRepo.create({
        organisationId: orgId,
        name: dto.name,
        keyPrefix: key.prefix,
        secretHash: hashSecret(key.secret),
        scopes: [...new Set(dto.scopes)],
        createdBy: userId,
      }),
    );
    this.logger.log(`Created API client ${client.id} org=${orgId} scopes=${client.scopes.join(',')}`);
    return { ...this.toDto(client), rawKey: key.raw };
  }

  async list(orgId: string): Promise<ApiClientDto[]> {
    const clients = await this.clientRepo.find({ where: { organisationId: orgId }, order: { createdAt: 'DESC' } });
    return clients.map((c) => this.toDto(c));
  }

  async revoke(orgId: string, id: string): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id, organisationId: orgId } });
    if (!client) throw new NotFoundException('API client not found');
    if (!client.revokedAt) {
      client.revokedAt = new Date();
      await this.clientRepo.save(client);
      this.logger.log(`Revoked API client ${id} org=${orgId}`);
    }
  }

  /** Resolves a raw `X-Api-Key` value to its organisation and scopes, or null when it must be rejected. */
  async authenticate(rawKey: string): Promise<IntegrationPrincipal | null> {
    const parsed = parseApiKey(rawKey);
    if (!parsed) return null;

    const client = await this.clientRepo
      .createQueryBuilder('c')
      .addSelect('c.secretHash')
      .where('c.key_prefix = :prefix', { prefix: parsed.prefix })
      .andWhere('c.revoked_at IS NULL')
      .getOne();
    if (!client) return null;

    const expected = Buffer.from(client.secretHash, 'hex');
    const actual = Buffer.from(hashSecret(parsed.secret), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    const org = await this.orgsService.findById(client.organisationId).catch(() => null);
    if (!org || !org.isActive) return null;
    if (org.plan === 'trial' && org.trialEndsAt && org.trialEndsAt < new Date()) return null;

    if (!client.lastUsedAt || Date.now() - client.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
      await this.clientRepo.update({ id: client.id, revokedAt: IsNull() }, { lastUsedAt: new Date() });
    }

    return { orgId: client.organisationId, clientId: client.id, scopes: client.scopes, createdBy: client.createdBy };
  }

  private toDto(c: ApiClient): ApiClientDto {
    return {
      id: c.id,
      name: c.name,
      keyPrefix: c.keyPrefix,
      scopes: c.scopes,
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      revokedAt: c.revokedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
