import { MigrationInterface, QueryRunner } from 'typeorm';

/** Append-only audit log (HRIS integration Phase 2). The app exposes no update/delete for these rows. */
export class AuditLogs1785820000000 implements MigrationInterface {
  name = 'AuditLogs1785820000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "actor_type"      VARCHAR(20) NOT NULL,
        "actor_id"        UUID,
        "action"          VARCHAR(100) NOT NULL,
        "entity_type"     VARCHAR(50) NOT NULL,
        "entity_id"       VARCHAR(100),
        "before"          JSONB,
        "after"           JSONB,
        "reason"          TEXT,
        "metadata"        JSONB NOT NULL DEFAULT '{}',
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_org_created" ON "audit_logs" ("organisation_id", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_org_action" ON "audit_logs" ("organisation_id", "action")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
