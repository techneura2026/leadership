import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1717200000000 implements MigrationInterface {
  name = 'InitialSchema1717200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organisations" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "slug"            VARCHAR(100) NOT NULL,
        "name"            VARCHAR(255) NOT NULL,
        "logo_url"        TEXT,
        "primary_colour"  CHAR(7) NOT NULL DEFAULT '#1E40AF',
        "branding_name"   VARCHAR(255),
        "plan"            VARCHAR(50) NOT NULL DEFAULT 'trial',
        "trial_ends_at"   TIMESTAMPTZ,
        "plan_expires_at" TIMESTAMPTZ,
        "is_active"       BOOLEAN NOT NULL DEFAULT true,
        "settings"        JSONB NOT NULL DEFAULT '{}',
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organisations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organisations_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL,
        "name"            VARCHAR(255) NOT NULL,
        "parent_id"       UUID,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_departments_organisation"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_departments_parent"
          FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_departments_org" ON "departments" ("organisation_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL,
        "department_id"   UUID,
        "email"           VARCHAR(255) NOT NULL,
        "password_hash"   TEXT NOT NULL,
        "first_name"      VARCHAR(100) NOT NULL,
        "last_name"       VARCHAR(100) NOT NULL,
        "role"            VARCHAR(50) NOT NULL,
        "job_title"       VARCHAR(255),
        "avatar_url"      TEXT,
        "language_pref"   VARCHAR(2) NOT NULL DEFAULT 'en',
        "is_active"       BOOLEAN NOT NULL DEFAULT true,
        "email_verified"  BOOLEAN NOT NULL DEFAULT false,
        "last_login_at"   TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMPTZ,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_org_email" UNIQUE ("organisation_id", "email"),
        CONSTRAINT "FK_users_organisation"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_org"   ON "users" ("organisation_id");
      CREATE INDEX "IDX_users_email" ON "users" (LOWER("email"))
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id"             UUID NOT NULL,
        "refresh_token_hash"  TEXT NOT NULL,
        "expires_at"          TIMESTAMPTZ NOT NULL,
        "ip_address"          INET,
        "user_agent"          TEXT,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sessions_token" UNIQUE ("refresh_token_hash"),
        CONSTRAINT "FK_sessions_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_user" ON "sessions" ("user_id");
      CREATE INDEX "IDX_sessions_expires" ON "sessions" ("expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organisations"`);
  }
}
