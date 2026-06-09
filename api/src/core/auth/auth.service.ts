import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { OrganisationsService } from '../organisations/organisations.service';
import { User } from '../users/entities/user.entity';
import { RegisterOrgDto } from './dto/register-org.dto';
import { AccessTokenPayload, AuthResponseDto, UserRole, UserDto, OrganisationDto } from '@leaderprism/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly orgsService: OrganisationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async register(dto: RegisterOrgDto, req: { ip?: string; headers: Record<string, string | string[] | undefined> }): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const org = await this.orgsService.create({ name: dto.orgName, slug: dto.orgSlug });

    const user = await this.usersService.create({
      organisationId: org.id,
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.ORG_ADMIN,
    });

    return this.issueTokens(user, org.id, req);
  }

  async login(
    user: User,
    req: { ip?: string; headers: Record<string, string | string[] | undefined> },
  ): Promise<AuthResponseDto> {
    const org = await this.orgsService.findById(user.organisationId);

    if (!org.isActive) {
      throw new UnauthorizedException('Organisation is inactive');
    }

    if (org.trialEndsAt && org.trialEndsAt < new Date() && org.plan === 'trial') {
      throw new UnauthorizedException('Trial period has expired. Please upgrade your plan.');
    }

    await this.usersService.updateLastLogin(user.id);
    return this.issueTokens(user, org.id, req);
  }

  async refresh(
    refreshToken: string,
    req: { ip?: string; headers: Record<string, string | string[] | undefined> },
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    const session = await this.usersService.findSessionByToken(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (session.expiresAt < new Date()) {
      await this.usersService.deleteSession(session.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findByIdInternal(session.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Rotate refresh token
    await this.usersService.deleteSession(session.id);

    const newRefreshToken = uuidv4();
    const expiresAt = this.refreshExpiryDate();
    await this.usersService.createSession({
      userId: user.id,
      refreshToken: newRefreshToken,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });

    const accessToken = this.signAccessToken(user);
    const org = await this.orgsService.findById(user.organisationId);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        organisationId: user.organisationId,
        departmentId: user.departmentId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        languagePref: user.languagePref,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      organisation: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        primaryColour: org.primaryColour,
        plan: org.plan,
        trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
      },
    } as AuthResponseDto & { refreshToken: string };
  }

  async getMe(userId: string): Promise<{ user: UserDto; organisation: OrganisationDto }> {
    const user = await this.usersService.findByIdInternal(userId);
    if (!user) throw new NotFoundException('User not found');
    const org = await this.orgsService.findById(user.organisationId);
    return {
      user: {
        id: user.id,
        organisationId: user.organisationId,
        departmentId: user.departmentId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        languagePref: user.languagePref,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      organisation: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        primaryColour: org.primaryColour,
        plan: org.plan,
        trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.usersService.findSessionByToken(refreshToken);
    if (session) {
      await this.usersService.deleteSession(session.id);
    }
  }

  private async issueTokens(
    user: User,
    orgId: string,
    req: { ip?: string; headers: Record<string, string | string[] | undefined> },
  ): Promise<AuthResponseDto> {
    const refreshToken = uuidv4();
    const expiresAt = this.refreshExpiryDate();

    await this.usersService.createSession({
      userId: user.id,
      refreshToken,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });

    const accessToken = this.signAccessToken(user);
    const org = await this.orgsService.findById(orgId);

    return {
      accessToken,
      user: {
        id: user.id,
        organisationId: user.organisationId,
        departmentId: user.departmentId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        languagePref: user.languagePref,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      organisation: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        primaryColour: org.primaryColour,
        plan: org.plan,
        trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
      },
      refreshToken,
    } as AuthResponseDto & { refreshToken: string };
  }

  private signAccessToken(user: User): string {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      orgId: user.organisationId,
      role: user.role,
      email: user.email,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY') ?? '15m',
    });
  }

  private refreshExpiryDate(): Date {
    const expiry = this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? '30d';
    const days = expiry.endsWith('d') ? parseInt(expiry, 10) : 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
