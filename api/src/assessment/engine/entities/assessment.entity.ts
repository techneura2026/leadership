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
import { AssessmentStatus, AssessmentType } from '@leaderprism/shared';
import type { AssessmentConfig } from '@leaderprism/shared';
import { Organisation } from '../../../core/organisations/entities/organisation.entity';
import { User } from '../../../core/users/entities/user.entity';
import { AssessmentParticipant } from './assessment-participant.entity';

@Entity('assessments')
@Index(['organisationId'])
@Index(['status'])
@Index(['assessmentType'])
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'assessment_type', type: 'varchar', length: 50 })
  assessmentType: AssessmentType;

  @Column({ type: 'varchar', length: 50, default: AssessmentStatus.DRAFT })
  status: AssessmentStatus;

  @Column({ type: 'jsonb', default: {} })
  config: AssessmentConfig;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AssessmentParticipant, (p) => p.assessment)
  participants: AssessmentParticipant[];
}
