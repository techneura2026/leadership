import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RaterRelationship } from '@leaderprism/shared';

export class RaterNominationItemDto {
  @ApiProperty({ example: 'rater@example.com' })
  @IsEmail()
  raterEmail: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  raterName?: string;

  @ApiProperty({ enum: RaterRelationship })
  @IsEnum(RaterRelationship)
  relationship: RaterRelationship;
}

export class NominateRatersDto {
  @ApiProperty({ description: 'Participant UUID being rated' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ type: [RaterNominationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RaterNominationItemDto)
  raters: RaterNominationItemDto[];
}
