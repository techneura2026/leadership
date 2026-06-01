import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@leaderprism/shared';

const ASSIGNABLE_ROLES = [UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.PARTICIPANT] as const;

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Kavinda' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rajapaksa' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsEnum(ASSIGNABLE_ROLES, {
    message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
  })
  role?: (typeof ASSIGNABLE_ROLES)[number];

  @ApiPropertyOptional({ example: 'Head of Product' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Set false to deactivate the user' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
