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
import { ReportType } from '@leaderprism/shared';
import { Organisation } from '../core/organisations/entities/organisation.entity';
import { Assessment } from '../assessment/engine/entities/assessment.entity';
import { AssessmentParticipant } from '../assessment/engine/entities/assessment-participant.entity';
import { User } from '../core/users/entities/user.entity';

@Entity('reports')
@Index(['organisationId'])
@Index(['assessmentId'])
@Index(['status'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @ManyToOne(() => Assessment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Assessment;

  @Column({ name: 'participant_id', type: 'uuid', nullable: true })
  participantId: string | null;

  @ManyToOne(() => AssessmentParticipant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'participant_id' })
  participant: AssessmentParticipant | null;

  @Column({ name: 'report_type', type: 'varchar', length: 50 })
  reportType: ReportType;

  @Column({ name: 'blob_url', type: 'text', nullable: true })
  blobUrl: string | null;

  @Column({ name: 'local_path', type: 'text', nullable: true })
  localPath: string | null;

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'processing' | 'ready' | 'failed';

  @Column({ length: 2, default: 'en' })
  language: string;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'generated_by' })
  generatedByUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
