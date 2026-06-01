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
import { CompetencyAssessment } from './competency-assessment.entity';
import { Competency } from '../../items/entities/competency.entity';

@Entity('competency_ratings')
@Unique(['caId', 'competencyId'])
@Index(['caId'])
@Index(['competencyId'])
export class CompetencyRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ca_id' })
  caId: string;

  @ManyToOne(() => CompetencyAssessment, (ca) => ca.ratings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ca_id' })
  competencyAssessment: CompetencyAssessment;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @ManyToOne(() => Competency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competency_id' })
  competency: Competency;

  @Column({ name: 'level_rated', type: 'smallint' })
  levelRated: number;

  @Column({ name: 'evidence_text', type: 'text', nullable: true })
  evidenceText: string | null;

  @Column({ name: 'development_comment', type: 'text', nullable: true })
  developmentComment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
