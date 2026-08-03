import { AssessmentConfig } from '../types';

export type QuestionMode = 'competency' | 'custom';

/**
 * Missing questionMode always resolves to 'competency' — every 360 assessment created
 * before this field existed was already served the competency rater flow regardless of
 * whether config.questions was populated, so that (and never config.questions/competencyIds
 * presence) is the only safe backward-compatible default.
 */
export function resolveQuestionMode(
  config: Pick<AssessmentConfig, 'questionMode'> | null | undefined,
): QuestionMode {
  return config?.questionMode === 'custom' ? 'custom' : 'competency';
}
