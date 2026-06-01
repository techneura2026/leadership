import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Plan } from '@leaderprism/shared';
import { User } from '../../users/entities/user.entity';
import { Department } from './department.entity';

@Entity('organisations')
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  slug: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'logo_url', nullable: true, type: 'text' })
  logoUrl: string | null;

  @Column({ name: 'primary_colour', length: 7, default: '#1E40AF' })
  primaryColour: string;

  @Column({ type: 'varchar', name: 'branding_name', length: 255, nullable: true })
  brandingName: string | null;

  @Column({ type: 'varchar', length: 50, default: Plan.TRIAL })
  plan: Plan;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ name: 'plan_expires_at', type: 'timestamptz', nullable: true })
  planExpiresAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => User, (user) => user.organisation)
  users: User[];

  @OneToMany(() => Department, (dept) => dept.organisation)
  departments: Department[];
}
