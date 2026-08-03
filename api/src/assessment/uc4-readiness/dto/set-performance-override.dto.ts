import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetPerformanceOverrideDto {
  @ApiPropertyOptional({
    description: 'High/medium/low override for the 9-box performance axis. Send null to clear the override and fall back to the auto-derived value.',
    enum: ['high', 'medium', 'low'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  gridPerformance?: 'high' | 'medium' | 'low' | null;

  @ApiPropertyOptional({ description: 'Optional note explaining the override' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
