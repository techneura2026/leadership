import { MigrationInterface, QueryRunner } from 'typeorm';

/** HRIS integration — one-time SSO hand-off tickets (60 s, single use, hashed). */
export class SsoTickets1785790000000 implements MigrationInterface {
  name = 'SsoTickets1785790000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sso_tickets" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organisation_id" UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash"      CHAR(64) NOT NULL UNIQUE,
        "redirect_path"   VARCHAR(500) NOT NULL,
        "expires_at"      TIMESTAMPTZ NOT NULL,
        "used_at"         TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_sso_tickets_expires_at" ON "sso_tickets" ("expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sso_tickets"`);
  }
}
