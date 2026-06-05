import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation } from './entities/organisation.entity';
import { Department } from './entities/department.entity';
import { Plan } from '@leaderprism/shared';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation) private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    private readonly usersService: UsersService,
  ) {}

  async create(data: { name: string; slug: string }): Promise<Organisation> {
    const existing = await this.orgRepo.findOne({ where: { slug: data.slug } });
    if (existing) {
      throw new ConflictException(`Organisation slug '${data.slug}' is already taken`);
    }

    const trialDays = parseInt(process.env.TRIAL_DAYS ?? '30', 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const org = this.orgRepo.create({
      name: data.name,
      slug: data.slug,
      plan: Plan.TRIAL,
      trialEndsAt,
    });
    return this.orgRepo.save(org);
  }

  async findById(id: string): Promise<Organisation> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organisation not found');
    return org;
  }

  async findBySlug(slug: string): Promise<Organisation | null> {
    return this.orgRepo.findOne({ where: { slug } });
  }

  async update(
    id: string,
    data: Partial<Pick<Organisation, 'name' | 'logoUrl' | 'primaryColour' | 'brandingName'>>,
  ): Promise<Organisation> {
    await this.orgRepo.update(id, data as any);
    return this.findById(id);
  }

  async getDepartments(organisationId: string): Promise<Department[]> {
    return this.deptRepo.find({ where: { organisationId }, order: { name: 'ASC' } });
  }

  async createDepartment(organisationId: string, name: string, description?: string, parentId?: string): Promise<Department> {
    const dept = this.deptRepo.create({ organisationId, name, description: description ?? null, parentId: parentId ?? null });
    return this.deptRepo.save(dept);
  }

  async updateDepartment(
    organisationId: string,
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<Department> {
    const dept = await this.deptRepo.findOne({ where: { id, organisationId } });
    if (!dept) throw new NotFoundException('Department not found');
    Object.assign(dept, data);
    return this.deptRepo.save(dept);
  }

  async deleteDepartment(organisationId: string, id: string): Promise<void> {
    const dept = await this.deptRepo.findOne({ where: { id, organisationId } });
    if (!dept) throw new NotFoundException('Department not found');
    await this.deptRepo.remove(dept);
  }

  async getUsers(organisationId: string) {
    return this.usersService.findAll(organisationId);
  }
}
