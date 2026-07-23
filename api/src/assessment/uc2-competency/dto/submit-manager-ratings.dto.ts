import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CompetencyRatingItemDto } from './competency-rating-item.dto';

export class SubmitManagerRatingsDto {
  @ApiProperty({ type: [CompetencyRatingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompetencyRatingItemDto)
  ratings: CompetencyRatingItemDto[];
}
