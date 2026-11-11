import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { IntegrationScope } from '@leaderprism/shared';

/** A machine credential an organisation issues to its HRIS. */
@Entity('api_clients')
@Index(['organisationId'])
export class ApiClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'key_prefix', type: 'char', length: 8, unique: true })
  keyPrefix: string;

  @Column({ name: 'secret_hash', type: 'char', length: 64, select: false })
  secretHash: string;

  @Column({ type: 'text', array: true })
  scopes: IntegrationScope[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
