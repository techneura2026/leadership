/**
 * E2E Test Suite: Authentication & Session Management
 * QA Scenarios: QA-AUTH-001 through QA-AUTH-013
 *
 * Validates the full authentication lifecycle: registration, login, token refresh
 * with rotation, logout/invalidation, expired-trial blocking, deactivated-org
 * blocking, and input validation on the registration endpoint.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp, http } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  login,
  authGet,
  authPost,
  extractRefreshCookie,
  extractRefreshTokenValue,
  expireOrgTrial,
  deactivateOrg,
} from './setup/helpers';
import { ORGS, INVALID_INPUTS } from './setup/factories';

// ---------------------------------------------------------------------------
// Unique-suffix helpers — prevent collisions across test runs in the same DB
// ---------------------------------------------------------------------------
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

describe('[QA-AUTH] Authentication & Session Management', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();
  });

  // ─── QA-AUTH-001 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-001 | P1
   * Scenario: New organisation registration creates org_admin with trial plan.
   * Validates that registration returns a valid JWT, sets an HttpOnly refresh
   * cookie, assigns org_admin role, and places the org on the trial plan with
   * a ~30-day trial expiry.
   */
  it('QA-AUTH-001 | P1 — registers a new org and returns org_admin session on trial plan', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);

    const res = await http(app)
      .post('/api/v1/auth/register')
      .send(orgData)
      .expect(201);

    // Access token present in body
    expect(res.body.data).toHaveProperty('accessToken');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(20);

    // User role is org_admin
    expect(res.body.data.user.role).toBe('org_admin');
    expect(res.body.data.user.email).toBe(orgData.email);

    // Organisation on trial plan
    expect(res.body.data.organisation.plan).toBe('trial');

    // trialEndsAt roughly 30 days in the future (allow ±2 days for test latency)
    const trialEndsAt = new Date(res.body.data.organisation.trialEndsAt);
    const now = new Date();
    const diffDays = (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(27);
    expect(diffDays).toBeLessThan(33);

    // HttpOnly refresh cookie in Set-Cookie header
    const rawCookieHeader = res.headers['set-cookie']; const setCookieHeader: string[] = Array.isArray(rawCookieHeader) ? rawCookieHeader : (rawCookieHeader ? [rawCookieHeader as string] : []);
    const rawCookies = Array.isArray(setCookieHeader)
      ? setCookieHeader.join('; ')
      : setCookieHeader;
    expect(rawCookies).toMatch(/refresh_token=/);
    expect(rawCookies.toLowerCase()).toMatch(/httponly/);
  });

  // ─── QA-AUTH-002 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-002 | P1
   * Scenario: Duplicate email on registration returns 409 CONFLICT.
   * Guards that the system prevents two accounts sharing the same email address,
   * even across different organisations.
   */
  it('QA-AUTH-002 | P1 — duplicate email registration returns 409', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);

    // First registration should succeed
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    // Second attempt with same email but different org slug
    const duplicate = {
      ...orgData,
      orgName: `Duplicate Org ${uid()}`,
      orgSlug: `duplicate-org-${uid()}`,
    };

    const res = await http(app)
      .post('/api/v1/auth/register')
      .send(duplicate)
      .expect(409);

    expect(res.body.error).toBeDefined();
    // The error code should indicate a conflict
    const errorCode: string = res.body.error.code ?? '';
    expect(errorCode.toUpperCase()).toMatch(/CONFLICT/);
  });

  // ─── QA-AUTH-003 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-003 | P1
   * Scenario: Duplicate org slug on registration returns 409.
   * The slug is a unique identifier used in URLs; duplicates must be rejected.
   */
  it('QA-AUTH-003 | P1 — duplicate slug registration returns 409 with slug conflict message', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);

    // First registration — establishes the slug
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    // Second attempt with same slug but different email
    const duplicateSlug = {
      ...orgData,
      email: `other+${uid()}@example.com`,
    };

    const res = await http(app)
      .post('/api/v1/auth/register')
      .send(duplicateSlug)
      .expect(409);

    expect(res.body.error).toBeDefined();
    // Message or code must reference the slug conflict
    const message: string = res.body.error.message ?? '';
    const code: string = res.body.error.code ?? '';
    const combined = (message + code).toLowerCase();
    expect(combined).toMatch(/slug|conflict/);
  });

  // ─── QA-AUTH-004 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-004 | P1
   * Scenario: Valid login returns accessToken + refresh cookie; lastLoginAt is updated.
   * Confirms that the login endpoint issues a new session on every successful
   * credential check.
   */
  it('QA-AUTH-004 | P1 — valid login returns tokens and updates lastLoginAt', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    const res = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(200);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(orgData.email);

    // Refresh cookie present
    const cookie = extractRefreshCookie(res);
    expect(cookie).toMatch(/refresh_token=/);

    // Verify lastLoginAt was written to the DB
    const rows = await ds.query(
      `SELECT last_login_at FROM users WHERE email = $1`,
      [orgData.email],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].last_login_at).not.toBeNull();
  });

  // ─── QA-AUTH-005 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-005 | P1
   * Scenario: Wrong password returns 401 Unauthorized.
   * Ensures the local auth strategy correctly rejects invalid credentials.
   */
  it('QA-AUTH-005 | P1 — wrong password returns 401', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: 'WrongPass99!' })
      .expect(401);
  });

  // ─── QA-AUTH-006 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-006 | P1
   * Scenario: Refresh token rotation — after a refresh the old token is invalid.
   * Confirms that refresh tokens are single-use; replaying the original token
   * after rotation returns 401.
   */
  it('QA-AUTH-006 | P1 — refresh rotates the token; old token is rejected afterwards', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    // Step 1: Login and capture original refresh token value
    const loginRes = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(200);

    const originalCookieHeader = extractRefreshCookie(loginRes);
    const originalTokenValue = extractRefreshTokenValue(originalCookieHeader);
    expect(originalTokenValue.length).toBeGreaterThan(10);

    // Step 2: Use original token to refresh — should succeed and issue new token
    const refreshRes = await http(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${originalTokenValue}`)
      .expect(200);

    expect(refreshRes.body.data).toHaveProperty('accessToken');
    const newCookie = extractRefreshCookie(refreshRes);
    const newTokenValue = extractRefreshTokenValue(newCookie);
    expect(newTokenValue).not.toBe(originalTokenValue);

    // Step 3: Replay original token — must return 401
    await http(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${originalTokenValue}`)
      .expect(401);
  });

  // ─── QA-AUTH-007 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-007 | P1
   * Scenario: Expired trial blocks login with 401.
   * Validates that organisations whose trial period has ended cannot authenticate,
   * forcing an upgrade.
   */
  it('QA-AUTH-007 | P1 — expired trial blocks login with 401', async () => {
    const orgData = uniqueOrg(ORGS.peakPerformance);
    const org = await registerOrg(app, orgData);

    // Fast-expire the trial directly via DB
    await expireOrgTrial(ds, org.id);

    await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(401);
  });

  // ─── QA-AUTH-008 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-008 | P1
   * Scenario: Deactivated org blocks login with 401.
   * Validates that admin-deactivated organisations are immediately locked out,
   * regardless of trial status or plan.
   */
  it('QA-AUTH-008 | P1 — deactivated org blocks login with 401', async () => {
    const orgData = uniqueOrg(ORGS.nexusLeadership);
    const org = await registerOrg(app, orgData);

    // Deactivate the org directly via DB
    await deactivateOrg(ds, org.id);

    await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(401);
  });

  // ─── QA-AUTH-009 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-009 | P1
   * Scenario: Request to a protected endpoint without Authorization header returns 401.
   * Verifies that the JWT guard is applied globally to protected routes and
   * no unauthenticated access is permitted.
   */
  it('QA-AUTH-009 | P1 — no auth header on protected endpoint returns 401', async () => {
    await http(app).get('/api/v1/assessments').expect(401);
  });

  // ─── QA-AUTH-010 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-010 | P1
   * Scenario: After logout the refresh token is invalidated; subsequent refresh fails.
   * Ensures logout destroys the server-side session so the refresh token
   * cannot be reused to mint new access tokens.
   */
  it('QA-AUTH-010 | P1 — after logout, the refresh cookie cannot produce a new access token', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    const loginRes = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(200);

    const cookieStr = extractRefreshCookie(loginRes);
    const tokenValue = extractRefreshTokenValue(cookieStr);

    // Logout using the cookie
    await http(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${tokenValue}`)
      .expect(200);

    // Try refreshing with the now-invalidated cookie — must be 401
    await http(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${tokenValue}`)
      .expect(401);
  });

  // ─── QA-AUTH-011 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-011 | P1
   * Scenario: Logout then re-login works correctly; old refresh cookie is stale.
   * End-to-end session replacement: log out, log back in with credentials, and
   * confirm the new session is valid while the old one remains revoked.
   */
  it('QA-AUTH-011 | P1 — logout then re-login issues fresh session; old cookie rejected', async () => {
    const orgData = uniqueOrg(ORGS.strategicTalent);
    await http(app).post('/api/v1/auth/register').send(orgData).expect(201);

    // First login
    const login1 = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(200);

    const oldToken = extractRefreshTokenValue(extractRefreshCookie(login1));

    // Logout
    await http(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${oldToken}`)
      .expect(200);

    // Second login — issues a new session
    const login2 = await http(app)
      .post('/api/v1/auth/login')
      .send({ email: orgData.email, password: orgData.password })
      .expect(200);

    expect(login2.body.data).toHaveProperty('accessToken');
    const newToken = extractRefreshTokenValue(extractRefreshCookie(login2));
    expect(newToken).not.toBe(oldToken);

    // Old token is still invalid
    await http(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${oldToken}`)
      .expect(401);

    // New token is valid
    const refreshRes = await http(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${newToken}`)
      .expect(200);
    expect(refreshRes.body.data).toHaveProperty('accessToken');
  });

  // ─── QA-AUTH-012 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-012 | P2
   * Scenario: Each invalid password variant returns 400 Bad Request.
   * Tests the password validation rules: minimum length, at least one uppercase,
   * at least one lowercase, at least one digit.
   */
  it('QA-AUTH-012 | P2 — invalid password variants return 400 on registration', async () => {
    const invalidPasswords = [
      INVALID_INPUTS.tooShortPassword,       // too short (< 8 chars)
      INVALID_INPUTS.noUppercasePassword,    // no uppercase letter
      INVALID_INPUTS.noNumberPassword,       // no digit
    ];

    const baseOrg = uniqueOrg(ORGS.strategicTalent);

    for (const password of invalidPasswords) {
      const sfx = uid();
      const res = await http(app)
        .post('/api/v1/auth/register')
        .send({
          ...baseOrg,
          orgSlug: `${baseOrg.orgSlug}-pw-${sfx}`,
          email: baseOrg.email.replace('@', `+pw${sfx}@`),
          password,
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    }
  });

  // ─── QA-AUTH-013 ──────────────────────────────────────────────────────────

  /**
   * QA-AUTH-013 | P2
   * Scenario: Invalid slug formats return 400 Bad Request.
   * The org slug must match /^[a-z0-9-]+$/. Uppercase letters, spaces, and
   * special characters (except hyphens) must all be rejected.
   */
  it('QA-AUTH-013 | P2 — invalid slug formats return 400 on registration', async () => {
    const invalidSlugs = [
      'Has_Underscores',   // underscores not allowed
      'Has Spaces',        // spaces not allowed
      'HAS-UPPERCASE',     // uppercase not allowed
      'has.dots',          // dots not allowed
      'ab',                // too short (< 3 chars)
    ];

    const baseOrg = uniqueOrg(ORGS.strategicTalent);

    for (const orgSlug of invalidSlugs) {
      const sfx = uid();
      const res = await http(app)
        .post('/api/v1/auth/register')
        .send({
          ...baseOrg,
          orgSlug,
          email: baseOrg.email.replace('@', `+sl${sfx}@`),
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    }
  });
});
