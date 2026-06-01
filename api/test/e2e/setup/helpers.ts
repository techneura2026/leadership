import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthSession {
  accessToken: string;
  refreshCookie: string;
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

export interface TestOrg {
  id: string;
  slug: string;
  plan: string;
  trialEndsAt: string | null;
  admin: AuthSession;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

export function req(app: INestApplication) {
  return request(app.getHttpServer());
}

/** Registers a new organisation and returns the admin session. */
export async function registerOrg(
  app: INestApplication,
  data: {
    orgName: string;
    orgSlug: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  },
): Promise<TestOrg> {
  const res = await req(app).post('/api/v1/auth/register').send(data).expect(201);

  const { accessToken, user, organisation } = res.body.data;
  const refreshCookie = extractRefreshCookie(res);

  return {
    id: organisation.id,
    slug: organisation.slug,
    plan: organisation.plan,
    trialEndsAt: organisation.trialEndsAt,
    admin: {
      accessToken,
      refreshCookie,
      userId: user.id,
      orgId: organisation.id,
      email: user.email,
      role: user.role,
    },
  };
}

/** Logs in with email/password and returns an auth session. */
export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await req(app).post('/api/v1/auth/login').send({ email, password }).expect(200);

  const { accessToken, user, organisation } = res.body.data;
  return {
    accessToken,
    refreshCookie: extractRefreshCookie(res),
    userId: user.id,
    orgId: organisation.id,
    email: user.email,
    role: user.role,
  };
}

/** Minimal type accepted by auth helpers — only accessToken is required. */
export type MinAuth = Pick<AuthSession, 'accessToken'> & Partial<AuthSession>;

/** Returns an authenticated supertest agent (sets Authorization + Cookie). */
export function authed(
  app: INestApplication,
  session: MinAuth,
): request.SuperTest<request.Test> {
  const agent = request(app.getHttpServer()).set('Authorization', `Bearer ${session.accessToken}`);
  if (session.refreshCookie) agent.set('Cookie', session.refreshCookie);
  return agent as any;
}

/** GET helper with auth. */
export function authGet(app: INestApplication, session: MinAuth, path: string) {
  const r = req(app).get(path).set('Authorization', `Bearer ${session.accessToken}`);
  if (session.refreshCookie) r.set('Cookie', session.refreshCookie);
  return r;
}

/** POST helper with auth. */
export function authPost(app: INestApplication, session: MinAuth, path: string, body?: any) {
  const r = req(app).post(path).set('Authorization', `Bearer ${session.accessToken}`);
  if (session.refreshCookie) r.set('Cookie', session.refreshCookie);
  return r.send(body ?? {});
}

/** PATCH helper with auth. */
export function authPatch(app: INestApplication, session: MinAuth, path: string, body?: any) {
  const r = req(app).patch(path).set('Authorization', `Bearer ${session.accessToken}`);
  if (session.refreshCookie) r.set('Cookie', session.refreshCookie);
  return r.send(body ?? {});
}

/** DELETE helper with auth. */
export function authDelete(app: INestApplication, session: MinAuth, path: string) {
  const r = req(app).delete(path).set('Authorization', `Bearer ${session.accessToken}`);
  if (session.refreshCookie) r.set('Cookie', session.refreshCookie);
  return r;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export function extractRefreshCookie(res: request.Response): string {
  const cookieHeader = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(cookieHeader) ? cookieHeader : (cookieHeader ? [cookieHeader as string] : []);
  const raw = cookies.join('; ');
  const match = raw.match(/refresh_token=[^;]+/);
  return match ? match[0] : '';
}

export function extractRefreshTokenValue(cookieStr: string): string {
  const match = cookieStr.match(/refresh_token=([^;]+)/);
  return match ? match[1] : '';
}

// ── Assessment helpers ────────────────────────────────────────────────────────

/** Creates a draft assessment and returns its id. */
export async function createDraftAssessment(
  app: INestApplication,
  session: AuthSession,
  data: { title: string; assessmentType: string; config?: any },
): Promise<string> {
  const res = await authPost(app, session, '/api/v1/assessments', data).expect(201);
  return res.body.data.id as string;
}

/** Adds a participant to an assessment. */
export async function addParticipant(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
  userId: string,
): Promise<void> {
  await authPost(app, session, `/api/v1/assessments/${assessmentId}/participants`, {
    userId,
  }).expect(201);
}

/** Launches an assessment (DRAFT → ACTIVE). */
export async function launchAssessment(
  app: INestApplication,
  session: AuthSession,
  assessmentId: string,
): Promise<void> {
  await authPost(app, session, `/api/v1/assessments/${assessmentId}/launch`).expect(200);
}

/** Creates org, adds a participant user (via DB direct insert), and returns IDs. */
export async function setupAssessmentWithParticipant(
  app: INestApplication,
  admin: AuthSession,
  participantUserId: string,
  assessmentType = '360_feedback',
  title = 'Test Assessment',
): Promise<{ assessmentId: string }> {
  const assessmentId = await createDraftAssessment(app, admin, {
    title,
    assessmentType,
  });
  await addParticipant(app, admin, assessmentId, participantUserId);
  await launchAssessment(app, admin, assessmentId);
  return { assessmentId };
}

// ── User helpers ──────────────────────────────────────────────────────────────

/**
 * Registers a secondary user in an existing org via direct DB insert (bypasses invite flow).
 * This is a test helper only — real users are created via invitation flow in the app.
 */
export async function createUserInOrg(
  ds: DataSource,
  orgId: string,
  data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    password: string;
  },
): Promise<string> {
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash(data.password, 4);
  const result = await ds.query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, role, is_active, email_verified, language_pref, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, true, 'en', now(), now())
     RETURNING id`,
    [orgId, data.email, passwordHash, data.firstName, data.lastName, data.role],
  );
  return result[0].id as string;
}

// ── Plan helpers ──────────────────────────────────────────────────────────────

/** Directly sets the plan on an org in the DB. */
export async function setOrgPlan(
  ds: DataSource,
  orgId: string,
  plan: string,
): Promise<void> {
  await ds.query(`UPDATE organisations SET plan = $1 WHERE id = $2`, [plan, orgId]);
}

/** Sets trial_ends_at to a past date to simulate an expired trial. */
export async function expireOrgTrial(ds: DataSource, orgId: string): Promise<void> {
  await ds.query(
    `UPDATE organisations SET trial_ends_at = now() - interval '1 day' WHERE id = $1`,
    [orgId],
  );
}

/** Deactivates an org. */
export async function deactivateOrg(ds: DataSource, orgId: string): Promise<void> {
  await ds.query(`UPDATE organisations SET is_active = false WHERE id = $1`, [orgId]);
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Returns the shared e2e DataSource created by globalSetup. */
export function getE2EDataSource(): DataSource {
  const ds = (global as any).__E2E_DS__;
  if (!ds) throw new Error('E2E DataSource not initialised — check globalSetup');
  return ds;
}

/** Fetches all competency IDs for use in assessment configs. */
export async function getSeedCompetencyIds(ds: DataSource, limit = 4): Promise<string[]> {
  const rows = await ds.query(`SELECT id FROM competencies WHERE organisation_id IS NULL LIMIT $1`, [limit]);
  return rows.map((r: any) => r.id);
}

/** Fetches normative data to verify scoring formulas. */
export async function getNormData(ds: DataSource, factor: string): Promise<{ mean: number; std_dev: number }> {
  const rows = await ds.query(
    `SELECT mean, std_dev FROM normative_data WHERE factor = $1 AND population = 'sri_lanka_general'`,
    [factor],
  );
  return rows[0];
}

/** Fetches all Big Five item IDs for a specific factor. */
export async function getPersonalityItemIds(
  ds: DataSource,
  factor: string,
): Promise<Array<{ id: string; is_reverse: boolean }>> {
  return ds.query(
    `SELECT id, is_reverse FROM items WHERE module = 'personality' AND factor = $1 AND is_active = true`,
    [factor],
  );
}
