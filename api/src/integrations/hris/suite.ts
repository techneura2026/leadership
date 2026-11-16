/**
 * BizOS Suite Sign-in plan 2.4. With every sign-in link it asks for, BizOS sends the suite as this person sees it (BizOS and the apps
 * they may open from it) in the X-Bizos-Suite header: base64url JSON { v: 1, home, apps[] }. LeaderPrism keeps it on the person and
 * draws its Apps menu from it. It only ever becomes links (each opens BizOS's /launch/<app>); it grants nothing.
 */
export const SUITE_HEADER = 'x-bizos-suite';
const MAX_HEADER = 4096;

export interface SuiteLink { key: string; name: string; url: string }
export interface Suite { v: 1; home: SuiteLink; apps: SuiteLink[] }

function webUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 2000) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) ? v : null;
  } catch {
    return null;
  }
}

function link(v: unknown): SuiteLink | null {
  if (!v || typeof v !== 'object') return null;
  const { key, name, url } = v as Record<string, unknown>;
  if (typeof key !== 'string' || !key || key.length > 40 || typeof name !== 'string' || !name || name.length > 80) return null;
  const u = webUrl(url);
  return u ? { key, name, url: u } : null;
}

/** A valid suite, or null. Every link must be on BizOS itself (the home's origin): a person never clicks to anywhere else. */
export function readSuite(v: unknown): Suite | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.apps) || o.apps.length > 12) return null;
  const home = link(o.home);
  const apps = o.apps.map(link);
  if (!home || apps.some((a) => a === null)) return null;
  const origin = new URL(home.url).origin;
  if ((apps as SuiteLink[]).some((a) => new URL(a.url).origin !== origin)) return null;
  return { v: 1, home, apps: apps as SuiteLink[] };
}

/** The suite in the header (base64url JSON), or null for anything else. */
export function parseSuiteHeader(header: string | string[] | undefined): Suite | null {
  if (typeof header !== 'string' || !header || header.length > MAX_HEADER) return null;
  try {
    return readSuite(JSON.parse(Buffer.from(header, 'base64url').toString('utf8')));
  } catch {
    return null;
  }
}
