import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SaveParticipantResponsesDto {
  @ApiProperty({ description: 'Map of custom question id to response value' })
  @IsObject()
  responses: Record<string, any>;
}
