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
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { RegisterOrgDto } from './dto/register-org.dto';
import { AccessTokenPayload, AuthResponseDto, UserRole, UserDto, OrganisationDto } from '@leaderprism/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly orgsService: OrganisationsService,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    // Looks up the user regardless of active status so a deactivated account can get its own
    // error message below — but only after the password checks out, so a wrong-password guess
    // against a deactivated (or nonexistent) email still gets the generic "invalid" response
    // and doesn't leak account existence/status.
    const user = await this.usersService.findByEmailIncludingInactive(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact your organisation administrator.',
      );
    }

    return user;
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
    this.assertOrgIsUsable(org);

    await this.usersService.updateLastLogin(user.id);
    return this.issueTokens(user, org.id, req);
  }

  /** Shared by login() and refresh() so trial/active status is enforced consistently on both. */
  private assertOrgIsUsable(org: { isActive: boolean; trialEndsAt: Date | null; plan: string }): void {
    if (!org.isActive) {
      throw new UnauthorizedException('Organisation is inactive');
    }

    if (org.trialEndsAt && org.trialEndsAt < new Date() && org.plan === 'trial') {
      throw new UnauthorizedException('Trial period has expired. Please upgrade your plan.');
    }
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

    // Re-validate org status on every refresh, not just at login — otherwise a user who
    // logged in before their trial expired (or before their org was deactivated) could
    // keep refreshing indefinitely and never be re-checked.
    const org = await this.orgsService.findById(user.organisationId);
    this.assertOrgIsUsable(org);

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

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        organisationId: user.organisationId,
        departmentId: user.departmentId,
        managerId: user.managerId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        languagePref: user.languagePref,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        mustChangePassword: user.mustChangePassword,
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
        managerId: user.managerId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        languagePref: user.languagePref,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        mustChangePassword: user.mustChangePassword,
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

  /** Self-service change — used both for the forced first-login flow and a voluntary change. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    await this.usersService.changeOwnPassword(userId, currentPassword, newPassword);
  }

  /**
   * Always resolves without revealing whether the email exists, to avoid leaking which
   * addresses have accounts. Only sends an email when a matching active user is found.
   */
  async forgotPassword(email: string): Promise<void> {
    const result = await this.usersService.createPasswordResetToken(email);
    if (!result) return;

    const { user, token } = result;
    const resetUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`;
    try {
      await this.notificationsService.sendPasswordReset(user.email, user.firstName, resetUrl, {
        orgId: user.organisationId,
        userId: user.id,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to send password reset email to ${user.email}: ${err?.message}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.usersService.resetPasswordWithToken(token, newPassword);
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
        managerId: user.managerId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        languagePref: user.languagePref,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        mustChangePassword: user.mustChangePassword,
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
