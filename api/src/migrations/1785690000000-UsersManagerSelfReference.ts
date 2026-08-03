import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a self-referencing manager_id column to users, the foundation for reporting-hierarchy
 * features (succession org chart, manager-scoped RBAC). ON DELETE SET NULL so removing a
 * manager doesn't cascade-delete their reports; a CHECK constraint blocks the trivial
 * self-management case as defense-in-depth alongside the app-level cycle guard in UsersService.
 */
export class UsersManagerSelfReference1785690000000 implements MigrationInterface {
  name = 'UsersManagerSelfReference1785690000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "manager_id" UUID
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_manager"
        FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "CHK_users_manager_not_self" CHECK ("manager_id" <> "id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_manager" ON "users" ("manager_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_manager"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_manager_not_self"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_manager"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "manager_id"`);
  }
}
