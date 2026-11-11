import { generateApiKey, hashSecret, parseApiKey } from '../../src/integrations/api-clients/key-format';

describe('API key format', () => {
  it('generates keys in the lpk_<prefix>_<secret> format', () => {
    expect(generateApiKey().raw).toMatch(/^lpk_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{43}$/);
  });

  it('parseApiKey round-trips a generated key', () => {
    const key = generateApiKey();
    expect(parseApiKey(key.raw)).toEqual({ prefix: key.prefix, secret: key.secret });
  });

  it('parseApiKey rejects anything that is not an API key', () => {
    expect(parseApiKey('Bearer x')).toBeNull();
    expect(parseApiKey('lpk_short_x')).toBeNull();
    expect(parseApiKey('')).toBeNull();
  });

  it('hashSecret is sha256 hex', () => {
    expect(hashSecret('a')).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
  });

  it('generates a different key each time', () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });
});
