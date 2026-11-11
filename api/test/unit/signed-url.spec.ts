import { signReportUrl, verifyReportSignature } from '../../src/integrations/hris/signed-url';

const SECRET = 'unit-test-secret';
const NOW = new Date('2027-07-01T10:00:00Z');
const parse = (url: string) => {
  const u = new URL(url);
  return { path: u.pathname, exp: u.searchParams.get('exp')!, sig: u.searchParams.get('sig')! };
};

describe('signed report URLs', () => {
  it('builds a URL under /integrations/hris/report-files with exp and sig, and round-trips', () => {
    const { url, expiresAt } = signReportUrl('https://api.example.lk', 'rep-1', 900, SECRET, NOW);
    const { path, exp, sig } = parse(url);
    expect(path).toBe('/api/v1/integrations/hris/report-files/rep-1');
    expect(Number(exp)).toBe(Math.floor(NOW.getTime() / 1000) + 900);
    expect(expiresAt).toBe('2027-07-01T10:15:00.000Z');
    expect(verifyReportSignature('rep-1', exp, sig, SECRET, NOW)).toBe(true);
  });

  it('rejects a signature for a different report', () => {
    const { exp, sig } = parse(signReportUrl('https://api.example.lk', 'rep-1', 900, SECRET, NOW).url);
    expect(verifyReportSignature('rep-2', exp, sig, SECRET, NOW)).toBe(false);
  });

  it('rejects an expired link', () => {
    const { exp, sig } = parse(signReportUrl('https://api.example.lk', 'rep-1', 900, SECRET, NOW).url);
    const later = new Date((Number(exp) + 1) * 1000);
    expect(verifyReportSignature('rep-1', exp, sig, SECRET, later)).toBe(false);
  });

  it('rejects a tampered expiry, a wrong secret, and malformed signatures without throwing', () => {
    const { exp, sig } = parse(signReportUrl('https://api.example.lk', 'rep-1', 900, SECRET, NOW).url);
    expect(verifyReportSignature('rep-1', String(Number(exp) + 3600), sig, SECRET, NOW)).toBe(false);
    expect(verifyReportSignature('rep-1', exp, sig, 'other-secret', NOW)).toBe(false);
    expect(verifyReportSignature('rep-1', exp, 'abc', SECRET, NOW)).toBe(false);
    expect(verifyReportSignature('rep-1', 'not-a-number', sig, SECRET, NOW)).toBe(false);
  });

  it('strips a trailing slash from the base URL', () => {
    expect(signReportUrl('https://api.example.lk/', 'r', 60, SECRET, NOW).url).toMatch(/^https:\/\/api\.example\.lk\/api\/v1\//);
  });
});
