import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompetencySchema1717200001000 implements MigrationInterface {
  name = 'CompetencySchema1717200001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competency_domains" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID,
        "name"            VARCHAR(255) NOT NULL,
        "code"            VARCHAR(50) NOT NULL,
        "colour"          CHAR(7) NOT NULL DEFAULT '#6B7280',
        "display_order"   INTEGER NOT NULL DEFAULT 0,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competency_domains" PRIMARY KEY ("id"),
        CONSTRAINT "FK_competency_domains_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competency_domains_org" ON "competency_domains" ("organisation_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "competencies" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID,
        "domain_id"       UUID NOT NULL,
        "name"            VARCHAR(255) NOT NULL,
        "description"     TEXT,
        "is_active"       BOOLEAN NOT NULL DEFAULT true,
        "display_order"   INTEGER NOT NULL DEFAULT 0,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competencies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_competencies_domain"
          FOREIGN KEY ("domain_id") REFERENCES "competency_domains"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_competencies_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competencies_org"    ON "competencies" ("organisation_id");
      CREATE INDEX "IDX_competencies_domain" ON "competencies" ("domain_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "competency_levels" (
        "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
        "competency_id" UUID NOT NULL,
        "level"         SMALLINT NOT NULL,
        "label"         VARCHAR(100) NOT NULL,
        "description"   TEXT NOT NULL,
        "indicators"    JSONB NOT NULL DEFAULT '[]',
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competency_levels" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_competency_level" UNIQUE ("competency_id", "level"),
        CONSTRAINT "FK_competency_levels_competency"
          FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competency_levels_comp" ON "competency_levels" ("competency_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "competency_behaviours" (
        "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
        "competency_id" UUID NOT NULL,
        "statement"     TEXT NOT NULL,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competency_behaviours" PRIMARY KEY ("id"),
        CONSTRAINT "FK_competency_behaviours_competency"
          FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competency_behaviours_comp" ON "competency_behaviours" ("competency_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID,
        "item_type"    VARCHAR(50) NOT NULL,
        "module"       VARCHAR(50) NOT NULL,
        "factor"       VARCHAR(100),
        "stem"         TEXT NOT NULL,
        "options"      JSONB,
        "scoring_key"  JSONB,
        "is_reverse"   BOOLEAN NOT NULL DEFAULT false,
        "language"     VARCHAR(2) NOT NULL DEFAULT 'en',
        "is_active"    BOOLEAN NOT NULL DEFAULT true,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_items_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_items_org"    ON "items" ("organisation_id");
      CREATE INDEX "IDX_items_module" ON "items" ("module");
      CREATE INDEX "IDX_items_factor" ON "items" ("factor")
    `);

    await queryRunner.query(`
      CREATE TABLE "role_profiles" (
        "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id"       UUID NOT NULL,
        "title"                 VARCHAR(255) NOT NULL,
        "level"                 VARCHAR(100),
        "required_competencies" JSONB NOT NULL DEFAULT '[]',
        "personality_fit"       JSONB NOT NULL DEFAULT '{}',
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_role_profiles_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_profiles_org" ON "role_profiles" ("organisation_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competency_behaviours"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competency_levels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competencies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competency_domains"`);
  }
}
