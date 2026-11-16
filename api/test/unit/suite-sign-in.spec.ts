import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@leaderprism/shared';
import { HrisSessionsController, HrisSsoController } from '../../src/integrations/hris/hris-sso.controller';
import { parseSuiteHeader, readSuite } from '../../src/integrations/hris/suite';

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const suite = {
  v: 1,
  home: { key: 'bizos', name: 'BizOS', url: 'https://bizos.example/' },
  apps: [{ key: 'leaderprism', name: 'LeaderPrism', url: 'https://bizos.example/launch/leaderprism' }],
};

describe('BizOS suite (Suite Sign-in plan 2.4)', () => {
  it('reads the X-Bizos-Suite header and refuses anything not on BizOS itself', () => {
    expect(parseSuiteHeader(enc(suite))).toEqual(suite);
    expect(parseSuiteHeader(enc({ ...suite, apps: [{ key: 'x', name: 'X', url: 'https://evil.example/x' }] }))).toBeNull();
    expect(parseSuiteHeader(enc({ ...suite, home: { ...suite.home, url: 'javascript:alert(1)' } }))).toBeNull();
    expect(parseSuiteHeader(enc({ ...suite, v: 2 }))).toBeNull();
    expect(parseSuiteHeader('garbage')).toBeNull();
    expect(parseSuiteHeader(undefined)).toBeNull();
    expect(readSuite(null)).toBeNull();
  });

  it('keeps the suite on the person when BizOS asks for a sign-in link', async () => {
    const users = {
      findByExternalRefs: jest.fn().mockResolvedValue([{ id: 'u', isActive: true, employmentStatus: 'active', role: UserRole.PARTICIPANT }]),
      setSuite: jest.fn(),
    };
    const tickets = { issue: jest.fn().mockResolvedValue({ ticket: 'T1', expiresAt: new Date() }) };
    const ctrl = new HrisSsoController(users as any, tickets as any);
    await ctrl.issue('org-1', { employeeRef: 'E1' }, enc(suite));
    expect(users.setSuite).toHaveBeenCalledWith('org-1', 'u', suite);
    users.setSuite.mockClear();
    await ctrl.issue('org-1', { employeeRef: 'E1' }, 'garbage');
    expect(users.setSuite).not.toHaveBeenCalled();
  });
});

describe('signing out everywhere (Suite Sign-in plan 2.5)', () => {
  const client = { orgId: 'org-1', clientId: 'c1', scopes: ['sso:issue'], createdBy: null } as any;

  it("ends the employee's sessions, even a leaver's, and audits it", async () => {
    const users = { findByExternalRefs: jest.fn().mockResolvedValue([{ id: 'u', isActive: false, employmentStatus: 'left' }]), revokeUserSessions: jest.fn().mockResolvedValue(2) };
    const audit = { record: jest.fn() };
    const ctrl = new HrisSessionsController(users as any, audit as any);
    expect(await ctrl.revoke(client, { employeeRef: 'E1' })).toEqual({ revoked: 2 });
    expect(users.findByExternalRefs).toHaveBeenCalledWith('org-1', ['E1']);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', actorType: 'api_client', action: 'auth.sessions_revoked', entityId: 'u' }));
  });

  it('answers 404 for someone it does not know', async () => {
    const ctrl = new HrisSessionsController({ findByExternalRefs: jest.fn().mockResolvedValue([]) } as any, { record: jest.fn() } as any);
    await expect(ctrl.revoke(client, { employeeRef: 'nobody' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
