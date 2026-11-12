import { createHash, randomBytes } from 'crypto';

const PREFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const KEY_PATTERN = /^lpk_([A-Za-z0-9]{8})_([A-Za-z0-9_-]{43})$/;

/** API keys look like `lpk_<8-char prefix>_<43-char base64url secret>`. Only sha256(secret) is stored. */
export function generateApiKey(): { prefix: string; secret: string; raw: string } {
  const bytes = randomBytes(8);
  let prefix = '';
  for (const b of bytes) prefix += PREFIX_ALPHABET[b % PREFIX_ALPHABET.length];
  const secret = randomBytes(32).toString('base64url');
  return { prefix, secret, raw: `lpk_${prefix}_${secret}` };
}

export function parseApiKey(raw: string): { prefix: string; secret: string } | null {
  const m = KEY_PATTERN.exec(raw ?? '');
  return m ? { prefix: m[1], secret: m[2] } : null;
}

/** `https://<api key>@<API host>[:port]` — the single value an HRIS needs. Contains the secret: show once. */
export function buildHrisConnectionString(rawKey: string, apiPublicUrl: string): string {
  const u = new URL(apiPublicUrl);
  return `${u.protocol}//${rawKey}@${u.host}`;
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
