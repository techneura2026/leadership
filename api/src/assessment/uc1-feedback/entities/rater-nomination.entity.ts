import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RaterRelationship } from '@leaderprism/shared';
import { Assessment } from '../../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../../engine/entities/assessment-participant.entity';
import { User } from '../../../core/users/entities/user.entity';
import { RaterResponse } from './rater-response.entity';

@Entity('rater_nominations')
@Index(['assessmentId'])
@Index(['participantId'])
@Index(['token'])
export class RaterNomination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @ManyToOne(() => Assessment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Assessment;

  @Column({ name: 'participant_id' })
  participantId: string;

  @ManyToOne(() => AssessmentParticipant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant: AssessmentParticipant;

  @Column({ name: 'rater_email', length: 255 })
  raterEmail: string;

  @Column({ type: 'varchar', name: 'rater_name', length: 255, nullable: true })
  raterName: string | null;

  @Column({ type: 'varchar', length: 50 })
  relationship: RaterRelationship;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  token: string;

  @Column({ name: 'token_expires', type: 'timestamptz', nullable: true })
  tokenExpires: Date | null;

  @Column({ length: 50, default: 'pending' })
  status: string; // pending | approved | sent | completed | declined

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;

  @Column({ name: 'overall_rating', type: 'smallint', nullable: true })
  overallRating: number | null;

  @Column({ name: 'development_comment', type: 'text', nullable: true })
  developmentComment: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RaterResponse, (r) => r.nomination)
  responses: RaterResponse[];
}
