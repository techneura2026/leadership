import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const CRITICALITY = ['critical', 'high', 'medium'] as const;
const FLIGHT_RISK = ['high', 'medium', 'low'] as const;

export class UpdateKeyRoleDto {
  @ApiPropertyOptional({ example: 'VP Engineering' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Department UUID, or null to clear' })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({ enum: CRITICALITY })
  @IsOptional()
  @IsIn(CRITICALITY)
  criticality?: (typeof CRITICALITY)[number];

  @ApiPropertyOptional({ description: 'Current incumbent user UUID, or null to clear' })
  @IsOptional()
  @IsUUID()
  incumbentId?: string | null;

  @ApiPropertyOptional({ description: 'Date the incumbent took this role (YYYY-MM-DD), or null to clear' })
  @IsOptional()
  @IsDateString()
  incumbentSince?: string | null;

  @ApiPropertyOptional({ enum: FLIGHT_RISK })
  @IsOptional()
  @IsIn(FLIGHT_RISK)
  flightRisk?: (typeof FLIGHT_RISK)[number];
}
