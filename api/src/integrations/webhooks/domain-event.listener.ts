import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AssessmentEventPayload,
  DomainEvent,
  DomainEventBus,
  ReadinessComputedPayload,
  ReportReadyPayload,
  ResultsReadyPayload,
} from '../../shared/events/domain-events';
import { OrganisationsService } from '../../core/organisations/organisations.service';
import { UsersService } from '../../core/users/users.service';
import { WebhooksService } from './webhooks.service';

/** Turns domain events into spec §6 webhook bodies for subscribed HRIS endpoints. */
@Injectable()
export class DomainEventListener implements OnModuleInit {
  private readonly logger = new Logger(DomainEventListener.name);

  constructor(
    private readonly bus: DomainEventBus,
    private readonly webhooks: WebhooksService,
    private readonly users: UsersService,
    private readonly orgs: OrganisationsService,
  ) {}

  onModuleInit(): void {
    for (const event of [DomainEvent.AssessmentLaunched, DomainEvent.AssessmentClosed]) {
      this.bus.on(event, (p: AssessmentEventPayload) =>
        this.forward(p.orgId, event, async (orgRef) => ({
          event,
          orgRef,
          cycleRef: p.cycleRef,
          assessmentId: p.assessmentId,
          assessmentType: p.assessmentType,
          employeeRefs: await this.refs(p.orgId, p.participantUserIds),
          occurredAt: p.occurredAt,
        })),
      );
    }
    for (const event of [DomainEvent.ResultsReady, DomainEvent.ReadinessComputed]) {
      this.bus.on(event, (p: ResultsReadyPayload | ReadinessComputedPayload) =>
        this.forward(p.orgId, event, async (orgRef) => ({
          event,
          orgRef,
          cycleRef: p.cycleRef,
          assessmentId: p.assessmentId,
          employeeRefs: await this.refs(p.orgId, [p.userId]),
          occurredAt: p.occurredAt,
        })),
      );
    }
    this.bus.on(DomainEvent.ReportReady, (p: ReportReadyPayload) =>
      this.forward(p.orgId, DomainEvent.ReportReady, async (orgRef) => ({
        event: DomainEvent.ReportReady,
        orgRef,
        reportId: p.reportId,
        assessmentId: p.assessmentId,
        reportType: p.reportType,
        employeeRef: p.participantUserId ? ((await this.refs(p.orgId, [p.participantUserId]))[0] ?? null) : null,
        occurredAt: p.occurredAt,
      })),
    );
  }

  /** orgRef is the organisation's HRIS reference, falling back to its LeaderPrism slug. */
  async orgRef(orgId: string): Promise<string> {
    const org = await this.orgs.findById(orgId);
    return org.externalRef ?? org.slug;
  }

  private async forward(orgId: string, event: string, build: (orgRef: string) => Promise<Record<string, unknown>>) {
    if (!(await this.webhooks.hasSubscribers(orgId, event))) return;
    const body = await build(await this.orgRef(orgId));
    const count = await this.webhooks.enqueue(orgId, event, body);
    this.logger.log(`Queued ${event} for ${count} endpoint(s) org=${orgId}`);
  }

  private async refs(orgId: string, userIds: string[]): Promise<string[]> {
    const map = await this.users.getExternalRefs(orgId, userIds);
    return userIds.map((id) => map.get(id)).filter((r): r is string => !!r);
  }
}
