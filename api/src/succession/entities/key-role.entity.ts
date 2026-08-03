import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { Department } from '../../core/organisations/entities/department.entity';
import { User } from '../../core/users/entities/user.entity';
import { Successor } from './successor.entity';

@Entity('key_roles')
@Index(['organisationId'])
export class KeyRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  criticality: 'critical' | 'high' | 'medium';

  @Column({ name: 'incumbent_id', type: 'uuid', nullable: true })
  incumbentId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'incumbent_id' })
  incumbent: User | null;

  @Column({ name: 'incumbent_since', type: 'date', nullable: true })
  incumbentSince: string | null;

  @Column({ name: 'flight_risk', type: 'varchar', length: 20, default: 'medium' })
  flightRisk: 'high' | 'medium' | 'low';

  @OneToMany(() => Successor, (s) => s.keyRole)
  successors: Successor[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
