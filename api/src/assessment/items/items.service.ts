import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Or, Repository } from 'typeorm';
import { CompetencyDomain } from './entities/competency-domain.entity';
import { Competency } from './entities/competency.entity';
import { CompetencyLevel } from './entities/competency-level.entity';
import { CompetencyBehaviour } from './entities/competency-behaviour.entity';
import { Item } from './entities/item.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCompetencyDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  domainId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateCompetencyDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(CompetencyDomain)
    private readonly domainRepo: Repository<CompetencyDomain>,
    @InjectRepository(Competency)
    private readonly competencyRepo: Repository<Competency>,
    @InjectRepository(CompetencyLevel)
    private readonly levelRepo: Repository<CompetencyLevel>,
    @InjectRepository(CompetencyBehaviour)
    private readonly behaviourRepo: Repository<CompetencyBehaviour>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
  ) {}

  /**
   * Returns system-wide domains (organisationId IS NULL) plus org-specific domains.
   */
  async getDomains(orgId: string): Promise<CompetencyDomain[]> {
    return this.domainRepo.find({
      where: [{ organisationId: IsNull() }, { organisationId: orgId }],
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * Returns competencies (system + org) with levels and behaviours loaded.
   * Optionally filtered by domainId.
   */
  async getCompetencies(orgId: string, domainId?: string): Promise<Competency[]> {
    const qb = this.competencyRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.levels', 'lvl')
      .leftJoinAndSelect('c.behaviours', 'beh')
      .where('(c.organisation_id IS NULL OR c.organisation_id = :orgId)', { orgId })
      .andWhere('c.is_active = true')
      .orderBy('c.display_order', 'ASC')
      .addOrderBy('lvl.level', 'ASC')
      .addOrderBy('beh.display_order', 'ASC');

    if (domainId) {
      qb.andWhere('c.domain_id = :domainId', { domainId });
    }

    return qb.getMany();
  }

  async createCompetency(orgId: string, dto: CreateCompetencyDto): Promise<Competency> {
    const domain = await this.domainRepo.findOne({ where: { id: dto.domainId } });
    if (!domain) {
      throw new NotFoundException(`Domain ${dto.domainId} not found`);
    }

    const competency = this.competencyRepo.create({
      organisationId: orgId,
      domainId: dto.domainId,
      name: dto.name,
      description: dto.description ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: true,
    });

    const saved = await this.competencyRepo.save(competency);
    this.logger.log(`Created competency ${saved.id} for org ${orgId}`);
    return saved;
  }

  async updateCompetency(orgId: string, id: string, dto: UpdateCompetencyDto): Promise<Competency> {
    const competency = await this.competencyRepo.findOne({
      where: { id, organisationId: orgId },
    });

    if (!competency) {
      throw new NotFoundException(`Competency ${id} not found for organisation`);
    }

    if (dto.name !== undefined) competency.name = dto.name;
    if (dto.description !== undefined) competency.description = dto.description ?? null;
    if (dto.isActive !== undefined) competency.isActive = dto.isActive;
    if (dto.displayOrder !== undefined) competency.displayOrder = dto.displayOrder;

    const saved = await this.competencyRepo.save(competency);
    this.logger.log(`Updated competency ${id} for org ${orgId}`);
    return saved;
  }

  /**
   * Returns active items for a specific module (personality/sjt/learning_agility).
   * Optionally filtered by factor and language.
   */
  async getItems(module: string, language = 'en', factor?: string): Promise<Item[]> {
    const qb = this.itemRepo
      .createQueryBuilder('i')
      .where('i.module = :module', { module })
      .andWhere('i.language = :language', { language })
      .andWhere('i.is_active = true');

    if (factor) {
      qb.andWhere('i.factor = :factor', { factor });
    }

    return qb.orderBy('i.created_at', 'ASC').getMany();
  }

  /**
   * Returns the full competency framework for an org — domains with their competencies,
   * levels, and behaviours. Used for 360 assessment configuration.
   */
  async getCompetencyFramework(orgId: string): Promise<CompetencyDomain[]> {
    const domains = await this.domainRepo.find({
      where: [{ organisationId: IsNull() }, { organisationId: orgId }],
      order: { displayOrder: 'ASC' },
    });

    // Load competencies for each domain
    for (const domain of domains) {
      domain.competencies = await this.competencyRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.levels', 'lvl')
        .leftJoinAndSelect('c.behaviours', 'beh')
        .where('c.domain_id = :domainId', { domainId: domain.id })
        .andWhere('(c.organisation_id IS NULL OR c.organisation_id = :orgId)', { orgId })
        .andWhere('c.is_active = true')
        .orderBy('c.display_order', 'ASC')
        .addOrderBy('lvl.level', 'ASC')
        .addOrderBy('beh.display_order', 'ASC')
        .getMany();
    }

    return domains;
  }
}
