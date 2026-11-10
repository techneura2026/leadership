import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

/** X-LeaderPrism-Signature value (without the "sha256=" prefix): HMAC-SHA256 of "<timestamp>.<raw body>". */
export function signPayload(secret: string, timestamp: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

function keyFrom(keyB64: string): Buffer {
  const key = Buffer.from(keyB64 ?? '', 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be 32 bytes (base64)');
  return key;
}

/** AES-256-GCM; output "iv.tag.ciphertext", each base64url. Webhook secrets must be recoverable to sign. */
export function encryptSecret(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyB64), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(enc: string, keyB64: string): string {
  const [iv, tag, ct] = enc.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyB64), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

const PRIVATE_V4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT 100.64.0.0/10
];

/** True for an IP address webhooks must never be delivered to (loopback, private, link-local, …). */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (addr.includes(':')) {
    return addr === '::' || addr === '::1' || addr.startsWith('fe80:') || /^f[cd][0-9a-f]{0,2}:/.test(addr);
  }
  return PRIVATE_V4.some((re) => re.test(addr));
}

type Lookup = (host: string) => Promise<Array<{ address: string }>>;

/**
 * Delivery-time SSRF guard (production only): resolves the hostname and refuses delivery when any
 * resolved address is private — create-time validation alone can be bypassed by DNS. Returns an
 * error message, or null when the target may be called.
 */
export async function checkDeliveryTarget(rawUrl: string, production: boolean, lookup: Lookup): Promise<string | null> {
  if (!production) return null;
  const host = new URL(rawUrl).hostname.replace(/^\[|\]$/g, '');
  let addresses: Array<{ address: string }>;
  try {
    addresses = /^[\d.]+$/.test(host) || host.includes(':') ? [{ address: host }] : await lookup(host);
  } catch {
    return 'Could not resolve the webhook host';
  }
  if (addresses.length === 0) return 'Could not resolve the webhook host';
  return addresses.some((a) => isPrivateAddress(a.address)) ? 'Webhook host resolves to a private address' : null;
}

/**
 * Returns an error message, or null when the URL is acceptable. In production the URL must be
 * https and must not point at loopback/private/link-local hosts (SSRF guard).
 */
export function validateWebhookUrl(raw: string, production: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Webhook URL must be a valid URL';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Webhook URL must use http or https';
  if (!production) return null;
  if (url.protocol !== 'https:') return 'Webhook URL must use https';
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const isV6 = host.includes(':');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    (isV6 && (host === '::1' || host.startsWith('fe80:') || /^f[cd][0-9a-f]{0,2}:/.test(host)))
  ) {
    return 'Webhook URL must not point at a loopback or private address';
  }
  if (PRIVATE_V4.some((re) => re.test(host))) return 'Webhook URL must not point at a loopback or private address';
  return null;
}
