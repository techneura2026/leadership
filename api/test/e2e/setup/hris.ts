/**
 * Shared setup for HRIS integration e2e suites: an organisation on the professional plan,
 * an API key with the HRIS scopes, and employees synced through the integration API
 * (refs[0] is everyone else's manager).
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { authPost, registerOrg, req, setOrgPlan, TestOrg } from './helpers';
import { ORGS } from './factories';

let _n = 0;
export const hrisUid = () => `${Date.now()}${++_n}`;

export function uniqueHrisOrg() {
  const s = hrisUid();
  const b = ORGS.strategicTalent;
  return { ...b, orgName: `${b.orgName} ${s}`, orgSlug: `${b.orgSlug}-${s}`, email: b.email.replace('@', `+${s}@`) };
}

export const ALL_HRIS_SCOPES = [
  'employees:write', 'assessments:write', 'results:read', 'reports:read', 'sso:issue', 'scores:write', 'talent:read',
];

export async function setupHrisOrg(
  app: INestApplication,
  ds: DataSource,
  refs: string[],
  scopes: string[] = ALL_HRIS_SCOPES,
): Promise<{ org: TestOrg; key: string; emails: Record<string, string> }> {
  const org = await registerOrg(app, uniqueHrisOrg());
  await setOrgPlan(ds, org.id, 'professional');
  const res = await authPost(app, org.admin, '/api/v1/integrations/api-clients', { name: 'HRIS', scopes }).expect(201);
  const key: string = res.body.data.rawKey;
  const s = hrisUid();
  const emails: Record<string, string> = {};
  await req(app).put('/api/v1/integrations/hris/employees').set('X-Api-Key', key).send({
    employees: refs.map((ref, i) => {
      emails[ref] = `${ref.toLowerCase()}.${s}@hris.lk`;
      return {
        employeeRef: ref,
        email: emails[ref],
        firstName: 'Emp',
        lastName: ref,
        employmentStatus: 'active',
        ...(i > 0 ? { managerRef: refs[0] } : {}),
      };
    }),
  }).expect(200);
  return { org, key, emails };
}
