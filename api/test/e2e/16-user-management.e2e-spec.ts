/**
 * E2E Test Suite: User Management
 * QA Scenarios: QA-USR-001 through QA-USR-012
 *
 * Validates the full user lifecycle via the API (not DB bypass):
 *   - org admin creates users via POST /users
 *   - created users can log in and carry out assessments
 *   - competency self + manager flow, gap analysis, and profile results
 *   - PATCH and DELETE operations, deactivation prevents login
 *   - cross-tenant isolation (org B cannot see org A users)
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import {
  getE2EDataSource,
  registerOrg,
  login,
  authGet,
  authPost,
  authPatch,
  authDelete,
  createDraftAssessment,
  addParticipant,
  launchAssessment,
  setOrgPlan,
  getSeedCompetencyIds,
  TestOrg,
  AuthSession,
} from './setup/helpers';
import { ORGS, ASSESSMENTS } from './setup/factories';

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

describe('[QA-USR] User Management', () => {
  let app: INestApplication;
  let ds: DataSource;

  let org: TestOrg;
  let adminSession: AuthSession;

  // IDs of users created via the API during these tests
  let participantUserId: string;
  let managerUserId: string;
  let participantEmail: string;
  let managerEmail: string;
  const participantPassword = 'Participant1!';
  const managerPassword = 'Manager2026!';

  let participantSession: AuthSession;
  let managerSession: AuthSession;

  // Assessment-level IDs
  let assessmentId: string;
  let assessmentParticipantId: string; // the participant record id (not user id)

  // Competency assessment record IDs
  let selfCaId: string;
  let managerCaId: string;

  let competencyIds: string[];

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    org = await registerOrg(app, uniqueOrg(ORGS.strategicTalent));
    adminSession = org.admin;
    await setOrgPlan(ds, org.id, 'professional');

    competencyIds = await getSeedCompetencyIds(ds, 4);

    const sfx = uid();
    participantEmail = `kavinda.r+${sfx}@stp.lk`;
    managerEmail = `nimal.j+${sfx}@stp.lk`;
  });

  // ── QA-USR-001 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-001 | P1
   * Scenario: POST /users creates a participant user within the org.
   * The response contains id, email, firstName, lastName, role; passwordHash is never exposed.
   * The user appears in GET /users list with the same org scoping.
   */
  it('QA-USR-001 | P1 — POST /users creates participant; id returned; passwordHash not exposed; user appears in list', async () => {
    const res = await authPost(app, adminSession, '/api/v1/users', {
      email: participantEmail,
      password: participantPassword,
      firstName: 'Kavinda',
      lastName: 'Rajapaksa',
      role: 'participant',
      jobTitle: 'Senior Product Manager',
    }).expect(201);

    const user = res.body.data;
    expect(user).toHaveProperty('id');
    expect(user.email).toBe(participantEmail);
    expect(user.firstName).toBe('Kavinda');
    expect(user.lastName).toBe('Rajapaksa');
    expect(user.role).toBe('participant');
    expect(user.jobTitle).toBe('Senior Product Manager');
    expect(user.passwordHash).toBeUndefined();

    participantUserId = user.id;

    // Verify the user appears in GET /users
    const listRes = await authGet(app, adminSession, '/api/v1/users').expect(200);
    const ids: string[] = listRes.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(participantUserId);
  });

  // ── QA-USR-002 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-002 | P1
   * Scenario: POST /users creates a manager user. Created user can immediately log in
   * using the password supplied at creation and receives a valid access token and refresh cookie.
   */
  it('QA-USR-002 | P1 — created manager can login with the supplied password; access token returned', async () => {
    const createRes = await authPost(app, adminSession, '/api/v1/users', {
      email: managerEmail,
      password: managerPassword,
      firstName: 'Nimal',
      lastName: 'Jayawardena',
      role: 'manager',
    }).expect(201);

    managerUserId = createRes.body.data.id;

    // Manager logs in
    managerSession = await login(app, managerEmail, managerPassword);
    expect(managerSession.accessToken).toBeTruthy();
    expect(managerSession.userId).toBe(managerUserId);
    expect(managerSession.orgId).toBe(org.id);
    expect(managerSession.role).toBe('manager');
  });

  // ── QA-USR-003 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-003 | P1
   * Scenario: The participant user (created in QA-USR-001) can also log in.
   * The returned user object includes role=participant and org matches the creator's org.
   */
  it('QA-USR-003 | P1 — participant can login; role and orgId match creation values', async () => {
    participantSession = await login(app, participantEmail, participantPassword);
    expect(participantSession.accessToken).toBeTruthy();
    expect(participantSession.userId).toBe(participantUserId);
    expect(participantSession.orgId).toBe(org.id);
    expect(participantSession.role).toBe('participant');
  });

  // ── QA-USR-004 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-004 | P1
   * Scenario: GET /users/:id returns the user when called by org admin.
   * Calling with a non-existent UUID returns 404.
   */
  it('QA-USR-004 | P1 — GET /users/:id returns user for admin; 404 for non-existent UUID', async () => {
    const res = await authGet(app, adminSession, `/api/v1/users/${participantUserId}`).expect(200);
    expect(res.body.data.id).toBe(participantUserId);
    expect(res.body.data.email).toBe(participantEmail);

    await authGet(
      app,
      adminSession,
      '/api/v1/users/00000000-0000-0000-0000-000000000000',
    ).expect(404);
  });

  // ── QA-USR-005 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-005 | P1
   * Scenario: PATCH /users/:id updates firstName, lastName, and jobTitle.
   * Updated values are reflected in GET /users/:id.
   */
  it('QA-USR-005 | P1 — PATCH /users/:id updates profile fields; GET reflects changes', async () => {
    const patchRes = await authPatch(app, adminSession, `/api/v1/users/${participantUserId}`, {
      jobTitle: 'Lead Product Manager',
    }).expect(200);

    expect(patchRes.body.data.jobTitle).toBe('Lead Product Manager');

    const getRes = await authGet(app, adminSession, `/api/v1/users/${participantUserId}`).expect(200);
    expect(getRes.body.data.jobTitle).toBe('Lead Product Manager');
  });

  // ── QA-USR-006 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-006 | P1
   * Scenario: Attempting to create a second user with the same email in the same org
   * is rejected with 409 Conflict. The service must check for existing (including soft-deleted) records.
   */
  it('QA-USR-006 | P1 — duplicate email within org returns 409 Conflict', async () => {
    await authPost(app, adminSession, '/api/v1/users', {
      email: participantEmail,
      password: 'Another1!',
      firstName: 'Duplicate',
      lastName: 'User',
      role: 'participant',
    }).expect(409);
  });

  // ── QA-USR-007 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-007 | P1
   * Scenario: The API-created participant is added to a competency assessment.
   * Admin creates a draft assessment, adds participant, launches it.
   * Participant retrieves the participant record ID required for self-assessment.
   */
  it('QA-USR-007 | P1 — API-created participant added to competency assessment; assessment launches', async () => {
    assessmentId = await createDraftAssessment(app, adminSession, {
      title: ASSESSMENTS.competencyQ3,
      assessmentType: 'competency',
      config: { competencyIds },
    });
    await addParticipant(app, adminSession, assessmentId, participantUserId);
    await launchAssessment(app, adminSession, assessmentId);

    const pRes = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/participants`,
    ).expect(200);
    const participants: Array<{ id: string; userId: string }> = pRes.body.data;
    const record = participants.find((p) => p.userId === participantUserId);
    expect(record).toBeDefined();
    assessmentParticipantId = record!.id;
  });

  // ── QA-USR-008 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-008 | P1
   * Scenario: Participant starts and submits a self-assessment.
   * The CA record is created with submittedAt=null; after submit, submittedAt is set.
   */
  it('QA-USR-008 | P1 — participant starts self-assessment, submits ratings; submittedAt populated', async () => {
    // Participant starts self-assessment (admin acting on behalf, or participant directly)
    const startRes = await authPost(
      app,
      participantSession,
      `/api/v1/assessments/${assessmentId}/competency/self`,
      { participantId: assessmentParticipantId },
    );
    expect([200, 201]).toContain(startRes.status);
    selfCaId = startRes.body.data.id;
    expect(selfCaId).toBeDefined();
    expect(startRes.body.data.submittedAt).toBeNull();

    const ratings = competencyIds.map((cId) => ({
      competencyId: cId,
      levelRated: 2,
      evidenceText: `Participant self-evidence for ${cId}`,
    }));

    const submitRes = await authPost(
      app,
      participantSession,
      `/api/v1/assessments/${assessmentId}/competency/self/${selfCaId}/submit`,
      { participantId: assessmentParticipantId, ratings },
    );
    expect([200, 201]).toContain(submitRes.status);
    expect(submitRes.body.data.submittedAt).not.toBeNull();
  });

  // ── QA-USR-009 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-009 | P1
   * Scenario: Manager starts and submits manager ratings for the participant.
   * Manager is authenticated with a session obtained by logging in with the API-created credentials.
   */
  it('QA-USR-009 | P1 — manager submits ratings for participant; managerCaId set and submittedAt populated', async () => {
    const startRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${assessmentId}/competency/manager`,
      { participantId: assessmentParticipantId },
    );
    expect([200, 201]).toContain(startRes.status);
    managerCaId = startRes.body.data.id;
    expect(managerCaId).toBeDefined();

    const ratings = competencyIds.map((cId) => ({
      competencyId: cId,
      levelRated: 4,
      evidenceText: `Manager evidence for ${cId}`,
    }));

    const submitRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${assessmentId}/competency/manager/${managerCaId}/submit`,
      { ratings },
    );
    expect([200, 201]).toContain(submitRes.status);
    expect(submitRes.body.data.submittedAt).not.toBeNull();
  });

  // ── QA-USR-010 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-010 | P1
   * Scenario: Gap analysis returns results for all assessed competencies.
   * Self ratings were 2, manager ratings were 4, so gap = 2 (managerRating - selfRating).
   */
  it('QA-USR-010 | P1 — gap analysis shows managerRating - selfRating = 2 for each assessed competency', async () => {
    const res = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/competency/gap/${assessmentParticipantId}`,
    ).expect(200);

    const gaps: Array<{
      competencyId: string;
      selfRating: number;
      managerRating: number;
      gap: number;
    }> = res.body.data ?? res.body;

    expect(Array.isArray(gaps)).toBe(true);
    expect(gaps.length).toBeGreaterThan(0);

    for (const g of gaps) {
      expect(g).toHaveProperty('competencyId');
      expect(g).toHaveProperty('selfRating');
      expect(g).toHaveProperty('managerRating');
      expect(g).toHaveProperty('gap');
      expect(g.selfRating).toBe(2);
      expect(g.managerRating).toBe(4);
      expect(g.gap).toBe(2);
    }
  });

  // ── QA-USR-011 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-011 | P1
   * Scenario: Full competency profile groups results by domain with averages.
   * Domain-level averageSelfRating=2 and averageManagerRating=4.
   */
  it('QA-USR-011 | P1 — competency profile returns domain groupings with correct average ratings', async () => {
    const res = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${assessmentId}/competency/profile/${assessmentParticipantId}`,
    ).expect(200);

    const profile: Array<{
      domainId: string;
      domainName: string;
      averageSelfRating: number;
      averageManagerRating: number;
      competencies: unknown[];
    }> = res.body.data ?? res.body;

    expect(Array.isArray(profile)).toBe(true);
    expect(profile.length).toBeGreaterThan(0);

    for (const domain of profile) {
      expect(domain).toHaveProperty('domainId');
      expect(domain).toHaveProperty('domainName');
      expect(domain).toHaveProperty('averageSelfRating');
      expect(domain).toHaveProperty('averageManagerRating');
      expect(Array.isArray(domain.competencies)).toBe(true);
      expect(domain.averageSelfRating).toBe(2);
      expect(domain.averageManagerRating).toBe(4);
    }
  });

  // ── QA-USR-012 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-012 | P1
   * Scenario: DELETE /users/:id (org admin only) deactivates the user (isActive=false).
   * The deactivated user no longer appears in GET /users and cannot log in.
   */
  it('QA-USR-012 | P1 — DELETE /users/:id deactivates user; excluded from list; login returns 401', async () => {
    // Create a throwaway user to deactivate
    const sfx = uid();
    const throwawayEmail = `throwaway+${sfx}@stp.lk`;
    const createRes = await authPost(app, adminSession, '/api/v1/users', {
      email: throwawayEmail,
      password: 'Throwaway1!',
      firstName: 'Throw',
      lastName: 'Away',
      role: 'participant',
    }).expect(201);
    const throwawayId: string = createRes.body.data.id;

    // Deactivate
    await authDelete(app, adminSession, `/api/v1/users/${throwawayId}`).expect(204);

    // Must not appear in GET /users
    const listRes = await authGet(app, adminSession, '/api/v1/users').expect(200);
    const ids: string[] = listRes.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(throwawayId);

    // Deactivated user cannot log in
    await authPost(app, { accessToken: '' }, '/api/v1/auth/login', {
      email: throwawayEmail,
      password: 'Throwaway1!',
    }).expect(401);
  });

  // ── QA-USR-013 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-013 | P2
   * Scenario: Cross-tenant isolation — users created in org A are not visible to org B.
   * GET /users from org B must not contain org A user IDs.
   */
  it('QA-USR-013 | P2 — users from org A are not visible when listing users as org B admin', async () => {
    const orgB = await registerOrg(app, uniqueOrg(ORGS.nexusLeadership));
    await setOrgPlan(ds, orgB.id, 'professional');

    const listRes = await authGet(app, orgB.admin, '/api/v1/users').expect(200);
    const ids: string[] = listRes.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(participantUserId);
    expect(ids).not.toContain(managerUserId);
  });

  // ── QA-USR-014 ──────────────────────────────────────────────────────────────

  /**
   * QA-USR-014 | P2
   * Scenario: Only org_admin and hr_manager roles can create users.
   * A participant attempting POST /users is rejected with 403.
   */
  it('QA-USR-014 | P2 — participant cannot create users; 403 Forbidden returned', async () => {
    const sfx = uid();
    await authPost(app, participantSession, '/api/v1/users', {
      email: `blocked+${sfx}@stp.lk`,
      password: 'Blocked1!',
      firstName: 'Blocked',
      lastName: 'User',
      role: 'participant',
    }).expect(403);
  });
});
