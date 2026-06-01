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
import { Item } from '../../items/entities/item.entity';

@Entity('sjt_responses')
@Unique(['assessmentId', 'participantId', 'itemId'])
@Index(['assessmentId'])
@Index(['participantId'])
export class SjtResponse {
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

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'selected_option', type: 'smallint' })
  selectedOption: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  score: number;

  @CreateDateColumn({ name: 'responded_at' })
  respondedAt: Date;
}
