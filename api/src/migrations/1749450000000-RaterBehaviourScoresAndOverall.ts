import { MigrationInterface, QueryRunner } from 'typeorm';

export class RaterBehaviourScoresAndOverall1749450000000 implements MigrationInterface {
  name = 'RaterBehaviourScoresAndOverall1749450000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rater_responses"
      ADD COLUMN IF NOT EXISTS "behaviour_scores" JSONB DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "rater_nominations"
      ADD COLUMN IF NOT EXISTS "overall_rating" SMALLINT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "development_comment" TEXT DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rater_nominations"
      DROP COLUMN IF EXISTS "development_comment",
      DROP COLUMN IF EXISTS "overall_rating"
    `);

    await queryRunner.query(`
      ALTER TABLE "rater_responses"
      DROP COLUMN IF EXISTS "behaviour_scores"
    `);
  }
}
