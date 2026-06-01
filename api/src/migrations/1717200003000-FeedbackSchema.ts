import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackSchema1717200003000 implements MigrationInterface {
  name = 'FeedbackSchema1717200003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rater_nominations" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"  UUID NOT NULL,
        "participant_id" UUID NOT NULL,
        "rater_email"    VARCHAR(255) NOT NULL,
        "rater_name"     VARCHAR(255),
        "relationship"   VARCHAR(50) NOT NULL,
        "token"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "token_expires"  TIMESTAMPTZ,
        "status"         VARCHAR(50) NOT NULL DEFAULT 'pending',
        "approved_by"    UUID,
        "completed_at"   TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rater_nominations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rater_nominations_token" UNIQUE ("token"),
        CONSTRAINT "FK_rater_nominations_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rater_nominations_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rater_nominations_approved_by"
          FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rater_nominations_assessment"  ON "rater_nominations" ("assessment_id");
      CREATE INDEX "IDX_rater_nominations_participant" ON "rater_nominations" ("participant_id");
      CREATE INDEX "IDX_rater_nominations_token"       ON "rater_nominations" ("token")
    `);

    await queryRunner.query(`
      CREATE TABLE "rater_responses" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "nomination_id"  UUID NOT NULL,
        "competency_id"  UUID NOT NULL,
        "score"          DECIMAL(4,2),
        "open_text"      TEXT,
        "responded_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rater_responses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rater_responses_nomination"
          FOREIGN KEY ("nomination_id") REFERENCES "rater_nominations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rater_responses_competency"
          FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rater_responses_nomination"  ON "rater_responses" ("nomination_id");
      CREATE INDEX "IDX_rater_responses_competency"  ON "rater_responses" ("competency_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rater_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rater_nominations"`);
  }
}
