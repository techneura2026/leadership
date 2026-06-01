/**
 * E2E Test Suite: Input Validation & Error Handling
 * QA Scenarios: QA-VAL-001 through QA-VAL-006
 *
 * Validates that the API enforces DTO constraints, rejects malicious inputs
 * safely, strips unknown fields, enforces UUID route params, and returns a
 * consistent error envelope shape across all error status codes.
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp, http } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  authGet,
  authPost,
  TestOrg,
} from './setup/helpers';
import { ORGS, INVALID_INPUTS } from './setup/factories';

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

describe('[QA-VAL] Input Validation & Error Handling', () => {
  let app: INestApplication;
  let ds: DataSource;

  // A registered session used across tests that need an authenticated context
  let org: TestOrg;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
  });

  // ── QA-VAL-001 ────────────────────────────────────────────────────────────

  /**
   * QA-VAL-001 | P1
   * Scenario: Missing required fields on key endpoints return HTTP 400 with
   * VALIDATION_ERROR code and a populated `fields` object naming the bad fields.
   * Tests three endpoints: register (missing email), createAssessment (missing
   * assessmentType), and createDepartment (missing name).
   */
  it('QA-VAL-001 | P1 — missing required fields return 400 VALIDATION_ERROR with fields', async () => {
    // ── Register without email ─────────────────────────────────────────────
    const noEmailRes = await http(app)
      .post('/api/v1/auth/register')
      .send({
        orgName: 'Missing Email Org',
        orgSlug: `missing-email-${uid()}`,
        firstName: 'Kasun',
        lastName: 'Perera',
        // email is intentionally omitted
        password: 'SecurePass1!',
      });
    expect(noEmailRes.status).toBe(400);
    expect(noEmailRes.body.error).toBeDefined();
    expect(noEmailRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(noEmailRes.body.meta?.timestamp).toBeTruthy();
    // The fields object must name 'email'
    expect(noEmailRes.body.error.fields).toBeDefined();
    expect(Object.keys(noEmailRes.body.error.fields)).toContain('email');

    // ── Create assessment without assessmentType ───────────────────────────
    const noTypeRes = await authPost(app, org.admin, '/api/v1/assessments', {
      title: 'Missing Type Assessment',
      // assessmentType is intentionally omitted
    });
    expect(noTypeRes.status).toBe(400);
    expect(noTypeRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(noTypeRes.body.error.fields).toBeDefined();
    expect(Object.keys(noTypeRes.body.error.fields)).toContain('assessmentType');

    // ── Create department without name ─────────────────────────────────────
    const noDeptNameRes = await authPost(
      app,
      org.admin,
      '/api/v1/organisations/me/departments',
      {
        // name is intentionally omitted
      },
    );
    expect(noDeptNameRes.status).toBe(400);
    expect(noDeptNameRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(noDeptNameRes.body.error.fields).toBeDefined();
    expect(Object.keys(noDeptNameRes.body.error.fields)).toContain('name');
  });

  // ── QA-VAL-002 ────────────────────────────────────────────────────────────

  /**
   * QA-VAL-002 | P1
   * Scenario: SQL injection and XSS payloads are handled safely.
   * A login attempt with a SQL injection email returns 400 (invalid email format),
   * not 500 (which would indicate the DB received the raw payload). A title with
   * an XSS payload is stored as a literal string and does not crash the server.
   * After both attempts, the users table must still be queryable.
   */
  it('QA-VAL-002 | P1 — SQL injection returns 400 and XSS payload is stored as literal', async () => {
    // ── SQL injection in email field ───────────────────────────────────────
    const sqlInjectRes = await http(app)
      .post('/api/v1/auth/login')
      .send({
        email: INVALID_INPUTS.sqlInjection,
        password: 'AnyPassword1!',
      });

    // Must be 400 (invalid email format fails DTO validation) — NOT 500
    expect(sqlInjectRes.status).toBe(400);
    expect(sqlInjectRes.status).not.toBe(500);

    // ── XSS in assessment title ────────────────────────────────────────────
    const xssRes = await authPost(app, org.admin, '/api/v1/assessments', {
      title: INVALID_INPUTS.xssPayload,
      assessmentType: 'personality',
    });
    // Must succeed (stored as literal text, not executed)
    expect(xssRes.status).toBe(201);
    const storedTitle: string = xssRes.body.data?.title ?? '';
    // Title stored exactly as-is (not sanitised away)
    expect(storedTitle).toBe(INVALID_INPUTS.xssPayload);

    // ── Verify users table is still intact ────────────────────────────────
    const rows = await ds.query(`SELECT COUNT(*) as cnt FROM users WHERE organisation_id = $1`, [
      org.id,
    ]);
    expect(Number(rows[0].cnt)).toBeGreaterThan(0);

    // GET users endpoint must also work
    const usersRes = await authGet(app, org.admin, '/api/v1/organisations/me/users');
    expect(usersRes.status).toBe(200);
    const users: unknown[] = usersRes.body.data ?? [];
    expect(users.length).toBeGreaterThan(0);
  });

  // ── QA-VAL-003 ────────────────────────────────────────────────────────────

  /**
   * QA-VAL-003 | P1
   * Scenario: Excessively long orgName (10 001 characters) returns HTTP 400.
   * The DTO has @MaxLength(100) on orgName. Sending 10 001 characters must be
   * rejected with a VALIDATION_ERROR, not accepted or causing a DB overflow error.
   */
  it('QA-VAL-003 | P1 — orgName exceeding MaxLength returns 400 VALIDATION_ERROR', async () => {
    const res = await http(app)
      .post('/api/v1/auth/register')
      .send({
        orgName: INVALID_INPUTS.longString, // 10 001 chars
        orgSlug: `long-name-${uid()}`,
        firstName: 'Nuwan',
        lastName: 'Silva',
        email: `nuwan-long+${uid()}@test.lk`,
        password: 'SecurePass1!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.meta?.timestamp).toBeTruthy();
  });

  // ── QA-VAL-004 ────────────────────────────────────────────────────────────

  /**
   * QA-VAL-004 | P1
   * Scenario: Extra unknown fields sent during registration are silently stripped
   * and do not elevate the user's role. Sending isAdmin=true and superUser=true
   * alongside a valid payload must result in the user having role='org_admin'
   * (the default registration role), not any super-admin or elevated role.
   */
  it('QA-VAL-004 | P1 — unknown extra fields are stripped and do not elevate role', async () => {
    const res = await http(app)
      .post('/api/v1/auth/register')
      .send({
        orgName: 'Extra Fields Org',
        orgSlug: `extra-fields-${uid()}`,
        firstName: 'Ishara',
        lastName: 'Fernando',
        email: `ishara-extra+${uid()}@test.lk`,
        password: 'SecurePass1!',
        // Extra fields that should be stripped by whitelist: true
        isAdmin: true,
        superUser: true,
        role: 'super_admin',
        _internal: true,
      });

    expect(res.status).toBe(201);
    const user = res.body.data?.user;
    expect(user).toBeDefined();

    // Role must be the expected default for a registration
    expect(user.role).toBe('org_admin');

    // Must not contain injected privileged fields
    expect(user.isAdmin).toBeUndefined();
    expect(user.superUser).toBeUndefined();
    expect((user.role as string).toLowerCase()).not.toContain('super');
  });

  // ── QA-VAL-005 ────────────────────────────────────────────────────────────

  /**
   * QA-VAL-005 | P1
   * Scenario: Invalid UUID route parameters return 400 or 404, never 500.
   * Sending a non-UUID string as an assessment ID must be handled by the
   * validation layer or the ORM — a 500 would indicate an unhandled DB exception
   * caused by invalid UUID format.
   */
  it('QA-VAL-005 | P1 — invalid UUID route params return 400 or 404, not 500', async () => {
    // ── GET /assessments/:id with a non-UUID ─────────────────────────────
    const badUuidRes = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${INVALID_INPUTS.invalidUuid}`,
    );
    expect(badUuidRes.status).not.toBe(500);
    expect([400, 404]).toContain(badUuidRes.status);
    expect(badUuidRes.body.error).toBeDefined();
    expect(badUuidRes.body.error.code).toBeTruthy();
    expect(badUuidRes.body.meta?.timestamp).toBeTruthy();

    // ── GET /rater/:token with a non-UUID (public endpoint) ───────────────
    const raterRes = await http(app).get(`/api/v1/rater/${INVALID_INPUTS.invalidUuid}`);
    expect(raterRes.status).not.toBe(500);
    expect([400, 404]).toContain(raterRes.status);

    // ── GET /assessments/:id/sjt/:participantId with non-UUIDs ────────────
    const badSjtRes = await authGet(
      app,
      org.admin,
      `/api/v1/assessments/${INVALID_INPUTS.invalidUuid}/sjt/${INVALID_INPUTS.invalidUuid}`,
    );
    expect(badSjtRes.status).not.toBe(500);
    expect([400, 404]).toContain(badSjtRes.status);
  });

  // ── QA-VAL-006 ────────────────────────────────────────────────────────────

  /**
   * QA-VAL-006 | P1
   * Scenario: The error envelope is consistent across all HTTP error status codes
   * (400, 401, 404, 409). Every error response must have the shape
   * { error: { code, message }, meta: { timestamp } } and must not be plain text.
   * This validates that the HttpExceptionFilter is applied globally.
   */
  it('QA-VAL-006 | P1 — error envelope is consistent across all HTTP error status codes', async () => {
    /**
     * Helper that validates the standard error envelope shape.
     */
    function assertErrorEnvelope(
      res: { status: number; body: Record<string, unknown>; headers: Record<string, string> },
      expectedStatus: number,
    ) {
      expect(res.status).toBe(expectedStatus);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.error).toBeDefined();
      const err = res.body.error as Record<string, unknown>;
      expect(typeof err.code).toBe('string');
      expect(err.code).toBeTruthy();
      expect(typeof err.message).toBe('string');
      expect(err.message).toBeTruthy();
      const meta = res.body.meta as Record<string, unknown>;
      expect(meta).toBeDefined();
      expect(typeof meta.timestamp).toBe('string');
    }

    // ── 400: validation error ──────────────────────────────────────────────
    const res400 = await http(app)
      .post('/api/v1/auth/register')
      .send({ orgSlug: `env-400-${uid()}` }); // missing many required fields
    assertErrorEnvelope(res400, 400);

    // ── 401: unauthenticated access ────────────────────────────────────────
    const res401 = await http(app).get('/api/v1/organisations/me');
    assertErrorEnvelope(res401, 401);

    // ── 404: resource not found ────────────────────────────────────────────
    const nonexistentId = INVALID_INPUTS.nonExistentUuid;
    const res404 = await authGet(app, org.admin, `/api/v1/assessments/${nonexistentId}`);
    assertErrorEnvelope(res404, 404);

    // ── 409: conflict (duplicate registration) ─────────────────────────────
    const dupEmail = `dup-env+${uid()}@test.lk`;
    const dupSlug = `dup-env-${uid()}`;

    // First registration succeeds
    await http(app).post('/api/v1/auth/register').send({
      orgName: 'Dup Test Org',
      orgSlug: dupSlug,
      firstName: 'Dilini',
      lastName: 'Wickramasinghe',
      email: dupEmail,
      password: 'SecurePass1!',
    }).expect(201);

    // Second registration with same email → 409
    const res409 = await http(app)
      .post('/api/v1/auth/register')
      .send({
        orgName: 'Dup Test Org 2',
        orgSlug: `${dupSlug}-b`,
        firstName: 'Dilini',
        lastName: 'Wickramasinghe',
        email: dupEmail, // same email → conflict
        password: 'SecurePass1!',
      });
    assertErrorEnvelope(res409, 409);
  });
});
