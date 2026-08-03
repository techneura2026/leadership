import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes AssessmentParticipant.responses — the single-blob-per-user 360 custom-question
 * store superseded by RaterNomination.custom_answers (per-rater, anonymous-safe). Confirmed
 * unused: exactly one write site (the now-deleted saveParticipantResponses), zero read sites
 * anywhere (including reporting), no other assessment use case depends on it.
 *
 * Before running against any populated environment, verify no real data would be lost:
 *   SELECT count(*) FROM assessment_participants WHERE responses IS NOT NULL;
 */
export class DropParticipantResponses1785730000000 implements MigrationInterface {
  name = 'DropParticipantResponses1785730000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_participants"
      DROP COLUMN IF EXISTS "responses"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_participants"
      ADD COLUMN IF NOT EXISTS "responses" JSONB DEFAULT NULL
    `);
  }
}
