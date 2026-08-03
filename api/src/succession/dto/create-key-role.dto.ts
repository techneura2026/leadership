import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const CRITICALITY = ['critical', 'high', 'medium'] as const;
const FLIGHT_RISK = ['high', 'medium', 'low'] as const;

export class CreateKeyRoleDto {
  @ApiProperty({ example: 'VP Engineering' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: CRITICALITY })
  @IsOptional()
  @IsIn(CRITICALITY)
  criticality?: (typeof CRITICALITY)[number];

  @ApiPropertyOptional({ description: 'Current incumbent user UUID' })
  @IsOptional()
  @IsUUID()
  incumbentId?: string;

  @ApiPropertyOptional({ description: 'Date the incumbent took this role (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  incumbentSince?: string;

  @ApiPropertyOptional({ enum: FLIGHT_RISK })
  @IsOptional()
  @IsIn(FLIGHT_RISK)
  flightRisk?: (typeof FLIGHT_RISK)[number];
}
