import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RequiredCompetencyItemDto {
  @ApiProperty()
  @IsUUID()
  competencyId: string;

  @ApiProperty({ minimum: 0, maximum: 4 })
  @IsInt()
  @Min(0)
  @Max(4)
  minLevel: number;

  @ApiProperty()
  @IsNumber()
  weight: number;
}

export class CreateRoleProfileDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ type: [RequiredCompetencyItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredCompetencyItemDto)
  requiredCompetencies?: RequiredCompetencyItemDto[];

  @ApiPropertyOptional({
    description: 'Map of Big Five factor -> fit criteria (minTScore/maxTScore/idealTScore/weight)',
  })
  @IsOptional()
  @IsObject()
  personalityFit?: Record<
    string,
    { minTScore?: number; maxTScore?: number; idealTScore?: number; weight: number }
  >;
}
