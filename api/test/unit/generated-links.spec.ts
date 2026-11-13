/**
 * Every link the API generates must start with the single configured web base URL (APP_URL → WEB_URL).
 */
import { AuthService } from '../../src/core/auth/auth.service';
import { UsersController } from '../../src/core/users/users.controller';
import { Uc1FeedbackService } from '../../src/assessment/uc1-feedback/uc1-feedback.service';
import { HrisSsoController } from '../../src/integrations/hris/hris-sso.controller';
import { UserRole } from '@leaderprism/shared';

const BASE = 'http://localhost:3100';

describe('generated links use the configured web base URL', () => {
  const saved = { APP_URL: process.env.APP_URL, WEB_URL: process.env.WEB_URL };
  beforeEach(() => {
    process.env.APP_URL = `${BASE}/`;
    process.env.WEB_URL = 'http://localhost:3000';
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('reset-password link', async () => {
    const notifications = { sendPasswordReset: jest.fn() };
    const users = {
      createPasswordResetToken: jest.fn().mockResolvedValue({ user: { email: 'a@b.c', firstName: 'A', organisationId: 'o', id: 'u' }, token: 'tok' }),
    };
    const config = { get: jest.fn(), getOrThrow: jest.fn() };
    const svc = new AuthService(users as any, {} as any, notifications as any, {} as any, config as any, {} as any, {} as any);
    await svc.forgotPassword('a@b.c');
    expect(notifications.sendPasswordReset.mock.calls[0][2]).toBe(`${BASE}/reset-password?token=tok`);
  });

  it('login link in the welcome email', async () => {
    const notifications = { sendUserWelcome: jest.fn() };
    const users = { create: jest.fn().mockResolvedValue({ id: 'u', email: 'a@b.c', firstName: 'A' }) };
    const ctrl = new UsersController(users as any, notifications as any);
    await ctrl.create('org-1', { email: 'a@b.c', firstName: 'A', lastName: 'B', role: UserRole.PARTICIPANT } as any);
    expect(notifications.sendUserWelcome.mock.calls[0][3]).toBe(`${BASE}/login`);
  });

  describe('rater links', () => {
    const assessment = { id: 'a1', title: 'T', organisationId: 'org-1' };
    const make = (nominationRepo: any) =>
      new Uc1FeedbackService(
        nominationRepo,
        {} as any,
        { findOne: jest.fn().mockResolvedValue(assessment) } as any,
        { findOne: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1' }) } as any,
        {} as any,
        { findOne: jest.fn().mockResolvedValue(null) } as any,
        notifications as any,
        {} as any,
      );
    const notifications = { sendRaterInvitation: jest.fn() };
    beforeEach(() => notifications.sendRaterInvitation.mockClear());

    it('on nomination', async () => {
      const repo = {
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((x) => x),
        save: jest.fn(async (x) => ({ ...x, token: 'rt-1' })),
      };
      await make(repo).nominateRaters('a1', 'p1', [{ raterEmail: 'r@x.y', relationship: 'peer' as any }], 'org-1', 'u1', UserRole.ORG_ADMIN);
      expect(notifications.sendRaterInvitation.mock.calls[0][3]).toBe(`${BASE}/rater/rt-1`);
    });

    it('on approval', async () => {
      const repo = {
        find: jest.fn().mockResolvedValue([{ raterEmail: 'r@x.y', raterName: null, token: 'rt-2' }]),
        save: jest.fn(),
      };
      await make(repo).approveNominations('a1', 'org-1', 'admin');
      expect(notifications.sendRaterInvitation.mock.calls[0][3]).toBe(`${BASE}/rater/rt-2`);
    });
  });

  it('SSO ticket url', async () => {
    const users = { findByExternalRefs: jest.fn().mockResolvedValue([{ id: 'u', isActive: true, employmentStatus: 'active', role: UserRole.HR_MANAGER }]) };
    const tickets = { issue: jest.fn().mockResolvedValue({ ticket: 'T1', expiresAt: new Date() }) };
    const ctrl = new HrisSsoController(users as any, tickets as any);
    const res = await ctrl.issue('org-1', { employeeRef: 'E1' });
    expect(res.url).toBe(`${BASE}/sso/hris?ticket=T1`);
  });
});
