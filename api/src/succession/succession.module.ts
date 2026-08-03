import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeyRole } from './entities/key-role.entity';
import { Successor } from './entities/successor.entity';
import { SuccessionService } from './succession.service';
import { SuccessionController } from './succession.controller';
import { Uc4ReadinessModule } from '../assessment/uc4-readiness/uc4-readiness.module';
import { Uc2CompetencyModule } from '../assessment/uc2-competency/uc2-competency.module';
import { UsersModule } from '../core/users/users.module';
import { OrganisationsModule } from '../core/organisations/organisations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KeyRole, Successor]),
    Uc4ReadinessModule,
    Uc2CompetencyModule,
    UsersModule,
    OrganisationsModule,
  ],
  providers: [SuccessionService],
  controllers: [SuccessionController],
  exports: [SuccessionService],
})
export class SuccessionModule {}
