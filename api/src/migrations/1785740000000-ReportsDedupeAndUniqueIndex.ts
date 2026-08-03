import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * reports.requestReport() used to always INSERT a new row, so every "Retry" click (and every
 * transient failure, since BullMQ had no retry configured either) left a permanent extra row
 * behind — the reports table accumulated unbounded duplicates for the same
 * (org, assessment, participant, reportType) target. requestReport() now reuses an existing
 * row instead of inserting a new one; this migration cleans up rows that already accumulated
 * before that fix, then adds a DB-level guard so it can't happen again even under a race.
 *
 * Two partial unique indexes are needed because Postgres treats each NULL participant_id as
 * distinct from every other NULL, so a single plain unique index would not dedupe org-level
 * (participant_id IS NULL) reports.
 */
export class ReportsDedupeAndUniqueIndex1785740000000 implements MigrationInterface {
  name = 'ReportsDedupeAndUniqueIndex1785740000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Keep only the most recent row per (org, assessment, participant, reportType) group —
    // NULL participant_id is treated as equal to NULL within a PARTITION BY, unlike a plain
    // UNIQUE index, so this single query correctly dedupes both participant and org-level rows.
    await queryRunner.query(`
      DELETE FROM "reports" r
      USING (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "organisation_id", "assessment_id", "participant_id", "report_type"
          ORDER BY "created_at" DESC, "id" DESC
        ) AS rn
        FROM "reports"
      ) dedup
      WHERE r."id" = dedup."id" AND dedup.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reports_participant_scope"
        ON "reports" ("organisation_id", "assessment_id", "participant_id", "report_type")
        WHERE "participant_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reports_org_scope"
        ON "reports" ("organisation_id", "assessment_id", "report_type")
        WHERE "participant_id" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_reports_org_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_reports_participant_scope"`);
  }
}
