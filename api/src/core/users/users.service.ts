import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { Language, UserRole } from '@leaderprism/shared';
import type { SyncRowResult } from '@leaderprism/shared';

/** HRIS employee row with departmentRef already resolved by the caller. */
export interface EmployeeUpsertRow {
  employeeRef: string;
  email: string;
  firstName: string;
  lastName: string;
  /** undefined = leave unchanged; null = clear. */
  departmentId?: string | null;
  managerRef?: string | null;
  designationRef?: string | null;
  jobTitle?: string | null;
  employmentStatus: 'active' | 'probation' | 'left';
  language?: Language;
  role?: UserRole;
  /** Warnings collected while pre-resolving the row (e.g. department_not_found). */
  warnings?: string[];
}

/** Roles an HRIS sync must never change. */
const PROTECTED_ROLES: UserRole[] = [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN];

/** Unambiguous charset (no 0/O/1/I/l) — generated passwords are read aloud/typed by admins relaying them. */
const PASSWORD_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

export function generateSecurePassword(length = 14): string {
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARSET[bytes[i] % PASSWORD_CHARSET.length];
  }
  return password;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .andWhere('u.isActive = true')
      .getOne();
  }

  /** Includes deactivated users — only for login, so we can tell a wrong password apart from a deactivated account. */
  async findByEmailIncludingInactive(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findById(id: string, organisationId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id, organisationId },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Used internally (e.g. refresh token flow) where orgId is not yet known
  async findByIdInternal(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, isActive: true } });
  }

  async create(data: {
    organisationId: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    jobTitle?: string;
    departmentId?: string;
    managerId?: string;
    avatarUrl?: string;
    /** True for admin-invited users — forces a password change before they can use the app. False for self-registration (the org admin already knows the password they just chose). */
    mustChangePassword?: boolean;
  }): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: { organisationId: data.organisationId, email: data.email.toLowerCase() },
      withDeleted: true,
    });
    if (existing) throw new ConflictException('Email already in use within this organisation');

    if (data.managerId) {
      await this.assertManagerAssignmentValid(null, data.managerId, data.organisationId);
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    const passwordHash = await bcrypt.hash(data.password, rounds);
    const user = this.userRepo.create({
      ...data,
      email: data.email.toLowerCase(),
      passwordHash,
      emailVerified: true,
      mustChangePassword: data.mustChangePassword ?? false,
    });
    return this.userRepo.save(user);
  }

  async update(
    id: string,
    organisationId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      role: UserRole;
      jobTitle: string | null;
      departmentId: string | null;
      managerId: string | null;
      isActive: boolean;
      avatarUrl: string | null;
    }>,
  ): Promise<User> {
    const user = await this.findById(id, organisationId);

    if (data.managerId) {
      await this.assertManagerAssignmentValid(id, data.managerId, organisationId);
    }

    Object.assign(user, data);
    return this.userRepo.save(user);
  }

  /**
   * Guards against a manager assignment that would create a cycle (A manages B manages A).
   * Walks the proposed manager's existing chain and rejects if it loops back to the user
   * being updated. `userId` is null when creating a brand-new user — no existing chain to
   * loop back into, so only the proposed manager's existence/org membership is checked.
   */
  private async assertManagerAssignmentValid(
    userId: string | null,
    proposedManagerId: string,
    organisationId: string,
  ): Promise<void> {
    if (userId && proposedManagerId === userId) {
      throw new BadRequestException('A user cannot be their own manager.');
    }

    const manager = await this.userRepo.findOne({
      where: { id: proposedManagerId, organisationId },
    });
    if (!manager) {
      throw new NotFoundException('Proposed manager not found in this organisation.');
    }

    if (!userId) return;

    let cursor: string | null = manager.managerId;
    let hops = 0;
    const MAX_HOPS = 100; // defensive bound against runaway loops on already-corrupt data
    while (cursor && hops < MAX_HOPS) {
      if (cursor === userId) {
        throw new BadRequestException('This assignment would create a management cycle.');
      }
      const next: Pick<User, 'managerId'> | null = await this.userRepo.findOne({
        where: { id: cursor },
        select: ['id', 'managerId'],
      });
      cursor = next?.managerId ?? null;
      hops++;
    }
  }

  /**
   * HRIS employee sync, in one transaction. Matching order: externalRef → same email with no
   * externalRef (linked) → create. Pass 2 resolves managerRef against the org plus the batch.
   * Rows that would form a management cycle are rejected before anything is written.
   * `departmentId` is pre-resolved by the caller (undefined = leave unchanged).
   */
  async upsertEmployeesByRef(
    organisationId: string,
    rows: EmployeeUpsertRow[],
    opts: { fullSync: boolean },
  ): Promise<SyncRowResult[]> {
    return this.userRepo.manager.transaction(async (em) => {
      const repo = em.getRepository(User);
      const sessions = em.getRepository(Session);
      const all = await repo.find({ where: { organisationId }, withDeleted: true });
      const live = all.filter((u) => !u.deletedAt);
      const byRef = new Map(live.filter((u) => u.externalRef).map((u) => [u.externalRef as string, u]));
      const byId = new Map(live.map((u) => [u.id, u]));
      const byEmail = new Map(all.map((u) => [u.email.toLowerCase(), u]));

      const batchManager = new Map(rows.map((r) => [r.employeeRef, r.managerRef]));
      const managerRefOf = (ref: string): string | null => {
        const proposed = batchManager.get(ref);
        if (proposed !== undefined) return proposed;
        const u = byRef.get(ref);
        const m = u?.managerId ? byId.get(u.managerId) : undefined;
        return m?.externalRef ?? null;
      };
      const inCycle = (ref: string): boolean => {
        let cur = managerRefOf(ref);
        for (let i = 0; cur && i <= rows.length + live.length; i++) {
          if (cur === ref) return true;
          cur = managerRefOf(cur);
        }
        return false;
      };

      const snapshot = (u: User) =>
        JSON.stringify([u.email, u.firstName, u.lastName, u.departmentId, u.managerId, u.jobTitle, u.designationRef,
          u.employmentStatus, u.isActive, u.languagePref, u.role, u.externalRef, u.hrisManaged]);

      const results: SyncRowResult[] = [];
      const before = new Map<string, string>();
      const touched: User[] = [];
      const deactivated = new Set<string>();

      // Pass 1 — identity fields.
      for (const row of rows) {
        const email = row.email.toLowerCase();
        const warnings = [...(row.warnings ?? [])];
        if (inCycle(row.employeeRef)) {
          results.push({ ref: row.employeeRef, status: 'error', error: 'manager_cycle' });
          continue;
        }

        let user = byRef.get(row.employeeRef);
        const emailOwner = byEmail.get(email);
        if (!user && emailOwner && !emailOwner.deletedAt && !emailOwner.externalRef) user = emailOwner; // link
        if (emailOwner && emailOwner !== user) {
          results.push({ ref: row.employeeRef, status: 'error', error: 'email_conflict' });
          continue;
        }

        const isNew = !user;
        if (!user) {
          const password = crypto.randomBytes(32).toString('base64url');
          user = repo.create({
            organisationId,
            // Unusable random password — HRIS users sign in through SSO (low cost factor: the secret is unguessable).
            passwordHash: await bcrypt.hash(password, 4),
            emailVerified: true,
            mustChangePassword: false,
            role: UserRole.PARTICIPANT,
          });
        } else {
          before.set(user.id, snapshot(user));
        }

        const wasActive = isNew ? true : user.isActive;
        user.externalRef = row.employeeRef;
        user.hrisManaged = true;
        user.email = email;
        user.firstName = row.firstName;
        user.lastName = row.lastName;
        if (row.departmentId !== undefined) user.departmentId = row.departmentId;
        if (row.jobTitle !== undefined) user.jobTitle = row.jobTitle;
        if (row.designationRef !== undefined) user.designationRef = row.designationRef;
        if (row.language) user.languagePref = row.language;
        user.employmentStatus = row.employmentStatus;
        user.isActive = row.employmentStatus !== 'left';
        if (row.role && !PROTECTED_ROLES.includes(user.role)) user.role = row.role;

        user = await repo.save(user);
        if (wasActive && !user.isActive) {
          await sessions.delete({ userId: user.id });
          deactivated.add(user.id);
        }
        byRef.set(row.employeeRef, user);
        byId.set(user.id, user);
        byEmail.set(email, user);
        touched.push(user);
        results.push({ ref: row.employeeRef, status: isNew ? 'created' : 'unchanged', id: user.id, ...(warnings.length ? { warnings } : {}) });
      }

      // Pass 2 — reporting lines.
      for (const [i, row] of rows.entries()) {
        const result = results[i];
        if (result.status === 'error' || row.managerRef === undefined) continue;
        const user = byRef.get(row.employeeRef)!;
        let managerId: string | null = null;
        if (row.managerRef !== null) {
          const manager = byRef.get(row.managerRef);
          if (manager) managerId = manager.id;
          else result.warnings = [...(result.warnings ?? []), 'manager_not_found'];
        }
        if (user.managerId !== managerId) {
          user.managerId = managerId;
          await repo.update({ id: user.id }, { managerId });
        }
      }

      // Participants who now have direct reports become managers (never demoted automatically).
      const managerIds = new Set([...byId.values()].filter((u) => u.isActive && u.managerId).map((u) => u.managerId));
      for (const user of touched) {
        if (user.role === UserRole.PARTICIPANT && managerIds.has(user.id)) {
          user.role = UserRole.MANAGER;
          await repo.update({ id: user.id }, { role: UserRole.MANAGER });
        }
      }

      for (const [i, row] of rows.entries()) {
        const result = results[i];
        if (result.status !== 'unchanged') continue;
        const user = byRef.get(row.employeeRef)!;
        if (before.get(user.id) !== snapshot(user)) result.status = 'updated';
      }

      if (opts.fullSync) {
        const seen = new Set(rows.map((r) => r.employeeRef));
        for (const user of live) {
          if (!user.hrisManaged || !user.isActive || !user.externalRef || seen.has(user.externalRef)) continue;
          await repo.update({ id: user.id }, { isActive: false, employmentStatus: 'left' });
          await sessions.delete({ userId: user.id });
          results.push({ ref: user.externalRef, status: 'updated', id: user.id, warnings: ['deactivated_missing_from_full_sync'] });
        }
      }

      return results;
    });
  }

  /** Users in the organisation with the given HRIS employeeRefs (unknown refs are absent). */
  async findByExternalRefs(organisationId: string, refs: string[]): Promise<User[]> {
    if (refs.length === 0) return [];
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.organisation_id = :organisationId', { organisationId })
      .andWhere('u.external_ref IN (:...refs)', { refs: [...new Set(refs)] })
      .getMany();
  }

  /** userId → employeeRef for users that have one. */
  async getExternalRefs(organisationId: string, userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const users = await this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .select(['u.id', 'u.externalRef'])
      .where('u.organisation_id = :organisationId', { organisationId })
      .andWhere('u.id IN (:...ids)', { ids: [...new Set(userIds)] })
      .andWhere('u.external_ref IS NOT NULL')
      .getMany();
    return new Map(users.map((u) => [u.id, u.externalRef as string]));
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepo.update(userId, { lastLoginAt: new Date() });
  }

  async createSession(data: {
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    // Refresh tokens are high-entropy uuidv4()s, not user-chosen secrets — a fast deterministic
    // hash (SHA-256) allows an indexed lookup by hash instead of the bcrypt-scan-every-row
    // anti-pattern this used to have (same reasoning as password reset tokens below).
    const session = this.sessionRepo.create({
      userId: data.userId,
      refreshTokenHash: this.hashToken(data.refreshToken),
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    });
    return this.sessionRepo.save(session);
  }

  async findSessionByToken(refreshToken: string): Promise<Session | null> {
    return this.sessionRepo
      .createQueryBuilder('s')
      .where('s.refreshTokenHash = :hash', { hash: this.hashToken(refreshToken) })
      .andWhere('s.expiresAt > NOW()')
      .getOne();
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionRepo.delete(id);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessionRepo.delete({ userId });
  }

  async findAll(
    organisationId: string,
    filters?: {
      page?: number;
      limit?: number;
      search?: string;
      departmentId?: string;
    },
  ): Promise<{ data: User[]; total: number; page: number; limit: number } | User[]> {
    if (!filters || (!filters.page && !filters.limit && !filters.search && !filters.departmentId)) {
      return this.userRepo.find({
        where: { organisationId },
        order: { isActive: 'DESC', firstName: 'ASC', lastName: 'ASC' },
      });
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const query = this.userRepo.createQueryBuilder('u')
      .where('u.organisationId = :organisationId', { organisationId })
      .orderBy('u.isActive', 'DESC')
      .addOrderBy('u.firstName', 'ASC')
      .addOrderBy('u.lastName', 'ASC');

    if (filters.search) {
      query.andWhere(
        '(LOWER(u.firstName) LIKE LOWER(:search) OR LOWER(u.lastName) LIKE LOWER(:search) OR LOWER(u.email) LIKE LOWER(:search))',
        { search: `%${filters.search.toLowerCase()}%` }
      );
    }

    if (filters.departmentId) {
      query.andWhere('u.departmentId = :departmentId', { departmentId: filters.departmentId });
    }

    const [data, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async hardDelete(id: string, organisationId: string): Promise<void> {
    const result = await this.userRepo.delete({ id, organisationId });
    if (!result.affected) throw new NotFoundException('User not found');
  }

  /** Admin-initiated reset for a locked-out user — always re-flags mustChangePassword since the user didn't choose this password. */
  async adminSetPassword(id: string, organisationId: string, newPassword: string): Promise<void> {
    const user = await this.findById(id, organisationId);
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    user.passwordHash = await bcrypt.hash(newPassword, rounds);
    user.mustChangePassword = true;
    await this.userRepo.save(user);
    await this.deleteUserSessions(id);
  }

  /** Self-service password change (first-login forced change, or a voluntary change from settings). */
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :userId', { userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    user.passwordHash = await bcrypt.hash(newPassword, rounds);
    user.mustChangePassword = false;
    await this.userRepo.save(user);
  }

  /**
   * Generates a password-reset token for the given email. Always resolves (never reveals
   * whether the email exists) — the caller decides what to do with a null return.
   * The token is hashed with a fast deterministic hash (SHA-256) rather than bcrypt: unlike a
   * password, this token is high-entropy (32 random bytes) so it doesn't need slow hashing, and
   * a deterministic hash allows a direct indexed lookup instead of scanning every outstanding
   * reset token and bcrypt-comparing each one (the same reasoning applied to session lookup
   * in createSession/findSessionByToken above).
   */
  async createPasswordResetToken(email: string): Promise<{ user: User; token: string } | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase(), isActive: true },
    });
    if (!user) return null;

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = this.hashToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.userRepo.save(user);

    return { user, token };
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordResetTokenHash')
      .where('u.passwordResetTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    user.passwordHash = await bcrypt.hash(newPassword, rounds);
    user.mustChangePassword = false;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.userRepo.save(user);
    await this.deleteUserSessions(user.id);
  }

  /** Fast deterministic hash for high-entropy random tokens (refresh tokens, reset tokens) — see createSession. */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
