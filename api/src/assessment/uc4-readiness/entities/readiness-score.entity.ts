import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ReadinessRating } from '@leaderprism/shared';
import { Assessment } from '../../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../../engine/entities/assessment-participant.entity';
import { RoleProfile } from './role-profile.entity';
import { User } from '../../../core/users/entities/user.entity';

@Entity('readiness_scores')
@Unique(['assessmentId', 'participantId', 'roleProfileId'])
@Index(['assessmentId'])
@Index(['participantId'])
export class ReadinessScore {
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

  @Column({ name: 'role_profile_id', type: 'uuid', nullable: true })
  roleProfileId: string | null;

  @ManyToOne(() => RoleProfile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'role_profile_id' })
  roleProfile: RoleProfile | null;

  @Column({ name: 'readiness_rating', type: 'varchar', length: 50 })
  readinessRating: ReadinessRating;

  @Column({ name: 'composite_score', type: 'decimal', precision: 5, scale: 2 })
  compositeScore: number;

  @Column({ name: 'competency_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  competencyScore: number;

  @Column({ name: 'feedback_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  feedbackScore: number;

  @Column({ name: 'sjt_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  sjtScore: number;

  @Column({ name: 'learning_agility_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  learningAgilityScore: number;

  @Column({ name: 'personality_fit_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  personalityFitScore: number;

  @Column({ name: 'grid_performance', length: 20, default: 'medium' })
  gridPerformance: 'high' | 'medium' | 'low';

  @Column({ name: 'grid_potential', length: 20, default: 'medium' })
  gridPotential: 'high' | 'medium' | 'low';

  @Column({ name: 'manual_grid_performance', type: 'varchar', length: 20, nullable: true })
  manualGridPerformance: 'high' | 'medium' | 'low' | null;

  @Column({ name: 'manual_performance_note', type: 'text', nullable: true })
  manualPerformanceNote: string | null;

  @Column({ name: 'manual_performance_set_by_id', type: 'uuid', nullable: true })
  manualPerformanceSetById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'manual_performance_set_by_id' })
  manualPerformanceSetBy: User | null;

  @Column({ name: 'manual_performance_set_at', type: 'timestamptz', nullable: true })
  manualPerformanceSetAt: Date | null;

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;
}

/** Single source of truth for "what performance placement should the 9-box actually use" — every consumer (dashboard, succession candidates, PDF exports) imports this instead of duplicating the `??` fallback. */
export function effectiveGridPerformance(
  s: Pick<ReadinessScore, 'gridPerformance' | 'manualGridPerformance'>,
): 'high' | 'medium' | 'low' {
  return s.manualGridPerformance ?? s.gridPerformance;
}
