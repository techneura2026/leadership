import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { UserRole } from '@leaderprism/shared';

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
  }): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: { organisationId: data.organisationId, email: data.email.toLowerCase() },
      withDeleted: true,
    });
    if (existing) throw new ConflictException('Email already in use within this organisation');

    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    const passwordHash = await bcrypt.hash(data.password, rounds);
    const user = this.userRepo.create({
      ...data,
      email: data.email.toLowerCase(),
      passwordHash,
      emailVerified: true,
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
      isActive: boolean;
    }>,
  ): Promise<User> {
    const user = await this.findById(id, organisationId);
    Object.assign(user, data);
    return this.userRepo.save(user);
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
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    const refreshTokenHash = await bcrypt.hash(data.refreshToken, rounds);
    const session = this.sessionRepo.create({
      userId: data.userId,
      refreshTokenHash,
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    });
    return this.sessionRepo.save(session);
  }

  async findSessionByToken(refreshToken: string): Promise<Session | null> {
    const sessions = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.expiresAt > NOW()')
      .getMany();

    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (match) return session;
    }
    return null;
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionRepo.delete(id);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessionRepo.delete({ userId });
  }

  async findAll(organisationId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { organisationId },
      order: { isActive: 'DESC', firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async hardDelete(id: string, organisationId: string): Promise<void> {
    const result = await this.userRepo.delete({ id, organisationId });
    if (!result.affected) throw new NotFoundException('User not found');
  }
}
