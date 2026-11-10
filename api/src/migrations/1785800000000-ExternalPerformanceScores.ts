import { MigrationInterface, QueryRunner } from 'typeorm';

/** HRIS integration (Phase 2) — final performance scores from the HRIS drive the 9-box performance axis. */
export class ExternalPerformanceScores1785800000000 implements MigrationInterface {
  name = 'ExternalPerformanceScores1785800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "external_performance_scores" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "cycle_ref"       VARCHAR(100) NOT NULL,
        "final_score"     NUMERIC(5,2) NOT NULL CHECK ("final_score" >= 0 AND "final_score" <= 100),
        "rating_band"     VARCHAR(50),
        "finalised_at"    TIMESTAMPTZ NOT NULL,
        "received_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_external_performance_scores" UNIQUE ("organisation_id", "user_id", "cycle_ref")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_external_perf_org_user" ON "external_performance_scores" ("organisation_id", "user_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "external_performance_scores"`);
  }
}
