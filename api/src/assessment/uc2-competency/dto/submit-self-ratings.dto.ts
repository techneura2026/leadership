import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { CompetencyRatingItemDto } from './competency-rating-item.dto';

export class SubmitSelfRatingsDto {
  @ApiProperty()
  @IsUUID()
  participantId: string;

  @ApiProperty({ type: [CompetencyRatingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompetencyRatingItemDto)
  ratings: CompetencyRatingItemDto[];
}
