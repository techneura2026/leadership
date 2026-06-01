import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@leaderprism/shared';

const ASSIGNABLE_ROLES = [UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.PARTICIPANT] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'kavinda.r@stp.lk' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

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
