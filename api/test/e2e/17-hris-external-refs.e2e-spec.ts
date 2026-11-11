/**
 * E2E: HRIS external reference columns (plan Task 1).
 * external_ref must be unique per organisation when set, and free across organisations / when NULL.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getApp } from './setup/app';
import { registerOrg, TestOrg } from './setup/helpers';
import { ORGS } from './setup/factories';

let _n = 0;
const uid = () => `${Date.now()}${++_n}`;
function uniqueOrg() {
  const s = uid();
  const b = ORGS.strategicTalent;
  return { ...b, orgName: `${b.orgName} ${s}`, orgSlug: `${b.orgSlug}-${s}`, email: b.email.replace('@', `+${s}@`) };
}

async function insertUser(ds: DataSource, orgId: string, externalRef: string | null): Promise<void> {
  await ds.query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, role, external_ref)
     VALUES (gen_random_uuid(), $1, $2, 'x', 'A', 'B', 'participant', $3)`,
    [orgId, `u${uid()}@example.lk`, externalRef],
  );
}

describe('[HRIS-REF] external reference columns', () => {
  let app: INestApplication;
  let ds: DataSource;
  let orgA: TestOrg;
  let orgB: TestOrg;

  beforeAll(async () => {
    app = await getApp();
    ds = app.get(DataSource);
    orgA = await registerOrg(app, uniqueOrg());
    orgB = await registerOrg(app, uniqueOrg());
  });

  it('rejects a duplicate external_ref within one organisation', async () => {
    await insertUser(ds, orgA.id, 'EMP-001');
    await expect(insertUser(ds, orgA.id, 'EMP-001')).rejects.toMatchObject({ code: '23505' });
  });

  it('allows the same external_ref in a different organisation', async () => {
    await expect(insertUser(ds, orgB.id, 'EMP-001')).resolves.toBeUndefined();
  });

  it('allows many NULL external_refs in one organisation', async () => {
    await insertUser(ds, orgA.id, null);
    await expect(insertUser(ds, orgA.id, null)).resolves.toBeUndefined();
  });

  it('has the new assessment and department columns', async () => {
    const cols = await ds.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE (table_name = 'assessments' AND column_name IN ('cycle_ref','subject_ref','source'))
          OR (table_name = 'departments' AND column_name IN ('external_ref','hris_managed'))
          OR (table_name = 'users' AND column_name IN ('hris_managed','employment_status','designation_ref'))
          OR (table_name = 'organisations' AND column_name = 'external_ref')`,
    );
    expect(cols).toHaveLength(9);
  });
});
