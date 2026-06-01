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
import { Assessment } from '../../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../../engine/entities/assessment-participant.entity';

@Entity('personality_scores')
@Unique(['assessmentId', 'participantId', 'factor'])
@Index(['assessmentId'])
@Index(['participantId'])
export class PersonalityScore {
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

  @Column({ length: 100 })
  factor: string;

  @Column({ name: 'raw_score', type: 'decimal', precision: 6, scale: 2 })
  rawScore: number;

  @Column({ name: 't_score', type: 'decimal', precision: 5, scale: 2 })
  tScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentile: number;

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;
}
