import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a manual performance-rating override to readiness_scores. The 9-box grid's performance
 * axis is auto-derived from the 360-feedback score (gridPerformance) — there's no real
 * performance-review input anywhere in the system yet. This lets HR/ORG_ADMIN set/clear an
 * override per score row when they have better data, without losing the auto-derived value.
 */
export class ReadinessScorePerformanceOverride1785700000000 implements MigrationInterface {
  name = 'ReadinessScorePerformanceOverride1785700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "readiness_scores" ADD COLUMN "manual_grid_performance" VARCHAR(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "readiness_scores" ADD COLUMN "manual_performance_note" TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "readiness_scores" ADD COLUMN "manual_performance_set_by_id" UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "readiness_scores" ADD COLUMN "manual_performance_set_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "readiness_scores"
      ADD CONSTRAINT "FK_readiness_scores_manual_set_by"
        FOREIGN KEY ("manual_performance_set_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "readiness_scores" DROP CONSTRAINT IF EXISTS "FK_readiness_scores_manual_set_by"`);
    await queryRunner.query(`ALTER TABLE "readiness_scores" DROP COLUMN IF EXISTS "manual_performance_set_at"`);
    await queryRunner.query(`ALTER TABLE "readiness_scores" DROP COLUMN IF EXISTS "manual_performance_set_by_id"`);
    await queryRunner.query(`ALTER TABLE "readiness_scores" DROP COLUMN IF EXISTS "manual_performance_note"`);
    await queryRunner.query(`ALTER TABLE "readiness_scores" DROP COLUMN IF EXISTS "manual_grid_performance"`);
  }
}
