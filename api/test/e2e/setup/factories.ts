/**
 * Realistic test data for LeaderPrism E2E tests.
 *
 * Organisations are modelled on Sri Lankan HR consultancies and enterprises.
 * Personal names use common Sri Lankan name patterns.
 * Passwords meet the validation rules: ≥8 chars, uppercase, lowercase, digit.
 */

export const ORGS = {
  /** Professional plan organisation — the primary test org for most tests */
  strategicTalent: {
    orgName: 'Strategic Talent Partners (Pvt) Ltd',
    orgSlug: 'strategic-talent',
    firstName: 'Ayesha',
    lastName: 'Bandara',
    email: 'ayesha.bandara@stp.lk',
    password: 'Talent@2026',
  },

  /** Trial plan organisation — used for plan-limit enforcement tests */
  peakPerformance: {
    orgName: 'Peak Performance Consulting',
    orgSlug: 'peak-performance',
    firstName: 'Malinda',
    lastName: 'Senanayake',
    email: 'malinda.s@ppc.lk',
    password: 'PeakPerf1!',
  },

  /** Second organisation — used exclusively for cross-tenant isolation tests */
  nexusLeadership: {
    orgName: 'Nexus Leadership Group',
    orgSlug: 'nexus-leadership',
    firstName: 'Pradeep',
    lastName: 'Kariyawasam',
    email: 'pradeep.k@nexus.lk',
    password: 'Nexus2026!',
  },

  /** Duplicate email test — same email as strategicTalent admin */
  duplicateEmail: {
    orgName: 'Duplicate Test Org',
    orgSlug: 'duplicate-test-org',
    firstName: 'Duplicate',
    lastName: 'User',
    email: 'ayesha.bandara@stp.lk', // intentionally same as strategicTalent
    password: 'Duplicate1!',
  },
};

/** Additional users to invite into Strategic Talent Partners */
export const USERS = {
  hrManager: {
    email: 'chamari.silva@stp.lk',
    firstName: 'Chamari',
    lastName: 'Silva',
    password: 'HrMgr2026!',
    role: 'hr_manager',
  },
  manager: {
    email: 'nimal.jayawardena@stp.lk',
    firstName: 'Nimal',
    lastName: 'Jayawardena',
    password: 'Manager1!',
    role: 'manager',
  },
  participant1: {
    email: 'kavinda.rajapaksa@stp.lk',
    firstName: 'Kavinda',
    lastName: 'Rajapaksa',
    password: 'Participant1!',
    role: 'participant',
  },
  participant2: {
    email: 'dilini.wickramasinghe@stp.lk',
    firstName: 'Dilini',
    lastName: 'Wickramasinghe',
    password: 'Participant2!',
    role: 'participant',
  },
  participant3: {
    email: 'roshan.perera@stp.lk',
    firstName: 'Roshan',
    lastName: 'Perera',
    password: 'Participant3!',
    role: 'participant',
  },
};

/** External raters for 360 tests (not platform users — just email addresses) */
export const RATERS = {
  supervisor: {
    email: 'ruwan.dissanayake@clientorg.lk',
    name: 'Ruwan Dissanayake',
    relationship: 'supervisor',
  },
  peer1: {
    email: 'buddhika.premaratne@clientorg.lk',
    name: 'Buddhika Premaratne',
    relationship: 'peer',
  },
  peer2: {
    email: 'sanduni.herath@clientorg.lk',
    name: 'Sanduni Herath',
    relationship: 'peer',
  },
  peer3: {
    email: 'thilina.abeywickrama@clientorg.lk',
    name: 'Thilina Abeywickrama',
    relationship: 'peer',
  },
  peer4: {
    email: 'hasitha.gunasekara@clientorg.lk',
    name: 'Hasitha Gunasekara',
    relationship: 'peer',
  },
  dr1: {
    email: 'savindi.wijesinghe@clientorg.lk',
    name: 'Savindi Wijesinghe',
    relationship: 'direct_report',
  },
  dr2: {
    email: 'kasun.fernando@clientorg.lk',
    name: 'Kasun Fernando',
    relationship: 'direct_report',
  },
  dr3: {
    email: 'piumali.rathnayake@clientorg.lk',
    name: 'Piumali Rathnayake',
    relationship: 'direct_report',
  },
};

/** Assessment titles */
export const ASSESSMENTS = {
  q3360: 'Q3 2026 — Senior Manager 360° Review',
  competencyQ3: 'Q3 2026 — Leadership Competency Assessment',
  personalityOnboarding: '2026 Onboarding — Big Five Personality Profile',
  readinessSuccession: '2026 Succession Planning — Senior Director Readiness',
};

/** Invalid inputs for validation tests */
export const INVALID_INPUTS = {
  tooShortPassword: 'short1',
  noUppercasePassword: 'alllower1!',
  noNumberPassword: 'NoNumbers!!',
  invalidEmail: 'not-an-email',
  longString: 'A'.repeat(10_001),
  sqlInjection: "'; DROP TABLE users; --",
  xssPayload: "<script>alert('xss')</script>",
  invalidUuid: 'not-a-uuid',
  nonExistentUuid: '00000000-0000-0000-0000-000000000000',
};
