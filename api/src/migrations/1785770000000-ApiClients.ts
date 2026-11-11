import { MigrationInterface, QueryRunner } from 'typeorm';

/** HRIS integration — per-organisation API clients (machine credentials). Only sha256(secret) is stored. */
export class ApiClients1785770000000 implements MigrationInterface {
  name = 'ApiClients1785770000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_clients" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "name"            VARCHAR(100) NOT NULL,
        "key_prefix"      CHAR(8) NOT NULL UNIQUE,
        "secret_hash"     CHAR(64) NOT NULL,
        "scopes"          TEXT[] NOT NULL DEFAULT '{}',
        "created_by"      UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "last_used_at"    TIMESTAMPTZ,
        "revoked_at"      TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_api_clients_org" ON "api_clients" ("organisation_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "api_clients"`);
  }
}
