import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Report generation failures were only ever logged server-side — a failed report gave the
 * user nothing but "Failed" with no indication of why (e.g. "Readiness score not computed
 * yet" vs. a genuine Puppeteer crash), which just encourages blind retry-clicking. Persisting
 * the error message lets the UI show it directly.
 */
export class ReportErrorColumn1785750000000 implements MigrationInterface {
  name = 'ReportErrorColumn1785750000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN "error" TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "error"`);
  }
}
