import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordSecurityColumns1785670000000 implements MigrationInterface {
  name = 'PasswordSecurityColumns1785670000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "password_reset_token_hash" TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "password_reset_expires_at" TIMESTAMPTZ DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "password_reset_expires_at",
      DROP COLUMN IF EXISTS "password_reset_token_hash",
      DROP COLUMN IF EXISTS "must_change_password"
    `);
  }
}
