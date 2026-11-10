import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Final calibrated performance score sent by the HRIS per employee and review cycle (9-box performance axis). */
@Entity('external_performance_scores')
@Unique(['organisationId', 'userId', 'cycleRef'])
@Index(['organisationId', 'userId'])
export class ExternalPerformanceScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'cycle_ref', length: 100 })
  cycleRef: string;

  @Column({ name: 'final_score', type: 'numeric', precision: 5, scale: 2 })
  finalScore: number;

  @Column({ name: 'rating_band', type: 'varchar', length: 50, nullable: true })
  ratingBand: string | null;

  @Column({ name: 'finalised_at', type: 'timestamptz' })
  finalisedAt: Date;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
