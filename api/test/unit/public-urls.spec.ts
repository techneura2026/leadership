import { assertPublicUrlsConfigured, getApiPublicUrl, getWebBaseUrl } from '../../src/shared/public-urls';

describe('getWebBaseUrl', () => {
  it('prefers APP_URL over WEB_URL', () => {
    expect(getWebBaseUrl({ APP_URL: 'http://localhost:3100', WEB_URL: 'http://localhost:3000' })).toBe('http://localhost:3100');
  });

  it('falls back to WEB_URL when APP_URL is unset or blank', () => {
    expect(getWebBaseUrl({ WEB_URL: 'http://localhost:3100' })).toBe('http://localhost:3100');
    expect(getWebBaseUrl({ APP_URL: '  ', WEB_URL: 'http://localhost:3100' })).toBe('http://localhost:3100');
  });

  it('defaults to http://localhost:3000 outside production', () => {
    expect(getWebBaseUrl({})).toBe('http://localhost:3000');
    expect(getWebBaseUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });

  it('strips trailing slashes', () => {
    expect(getWebBaseUrl({ APP_URL: 'https://app.example.com///' })).toBe('https://app.example.com');
  });

  it('throws in production when neither is set', () => {
    expect(() => getWebBaseUrl({ NODE_ENV: 'production' })).toThrow(/APP_URL/);
  });
});

describe('getApiPublicUrl', () => {
  it('returns API_PUBLIC_URL without trailing slash', () => {
    expect(getApiPublicUrl({ API_PUBLIC_URL: 'https://api.example.com/' })).toBe('https://api.example.com');
  });

  it('defaults to http://localhost:3001 outside production', () => {
    expect(getApiPublicUrl({})).toBe('http://localhost:3001');
  });

  it('throws in production when unset', () => {
    expect(() => getApiPublicUrl({ NODE_ENV: 'production' })).toThrow(/API_PUBLIC_URL/);
  });
});

describe('assertPublicUrlsConfigured', () => {
  const prod = { NODE_ENV: 'production', APP_URL: 'https://app.example.com', API_PUBLIC_URL: 'https://api.example.com' };

  it('passes in production with real hosts', () => {
    expect(() => assertPublicUrlsConfigured(prod)).not.toThrow();
  });

  it('throws in production when neither APP_URL nor WEB_URL is set', () => {
    expect(() => assertPublicUrlsConfigured({ ...prod, APP_URL: undefined })).toThrow(/APP_URL/);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])('throws in production when the web URL is %s', (u) => {
    expect(() => assertPublicUrlsConfigured({ ...prod, APP_URL: u })).toThrow(/localhost/);
  });

  it('throws in production when API_PUBLIC_URL is missing or localhost', () => {
    expect(() => assertPublicUrlsConfigured({ ...prod, API_PUBLIC_URL: undefined })).toThrow(/API_PUBLIC_URL/);
    expect(() => assertPublicUrlsConfigured({ ...prod, API_PUBLIC_URL: 'http://localhost:3001' })).toThrow(/API_PUBLIC_URL/);
  });

  it('does nothing outside production', () => {
    expect(() => assertPublicUrlsConfigured({})).not.toThrow();
  });
});
