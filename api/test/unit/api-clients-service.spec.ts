import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApiClientsService } from '../../src/integrations/api-clients/api-clients.service';
import { buildHrisConnectionString } from '../../src/integrations/api-clients/key-format';

describe('buildHrisConnectionString', () => {
  const key = 'lpk_AbCd1234_' + 'x'.repeat(43);

  it('puts the key in the user name and keeps the API host and port', () => {
    const cs = buildHrisConnectionString(key, 'http://localhost:3101');
    expect(cs).toBe(`http://${key}@localhost:3101`);
    const u = new URL(cs);
    expect(u.username).toBe(key);
    expect(u.host).toBe('localhost:3101');
  });

  it('keeps https and drops any path', () => {
    expect(buildHrisConnectionString(key, 'https://api.example.com/api/v1')).toBe(`https://${key}@api.example.com`);
  });
});

describe('ApiClientsService', () => {
  const makeService = (client: any) => {
    const repo: any = {
      findOne: jest.fn().mockResolvedValue(client),
      save: jest.fn(async (c) => c),
      create: jest.fn((c) => ({ id: 'new-id', createdAt: new Date(), lastUsedAt: null, revokedAt: null, ...c })),
    };
    const audit = { record: jest.fn() };
    return { svc: new ApiClientsService(repo, {} as any, audit as any), repo, audit };
  };
  const base = () => ({ id: 'c1', organisationId: 'org-1', name: 'HRIS', keyPrefix: 'AbCd1234', scopes: ['employees:write'], createdAt: new Date(), lastUsedAt: null, revokedAt: null });

  it('create returns a connectionString built from the new key and API_PUBLIC_URL', async () => {
    process.env.API_PUBLIC_URL = 'http://localhost:3101/';
    const { svc } = makeService(null);
    const res = await svc.create('org-1', 'u1', { name: 'HRIS', scopes: ['employees:write'] });
    expect(new URL(res.connectionString!).username).toBe(res.rawKey);
    expect(new URL(res.connectionString!).host).toBe('localhost:3101');
  });

  it('updateScopes looks up by id AND organisationId, replaces scopes, and audits before/after without a secret', async () => {
    const { svc, repo, audit } = makeService(base());
    const dto = await svc.updateScopes('org-1', 'c1', ['employees:write', 'sso:issue', 'sso:issue'], 'u1');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'c1', organisationId: 'org-1' } });
    expect(dto.scopes).toEqual(['employees:write', 'sso:issue']);
    expect((dto as any).rawKey).toBeUndefined();
    const entry = audit.record.mock.calls[0][0];
    expect(entry).toMatchObject({
      orgId: 'org-1', actorType: 'user', actorId: 'u1', action: 'integration.api_client.scopes_updated', entityType: 'api_client', entityId: 'c1',
      before: { scopes: ['employees:write'] }, after: { scopes: ['employees:write', 'sso:issue'] },
    });
  });

  it('updateScopes → 404 when not found in the org', async () => {
    const { svc } = makeService(null);
    await expect(svc.updateScopes('org-1', 'c1', ['results:read'], 'u1')).rejects.toThrow(NotFoundException);
  });

  it('updateScopes → 409 when revoked', async () => {
    const { svc, repo } = makeService({ ...base(), revokedAt: new Date() });
    await expect(svc.updateScopes('org-1', 'c1', ['results:read'], 'u1')).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
