import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.department_id was never given a foreign key, so deleting a department silently
 * orphaned any users still assigned to it (dangling department_id, no error, no cascade).
 * Adds the missing FK with ON DELETE SET NULL so the DB itself guards against this,
 * matching the pattern already used for departments.parent_id.
 */
export class UsersDepartmentForeignKey1785680000000 implements MigrationInterface {
  name = 'UsersDepartmentForeignKey1785680000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Clean up any pre-existing dangling references before the constraint can be added.
    await queryRunner.query(`
      UPDATE "users" SET "department_id" = NULL
      WHERE "department_id" IS NOT NULL
        AND "department_id" NOT IN (SELECT "id" FROM "departments")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_department"
        FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_department" ON "users" ("department_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_department"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_department"`);
  }
}
