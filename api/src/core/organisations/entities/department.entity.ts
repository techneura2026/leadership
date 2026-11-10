import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';

@Entity('departments')
@Index(['organisationId'])
@Index('UQ_departments_org_external_ref', ['organisationId', 'externalRef'], { unique: true, where: '"external_ref" IS NOT NULL' })
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id' })
  organisationId: string;

  @ManyToOne(() => Organisation, (org) => org.departments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'parent_id', nullable: true, type: 'uuid' })
  parentId: string | null;

  @ManyToOne(() => Department, (dept) => dept.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Department | null;

  @OneToMany(() => Department, (dept) => dept.parent)
  children: Department[];

  /** HRIS department reference (departmentRef). Unique per organisation when set. */
  @Column({ name: 'external_ref', type: 'varchar', length: 100, nullable: true })
  externalRef: string | null;

  @Column({ name: 'hris_managed', default: false })
  hrisManaged: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
