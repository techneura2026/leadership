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
import { Assessment } from '../../engine/entities/assessment.entity';
import { AssessmentParticipant } from '../../engine/entities/assessment-participant.entity';
import { User } from '../../../core/users/entities/user.entity';
import { CompetencyRating } from './competency-rating.entity';

@Entity('competency_assessments')
@Unique(['assessmentId', 'participantId', 'assessorId', 'assessorType'])
@Index(['assessmentId'])
@Index(['participantId'])
@Index(['assessorId'])
export class CompetencyAssessment {
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

  @Column({ name: 'assessor_id' })
  assessorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assessor_id' })
  assessor: User;

  @Column({ name: 'assessor_type', length: 20, default: 'self' })
  assessorType: 'self' | 'manager';

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CompetencyRating, (r) => r.competencyAssessment)
  ratings: CompetencyRating[];
}
