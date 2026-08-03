import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New tables backing the succession-planning "Key Roles" tab: critical roles (with incumbent,
 * criticality, flight-risk) and their nominated successor pipeline. Replaces the previous
 * fully-hardcoded MOCK_KEY_ROLES/MOCK_CANDIDATES frontend data with real, org-scoped entities.
 */
export class SuccessionKeyRolesAndSuccessors1785710000000 implements MigrationInterface {
  name = 'SuccessionKeyRolesAndSuccessors1785710000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "key_roles" (
        "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id"   UUID NOT NULL,
        "title"             VARCHAR(255) NOT NULL,
        "department_id"     UUID,
        "criticality"       VARCHAR(20) NOT NULL DEFAULT 'medium',
        "incumbent_id"      UUID,
        "incumbent_since"   DATE,
        "flight_risk"       VARCHAR(20) NOT NULL DEFAULT 'medium',
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_key_roles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_key_roles_organisation"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_key_roles_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_key_roles_incumbent"
          FOREIGN KEY ("incumbent_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_key_roles_organisation" ON "key_roles" ("organisation_id");
      CREATE INDEX "IDX_key_roles_department" ON "key_roles" ("department_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "successors" (
        "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
        "key_role_id"       UUID NOT NULL,
        "candidate_user_id" UUID,
        "nominated_by_id"   UUID,
        "nominated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "notes"             TEXT,
        CONSTRAINT "PK_successors" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_successors_role_candidate" UNIQUE ("key_role_id", "candidate_user_id"),
        CONSTRAINT "FK_successors_key_role"
          FOREIGN KEY ("key_role_id") REFERENCES "key_roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_successors_candidate"
          FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_successors_nominated_by"
          FOREIGN KEY ("nominated_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_successors_key_role" ON "successors" ("key_role_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "successors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "key_roles"`);
  }
}
