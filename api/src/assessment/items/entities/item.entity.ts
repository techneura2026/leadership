import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from '../../../core/organisations/entities/organisation.entity';

@Entity('items')
@Index(['organisationId'])
@Index(['module'])
@Index(['factor'])
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId: string | null;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation | null;

  @Column({ name: 'item_type', length: 50 })
  itemType: string; // 'likert' | 'sjt' | 'la' | 'open'

  @Column({ length: 50 })
  module: string; // 'personality' | 'sjt' | 'learning_agility'

  @Column({ type: 'varchar', length: 100, nullable: true })
  factor: string | null;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'jsonb', nullable: true })
  options: Array<{ value: number; label: string }> | null;

  @Column({ name: 'scoring_key', type: 'jsonb', nullable: true })
  scoringKey: Record<string, number> | null;

  @Column({ name: 'is_reverse', default: false })
  isReverse: boolean;

  @Column({ length: 2, default: 'en' })
  language: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
