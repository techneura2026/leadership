import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const REQUESTABLE_TYPES = ['competency', '360_feedback'] as const;
export type RequestableType = (typeof REQUESTABLE_TYPES)[number];

export interface RaterInput {
  email: string;
  name: string;
  relationship: 'supervisor' | 'peer' | 'direct_report' | 'stakeholder';
}

export class AssessmentRequestDto {
  @IsString() @MinLength(1) @MaxLength(100)
  cycleRef: string;

  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsIn([...REQUESTABLE_TYPES], { each: true })
  types: RequestableType[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ArrayUnique() @IsString({ each: true }) @MaxLength(100, { each: true })
  employeeRefs: string[];

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  competencyIds?: string[];

  @IsOptional() @IsUUID('4')
  roleProfileId?: string;

  @IsOptional() @IsBoolean()
  includeSelfAssessment?: boolean;

  /** 360 only: raters to nominate (and approve) per employeeRef. */
  @IsOptional() @IsObject()
  raters?: Record<string, RaterInput[]>;
}

export interface AssessmentRequestResult {
  assessments: Array<{ assessmentId: string; type: RequestableType; employeeRefs: string[]; created: boolean }>;
}
