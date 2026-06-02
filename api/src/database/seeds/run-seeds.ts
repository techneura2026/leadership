import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedCompetencyFramework } from './competency-framework.seed';
import { seedPersonalityItems } from './personality-items.seed';
import { seedReadinessItems } from './readiness-items.seed';
import { seedNormativeData } from './normative-data.seed';
import { seedAdminAccount } from './admin.seed';

async function runSeeds(): Promise<void> {
  console.log('Initialising database connection...');
  await AppDataSource.initialize();

  try {
    console.log('Running seed: Competency Framework...');
    await seedCompetencyFramework(AppDataSource);
    console.log('  Competency framework seeded.');

    console.log('Running seed: Personality Items...');
    await seedPersonalityItems(AppDataSource);
    console.log('  Personality items seeded.');

    console.log('Running seed: Readiness Items...');
    await seedReadinessItems(AppDataSource);
    console.log('  Readiness items seeded.');

    console.log('Running seed: Normative Data...');
    await seedNormativeData(AppDataSource);
    console.log('  Normative data seeded.');

    console.log('Running seed: Admin Account...');
    await seedAdminAccount(AppDataSource);
    console.log('  Admin account seeded.');

    console.log('All seeds completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

runSeeds();
