import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HRIS integration — external reference columns so LeaderPrism records can be matched to the
 * HRIS's own IDs (employeeRef, departmentRef, orgRef, cycleRef). Refs are unique per
 * organisation only when set, so app-created records (NULL ref) are unaffected.
 */
export class HrisExternalRefs1785760000000 implements MigrationInterface {
  name = 'HrisExternalRefs1785760000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "external_ref" VARCHAR(100),
        ADD COLUMN "hris_managed" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN "employment_status" VARCHAR(20) NOT NULL DEFAULT 'active',
        ADD COLUMN "designation_ref" VARCHAR(100)
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_org_external_ref" ON "users" ("organisation_id", "external_ref") WHERE "external_ref" IS NOT NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "departments"
        ADD COLUMN "external_ref" VARCHAR(100),
        ADD COLUMN "hris_managed" BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_departments_org_external_ref" ON "departments" ("organisation_id", "external_ref") WHERE "external_ref" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "organisations" ADD COLUMN "external_ref" VARCHAR(100)`);

    await queryRunner.query(`
      ALTER TABLE "assessments"
        ADD COLUMN "cycle_ref" VARCHAR(100),
        ADD COLUMN "subject_ref" VARCHAR(100),
        ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'app'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_assessments_org_cycle_ref" ON "assessments" ("organisation_id", "cycle_ref")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assessments_org_cycle_ref"`);
    await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN IF EXISTS "source", DROP COLUMN IF EXISTS "subject_ref", DROP COLUMN IF EXISTS "cycle_ref"`);
    await queryRunner.query(`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "external_ref"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_departments_org_external_ref"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "hris_managed", DROP COLUMN IF EXISTS "external_ref"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_org_external_ref"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "designation_ref", DROP COLUMN IF EXISTS "employment_status", DROP COLUMN IF EXISTS "hris_managed", DROP COLUMN IF EXISTS "external_ref"`);
  }
}
