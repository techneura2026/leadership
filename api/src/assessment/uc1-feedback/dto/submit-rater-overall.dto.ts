import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitRaterOverallDto {
  @ApiProperty({ minimum: 1, maximum: 10, description: '1=Needs significant development ... 10=Exceptional' })
  @IsNumber()
  @Min(1)
  @Max(10)
  overallRating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  developmentComment?: string;
}
