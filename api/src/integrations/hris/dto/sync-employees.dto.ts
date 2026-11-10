import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EmployeeSyncRowDto {
  @IsString() @MinLength(1) @MaxLength(100)
  employeeRef: string;

  @IsEmail() @MaxLength(255)
  email: string;

  @IsString() @MinLength(1) @MaxLength(100)
  firstName: string;

  @IsString() @MinLength(1) @MaxLength(100)
  lastName: string;

  /** null clears the department; omitted leaves it unchanged. */
  @IsOptional() @IsString() @MaxLength(100)
  departmentRef?: string | null;

  /** null clears the manager; omitted leaves it unchanged. */
  @IsOptional() @IsString() @MaxLength(100)
  managerRef?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  designationRef?: string | null;

  @IsOptional() @IsString() @MaxLength(255)
  jobTitle?: string | null;

  @IsIn(['active', 'probation', 'left'])
  employmentStatus: 'active' | 'probation' | 'left';

  @IsOptional() @IsDateString()
  joiningDate?: string;

  @IsOptional() @IsIn(['en', 'si', 'ta'])
  language?: 'en' | 'si' | 'ta';

  @IsOptional() @IsIn(['participant', 'manager', 'hr_manager'])
  role?: 'participant' | 'manager' | 'hr_manager';
}

export class SyncEmployeesDto {
  /** When true, HRIS-managed users missing from this payload are deactivated. Payload must hold every employee (≤ 1000). */
  @IsOptional() @IsBoolean()
  fullSync?: boolean;

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => EmployeeSyncRowDto)
  employees: EmployeeSyncRowDto[];
}
