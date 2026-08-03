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
import { UserRole } from '@leaderprism/shared';

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
