import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetencyDomain } from './entities/competency-domain.entity';
import { Competency } from './entities/competency.entity';
import { CompetencyLevel } from './entities/competency-level.entity';
import { CompetencyBehaviour } from './entities/competency-behaviour.entity';
import { Item } from './entities/item.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompetencyDomain,
      Competency,
      CompetencyLevel,
      CompetencyBehaviour,
      Item,
    ]),
  ],
  providers: [ItemsService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
