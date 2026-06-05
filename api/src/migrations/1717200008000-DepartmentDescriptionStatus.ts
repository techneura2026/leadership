import { MigrationInterface, QueryRunner } from 'typeorm';

export class DepartmentDescriptionStatus1717200008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "description" text`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "is_active"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "description"`);
  }
}
