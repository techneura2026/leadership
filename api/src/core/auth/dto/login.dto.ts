import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@acme-hr.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsString()
  @MinLength(1)
  password: string;
}
