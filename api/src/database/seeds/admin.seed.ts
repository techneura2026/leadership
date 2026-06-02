import { DataSource } from 'typeorm';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { User } from '../../core/users/entities/user.entity';
import { Plan, UserRole } from '@leaderprism/shared';
import * as bcrypt from 'bcrypt';

export async function seedAdminAccount(dataSource: DataSource): Promise<void> {
  const orgRepo = dataSource.getRepository(Organisation);
  const userRepo = dataSource.getRepository(User);

  // Check/Create default organisation
  let org = await orgRepo.findOne({ where: { slug: 'acme' } });
  if (!org) {
    console.log('  Seeding Organisation: Acme Corporation...');
    org = orgRepo.create({
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
  const existingUser = await userRepo.findOne({
    where: { organisationId: org.id, email },
  });

  if (!existingUser) {
    console.log(`  Seeding Admin User: ${email}...`);
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const adminUser = userRepo.create({
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
