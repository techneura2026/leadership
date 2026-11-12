/**
 * The ONLY place that reads APP_URL / WEB_URL / API_PUBLIC_URL.
 *
 * - Web base URL: APP_URL → WEB_URL → http://localhost:3000 (non-production only).
 * - API public URL: API_PUBLIC_URL → http://localhost:3001 (non-production only).
 * In production a missing value throws instead of silently producing localhost links.
 */
type Env = Record<string, string | undefined>;

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i;

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim().replace(/\/+$/, '');
  return t ? t : undefined;
};

const isProd = (env: Env) => env.NODE_ENV === 'production';

export function getWebBaseUrl(env: Env = process.env): string {
  const url = clean(env.APP_URL) ?? clean(env.WEB_URL);
  if (url) return url;
  if (isProd(env)) {
    throw new Error('APP_URL (or WEB_URL) must be set in production: it is the public URL of the web app used in emailed and SSO links.');
  }
  return 'http://localhost:3000';
}

export function getApiPublicUrl(env: Env = process.env): string {
  const url = clean(env.API_PUBLIC_URL);
  if (url) return url;
  if (isProd(env)) {
    throw new Error('API_PUBLIC_URL must be set in production: it is the public URL of this API used in report links and HRIS connection strings.');
  }
  return 'http://localhost:3001';
}

/** Call once at startup. Production only: refuses to boot with missing or localhost public URLs. */
export function assertPublicUrlsConfigured(env: Env = process.env): void {
  if (!isProd(env)) return;
  const web = getWebBaseUrl(env);
  if (LOCAL_HOST.test(web)) {
    throw new Error(`APP_URL/WEB_URL points at localhost (${web}) in production; set it to the public web address.`);
  }
  const api = getApiPublicUrl(env);
  if (LOCAL_HOST.test(api)) {
    throw new Error(`API_PUBLIC_URL points at localhost (${api}) in production; set it to the public API address.`);
  }
}
