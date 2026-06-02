import { DataSource } from 'typeorm';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { User } from '../../core/users/entities/user.entity';
import { Plan, UserRole } from '@leaderprism/shared';
import * as bcrypt from 'bcrypt';

export async function seedAdminAccount(dataSource: DataSource): Promise<void> {
  const orgRepo = dataSource.getRepository(Organisation);
  const userRepo = dataSource.getRepository(User);

  // Check/Create default organisation
  let org = await orgRepo.findOne({ where: { id: '8ebe0e01-4353-4042-b84a-62abbf275c79' } });
  if (!org) {
    const oldOrg = await orgRepo.findOne({ where: { slug: 'acme' } });
    if (oldOrg) {
      console.log('  Removing old Acme Corporation with non-static ID...');
      await orgRepo.remove(oldOrg);
    }
    console.log('  Seeding Organisation: Acme Corporation...');
    org = orgRepo.create({
      id: '8ebe0e01-4353-4042-b84a-62abbf275c79',
      slug: 'acme',
      name: 'Acme Corporation',
      primaryColour: '#1E40AF',
      plan: Plan.ENTERPRISE,
    });
    org = await orgRepo.save(org);
  } else if (org.plan !== Plan.ENTERPRISE) {
    org.plan = Plan.ENTERPRISE;
    org = await orgRepo.save(org);
    console.log('  Updated Acme Corporation plan to ENTERPRISE');
  }

  // Check/Create default administrator user
  const email = 'admin@acme.com';
  let adminUser = await userRepo.findOne({
    where: { id: '99849206-8d19-482a-9f5b-1c5c16053351' },
  });

  if (!adminUser) {
    const oldUser = await userRepo.findOne({ where: { organisationId: org.id, email } });
    if (oldUser) {
      console.log(`  Removing old Admin User with non-static ID...`);
      await userRepo.remove(oldUser);
    }
    console.log(`  Seeding Admin User: ${email}...`);
    const passwordHash = await bcrypt.hash('Password123!', 10);
    adminUser = userRepo.create({
      id: '99849206-8d19-482a-9f5b-1c5c16053351',
      organisationId: org.id,
      email,
      passwordHash,
      firstName: 'Acme',
      lastName: 'Admin',
      role: UserRole.ORG_ADMIN,
      isActive: true,
      emailVerified: true,
    });
    await userRepo.save(adminUser);
  }
}
