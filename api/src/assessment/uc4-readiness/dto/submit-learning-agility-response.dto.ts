import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class SubmitLearningAgilityResponseDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: '1=Strongly Disagree ... 5=Strongly Agree' })
  @IsInt()
  @Min(1)
  @Max(5)
  value: number;
}
