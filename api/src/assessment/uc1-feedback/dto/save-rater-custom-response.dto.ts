import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString } from 'class-validator';
import type { Answer } from '@leaderprism/shared';

export class SaveRaterCustomResponseDto {
  @ApiProperty({ description: 'FormQuestion.id from the assessment config.questions array' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: 'string | string[] | Record<string,string> depending on question type' })
  @IsDefined()
  answer: Answer;
}
