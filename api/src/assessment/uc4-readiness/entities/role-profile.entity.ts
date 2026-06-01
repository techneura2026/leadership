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
import { Organisation } from '../../../core/organisations/entities/organisation.entity';

interface RequiredCompetency {
  competencyId: string;
  minLevel: number;  // 1-4
  weight: number;    // proportion, e.g. 0.1 (all should sum to 1)
}

interface PersonalityFitRequirement {
  factor: string;
  minTScore?: number;
  maxTScore?: number;
  idealTScore?: number;
  weight: number;
}

@Entity('role_profiles')
@Index(['organisationId'])
export class RoleProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  level: string | null;

  @Column({ name: 'required_competencies', type: 'jsonb', default: [] })
  requiredCompetencies: RequiredCompetency[];

  @Column({ name: 'personality_fit', type: 'jsonb', default: {} })
  personalityFit: Record<string, PersonalityFitRequirement>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
