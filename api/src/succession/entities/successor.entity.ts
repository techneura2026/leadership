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
import { User } from '../../core/users/entities/user.entity';
import { KeyRole } from './key-role.entity';

@Entity('successors')
@Unique(['keyRoleId', 'candidateUserId'])
@Index(['keyRoleId'])
export class Successor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'key_role_id' })
  keyRoleId: string;

  @ManyToOne(() => KeyRole, (kr) => kr.successors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'key_role_id' })
  keyRole: KeyRole;

  @Column({ name: 'candidate_user_id', type: 'uuid', nullable: true })
  candidateUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'candidate_user_id' })
  candidate: User | null;

  @Column({ name: 'nominated_by_id', type: 'uuid', nullable: true })
  nominatedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'nominated_by_id' })
  nominatedBy: User | null;

  @CreateDateColumn({ name: 'nominated_at' })
  nominatedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
