import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../core/users/entities/user.entity';
import { Assessment } from './assessment.entity';

@Entity('assessment_participants')
@Unique(['assessmentId', 'userId'])
@Index(['assessmentId'])
@Index(['userId'])
export class AssessmentParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @ManyToOne(() => Assessment, (a) => a.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Assessment;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'target_role_id', type: 'uuid', nullable: true })
  targetRoleId: string | null;

  @Column({ length: 50, default: 'invited' })
  status: string; // invited | in_progress | completed | withdrawn

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
