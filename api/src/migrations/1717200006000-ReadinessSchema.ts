import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReadinessSchema1717200006000 implements MigrationInterface {
  name = 'ReadinessSchema1717200006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sjt_responses" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"   UUID NOT NULL,
        "participant_id"  UUID NOT NULL,
        "item_id"         UUID NOT NULL,
        "selected_option" SMALLINT NOT NULL,
        "score"           DECIMAL(4,2) NOT NULL DEFAULT 0,
        "responded_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sjt_responses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sjt_response" UNIQUE ("assessment_id", "participant_id", "item_id"),
        CONSTRAINT "FK_sjt_responses_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sjt_responses_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sjt_responses_item"
          FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sjt_responses_assessment"  ON "sjt_responses" ("assessment_id");
      CREATE INDEX "IDX_sjt_responses_participant" ON "sjt_responses" ("participant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "learning_agility_responses" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"  UUID NOT NULL,
        "participant_id" UUID NOT NULL,
        "item_id"        UUID NOT NULL,
        "response_value" SMALLINT NOT NULL,
        "responded_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_agility_responses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_la_response" UNIQUE ("assessment_id", "participant_id", "item_id"),
        CONSTRAINT "FK_la_responses_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_la_responses_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_la_responses_item"
          FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_la_responses_assessment"  ON "learning_agility_responses" ("assessment_id");
      CREATE INDEX "IDX_la_responses_participant" ON "learning_agility_responses" ("participant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "readiness_scores" (
        "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"         UUID NOT NULL,
        "participant_id"        UUID NOT NULL,
        "role_profile_id"       UUID,
        "readiness_rating"      VARCHAR(50) NOT NULL,
        "composite_score"       DECIMAL(5,2) NOT NULL,
        "competency_score"      DECIMAL(5,2) NOT NULL DEFAULT 0,
        "feedback_score"        DECIMAL(5,2) NOT NULL DEFAULT 0,
        "sjt_score"             DECIMAL(5,2) NOT NULL DEFAULT 0,
        "learning_agility_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
        "personality_fit_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
        "grid_performance"      VARCHAR(20) NOT NULL DEFAULT 'medium',
        "grid_potential"        VARCHAR(20) NOT NULL DEFAULT 'medium',
        "calculated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_readiness_scores" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_readiness_score" UNIQUE ("assessment_id", "participant_id", "role_profile_id"),
        CONSTRAINT "FK_readiness_scores_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_readiness_scores_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_readiness_scores_role_profile"
          FOREIGN KEY ("role_profile_id") REFERENCES "role_profiles"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_readiness_scores_assessment"  ON "readiness_scores" ("assessment_id");
      CREATE INDEX "IDX_readiness_scores_participant" ON "readiness_scores" ("participant_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "readiness_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_agility_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sjt_responses"`);
  }
}
