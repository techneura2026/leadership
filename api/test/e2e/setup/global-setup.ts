import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load test env BEFORE anything else imports config
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

import { DataSource } from 'typeorm';
import { seedCompetencyFramework } from '../../../src/database/seeds/competency-framework.seed';
import { seedPersonalityItems } from '../../../src/database/seeds/personality-items.seed';
import { seedNormativeData } from '../../../src/database/seeds/normative-data.seed';
import { seedAdminAccount } from '../../../src/database/seeds/admin.seed';

/**
 * Runs once before all e2e test suites:
 *   1. Truncates all data from the database (cascade via organisations table)
 *   2. Runs TypeORM migrations to ensure schema is current
 *   3. Loads reference data seeds (competency framework, personality items, normative data)
 *
 * This ensures every e2e run starts from a known clean state with reference data in place.
 */
export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL!;
  console.log('\n🧹  E2E global setup — resetting database...');

  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: [path.join(__dirname, '../../../src/**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '../../../src/migrations/*{.ts,.js}')],
    synchronize: false,
  });

  await ds.initialize();

  // 1. Ensure all migrations are applied
  await ds.runMigrations({ transaction: 'each' });
  console.log('   ✓ Migrations applied');

  // 2. Truncate all tenant data (CASCADE clears all child tables)
  await ds.query(`SET session_replication_role = 'replica'`);
  const tables = [
    'notifications', 'reports',
    'readiness_scores', 'learning_agility_responses', 'sjt_responses',
    'personality_scores', 'personality_responses',
    'normative_data',
    'competency_ratings', 'competency_assessments',
    'rater_responses', 'rater_nominations',
    'assessment_participants', 'assessments',
    'role_profiles',
    'items',
    'competency_behaviours', 'competency_levels', 'competencies', 'competency_domains',
    'sessions', 'users', 'departments', 'organisations',
  ];
  for (const t of tables) {
    await ds.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`).catch(() => {
      // Table may not exist yet if running fresh — ignore
    });
  }
  await ds.query(`SET session_replication_role = 'origin'`);
  console.log('   ✓ All tables truncated');

  // 3. Seed reference data (competency framework, Big Five items, normative data)
  await seedCompetencyFramework(ds);
  await seedPersonalityItems(ds);
  await seedNormativeData(ds);
  console.log('   ✓ Reference data seeded');

  // 4. Seed default admin account
  await seedAdminAccount(ds);
  console.log('   ✓ Default admin account seeded');

  // Store the DataSource on global so globalTeardown can close it
  (global as any).__E2E_DS__ = ds;

  console.log('   ✓ E2E global setup complete\n');
}
