/**
 * Tests the dual-mode 360 question logic: resolveQuestionMode's backward-compat rule,
 * and Uc1FeedbackService.aggregateCustomAnswers' per-question-type tallying (including the
 * TRUE_FALSE quirk: stored answers are the literal strings 'true'/'false', not option ids).
 */
import { AssessmentConfig, FormQuestion, resolveQuestionMode } from '@leaderprism/shared';
import { Uc1FeedbackService } from '../../src/assessment/uc1-feedback/uc1-feedback.service';
import { RaterNomination } from '../../src/assessment/uc1-feedback/entities/rater-nomination.entity';

function makeNomination(customAnswers: Record<string, any> | null): RaterNomination {
  return { customAnswers } as RaterNomination;
}

// aggregateCustomAnswers/shuffle are pure — no repository access — so the other
// constructor args can be stubbed out.
const service = new Uc1FeedbackService(
  {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
);

describe('resolveQuestionMode', () => {
  it('defaults to competency when questionMode is absent, regardless of questions/competencyIds', () => {
    expect(resolveQuestionMode(undefined)).toBe('competency');
    expect(resolveQuestionMode(null)).toBe('competency');
    expect(resolveQuestionMode({})).toBe('competency');
    // The critical regression case: a pre-existing 360 assessment created by the wizard
    // before this feature always sent `{ questions: [...] }` with no questionMode field —
    // raters must still resolve to 'competency' exactly like they always have.
    const legacyConfig: AssessmentConfig = { questions: [{ id: 'q1' } as FormQuestion] };
    expect(resolveQuestionMode(legacyConfig)).toBe('competency');
  });

  it('resolves to custom only when questionMode is explicitly set to custom', () => {
    expect(resolveQuestionMode({ questionMode: 'custom' })).toBe('custom');
  });

  it('resolves to competency when questionMode is explicitly competency', () => {
    expect(resolveQuestionMode({ questionMode: 'competency' })).toBe('competency');
  });
});

describe('Uc1FeedbackService.aggregateCustomAnswers', () => {
  it('tallies SINGLE_CHOICE answers by option id', () => {
    const question: FormQuestion = {
      id: 'q1',
      type: 'SINGLE_CHOICE',
      title: 'How clear is their communication?',
      required: true,
      options: [{ id: 'opt-a', text: 'Very clear' }, { id: 'opt-b', text: 'Unclear' }],
      tableRows: [],
      tableColumns: [],
    };
    const nominations = [
      makeNomination({ q1: 'opt-a' }),
      makeNomination({ q1: 'opt-a' }),
      makeNomination({ q1: 'opt-b' }),
    ];

    const [summary] = service.aggregateCustomAnswers([question], nominations);
    expect(summary.totalResponses).toBe(3);
    expect(summary.tally).toEqual([
      { optionId: 'opt-a', optionText: 'Very clear', count: 2 },
      { optionId: 'opt-b', optionText: 'Unclear', count: 1 },
    ]);
  });

  it('tallies MULTIPLE_CHOICE answers across all selected option ids', () => {
    const question: FormQuestion = {
      id: 'q2',
      type: 'MULTIPLE_CHOICE',
      title: 'Which strengths stand out?',
      required: false,
      options: [{ id: 'opt-a', text: 'Communication' }, { id: 'opt-b', text: 'Delegation' }],
      tableRows: [],
      tableColumns: [],
    };
    const nominations = [
      makeNomination({ q2: ['opt-a', 'opt-b'] }),
      makeNomination({ q2: ['opt-a'] }),
    ];

    const [summary] = service.aggregateCustomAnswers([question], nominations);
    expect(summary.tally).toEqual([
      { optionId: 'opt-a', optionText: 'Communication', count: 2 },
      { optionId: 'opt-b', optionText: 'Delegation', count: 1 },
    ]);
  });

  it('tallies TRUE_FALSE against the literal string answer, not the authored option id', () => {
    // Authored options carry ids opt-true/opt-false, but the rater UI submits the literal
    // strings 'true'/'false' — this test guards against silently producing all-zero tallies.
    const question: FormQuestion = {
      id: 'q3',
      type: 'TRUE_FALSE',
      title: 'Do they meet deadlines?',
      required: true,
      options: [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }],
      tableRows: [],
      tableColumns: [],
    };
    const nominations = [
      makeNomination({ q3: 'true' }),
      makeNomination({ q3: 'true' }),
      makeNomination({ q3: 'false' }),
    ];

    const [summary] = service.aggregateCustomAnswers([question], nominations);
    expect(summary.tally).toEqual([
      { optionId: 'true', optionText: 'True', count: 2 },
      { optionId: 'false', optionText: 'False', count: 1 },
    ]);
  });

  it('shuffles and returns non-empty SHORT_ANSWER text, filtering blanks', () => {
    const question: FormQuestion = {
      id: 'q4',
      type: 'SHORT_ANSWER',
      title: 'What should they focus on?',
      required: false,
      options: [],
      tableRows: [],
      tableColumns: [],
    };
    const nominations = [
      makeNomination({ q4: 'Delegate more.' }),
      makeNomination({ q4: '   ' }),
      makeNomination({ q4: null }),
      makeNomination({ q4: 'Listen actively.' }),
    ];

    const [summary] = service.aggregateCustomAnswers([question], nominations);
    // totalResponses counts every non-null answer submitted (including the whitespace-only
    // one); `responses` separately filters down to displayable non-blank text.
    expect(summary.totalResponses).toBe(3);
    expect(summary.responses).toHaveLength(2);
    expect(new Set(summary.responses)).toEqual(new Set(['Delegate more.', 'Listen actively.']));
  });

  it('flattens TABLE answers into row/column label pairs', () => {
    const question: FormQuestion = {
      id: 'q5',
      type: 'TABLE',
      title: 'Rate each area',
      required: true,
      options: [],
      tableRows: ['Communication', 'Delegation'],
      tableColumns: ['Needs work', 'Strong'],
    };
    const nominations = [makeNomination({ q5: { '0': '1', '1': '0' } })];

    const [summary] = service.aggregateCustomAnswers([question], nominations);
    expect(summary.totalResponses).toBe(1);
    expect(summary.responses).toEqual(
      expect.arrayContaining(['Communication: Strong', 'Delegation: Needs work']),
    );
  });

  it('excludes nominations with no answer for a question from totalResponses', () => {
    const question: FormQuestion = {
      id: 'q6',
      type: 'SINGLE_CHOICE',
      title: 'Unanswered by some raters',
      required: false,
      options: [{ id: 'opt-a', text: 'Yes' }],
      tableRows: [],
      tableColumns: [],
    };
    const nominations = [makeNomination({ q6: 'opt-a' }), makeNomination(null), makeNomination({})];

    const [summary] = service.aggregateCustomAnswers([question], nominations);
    expect(summary.totalResponses).toBe(1);
  });
});
