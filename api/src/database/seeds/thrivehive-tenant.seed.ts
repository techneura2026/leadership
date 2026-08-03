import { DataSource } from 'typeorm';
import { Organisation } from '../../core/organisations/entities/organisation.entity';
import { User } from '../../core/users/entities/user.entity';
import { Plan, UserRole } from '@leaderprism/shared';
import * as bcrypt from 'bcrypt';

const ORG_ID = 'd80d2f22-8215-49ab-9c2e-0fe54d91b382';
const ADMIN_USER_ID = 'a5b1b56b-1b6e-4dda-9093-141ad4975135';
const ADMIN_EMAIL = 'dulendra@thrivehive.lk';
const ADMIN_PASSWORD = 'P5FRWc6jgUsQ2y!';

export async function seedThriveHiveTenant(dataSource: DataSource): Promise<void> {
  const orgRepo = dataSource.getRepository(Organisation);
  const userRepo = dataSource.getRepository(User);

  let org = await orgRepo.findOne({ where: { id: ORG_ID } });
  if (!org) {
    console.log('  Seeding Organisation: Thrive Hive...');
    org = orgRepo.create({
      id: ORG_ID,
      slug: 'thrivehive',
      name: 'Thrive Hive',
      primaryColour: '#1E40AF',
      plan: Plan.TRIAL,
    });
    org = await orgRepo.save(org);
  }

  let adminUser = await userRepo.findOne({ where: { id: ADMIN_USER_ID } });
  if (!adminUser) {
    const oldUser = await userRepo.findOne({
      where: { organisationId: org.id, email: ADMIN_EMAIL },
    });
    if (oldUser) {
      console.log('  Removing old Thrive Hive Admin User with non-static ID...');
      await userRepo.remove(oldUser);
    }
    console.log(`  Seeding Admin User: ${ADMIN_EMAIL}...`);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    adminUser = userRepo.create({
      id: ADMIN_USER_ID,
      organisationId: org.id,
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Dulendra',
      lastName: 'Admin',
      role: UserRole.ORG_ADMIN,
      isActive: true,
      emailVerified: true,
      mustChangePassword: true,
    });
    await userRepo.save(adminUser);
  }
}
