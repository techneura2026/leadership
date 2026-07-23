import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CompetencyRatingItemDto {
  @ApiProperty()
  @IsUUID()
  competencyId: string;

  @ApiProperty({ minimum: 0, maximum: 4 })
  @IsInt()
  @Min(0)
  @Max(4)
  levelRated: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  developmentComment?: string;
}
