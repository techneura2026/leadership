import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { EventEmitter } from 'events';

/**
 * In-process domain events. Core modules publish; integrations (webhooks) subscribe — so core
 * modules never import the integrations module. Listeners run asynchronously and their failures
 * are logged, never propagated to the request that emitted the event.
 */
export const DomainEvent = {
  AssessmentLaunched: 'assessment.launched',
  AssessmentClosed: 'assessment.closed',
  ResultsReady: 'results.ready',
  ReportReady: 'report.ready',
  ReadinessComputed: 'readiness.computed',
} as const;

export type DomainEventName = (typeof DomainEvent)[keyof typeof DomainEvent];

export interface AssessmentEventPayload {
  orgId: string;
  assessmentId: string;
  assessmentType: string;
  cycleRef: string | null;
  participantUserIds: string[];
  occurredAt: string;
}

export interface ResultsReadyPayload {
  orgId: string;
  assessmentId: string;
  cycleRef: string | null;
  userId: string;
  occurredAt: string;
}

export interface ReportReadyPayload {
  orgId: string;
  reportId: string;
  assessmentId: string;
  participantUserId: string | null;
  reportType: string;
  occurredAt: string;
}

export interface ReadinessComputedPayload {
  orgId: string;
  assessmentId: string;
  cycleRef: string | null;
  userId: string;
  occurredAt: string;
}

type Handler = (payload: any) => unknown | Promise<unknown>;

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  on(name: DomainEventName, handler: Handler): void {
    this.emitter.on(name, (payload) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => this.logger.error(`Listener for ${name} failed: ${err?.message ?? err}`));
    });
  }

  /** Publish after the triggering write has been saved. */
  emit(name: DomainEventName, payload: object): void {
    try {
      this.emitter.emit(name, payload);
    } catch (err: any) {
      this.logger.error(`Emitting ${name} failed: ${err?.message ?? err}`);
    }
  }
}

@Global()
@Module({ providers: [DomainEventBus], exports: [DomainEventBus] })
export class DomainEventsModule {}
