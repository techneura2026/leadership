import { MigrationInterface, QueryRunner } from 'typeorm';

export class RaterNominationCustomAnswers1785720000000 implements MigrationInterface {
  name = 'RaterNominationCustomAnswers1785720000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rater_nominations"
      ADD COLUMN IF NOT EXISTS "custom_answers" JSONB DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rater_nominations"
      DROP COLUMN IF EXISTS "custom_answers"
    `);
  }
}
