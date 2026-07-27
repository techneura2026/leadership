import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class SubmitSjtResponseDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ description: 'Value of the chosen option, as defined on the SJT item' })
  @IsInt()
  @Min(0)
  selectedOption: number;
}
