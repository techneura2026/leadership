import { AssessmentConfig } from '../types';
export type QuestionMode = 'competency' | 'custom';
export declare function resolveQuestionMode(config: Pick<AssessmentConfig, 'questionMode'> | null | undefined): QuestionMode;
