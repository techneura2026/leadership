import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RaterNomination } from './rater-nomination.entity';
import { Competency } from '../../items/entities/competency.entity';

@Entity('rater_responses')
@Index(['nominationId'])
@Index(['competencyId'])
export class RaterResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nomination_id' })
  nominationId: string;

  @ManyToOne(() => RaterNomination, (n) => n.responses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nomination_id' })
  nomination: RaterNomination;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @ManyToOne(() => Competency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competency_id' })
  competency: Competency;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  score: number | null;

  @Column({ name: 'open_text', type: 'text', nullable: true })
  openText: string | null;

  @Column({ name: 'behaviour_scores', type: 'jsonb', nullable: true })
  behaviourScores: Array<{ behaviourId: string; score: number }> | null;

  @CreateDateColumn({ name: 'responded_at' })
  respondedAt: Date;
}
