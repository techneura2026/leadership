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

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;
}
