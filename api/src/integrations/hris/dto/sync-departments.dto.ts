import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DepartmentSyncRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  departmentRef: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  /** null clears the parent; omitted leaves it unchanged. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  parentRef?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SyncDepartmentsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => DepartmentSyncRowDto)
  departments: DepartmentSyncRowDto[];
}
