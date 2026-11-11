import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_deliveries')
@Index(['organisationId', 'createdAt'])
@Index(['endpointId'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'endpoint_id', type: 'uuid' })
  endpointId: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @Column({ length: 100 })
  event: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'succeeded' | 'failed';

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'last_status_code', type: 'int', nullable: true })
  lastStatusCode: number | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
