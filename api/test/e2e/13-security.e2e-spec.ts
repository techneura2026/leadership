/**
 * E2E Test Suite: Security
 * QA Scenarios: QA-SEC-001 through QA-SEC-007
 *
 * Validates that the platform enforces security best practices: HttpOnly cookies,
 * refresh token never in the response body, CORS restrictions against unknown
 * origins, bcrypt password storage, rejection of algorithm=none JWTs, no
 * sensitive fields in user list responses, and refresh token not leaked via body.
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp, http } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  authGet,
  TestOrg,
} from './setup/helpers';
import { ORGS } from './setup/factories';

let _counter = 0;
function uid() {
  return `${Date.now()}${++_counter}`;
}

function uniqueOrg(base: typeof ORGS.strategicTalent) {
  const sfx = uid();
  return {
    ...base,
    orgName: `${base.orgName} ${sfx}`,
    orgSlug: `${base.orgSlug}-${sfx}`,
    email: base.email.replace('@', `+${sfx}@`),
  };
}

describe('[QA-SEC] Security', () => {
  let app: INestApplication;
  let ds: DataSource;

  // Shared state — set in beforeAll
  let org: TestOrg;
  let adminEmail: string;
  let adminPassword: string;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    adminPassword = 'SecurePass1!';
    const orgData = uniqueOrg(ORGS.strategicTalent);
    adminEmail = orgData.email;
    // Override with a known password for this suite
    orgData.password = adminPassword;

    org = await registerOrg(app, orgData);
  });

  // ── QA-SEC-001 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-001 | P1
   * Scenario: Login response sets the refresh token cookie with the HttpOnly flag.
   * An HttpOnly cookie cannot be read by JavaScript (document.cookie), which
   * prevents XSS attacks from exfiltrating the refresh token. We inspect the
   * raw Set-Cookie header string for the 'HttpOnly' attribute.
   */
  it('QA-SEC-001 | P1 — login Set-Cookie header has HttpOnly attribute', async () => {
    const loginRes = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(loginRes.status).toBe(200);

    // The Set-Cookie header may be a string or an array of strings
    const rawCookies: string[] = Array.isArray(loginRes.headers['set-cookie'])
      ? (loginRes.headers['set-cookie'] as string[])
      : loginRes.headers['set-cookie']
      ? [loginRes.headers['set-cookie'] as string]
      : [];

    expect(rawCookies.length).toBeGreaterThan(0);

    // Find the refresh_token cookie
    const refreshCookie = rawCookies.find((c) =>
      c.toLowerCase().startsWith('refresh_token'),
    );
    expect(refreshCookie).toBeDefined();

    // Must have HttpOnly attribute
    expect(refreshCookie!.toLowerCase()).toContain('httponly');
  });

  // ── QA-SEC-002 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-002 | P1
   * Scenario: The login response body does NOT include the refresh token.
   * The refreshToken must only be in the Set-Cookie header (HttpOnly). If it
   * appears in the JSON body, client-side JavaScript can read it, defeating the
   * HttpOnly protection. We check the data.user and top-level data fields.
   */
  it('QA-SEC-002 | P1 — login response body does not expose refreshToken', async () => {
    const loginRes = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(loginRes.status).toBe(200);

    const data = loginRes.body.data as Record<string, unknown>;
    expect(data).toBeDefined();

    // Top-level data must not contain refreshToken
    expect(data['refreshToken']).toBeUndefined();
    expect(data['refresh_token']).toBeUndefined();

    // data.user must not contain refresh token fields
    const user = data['user'] as Record<string, unknown> | undefined;
    if (user) {
      expect(user['refreshToken']).toBeUndefined();
      expect(user['refresh_token']).toBeUndefined();
      expect(user['refreshTokenHash']).toBeUndefined();
    }

    // data.organisation must not contain refresh token fields
    const orgData = data['organisation'] as Record<string, unknown> | undefined;
    if (orgData) {
      expect(orgData['refreshToken']).toBeUndefined();
      expect(orgData['refresh_token']).toBeUndefined();
    }
  });

  // ── QA-SEC-003 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-003 | P1
   * Scenario: CORS does not allow arbitrary unknown origins.
   * A request from a malicious origin must NOT receive an
   * Access-Control-Allow-Origin header that echoes back that origin.
   * (The API should only allow configured origins or same-origin.)
   */
  it('QA-SEC-003 | P1 — CORS does not reflect arbitrary malicious origins', async () => {
    const maliciousOrigin = 'http://malicious.test:8080';

    const res = await http(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${org.admin.accessToken}`)
      .set('Origin', maliciousOrigin);

    // The response must NOT echo back the malicious origin
    const acao = res.headers['access-control-allow-origin'] as string | undefined;

    // If CORS header is present, it must NOT be the malicious origin
    if (acao !== undefined) {
      expect(acao).not.toBe(maliciousOrigin);
    }
    // If the header is absent, that's also acceptable (no CORS configured = no leak)
  });

  // ── QA-SEC-004 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-004 | P1
   * Scenario: Passwords are stored as bcrypt hashes, not plaintext.
   * Queries the users table directly for the password_hash column of the
   * registered admin user and verifies the value starts with '$2b$' (bcrypt
   * identifier) and does not equal the plaintext password.
   */
  it('QA-SEC-004 | P1 — user password is stored as a bcrypt hash, not plaintext', async () => {
    const rows = await ds.query(
      `SELECT password_hash FROM users WHERE email = $1`,
      [adminEmail],
    );

    expect(rows.length).toBe(1);
    const passwordHash: string = rows[0].password_hash;

    // Must be a bcrypt hash (starts with $2b$ for bcrypt version 2b)
    expect(passwordHash).toMatch(/^\$2b\$/);

    // Must NOT be the plaintext password
    expect(passwordHash).not.toBe(adminPassword);

    // Must have bcrypt hash length (bcrypt hashes are always 60 chars)
    expect(passwordHash.length).toBe(60);
  });

  // ── QA-SEC-005 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-005 | P1
   * Scenario: A JWT with algorithm='none' (unsigned) is rejected with HTTP 401.
   * An attacker can craft a token with alg=none and an arbitrary payload
   * if the server accepts unsigned tokens. The JWT strategy must not accept these.
   */
  it('QA-SEC-005 | P1 — JWT with algorithm=none is rejected with 401', async () => {
    // Craft a fake unsigned JWT: base64url(header).base64url(payload).empty-signature
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');

    const payload = Buffer.from(
      JSON.stringify({
        sub: '00000000-0000-4000-a000-000000000099',
        orgId: org.id,
        role: 'org_admin',
        email: 'attacker@evil.test',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');

    // alg=none means no signature — the signature part is an empty string
    const fakeToken = `${header}.${payload}.`;

    const res = await http(app)
      .get('/api/v1/organisations/me')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBeTruthy();
  });

  // ── QA-SEC-006 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-006 | P1
   * Scenario: The user list endpoint does not expose sensitive fields.
   * GET /organisations/me/users must not return passwordHash, password_hash,
   * refreshTokenHash, or any other credential-related field in the response.
   * This verifies the DTO layer strips internal DB columns.
   */
  it('QA-SEC-006 | P1 — user list does not expose passwordHash or refreshTokenHash', async () => {
    const usersRes = await authGet(app, org.admin, '/api/v1/organisations/me/users');
    expect(usersRes.status).toBe(200);

    const users: Array<Record<string, unknown>> = usersRes.body.data ?? [];
    expect(users.length).toBeGreaterThan(0);

    for (const user of users) {
      // Sensitive DB columns must not be present in the API response
      expect(user['passwordHash']).toBeUndefined();
      expect(user['password_hash']).toBeUndefined();
      expect(user['refreshTokenHash']).toBeUndefined();
      expect(user['refresh_token_hash']).toBeUndefined();

      // Must have expected public fields
      expect(user['id']).toBeTruthy();
      expect(user['email']).toBeTruthy();
      expect(user['role']).toBeTruthy();
    }
  });

  // ── QA-SEC-007 ────────────────────────────────────────────────────────────

  /**
   * QA-SEC-007 | P1
   * Scenario: Refresh token is not present in the response body after login.
   * This is the explicit contract check: the auth controller strips the
   * refreshToken from the JSON payload and places it only in the HttpOnly cookie.
   * Any accidental leak (e.g. a future refactor re-exposing the field) is caught here.
   */
  it('QA-SEC-007 | P1 — refreshToken is absent from the login response body', async () => {
    const loginRes = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(loginRes.status).toBe(200);

    // Stringify the entire body and search for 'refreshToken' as a JSON key
    const bodyString = JSON.stringify(loginRes.body);

    // The string 'refreshToken' or 'refresh_token' must not appear as a JSON key
    expect(bodyString).not.toMatch(/"refreshToken"\s*:/);
    expect(bodyString).not.toMatch(/"refresh_token"\s*:/);

    // The accessToken IS expected to be in the body
    expect(loginRes.body.data?.accessToken).toBeTruthy();

    // Positive assertion: the token IS in the Set-Cookie header
    const rawCookies: string[] = Array.isArray(loginRes.headers['set-cookie'])
      ? (loginRes.headers['set-cookie'] as string[])
      : loginRes.headers['set-cookie']
      ? [loginRes.headers['set-cookie'] as string]
      : [];

    const hasRefreshCookie = rawCookies.some((c) =>
      c.toLowerCase().startsWith('refresh_token'),
    );
    expect(hasRefreshCookie).toBe(true);
  });
});
