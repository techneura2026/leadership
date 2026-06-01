import { seedCompetencyFramework } from '../../../src/database/seeds/competency-framework.seed';
import { seedPersonalityItems } from '../../../src/database/seeds/personality-items.seed';
import { seedNormativeData } from '../../../src/database/seeds/normative-data.seed';
import { seedAdminAccount } from '../../../src/database/seeds/admin.seed';
import * as bcrypt from 'bcrypt';

export default async function globalTeardown() {
  const ds = (global as any).__E2E_DS__;
  if (ds?.isInitialized) {
    try {
      if (process.env.CLEAN_UP_E2E === 'true') {
        console.log('\n🧹  E2E global teardown — cleaning up E2E data...');
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
            // Table may not exist yet — ignore
          });
        }
        await ds.query(`SET session_replication_role = 'origin'`);
        console.log('   ✓ All tables truncated');

        // Seed reference data and admin account
        await seedCompetencyFramework(ds);
        await seedPersonalityItems(ds);
        await seedNormativeData(ds);
        await seedAdminAccount(ds);
        console.log('   ✓ System populated with reference data and admin account');
      } else {
        // Seed default admin account (Clean)
        console.log('\n👤  E2E global teardown — ensuring admin account is seeded...');
        await seedAdminAccount(ds);

        console.log('🔑  E2E global teardown — seeding E2E test account and migrating test data...');

        // 1. Seed fixed E2E Organisation
        let orgRes = await ds.query(`SELECT id FROM organisations WHERE slug = 'e2e'`);
        let e2eOrgId: string;
        if (orgRes.length > 0) {
          e2eOrgId = orgRes[0].id;
        } else {
          const res = await ds.query(`
            INSERT INTO organisations (slug, name, primary_colour, plan)
            VALUES ('e2e', 'E2E Testing Org', '#1E40AF', 'professional')
            RETURNING id
          `);
          e2eOrgId = res[0].id;
        }

        // 2. Seed fixed E2E Admin User
        const passwordHash = await bcrypt.hash('Password123!', 10);
        let userRes = await ds.query(`SELECT id FROM users WHERE email = 'e2e@leaderprism.com'`);
        let e2eAdminId: string;
        if (userRes.length > 0) {
          e2eAdminId = userRes[0].id;
        } else {
          const res = await ds.query(`
            INSERT INTO users (organisation_id, email, password_hash, first_name, last_name, role, is_active, email_verified)
            VALUES ($1, 'e2e@leaderprism.com', $2, 'E2E', 'Admin', 'org_admin', true, true)
            RETURNING id
          `, [e2eOrgId, passwordHash]);
          e2eAdminId = res[0].id;
        }

        // 3. Get Acme Org ID to avoid touching it
        const acmeOrgRes = await ds.query(`SELECT id FROM organisations WHERE slug = 'acme'`);
        const acmeOrgId = acmeOrgRes[0]?.id;

        if (acmeOrgId) {
          // Move E2E test data from dynamic organisations to the fixed E2E organisation
          await ds.query(`
            UPDATE users 
            SET organisation_id = $1 
            WHERE organisation_id != $1 AND organisation_id != $2
          `, [e2eOrgId, acmeOrgId]);

          await ds.query(`
            UPDATE assessments 
            SET organisation_id = $1, created_by = $2
            WHERE organisation_id != $1 AND organisation_id != $3
          `, [e2eOrgId, e2eAdminId, acmeOrgId]);

          await ds.query(`
            UPDATE role_profiles 
            SET organisation_id = $1 
            WHERE organisation_id != $1 AND organisation_id != $2
          `, [e2eOrgId, acmeOrgId]);

          await ds.query(`
            UPDATE competency_domains 
            SET organisation_id = $1 
            WHERE organisation_id IS NOT NULL AND organisation_id != $1 AND organisation_id != $2
          `, [e2eOrgId, acmeOrgId]);

          await ds.query(`
            UPDATE competencies 
            SET organisation_id = $1 
            WHERE organisation_id IS NOT NULL AND organisation_id != $1 AND organisation_id != $2
          `, [e2eOrgId, acmeOrgId]);

          await ds.query(`
            UPDATE reports 
            SET organisation_id = $1 
            WHERE organisation_id != $1 AND organisation_id != $2
          `, [e2eOrgId, acmeOrgId]);
          
          await ds.query(`
            UPDATE notifications 
            SET organisation_id = $1 
            WHERE organisation_id != $1 AND organisation_id != $2
          `, [e2eOrgId, acmeOrgId]);
        }

        console.log('   ✓ System populated with E2E test account: e2e@leaderprism.com / Password123!');
      }
    } catch (err) {
      console.error('Error during global teardown cleanup:', err);
    } finally {
      await ds.destroy();
    }
  }
}
