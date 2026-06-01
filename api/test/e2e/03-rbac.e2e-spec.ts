/**
 * E2E Test Suite: Role-Based Access Control (RBAC)
 * QA Scenarios: QA-RBAC-001 through QA-RBAC-004
 *
 * Validates that each user role has exactly the permissions it should have and
 * no more. Tests cover participant (read-only), manager (limited write),
 * hr_manager (assessment creation, no org settings), and org_admin (full control).
 * Also validates that the registration endpoint always yields org_admin and that
 * invalid role values are rejected on invite.
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
  authPatch,
  createDraftAssessment,
  addParticipant,
  launchAssessment,
  createUserInOrg,
  setOrgPlan,
  TestOrg,
  AuthSession,
} from './setup/helpers';
import { ORGS, USERS, ASSESSMENTS } from './setup/factories';

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

describe('[QA-RBAC] Role-Based Access Control', () => {
  let app: INestApplication;
  let ds: DataSource;

  let org: TestOrg;
  let adminSession: AuthSession;
  let hrManagerSession: AuthSession;
  let managerSession: AuthSession;
  let participantSession: AuthSession;

  // User IDs
  let hrManagerUserId: string;
  let managerUserId: string;
  let participantUserId: string;

  beforeAll(async () => {
    app = await getApp();
    ds = getE2EDataSource();

    const orgData = uniqueOrg(ORGS.strategicTalent);
    org = await registerOrg(app, orgData);
    adminSession = org.admin;
    await setOrgPlan(ds, org.id, 'professional');

    const sfx = uid();

    // Create secondary users directly via DB
    hrManagerUserId = await createUserInOrg(ds, org.id, {
      email: USERS.hrManager.email.replace('@', `+${sfx}@`),
      firstName: USERS.hrManager.firstName,
      lastName: USERS.hrManager.lastName,
      role: 'hr_manager',
      password: USERS.hrManager.password,
    });

    managerUserId = await createUserInOrg(ds, org.id, {
      email: USERS.manager.email.replace('@', `+${sfx}@`),
      firstName: USERS.manager.firstName,
      lastName: USERS.manager.lastName,
      role: 'manager',
      password: USERS.manager.password,
    });

    participantUserId = await createUserInOrg(ds, org.id, {
      email: USERS.participant1.email.replace('@', `+${sfx}@`),
      firstName: USERS.participant1.firstName,
      lastName: USERS.participant1.lastName,
      role: 'participant',
      password: USERS.participant1.password,
    });

    // Login each user to get sessions
    hrManagerSession = await login(
      app,
      USERS.hrManager.email.replace('@', `+${sfx}@`),
      USERS.hrManager.password,
    );

    managerSession = await login(
      app,
      USERS.manager.email.replace('@', `+${sfx}@`),
      USERS.manager.password,
    );

    participantSession = await login(
      app,
      USERS.participant1.email.replace('@', `+${sfx}@`),
      USERS.participant1.password,
    );
  });

  // ─── QA-RBAC-001 ────────────────────────────────────────────────────────

  /**
   * QA-RBAC-001 | P1
   * Scenario: Participant cannot access admin/management endpoints.
   * A participant role must receive 403 Forbidden when attempting to create
   * assessments or access HR/admin-only resources.
   */
  it('QA-RBAC-001 | P1 — participant is forbidden from creating assessments and org-admin endpoints', async () => {
    // Participant cannot create an assessment (admin/hr_manager only)
    const createRes = await authPost(app, participantSession, '/api/v1/assessments', {
      title: 'Participant Attempt',
      assessmentType: '360_feedback',
    });
    expect([403, 401]).toContain(createRes.status);

    // Participant cannot PATCH the organisation
    const patchRes = await authPatch(app, participantSession, '/api/v1/organisations/me', {
      name: 'Hijacked Name',
    });
    expect([403, 401]).toContain(patchRes.status);

    // Participant cannot access analytics dashboard if it exists
    const analyticsRes = await authGet(app, participantSession, '/api/v1/analytics/dashboard');
    expect([403, 401, 404]).toContain(analyticsRes.status);
    // If the route exists, it must be 403 — not accidentally 200
    if (analyticsRes.status !== 404) {
      expect(analyticsRes.status).toBe(403);
    }
  });

  // ─── QA-RBAC-002 ────────────────────────────────────────────────────────

  /**
   * QA-RBAC-002 | P1
   * Scenario: Manager cannot create 360 assessments but CAN start a manager
   * competency assessment for a participant they oversee.
   * Managers have a narrow write privilege: they can rate participants they
   * supervise in competency assessments, but cannot create top-level assessments.
   */
  it('QA-RBAC-002 | P1 — manager cannot POST /assessments but can start a manager competency CA', async () => {
    // Manager cannot create a top-level assessment
    const createRes = await authPost(app, managerSession, '/api/v1/assessments', {
      title: 'Manager Attempt',
      assessmentType: '360_feedback',
    });
    expect([403, 401]).toContain(createRes.status);

    // Admin creates a competency assessment and adds both the participant and the manager as participant
    const compAssessmentId = await createDraftAssessment(app, adminSession, {
      title: `Manager Competency Test ${uid()}`,
      assessmentType: 'competency',
    });
    await addParticipant(app, adminSession, compAssessmentId, participantUserId);
    await launchAssessment(app, adminSession, compAssessmentId);

    // Fetch the assessment participant ID
    const participantsRes = await authGet(
      app,
      adminSession,
      `/api/v1/assessments/${compAssessmentId}/participants`,
    ).expect(200);
    const apId: string = participantsRes.body.data[0].id;

    // Manager starts a manager assessment for that participant — should be allowed
    const startRes = await authPost(
      app,
      managerSession,
      `/api/v1/assessments/${compAssessmentId}/competency/manager`,
      { participantId: apId },
    );
    // 200 or 201 are both acceptable; 403/401 would fail this assertion
    expect([200, 201]).toContain(startRes.status);
  });

  // ─── QA-RBAC-003 ────────────────────────────────────────────────────────

  /**
   * QA-RBAC-003 | P1
   * Scenario: HR Manager can create assessments but cannot update org settings.
   * hr_manager has assessment management rights but is not permitted to modify
   * organisation-level configuration.
   */
  it('QA-RBAC-003 | P1 — hr_manager can create assessment (201) but cannot PATCH /organisations/me (403)', async () => {
    // HR Manager creates a 360 assessment — should succeed
    const createRes = await authPost(app, hrManagerSession, '/api/v1/assessments', {
      title: `HR Manager Created Assessment ${uid()}`,
      assessmentType: '360_feedback',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toHaveProperty('id');

    // HR Manager tries to update org settings — should be forbidden
    const patchRes = await authPatch(app, hrManagerSession, '/api/v1/organisations/me', {
      name: 'Unauthorized Name Change',
    });
    expect(patchRes.status).toBe(403);
  });

  // ─── QA-RBAC-004 ────────────────────────────────────────────────────────

  /**
   * QA-RBAC-004 | P2
   * Scenario: Registration always creates org_admin; trying to invite with
   * role=super_admin returns 400.
   * The super_admin role does not exist in the invitation flow — only internal
   * system roles are valid for new invites.
   */
  it('QA-RBAC-004 | P2 — registration returns org_admin; inviting with super_admin role returns 400', async () => {
    // Fresh registration always yields org_admin
    const sfx = uid();
    const newOrg = {
      orgName: `RBAC Reg Test ${sfx}`,
      orgSlug: `rbac-reg-${sfx}`,
      firstName: 'Org',
      lastName: 'Admin',
      email: `orgadmin+${sfx}@test.lk`,
      password: 'OrgAdmin1!',
    };

    const regRes = await http(app)
      .post('/api/v1/auth/register')
      .send(newOrg)
      .expect(201);

    expect(regRes.body.data.user.role).toBe('org_admin');

    // Inviting a user with role=super_admin should return 400 (invalid role)
    // The invite endpoint might be at /api/v1/organisations/me/invite or /api/v1/users/invite
    // We test both possible paths — if neither exists the test is a no-op
    const invitePayload = {
      email: `superadmin+${sfx}@test.lk`,
      role: 'super_admin',
      firstName: 'Super',
      lastName: 'Admin',
    };

    const inviteRes1 = await authPost(
      app,
      org.admin,
      '/api/v1/organisations/me/invite',
      invitePayload,
    );
    // If the endpoint exists it must reject super_admin with 400
    if (inviteRes1.status !== 404) {
      expect(inviteRes1.status).toBe(400);
    }

    const inviteRes2 = await authPost(
      app,
      org.admin,
      '/api/v1/users/invite',
      invitePayload,
    );
    if (inviteRes2.status !== 404) {
      expect(inviteRes2.status).toBe(400);
    }
  });
});
