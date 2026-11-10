import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { WebhookEndpoint } from './webhook-endpoint.entity';
import { WebhookDelivery } from './webhook-delivery.entity';
import { lookup as dnsLookup } from 'dns/promises';
import { checkDeliveryTarget, decryptSecret, encryptSecret, signPayload, validateWebhookUrl } from './webhook-signing';

export const WEBHOOK_EVENTS = [
  'assessment.launched',
  'assessment.closed',
  'results.ready',
  'report.ready',
  'readiness.computed',
] as const;

export const WEBHOOK_QUEUE = 'webhooks';
const DELIVERY_ATTEMPTS = 6;
const DELIVERY_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookEndpoint) private readonly endpoints: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookDelivery) private readonly deliveries: Repository<WebhookDelivery>,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async create(orgId: string, dto: { url: string; events: string[] }) {
    const urlError = validateWebhookUrl(dto.url, this.config.get('NODE_ENV') === 'production');
    if (urlError) throw new BadRequestException(urlError);
    const unknown = dto.events.filter((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (unknown.length || dto.events.length === 0) {
      throw new BadRequestException(`events must be a non-empty subset of: ${WEBHOOK_EVENTS.join(', ')}`);
    }
    const secret = `whsec_${randomBytes(32).toString('base64url')}`;
    const saved = await this.endpoints.save(
      this.endpoints.create({
        organisationId: orgId,
        url: dto.url,
        events: [...new Set(dto.events)],
        secretEncrypted: encryptSecret(secret, this.encryptionKey()),
      }),
    );
    this.logger.log(`Created webhook endpoint ${saved.id} org=${orgId} events=${saved.events.join(',')}`);
    return { id: saved.id, url: saved.url, events: saved.events, isActive: saved.isActive, createdAt: saved.createdAt, secret };
  }

  async list(orgId: string) {
    const rows = await this.endpoints.find({ where: { organisationId: orgId }, order: { createdAt: 'DESC' } });
    return rows.map((e) => ({ id: e.id, url: e.url, events: e.events, isActive: e.isActive, createdAt: e.createdAt }));
  }

  async remove(orgId: string, id: string): Promise<void> {
    const res = await this.endpoints.delete({ id, organisationId: orgId });
    if (!res.affected) throw new NotFoundException('Webhook endpoint not found');
  }

  async listDeliveries(orgId: string, limit: number) {
    return this.deliveries.find({
      where: { organisationId: orgId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Sends a `ping` to one endpoint. */
  async sendTest(orgId: string, id: string, orgRef: string): Promise<{ deliveryId: string }> {
    const endpoint = await this.endpoints.findOne({ where: { id, organisationId: orgId } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    const deliveryId = await this.enqueueFor(endpoint, 'ping', { event: 'ping', orgRef, occurredAt: new Date().toISOString() });
    return { deliveryId };
  }

  /** Queues a delivery to every active endpoint of the organisation subscribed to `event`. */
  async enqueue(orgId: string, event: string, body: Record<string, unknown>): Promise<number> {
    const targets = (await this.endpoints.find({ where: { organisationId: orgId, isActive: true } })).filter((e) =>
      e.events.includes(event),
    );
    for (const endpoint of targets) await this.enqueueFor(endpoint, event, body);
    return targets.length;
  }

  async hasSubscribers(orgId: string, event: string): Promise<boolean> {
    const rows = await this.endpoints.find({ where: { organisationId: orgId, isActive: true }, select: ['id', 'events'] });
    return rows.some((e) => e.events.includes(event));
  }

  /**
   * One delivery attempt (called by the BullMQ worker). Throws on a non-2xx answer so BullMQ
   * retries with backoff; the final failed attempt marks the delivery `failed` instead.
   */
  async deliver(deliveryId: string, isFinalAttempt: boolean): Promise<void> {
    const delivery = await this.deliveries.findOne({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== 'pending') return;
    const endpoint = await this.endpoints
      .createQueryBuilder('e')
      .addSelect('e.secretEncrypted')
      .where('e.id = :id', { id: delivery.endpointId })
      .getOne();
    if (!endpoint || !endpoint.isActive) {
      await this.deliveries.update({ id: delivery.id }, { status: 'failed', lastError: 'Endpoint removed or inactive' });
      return;
    }

    const blocked = await checkDeliveryTarget(endpoint.url, this.config.get('NODE_ENV') === 'production', (host) =>
      dnsLookup(host, { all: true }),
    );
    if (blocked) {
      // Not retried: the target is refused, not temporarily unreachable.
      await this.deliveries.update({ id: delivery.id }, { status: 'failed', attempts: delivery.attempts + 1, lastError: blocked });
      this.logger.warn(`Webhook delivery ${delivery.id} refused: ${blocked}`);
      return;
    }

    const rawBody = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(decryptSecret(endpoint.secretEncrypted, this.encryptionKey()), timestamp, rawBody);

    let statusCode: number | null = null;
    let error: string | null = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LeaderPrism-Webhooks/1.0',
          'X-LeaderPrism-Event': delivery.event,
          'X-LeaderPrism-Delivery': delivery.id,
          'X-LeaderPrism-Timestamp': String(timestamp),
          'X-LeaderPrism-Signature': `sha256=${signature}`,
        },
        body: rawBody,
        signal: controller.signal,
        redirect: 'manual',
      });
      statusCode = res.status;
      if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
    } catch (err: any) {
      error = err?.name === 'AbortError' ? 'Timed out' : (err?.message ?? 'Request failed');
    } finally {
      clearTimeout(timer);
    }

    const attempts = delivery.attempts + 1;
    if (!error) {
      await this.deliveries.update({ id: delivery.id }, { status: 'succeeded', attempts, lastStatusCode: statusCode, lastError: null, deliveredAt: new Date() });
      return;
    }
    await this.deliveries.update(
      { id: delivery.id },
      { status: isFinalAttempt ? 'failed' : 'pending', attempts, lastStatusCode: statusCode, lastError: error },
    );
    if (!isFinalAttempt) throw new Error(`Webhook delivery ${delivery.id} failed: ${error}`);
    this.logger.warn(`Webhook delivery ${delivery.id} gave up after ${attempts} attempts: ${error}`);
  }

  private async enqueueFor(endpoint: WebhookEndpoint, event: string, body: Record<string, unknown>): Promise<string> {
    const delivery = await this.deliveries.save(
      this.deliveries.create({ endpointId: endpoint.id, organisationId: endpoint.organisationId, event, payload: body }),
    );
    await this.queue.add(
      'deliver',
      { deliveryId: delivery.id },
      { attempts: DELIVERY_ATTEMPTS, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: true, removeOnFail: 1000 },
    );
    return delivery.id;
  }

  private encryptionKey(): string {
    return this.config.getOrThrow<string>('INTEGRATION_ENCRYPTION_KEY');
  }
}
