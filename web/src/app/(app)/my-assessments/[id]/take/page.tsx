'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Spinner, PageSpinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { AssessmentDto, AssessmentType, CompetencyDto } from '@leaderprism/shared';

// ── Scale labels ──────────────────────────────────────────────────────────────
const FREQ_LABELS = ['Rarely', 'Occasionally', 'Sometimes', 'Often', 'Consistently'];
const PROFICIENCY_LABELS = ['Emerging', 'Developing', 'Proficient', 'Mastery'];
const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
const SJT_OPTIONS = ['A', 'B', 'C', 'D'];

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{label ?? `${current} of ${total}`}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Scale Button ──────────────────────────────────────────────────────────────
function ScaleButton({
  value,
  label,
  selected,
  onClick,
}: {
  value: number;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 min-w-0 flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all',
        'min-h-[56px] text-center',
        selected
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50',
      )}
    >
      <span className="text-base font-bold">{value}</span>
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── 360 / Competency Assessment (competency-by-competency) ────────────────────
function CompetencyByCompetencyTaker({
  assessmentId,
  assessmentType,
  competencies,
}: {
  assessmentId: string;
  assessmentType: AssessmentType;
  competencies: CompetencyDto[];
}) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [overallComment, setOverallComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFinal, setShowFinal] = useState(false);

  const is360 = assessmentType === AssessmentType.FEEDBACK_360;
  const scaleLabels = is360 ? FREQ_LABELS : PROFICIENCY_LABELS;
  const scaleSize = is360 ? 5 : 4;

  const current = competencies[currentIdx];
  const isLast = currentIdx === competencies.length - 1;

  // Auto-save debounced
  const currentRatings = ratings[current?.id] ?? {};
  const debouncedRatings = useDebounce(currentRatings, 500);

  const saveRef = useRef<() => void>(() => {});

  const autoSave = useCallback(async () => {
    if (!current) return;
    const ratingEntries = Object.entries(debouncedRatings);
    if (ratingEntries.length === 0) return;
    setSaving(true);
    try {
      const endpoint = is360
        ? `/assessments/${assessmentId}/360/self`
        : `/assessments/${assessmentId}/competency/self`;
      await api.post(endpoint, {
        competencyId: current.id,
        ratings: ratingEntries.map(([behaviourId, score]) => ({ behaviourId, score })),
        comment: comments[current.id] ?? '',
      });
    } catch {
      // silent auto-save failure
    } finally {
      setSaving(false);
    }
  }, [assessmentId, current, debouncedRatings, comments, is360]);

  saveRef.current = autoSave;

  useEffect(() => {
    saveRef.current();
  }, [debouncedRatings]);

  function setRating(behaviourId: string, score: number) {
    setRatings((prev) => ({
      ...prev,
      [current.id]: {
        ...(prev[current.id] ?? {}),
        [behaviourId]: score,
      },
    }));
  }

  async function goNext() {
    await autoSave();
    if (isLast) {
      setShowFinal(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const endpoint = is360
        ? `/assessments/${assessmentId}/360/self/complete`
        : `/assessments/${assessmentId}/competency/self/complete`;
      await api.post(endpoint, {
        overallRating,
        overallComment,
      });
      router.push('/my-assessments');
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!current) return null;

  if (showFinal) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Overall Rating</h2>
          <p className="text-sm text-gray-500 mb-6">
            Please provide an overall effectiveness rating.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Overall Effectiveness (1–10)
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setOverallRating(n)}
                  className={cn(
                    'w-10 h-10 rounded-lg border-2 text-sm font-semibold transition-all',
                    overallRating === n
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
              <span>Poor</span>
              <span>Average</span>
              <span>Excellent</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Open Comments (Optional)
            </label>
            <textarea
              rows={4}
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Share any additional comments…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || overallRating === null}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Spinner size="sm" className="border-white border-t-transparent" />
                Submitting…
              </>
            ) : (
              'Submit Assessment'
            )}
          </button>
        </div>
      </div>
    );
  }

  const behaviours = current.behaviours ?? [];
  const allRated = behaviours.every((b) => (ratings[current.id]?.[b.id] ?? 0) > 0);

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar
        current={currentIdx + 1}
        total={competencies.length}
        label={`Competency ${currentIdx + 1} of ${competencies.length}`}
      />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">{current.name}</h2>
          {saving && <Spinner size="sm" />}
        </div>
        {current.description && (
          <p className="text-sm text-gray-500 mb-6">{current.description}</p>
        )}

        <div className="space-y-6">
          {behaviours.map((behaviour) => (
            <div key={behaviour.id}>
              <p className="text-sm text-gray-800 font-medium mb-3 leading-snug">
                {behaviour.statement}
              </p>
              <div className="flex gap-2">
                {Array.from({ length: scaleSize }, (_, i) => i + 1).map((score) => (
                  <ScaleButton
                    key={score}
                    value={score}
                    label={scaleLabels[score - 1]}
                    selected={ratings[current.id]?.[behaviour.id] === score}
                    onClick={() => setRating(behaviour.id, score)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            Comment (Optional)
          </label>
          <textarea
            rows={3}
            value={comments[current.id] ?? ''}
            onChange={(e) =>
              setComments((prev) => ({ ...prev, [current.id]: e.target.value }))
            }
            placeholder="Optional: add a comment about this competency…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={goNext}
            disabled={!allRated}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLast ? 'Finish & Review' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Personality Assessment (item by item) ─────────────────────────────────────
interface PersonalityItem {
  id: string;
  statement: string;
  displayOrder: number;
}

function PersonalityTaker({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const { data: items, isLoading } = useApi<PersonalityItem[]>(
    `/assessments/${assessmentId}/personality/questionnaire`,
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sortedItems = items ? [...items].sort((a, b) => a.displayOrder - b.displayOrder) : [];
  const current = sortedItems[currentIdx];
  const total = sortedItems.length;
  const answered = Object.keys(responses).length;
  const estimatedSecsLeft = (total - answered) * 12;
  const minutesLeft = Math.ceil(estimatedSecsLeft / 60);

  async function selectResponse(score: number) {
    if (!current) return;
    setResponses((prev) => ({ ...prev, [current.id]: score }));
    setSaving(true);
    try {
      await api.post(`/assessments/${assessmentId}/personality/responses`, {
        itemId: current.id,
        score,
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
    // Auto-advance
    setTimeout(() => {
      if (currentIdx < total - 1) {
        setCurrentIdx((i) => i + 1);
      }
    }, 200);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/assessments/${assessmentId}/personality/complete`);
      router.push('/my-assessments');
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <PageSpinner />;

  const isComplete = answered >= total && total > 0;

  if (isComplete) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">All questions answered!</h2>
          <p className="text-sm text-gray-500 mb-6">
            You've completed all {total} items. Submit to finalise your assessment.
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Spinner size="sm" className="border-white border-t-transparent" />}
            Submit Assessment
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>
          Question {currentIdx + 1} of {total}
        </span>
        <span>~{minutesLeft} min remaining</span>
      </div>
      <ProgressBar current={answered} total={total} />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-base font-medium text-gray-900 leading-snug flex-1">
            {current.statement}
          </p>
          {saving && <Spinner size="sm" className="ml-3 shrink-0" />}
        </div>

        <div className="space-y-2.5">
          {LIKERT_LABELS.map((label, i) => {
            const score = i + 1;
            const isSelected = responses[current.id] === score;
            return (
              <button
                key={score}
                onClick={() => selectResponse(score)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                  'min-h-[48px]',
                  isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50',
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
                  )}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm text-gray-800">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
            disabled={currentIdx === total - 1}
            className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Skip →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Readiness Assessment ──────────────────────────────────────────────────────
interface SjtScenario {
  id: string;
  scenario: string;
  options: string[];
  displayOrder: number;
}

function ReadinessTaker({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const { data: sjtScenarios, isLoading: loadingSjt } = useApi<SjtScenario[]>(
    `/assessments/${assessmentId}/sjt/questionnaire`,
  );

  const [section, setSection] = useState<'sjt' | 'learning_agility'>('sjt');
  const [currentSjtIdx, setCurrentSjtIdx] = useState(0);
  const [sjtResponses, setSjtResponses] = useState<Record<string, number>>({});
  const [laRatings, setLaRatings] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const LA_ITEMS = [
    'I seek feedback even when it might be uncomfortable',
    'I thrive in situations of uncertainty and ambiguity',
    'I learn more from failures than from successes',
    'I regularly experiment with new approaches',
    'I adapt my style based on the situation and people involved',
    'I enjoy being stretched beyond my comfort zone',
    'I quickly integrate lessons from diverse experiences',
    'I actively seek out people with different perspectives',
    'I change direction readily when evidence points elsewhere',
    'I find complex problems energising rather than draining',
    'I extract meaning from contradictory or incomplete information',
    'I build networks across functions and organisations',
    'I reflect deeply on my own strengths and development areas',
    'I apply insights from one context to solve problems in another',
    'I remain effective when operating in conditions of high uncertainty',
  ];

  const scenarios = sjtScenarios
    ? [...sjtScenarios].sort((a, b) => a.displayOrder - b.displayOrder)
    : [];
  const currentScenario = scenarios[currentSjtIdx];
  const sjtTotal = scenarios.length;

  async function submitSjtResponse(optionIndex: number) {
    if (!currentScenario) return;
    setSjtResponses((prev) => ({ ...prev, [currentScenario.id]: optionIndex }));
    setSaving(true);
    try {
      await api.post(`/assessments/${assessmentId}/sjt/responses`, {
        scenarioId: currentScenario.id,
        selectedOption: optionIndex,
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
    if (currentSjtIdx < sjtTotal - 1) {
      setCurrentSjtIdx((i) => i + 1);
    } else {
      setSection('learning_agility');
    }
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/assessments/${assessmentId}/readiness/complete`, {
        learningAgilityRatings: Object.entries(laRatings).map(([idx, score]) => ({
          itemIndex: Number(idx),
          score,
        })),
      });
      router.push('/my-assessments');
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSjt) return <PageSpinner />;

  if (section === 'sjt') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700 font-medium mb-4">
          Section 1 of 2 — Situational Judgment
        </div>
        <ProgressBar
          current={currentSjtIdx + 1}
          total={sjtTotal}
          label={`Scenario ${currentSjtIdx + 1} of ${sjtTotal}`}
        />

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Scenario {currentSjtIdx + 1}
            </p>
            {saving && <Spinner size="sm" />}
          </div>
          <p className="text-base text-gray-900 leading-relaxed mb-6">
            {currentScenario?.scenario}
          </p>

          <div className="space-y-2.5">
            {(currentScenario?.options ?? []).map((option, idx) => (
              <button
                key={idx}
                onClick={() => submitSjtResponse(idx)}
                disabled={sjtResponses[currentScenario?.id] !== undefined}
                className={cn(
                  'w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 transition-all',
                  'min-h-[52px]',
                  sjtResponses[currentScenario?.id] === idx
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 disabled:opacity-60',
                )}
              >
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
                  {SJT_OPTIONS[idx]}
                </span>
                <span className="text-sm text-gray-800 leading-snug">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Learning Agility section
  const laAnswered = Object.keys(laRatings).length;
  const allLaAnswered = laAnswered === LA_ITEMS.length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs text-green-700 font-medium mb-4">
        Section 2 of 2 — Learning Agility
      </div>
      <ProgressBar
        current={laAnswered}
        total={LA_ITEMS.length}
        label={`${laAnswered} of ${LA_ITEMS.length} answered`}
      />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Learning Agility</h2>
        <p className="text-sm text-gray-500 mb-6">
          Rate each statement on a scale of 1 (Strongly Disagree) to 5 (Strongly Agree).
        </p>

        <div className="space-y-5">
          {LA_ITEMS.map((item, idx) => (
            <div key={idx}>
              <p className="text-sm text-gray-800 font-medium mb-2 leading-snug">{item}</p>
              <div className="flex gap-2">
                {FREQ_LABELS.map((label, i) => (
                  <ScaleButton
                    key={i + 1}
                    value={i + 1}
                    label={label}
                    selected={laRatings[idx] === i + 1}
                    onClick={() => setLaRatings((prev) => ({ ...prev, [idx]: i + 1 }))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={handleFinalSubmit}
            disabled={!allLaAnswered || submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Spinner size="sm" className="border-white border-t-transparent" />}
            {!allLaAnswered
              ? `Answer all items (${LA_ITEMS.length - laAnswered} remaining)`
              : 'Submit Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Take Page ─────────────────────────────────────────────────────────────
export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: assessment, error, isLoading } = useApi<AssessmentDto>(`/assessments/${id}`);

  const needsCompetencies =
    assessment?.assessmentType === AssessmentType.FEEDBACK_360 ||
    assessment?.assessmentType === AssessmentType.COMPETENCY;

  const { data: allCompetencies, isLoading: loadingComps } = useApi<CompetencyDto[]>(
    needsCompetencies ? '/items/competencies' : null,
  );

  // Narrow to only the competencies configured for this assessment
  const configIds: string[] = (assessment?.config as any)?.competencyIds ?? [];
  const competencies =
    configIds.length > 0 && allCompetencies
      ? allCompetencies.filter((c) => configIds.includes(c.id))
      : allCompetencies;

  if (isLoading || loadingComps) return <PageSpinner />;
  if (error || !assessment) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load assessment. Please go back and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="mb-6">
        <button
          onClick={() => router.push('/my-assessments')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          My Assessments
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{assessment.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">
          {assessment.assessmentType.replace('_', ' ')} Assessment
        </p>
      </div>

      {(assessment.assessmentType === AssessmentType.FEEDBACK_360 ||
        assessment.assessmentType === AssessmentType.COMPETENCY) && (
        <CompetencyByCompetencyTaker
          assessmentId={id}
          assessmentType={assessment.assessmentType}
          competencies={competencies ?? []}
        />
      )}

      {assessment.assessmentType === AssessmentType.PERSONALITY && (
        <PersonalityTaker assessmentId={id} />
      )}

      {assessment.assessmentType === AssessmentType.READINESS && (
        <ReadinessTaker assessmentId={id} />
      )}
    </div>
  );
}
