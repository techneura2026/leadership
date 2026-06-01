import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompetencyAssessmentSchema1717200004000 implements MigrationInterface {
  name = 'CompetencyAssessmentSchema1717200004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competency_assessments" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id"  UUID NOT NULL,
        "participant_id" UUID NOT NULL,
        "assessor_id"    UUID NOT NULL,
        "assessor_type"  VARCHAR(20) NOT NULL DEFAULT 'self',
        "submitted_at"   TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competency_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_competency_assessment_unique"
          UNIQUE ("assessment_id", "participant_id", "assessor_id", "assessor_type"),
        CONSTRAINT "FK_competency_assessments_assessment"
          FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_competency_assessments_participant"
          FOREIGN KEY ("participant_id") REFERENCES "assessment_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_competency_assessments_assessor"
          FOREIGN KEY ("assessor_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competency_assessments_assessment"
        ON "competency_assessments" ("assessment_id");
      CREATE INDEX "IDX_competency_assessments_participant"
        ON "competency_assessments" ("participant_id");
      CREATE INDEX "IDX_competency_assessments_assessor"
        ON "competency_assessments" ("assessor_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "competency_ratings" (
        "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
        "ca_id"               UUID NOT NULL,
        "competency_id"       UUID NOT NULL,
        "level_rated"         SMALLINT NOT NULL,
        "evidence_text"       TEXT,
        "development_comment" TEXT,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competency_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_competency_rating" UNIQUE ("ca_id", "competency_id"),
        CONSTRAINT "FK_competency_ratings_ca"
          FOREIGN KEY ("ca_id") REFERENCES "competency_assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_competency_ratings_competency"
          FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competency_ratings_ca"         ON "competency_ratings" ("ca_id");
      CREATE INDEX "IDX_competency_ratings_competency" ON "competency_ratings" ("competency_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "competency_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competency_assessments"`);
  }
}
