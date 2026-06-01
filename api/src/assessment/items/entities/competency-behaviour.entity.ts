import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Competency } from './competency.entity';

@Entity('competency_behaviours')
@Index(['competencyId'])
export class CompetencyBehaviour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @ManyToOne(() => Competency, (c) => c.behaviours, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competency_id' })
  competency: Competency;

  @Column({ type: 'text' })
  statement: string;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
