import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetUserPasswordDto {
  @ApiProperty({ description: 'New password for the user. They will be required to change it again on next login.' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
