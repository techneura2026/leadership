import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedThriveHiveTenant } from './thrivehive-tenant.seed';

async function run(): Promise<void> {
  console.log('Initialising database connection...');
  await AppDataSource.initialize();

  try {
    console.log('Running seed: Thrive Hive Tenant...');
    await seedThriveHiveTenant(AppDataSource);
    console.log('  Thrive Hive tenant seeded.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
