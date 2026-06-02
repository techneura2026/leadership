/**
 * E2E test runner script.
 *
 * Usage:  npx ts-node api/test/e2e/scripts/reset-and-run.ts
 *
 * What it does:
 *   1. Connects to PostgreSQL using the test DATABASE_URL
 *   2. Truncates all tables (safe cascade via organisations)
 *   3. Runs TypeORM migrations to ensure schema is current
 *   4. Runs all reference data seeds (competency framework, Big Five items, normative data)
 *   5. Prints summary — Jest then runs the actual tests via jest.e2e.config.js
 *
 * This script is invoked by jest's globalSetup, so you don't normally call it directly.
 * It exists as a standalone script for debugging the setup phase.
 */

import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

import { DataSource } from 'typeorm';
import { seedCompetencyFramework } from '../../../src/database/seeds/competency-framework.seed';
import { seedPersonalityItems } from '../../../src/database/seeds/personality-items.seed';
import { seedReadinessItems } from '../../../src/database/seeds/readiness-items.seed';
import { seedNormativeData } from '../../../src/database/seeds/normative-data.seed';

async function main() {
  console.log('\n🔧  LeaderPrism E2E — Database Reset & Seed\n');

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL!,
    entities: [path.join(__dirname, '../../../src/**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '../../../src/migrations/*{.ts,.js}')],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log(`   Connected: ${process.env.DATABASE_URL}\n`);

  // Run migrations
  const pending = await ds.showMigrations();
  if (pending) {
    await ds.runMigrations({ transaction: 'each' });
    console.log('   ✓ Migrations applied');
  } else {
    console.log('   ✓ Schema up-to-date');
  }

  // Truncate all data
  await ds.query(`SET session_replication_role = 'replica'`);
  const tables = [
    'notifications', 'reports',
    'readiness_scores', 'learning_agility_responses', 'sjt_responses',
    'personality_scores', 'personality_responses', 'normative_data',
    'competency_ratings', 'competency_assessments',
    'rater_responses', 'rater_nominations',
    'assessment_participants', 'assessments',
    'role_profiles', 'items',
    'competency_behaviours', 'competency_levels', 'competencies', 'competency_domains',
    'sessions', 'users', 'departments', 'organisations',
  ];
  for (const t of tables) {
    await ds.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`).catch(() => {});
  }
  await ds.query(`SET session_replication_role = 'DEFAULT'`);
  console.log('   ✓ All tables truncated');

  // Seed reference data
  await seedCompetencyFramework(ds);
  const compCount = await ds.query(`SELECT COUNT(*) FROM competencies`);
  console.log(`   ✓ Competency framework seeded (${compCount[0].count} competencies)`);

  await seedPersonalityItems(ds);
  const itemCount = await ds.query(`SELECT COUNT(*) FROM items WHERE module = 'personality'`);
  console.log(`   ✓ Personality items seeded (${itemCount[0].count} items)`);

  await seedReadinessItems(ds);
  const readinessSjtCount = await ds.query(`SELECT COUNT(*) FROM items WHERE module = 'sjt'`);
  const readinessLaCount = await ds.query(`SELECT COUNT(*) FROM items WHERE module = 'learning_agility'`);
  console.log(`   ✓ Readiness items seeded (${readinessSjtCount[0].count} SJT, ${readinessLaCount[0].count} LA items)`);

  await seedNormativeData(ds);
  const normCount = await ds.query(`SELECT COUNT(*) FROM normative_data`);
  console.log(`   ✓ Normative data seeded (${normCount[0].count} factor rows)`);

  await ds.destroy();

  console.log('\n   ✅  Reset complete — ready to run E2E tests\n');
  console.log('   Run:  npm run test:e2e -w api\n');
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
