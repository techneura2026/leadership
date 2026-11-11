import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_endpoints')
@Index(['organisationId'])
export class WebhookEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @Column({ type: 'text' })
  url: string;

  /** AES-256-GCM encrypted (INTEGRATION_ENCRYPTION_KEY) — needed in clear to sign deliveries. */
  @Column({ name: 'secret_encrypted', type: 'text', select: false })
  secretEncrypted: string;

  @Column({ type: 'text', array: true })
  events: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
