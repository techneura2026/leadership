import { MigrationInterface, QueryRunner } from 'typeorm';

/** BizOS Suite Sign-in plan 2.4: the suite BizOS sent with a person's last sign-in link, for LeaderPrism's Apps menu. */
export class UserSuite1785830000000 implements MigrationInterface {
  name = 'UserSuite1785830000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suite" JSONB, ADD COLUMN IF NOT EXISTS "suite_at" TIMESTAMPTZ`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "suite", DROP COLUMN IF EXISTS "suite_at"`);
  }
}
