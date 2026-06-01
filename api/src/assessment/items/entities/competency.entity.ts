import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from '../../../core/organisations/entities/organisation.entity';
import { CompetencyDomain } from './competency-domain.entity';
import { CompetencyLevel } from './competency-level.entity';
import { CompetencyBehaviour } from './competency-behaviour.entity';

@Entity('competencies')
@Index(['organisationId'])
@Index(['domainId'])
export class Competency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  organisationId: string | null;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation | null;

  @Column({ name: 'domain_id' })
  domainId: string;

  @ManyToOne(() => CompetencyDomain, (d) => d.competencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: CompetencyDomain;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CompetencyLevel, (l) => l.competency)
  levels: CompetencyLevel[];

  @OneToMany(() => CompetencyBehaviour, (b) => b.competency)
  behaviours: CompetencyBehaviour[];
}
