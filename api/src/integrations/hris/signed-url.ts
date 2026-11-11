import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed links for report PDFs, so the HRIS can hand a URL to a browser without
 * sharing its API key. The HMAC over "<reportId>.<exp>" is the only credential.
 */
const sign = (reportId: string, exp: string, secret: string) =>
  createHmac('sha256', secret).update(`${reportId}.${exp}`).digest('hex');

export function signReportUrl(
  baseUrl: string,
  reportId: string,
  ttlSeconds: number,
  secret: string,
  now: Date = new Date(),
): { url: string; expiresAt: string } {
  const exp = String(Math.floor(now.getTime() / 1000) + ttlSeconds);
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/v1/integrations/hris/report-files/${encodeURIComponent(reportId)}?exp=${exp}&sig=${sign(reportId, exp, secret)}`;
  return { url, expiresAt: new Date(Number(exp) * 1000).toISOString() };
}

export function verifyReportSignature(
  reportId: string,
  exp: string,
  sig: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d+$/.test(exp ?? '') || !/^[0-9a-f]{64}$/.test(sig ?? '')) return false;
  if (Number(exp) * 1000 < now.getTime()) return false;
  const expected = Buffer.from(sign(reportId, exp, secret), 'hex');
  return timingSafeEqual(expected, Buffer.from(sig, 'hex'));
}
