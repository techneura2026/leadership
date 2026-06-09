import { MigrationInterface, QueryRunner } from 'typeorm';

export class ParticipantFeedbackResponses1717200009000 implements MigrationInterface {
  name = 'ParticipantFeedbackResponses1717200009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_participants"
      ADD COLUMN IF NOT EXISTS "responses" JSONB DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_participants"
      DROP COLUMN IF EXISTS "responses"
    `);
  }
}
