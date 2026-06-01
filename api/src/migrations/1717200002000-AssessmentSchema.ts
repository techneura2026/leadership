import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssessmentSchema1717200002000 implements MigrationInterface {
  name = 'AssessmentSchema1717200002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessments" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL,
        "created_by"      UUID NOT NULL,
        "title"           VARCHAR(255) NOT NULL,
        "assessment_type" VARCHAR(50) NOT NULL,
        "status"          VARCHAR(50) NOT NULL DEFAULT 'draft',
        "config"          JSONB NOT NULL DEFAULT '{}',
        "start_date"      TIMESTAMPTZ,
        "end_date"        TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assessments_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_assessments_creator"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assessments_org"    ON "assessments" ("organisation_id");
      CREATE INDEX "IDX_assessments_status" ON "assessments" ("status");
      CREATE INDEX "IDX_assessments_type"   ON "assessments" ("assessment_type")
    `);

    await queryRunner.query(`
      CREATE TABLE "assessment_participants" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"   UUID NOT NULL,
        "user_id"         UUID NOT NULL,
        "target_role_id"  UUID,
        "status"          VARCHAR(50) NOT NULL DEFAULT 'invited',
        "completed_at"    TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assessment_participants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assessment_participant" UNIQUE ("assessment_id", "user_id"),
        CONSTRAINT "FK_assessment_participants_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_assessment_participants_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assessment_participants_assessment"
        ON "assessment_participants" ("assessment_id");
      CREATE INDEX "IDX_assessment_participants_user"
        ON "assessment_participants" ("user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessments"`);
  }
}
