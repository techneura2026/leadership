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
import { Competency } from './competency.entity';

@Entity('competency_levels')
@Unique(['competencyId', 'level'])
@Index(['competencyId'])
export class CompetencyLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @ManyToOne(() => Competency, (c) => c.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competency_id' })
  competency: Competency;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ length: 100 })
  label: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  indicators: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
