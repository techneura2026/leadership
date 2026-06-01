import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('normative_data')
@Unique(['factor', 'population'])
export class NormativeDatum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  factor: string;

  @Column({ length: 100 })
  population: string;

  @Column({ name: 'sample_size' })
  sampleSize: number;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  mean: number;

  @Column({ name: 'std_dev', type: 'decimal', precision: 6, scale: 2 })
  stdDev: number;

  @Column({ name: 'percentile_table', type: 'jsonb', default: {} })
  percentileTable: Record<string, number>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
