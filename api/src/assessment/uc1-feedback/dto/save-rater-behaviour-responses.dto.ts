import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BehaviourRatingItemDto {
  @ApiProperty()
  @IsUUID()
  behaviourId: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: '1=Rarely ... 5=Consistently' })
  @IsNumber()
  @Min(1)
  @Max(5)
  score: number;
}

export class SaveRaterBehaviourResponsesDto {
  @ApiProperty()
  @IsUUID()
  competencyId: string;

  @ApiProperty({ type: [BehaviourRatingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BehaviourRatingItemDto)
  ratings: BehaviourRatingItemDto[];

  @ApiProperty()
  @IsString()
  comment: string;
}
