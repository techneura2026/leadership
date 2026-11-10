import { createHmac, randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, signPayload, validateWebhookUrl } from '../../src/integrations/webhooks/webhook-signing';

const KEY = randomBytes(32).toString('base64');

describe('webhook signing', () => {
  it('signs "<timestamp>.<raw body>" with HMAC-SHA256 (hex)', () => {
    const expected = createHmac('sha256', 'whsec_test').update('1700000000.{"a":1}').digest('hex');
    expect(signPayload('whsec_test', 1700000000, '{"a":1}')).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different timestamps give different signatures (replay protection input)', () => {
    expect(signPayload('s', 1, 'b')).not.toBe(signPayload('s', 2, 'b'));
  });
});

describe('webhook secret encryption', () => {
  it('round-trips', () => {
    const enc = encryptSecret('whsec_abc', KEY);
    expect(enc).not.toContain('whsec_abc');
    expect(decryptSecret(enc, KEY)).toBe('whsec_abc');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
  });

  it('throws with the wrong key or tampered ciphertext', () => {
    const enc = encryptSecret('whsec_abc', KEY);
    expect(() => decryptSecret(enc, randomBytes(32).toString('base64'))).toThrow();
    const [iv, tag, ct] = enc.split('.');
    expect(() => decryptSecret([iv, tag, ct.slice(0, -2) + (ct.endsWith('A') ? 'BB' : 'AA')].join('.'), KEY)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptSecret('x', Buffer.from('short').toString('base64'))).toThrow(/32 bytes/);
  });
});

describe('webhook URL validation', () => {
  it('in production requires https and rejects private, loopback and link-local hosts', () => {
    expect(validateWebhookUrl('https://hris.example.lk/hooks', true)).toBeNull();
    expect(validateWebhookUrl('http://hris.example.lk/hooks', true)).toMatch(/https/);
    for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.5', '172.31.255.1', '192.168.1.10', '169.254.169.254', '[::1]']) {
      expect(validateWebhookUrl(`https://${host}/x`, true)).toMatch(/private|loopback/i);
    }
    expect(validateWebhookUrl('https://172.32.0.1/x', true)).toBeNull();
    // IPv6 private prefixes must not catch ordinary hostnames that start with the same letters
    expect(validateWebhookUrl('https://fcbank.lk/x', true)).toBeNull();
    expect(validateWebhookUrl('https://fdhris.example.lk/x', true)).toBeNull();
    expect(validateWebhookUrl('https://[fd00::1]/x', true)).toMatch(/private/);
  });

  it('outside production allows http and localhost (local receivers)', () => {
    expect(validateWebhookUrl('http://localhost:4000/hook', false)).toBeNull();
  });

  it('rejects things that are not URLs or not http(s)', () => {
    expect(validateWebhookUrl('not a url', false)).toMatch(/valid URL/);
    expect(validateWebhookUrl('ftp://example.lk/x', false)).toMatch(/http/);
  });
});
