import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonalitySchema1717200005000 implements MigrationInterface {
  name = 'PersonalitySchema1717200005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "personality_responses" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"  UUID NOT NULL,
        "participant_id" UUID NOT NULL,
        "item_id"        UUID NOT NULL,
        "response_value" SMALLINT NOT NULL,
        "responded_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_personality_responses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_personality_response" UNIQUE ("assessment_id", "participant_id", "item_id"),
        CONSTRAINT "FK_personality_responses_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_personality_responses_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_personality_responses_item"
          FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_personality_responses_assessment"
        ON "personality_responses" ("assessment_id");
      CREATE INDEX "IDX_personality_responses_participant"
        ON "personality_responses" ("participant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "personality_scores" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"  UUID NOT NULL,
        "participant_id" UUID NOT NULL,
        "factor"         VARCHAR(100) NOT NULL,
        "raw_score"      DECIMAL(6,2) NOT NULL,
        "t_score"        DECIMAL(5,2) NOT NULL,
        "percentile"     DECIMAL(5,2) NOT NULL,
        "calculated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_personality_scores" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_personality_score" UNIQUE ("assessment_id", "participant_id", "factor"),
        CONSTRAINT "FK_personality_scores_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_personality_scores_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_personality_scores_assessment"
        ON "personality_scores" ("assessment_id");
      CREATE INDEX "IDX_personality_scores_participant"
        ON "personality_scores" ("participant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "normative_data" (
        "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
        "factor"           VARCHAR(100) NOT NULL,
        "population"       VARCHAR(100) NOT NULL,
        "sample_size"      INTEGER NOT NULL,
        "mean"             DECIMAL(6,2) NOT NULL,
        "std_dev"          DECIMAL(6,2) NOT NULL,
        "percentile_table" JSONB NOT NULL DEFAULT '{}',
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_normative_data" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_normative_data" UNIQUE ("factor", "population")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "normative_data"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "personality_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "personality_responses"`);
  }
}
