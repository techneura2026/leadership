import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@leaderprism/shared';

const ASSIGNABLE_ROLES = [UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.PARTICIPANT] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'kavinda.r@stp.lk' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '12345678', description: 'Defaults to 12345678 when omitted' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiProperty({ example: 'Kavinda' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Rajapaksa' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES, example: UserRole.PARTICIPANT })
  @IsEnum(ASSIGNABLE_ROLES, {
    message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
  })
  role: (typeof ASSIGNABLE_ROLES)[number];

  @ApiPropertyOptional({ example: 'Senior Product Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
