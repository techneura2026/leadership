import { MigrationInterface, QueryRunner } from 'typeorm';

/** HRIS integration (Phase 2) — link role profiles to HRIS designation codes. */
export class RoleProfileDesignationRefs1785810000000 implements MigrationInterface {
  name = 'RoleProfileDesignationRefs1785810000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "role_profiles" ADD COLUMN "designation_refs" TEXT[] NOT NULL DEFAULT '{}'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "role_profiles" DROP COLUMN IF EXISTS "designation_refs"`);
  }
}
