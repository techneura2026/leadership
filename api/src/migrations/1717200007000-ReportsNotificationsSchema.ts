import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportsNotificationsSchema1717200007000 implements MigrationInterface {
  name = 'ReportsNotificationsSchema1717200007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL,
        "assessment_id"   UUID NOT NULL,
        "participant_id"  UUID,
        "report_type"     VARCHAR(50) NOT NULL,
        "blob_url"        TEXT,
        "local_path"      TEXT,
        "status"          VARCHAR(20) NOT NULL DEFAULT 'pending',
        "language"        VARCHAR(2) NOT NULL DEFAULT 'en',
        "generated_at"    TIMESTAMPTZ,
        "generated_by"    UUID,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reports_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reports_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_reports_generated_by"
          FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reports_org"        ON "reports" ("organisation_id");
      CREATE INDEX "IDX_reports_assessment" ON "reports" ("assessment_id");
      CREATE INDEX "IDX_reports_status"     ON "reports" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL,
        "user_id"         UUID,
        "email"           VARCHAR(255) NOT NULL,
        "type"            VARCHAR(50) NOT NULL,
        "template_key"    VARCHAR(100) NOT NULL,
        "payload"         JSONB NOT NULL DEFAULT '{}',
        "status"          VARCHAR(20) NOT NULL DEFAULT 'pending',
        "sent_at"         TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_org"
          FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_org"    ON "notifications" ("organisation_id");
      CREATE INDEX "IDX_notifications_user"   ON "notifications" ("user_id");
      CREATE INDEX "IDX_notifications_status" ON "notifications" ("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
  }
}
