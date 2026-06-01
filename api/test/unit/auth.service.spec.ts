import { AuthService } from '../../src/core/auth/auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@leaderprism/shared';

const mockUsersService = {
  findByEmail: jest.fn(),
  findByIdInternal: jest.fn(),
  create: jest.fn(),
  updateLastLogin: jest.fn(),
  createSession: jest.fn(),
  findSessionByToken: jest.fn(),
  deleteSession: jest.fn(),
  deleteUserSessions: jest.fn(),
};

const mockOrgsService = {
  create: jest.fn(),
  findById: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.access.token'),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
    return '';
  }),
  get: jest.fn((key: string, def?: string) => {
    if (key === 'JWT_ACCESS_EXPIRY') return '15m';
    if (key === 'JWT_REFRESH_EXPIRY') return '30d';
    return def ?? '';
  }),
};

const fakeOrg = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
  plan: 'trial',
  isActive: true,
  trialEndsAt: new Date(Date.now() + 86400000 * 30),
  logoUrl: null,
  primaryColour: '#1E40AF',
  createdAt: new Date(),
  brandingName: null,
  updatedAt: new Date(),
};

const fakeUser = {
  id: 'user-1',
  organisationId: 'org-1',
  email: 'jane@test.com',
  firstName: 'Jane',
  lastName: 'Perera',
  role: UserRole.ORG_ADMIN,
  passwordHash: '$2b$12$hashedpassword',
  isActive: true,
  emailVerified: false,
  departmentId: null,
  jobTitle: null,
  avatarUrl: null,
  languagePref: 'en',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  deletedAt: null,
};

const fakeReq = { ip: '127.0.0.1', headers: { 'user-agent': 'jest-test' } };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockUsersService as any,
      mockOrgsService as any,
      mockJwtService as any,
      mockConfigService as any,
    );
  });

  describe('validateUser', () => {
    it('returns user when credentials are valid', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('Password1!', 4);
      mockUsersService.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash: hash });

      const result = await service.validateUser('jane@test.com', 'Password1!');
      expect(result).not.toBeNull();
      expect(result?.email).toBe('jane@test.com');
    });

    it('returns null when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      const result = await service.validateUser('unknown@test.com', 'any');
      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correct-password', 4);
      mockUsersService.findByEmail.mockResolvedValue({ ...fakeUser, passwordHash: hash });

      const result = await service.validateUser('jane@test.com', 'wrong-password');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('throws ConflictException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(fakeUser);

      await expect(
        service.register(
          { orgName: 'New Org', orgSlug: 'new-org', firstName: 'John', lastName: 'Doe', email: 'jane@test.com', password: 'Pass1!' },
          fakeReq as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates org and user and returns tokens on success', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockOrgsService.create.mockResolvedValue(fakeOrg);
      mockUsersService.create.mockResolvedValue(fakeUser);
      mockUsersService.createSession.mockResolvedValue({ id: 'session-1' });
      mockOrgsService.findById.mockResolvedValue(fakeOrg);

      const result = await service.register(
        { orgName: 'Test Org', orgSlug: 'test-org', firstName: 'Jane', lastName: 'Perera', email: 'jane@test.com', password: 'Pass1!' },
        fakeReq as any,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('jane@test.com');
      expect(result.organisation.id).toBe('org-1');
      expect(mockOrgsService.create).toHaveBeenCalledWith({ name: 'Test Org', slug: 'test-org' });
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ORG_ADMIN }),
      );
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when org is inactive', async () => {
      mockOrgsService.findById.mockResolvedValue({ ...fakeOrg, isActive: false });
      await expect(service.login(fakeUser as any, fakeReq as any)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when trial has expired', async () => {
      const expiredOrg = { ...fakeOrg, plan: 'trial', trialEndsAt: new Date(Date.now() - 86400000) };
      mockOrgsService.findById.mockResolvedValue(expiredOrg);
      await expect(service.login(fakeUser as any, fakeReq as any)).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens for valid active user', async () => {
      mockOrgsService.findById.mockResolvedValue(fakeOrg);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockUsersService.createSession.mockResolvedValue({ id: 'session-1' });

      const result = await service.login(fakeUser as any, fakeReq as any);
      expect(result.accessToken).toBeDefined();
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when refresh token not found', async () => {
      mockUsersService.findSessionByToken.mockResolvedValue(null);
      await expect(service.refresh('bad-token', fakeReq as any)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when session is expired', async () => {
      const expiredSession = {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        refreshTokenHash: 'hash',
      };
      mockUsersService.findSessionByToken.mockResolvedValue(expiredSession);
      mockUsersService.deleteSession.mockResolvedValue(undefined);

      await expect(service.refresh('expired-token', fakeReq as any)).rejects.toThrow(UnauthorizedException);
    });

    it('rotates token and returns new access token', async () => {
      const validSession = {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        refreshTokenHash: 'hash',
      };
      mockUsersService.findSessionByToken.mockResolvedValue(validSession);
      mockUsersService.findByIdInternal.mockResolvedValue(fakeUser);
      mockUsersService.deleteSession.mockResolvedValue(undefined);
      mockUsersService.createSession.mockResolvedValue({ id: 'session-2' });

      const result = await service.refresh('valid-token', fakeReq as any);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockUsersService.deleteSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('logout', () => {
    it('deletes session when refresh token is valid', async () => {
      mockUsersService.findSessionByToken.mockResolvedValue({ id: 'session-1', userId: 'user-1', expiresAt: new Date(), refreshTokenHash: 'hash' });
      mockUsersService.deleteSession.mockResolvedValue(undefined);

      await service.logout('some-token');
      expect(mockUsersService.deleteSession).toHaveBeenCalledWith('session-1');
    });

    it('does not throw when refresh token not found (idempotent)', async () => {
      mockUsersService.findSessionByToken.mockResolvedValue(null);
      await expect(service.logout('unknown-token')).resolves.not.toThrow();
    });
  });
});
