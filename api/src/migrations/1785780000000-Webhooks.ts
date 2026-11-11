import { MigrationInterface, QueryRunner } from 'typeorm';

/** HRIS integration — webhook endpoints (secret stored encrypted) and a delivery log. */
export class Webhooks1785780000000 implements MigrationInterface {
  name = 'Webhooks1785780000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_endpoints" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organisation_id"  UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "url"              TEXT NOT NULL,
        "secret_encrypted" TEXT NOT NULL,
        "events"           TEXT[] NOT NULL DEFAULT '{}',
        "is_active"        BOOLEAN NOT NULL DEFAULT true,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_endpoints_org" ON "webhook_endpoints" ("organisation_id")`);
    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "endpoint_id"      UUID NOT NULL REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
        "organisation_id"  UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "event"            VARCHAR(100) NOT NULL,
        "payload"          JSONB NOT NULL,
        "status"           VARCHAR(20) NOT NULL DEFAULT 'pending',
        "attempts"         INT NOT NULL DEFAULT 0,
        "last_status_code" INT,
        "last_error"       TEXT,
        "delivered_at"     TIMESTAMPTZ,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_deliveries_org_created" ON "webhook_deliveries" ("organisation_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_deliveries_endpoint" ON "webhook_deliveries" ("endpoint_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_endpoints"`);
  }
}
