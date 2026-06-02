'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Spinner, PageSpinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { AssessmentDto, AssessmentType, CompetencyDto } from '@leaderprism/shared';

// ── Shared primitives ─────────────────────────────────────────────────────────

function ProgressBar({ current, total, label }: { current: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{label ?? `${current} of ${total}`}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScaleBtn({
  value, label, selected, onClick,
}: {
  value: number; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 min-w-0 flex flex-col items-center gap-1 py-3 px-1 rounded-xl border-2 transition-all',
        selected
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50',
      )}
    >
      <span className="text-base font-bold">{value}</span>
      <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
    </button>
  );
}

// ── Competency Taker ──────────────────────────────────────────────────────────
// Used for both COMPETENCY and FEEDBACK_360 assessment types.

const PROFICIENCY = ['Emerging', 'Developing', 'Proficient', 'Mastery'];

function CompetencyTaker({
  assessmentId, participantId, competencies,
}: {
  assessmentId: string; participantId: string; competencies: CompetencyDto[];
}) {
  const router = useRouter();
  const [caId, setCaId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStarting(true);
      try {
        const res = await api.post(`/assessments/${assessmentId}/competency/self`, { participantId });
        if (!cancelled) setCaId(res.data.data?.id ?? res.data.id);
      } catch {
        if (!cancelled) setError('Could not start assessment. Please try again.');
      } finally {
        if (!cancelled) setStarting(false);
      }
    }
    start();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, participantId]);

  async function handleSubmit() {
    if (!caId) return;
    setSubmitting(true);
    setError('');
    try {
      const ratingsList = competencies.map((c) => ({
        competencyId: c.id,
        levelRated: ratings[c.id] ?? 1,
        evidenceText: evidence[c.id] ?? undefined,
      }));
      await api.post(`/assessments/${assessmentId}/competency/self/${caId}/submit`, {
        participantId,
        ratings: ratingsList,
      });
      router.push(`/my-assessments/${assessmentId}/results`);
    } catch {
      setError('Submission failed. Please try again.');
      setSubmitting(false);
    }
  }

  if (starting) return <PageSpinner />;

  const ratedCount = Object.keys(ratings).length;
  const allRated = ratedCount === competencies.length;

  // Final review screen
  if (currentIdx === competencies.length) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Submit</h2>
          <p className="text-sm text-gray-500 mb-6">
            You've rated all {competencies.length} competencies. Submit when ready.
          </p>

          <div className="space-y-2 mb-6">
            {competencies.map((c) => (
              <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-800">{c.name}</span>
                <Badge variant="info">{PROFICIENCY[(ratings[c.id] ?? 1) - 1]}</Badge>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentIdx(competencies.length - 1)}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <><Spinner size="sm" />Submitting…</> : 'Submit Assessment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = competencies[currentIdx];
  if (!current) return null;

  const isLast = currentIdx === competencies.length - 1;

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar
        current={currentIdx + 1}
        total={competencies.length}
        label={`Competency ${currentIdx + 1} of ${competencies.length}`}
      />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{current.name}</h2>
        {current.description && (
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">{current.description}</p>
        )}

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Proficiency Level
        </p>
        <div className="flex gap-2 mb-6">
          {PROFICIENCY.map((label, i) => (
            <ScaleBtn
              key={i}
              value={i + 1}
              label={label}
              selected={ratings[current.id] === i + 1}
              onClick={() => setRatings((prev) => ({ ...prev, [current.id]: i + 1 }))}
            />
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            Evidence / Comments <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={evidence[current.id] ?? ''}
            onChange={(e) => setEvidence((prev) => ({ ...prev, [current.id]: e.target.value }))}
            placeholder="Describe specific examples or evidence for this rating…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex justify-between pt-4 border-t border-gray-100">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (isLast) setCurrentIdx(competencies.length);
              else setCurrentIdx((i) => i + 1);
            }}
            disabled={!ratings[current.id]}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {isLast ? (allRated ? 'Review & Submit' : 'Save & Continue') : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Personality Taker ─────────────────────────────────────────────────────────

interface PersonalityItem {
  id: string;
  stem: string;
  factor: string;
  isReverse: boolean;
  displayOrder: number;
  answered?: boolean;
  responseValue?: number | null;
}

interface QuestionnaireProgress {
  items: PersonalityItem[];
  total: number;
  answered: number;
  percentComplete: number;
}

const LIKERT = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

function PersonalityTaker({
  assessmentId,
  participantId,
  isRatingMandatory,
}: {
  assessmentId: string;
  participantId: string;
  isRatingMandatory: boolean;
}) {
  const router = useRouter();
  const { data: progress, isLoading } = useApi<QuestionnaireProgress>(
    `/assessments/${assessmentId}/personality/questionnaire/${participantId}`,
  );
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (progress?.items) {
      const resps: Record<string, number> = {};
      progress.items.forEach((item) => {
        if (item.answered && item.responseValue !== null && item.responseValue !== undefined) {
          resps[item.id] = item.responseValue;
        }
      });
      setResponses(resps);

      const sortedItems = [...progress.items].sort((a, b) => a.displayOrder - b.displayOrder);
      const firstUnanswered = sortedItems.findIndex((item) => !item.answered);
      if (firstUnanswered !== -1) {
        setCurrentIdx(firstUnanswered);
      }
    }
  }, [progress]);

  const items = progress?.items
    ? [...progress.items].sort((a, b) => a.displayOrder - b.displayOrder)
    : [];
  const total = items.length;
  const current = items[currentIdx];
  const answered = Object.keys(responses).length;

  async function selectAndAdvance(score: number) {
    if (!current) return;
    const next = { ...responses, [current.id]: score };
    setResponses(next);
    setSaving(true);
    try {
      await api.post(`/assessments/${assessmentId}/personality/responses/${participantId}`, {
        itemId: current.id, value: score,
      });
    } catch { /* silent auto-save failure */ }
    finally { setSaving(false); }
    setTimeout(() => {
      if (currentIdx < total - 1) setCurrentIdx((i) => i + 1);
    }, 150);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/assessments/${assessmentId}/personality/submit/${participantId}`);
      if (!isRatingMandatory) {
        router.push(`/my-assessments/${assessmentId}/results`);
      } else {
        router.push('/my-assessments');
      }
    } catch {
      alert('Submission failed. Please try again.');
      setSubmitting(false);
    }
  }

  if (isLoading) return <PageSpinner />;
  if (!current && total === 0) return <p className="text-sm text-gray-500">No items found.</p>;

  if (answered >= total && total > 0) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">All {total} items answered!</h2>
          <p className="text-sm text-gray-500 mb-6">Submit to finalise your personality assessment.</p>
          <button
            onClick={handleSubmit} disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Spinner size="sm" />}Submit Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <ProgressBar current={answered} total={total} label={`Question ${currentIdx + 1} of ${total}`} />
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <div className="flex items-start justify-between mb-6">
          <p className="text-base font-medium text-gray-900 leading-snug flex-1">{current?.stem}</p>
          {saving && <Spinner size="sm" className="ml-3 shrink-0" />}
        </div>
        <div className="space-y-2.5">
          {LIKERT.map((label, i) => {
            const score = i + 1;
            const isSelected = responses[current?.id] === score;
            return (
              <button
                key={score} onClick={() => selectAndAdvance(score)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                  isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300',
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
                )}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm text-gray-800">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}
            className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors">← Back</button>
          <button onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))} disabled={currentIdx >= total - 1}
            className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors">Skip →</button>
        </div>
      </div>
    </div>
  );
}

// ── Readiness Taker ───────────────────────────────────────────────────────────

interface SjtItem {
  id: string;
  stem: string;
  options: string[];
  displayOrder: number;
  answered?: boolean;
  selectedOption?: number | null;
}

interface LaItem {
  id: string;
  stem: string;
  factor: string;
  displayOrder: number;
  answered?: boolean;
  responseValue?: number | null;
}

interface SjtProgress {
  items: SjtItem[];
  total: number;
  answered: number;
}

interface LaProgress {
  items: LaItem[];
  total: number;
  answered: number;
}

const LA_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

function ReadinessTaker({ assessmentId, participantId }: { assessmentId: string; participantId: string }) {
  const router = useRouter();
  const { data: sjtProg, isLoading: loadingSjt } = useApi<SjtProgress>(`/assessments/${assessmentId}/sjt/${participantId}`);
  const { data: laProg, isLoading: loadingLa } = useApi<LaProgress>(`/assessments/${assessmentId}/learning-agility/${participantId}`);

  const [section, setSection] = useState<'sjt' | 'la'>('sjt');
  const [sjtIdx, setSjtIdx] = useState(0);
  const [sjtResponses, setSjtResponses] = useState<Record<string, number>>({});
  const [laResponses, setLaResponses] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sjtProg?.items) {
      const resps: Record<string, number> = {};
      sjtProg.items.forEach((item) => {
        if (item.answered && item.selectedOption !== null && item.selectedOption !== undefined) {
          resps[item.id] = item.selectedOption;
        }
      });
      setSjtResponses(resps);

      const sortedSjt = [...sjtProg.items].sort((a, b) => a.displayOrder - b.displayOrder);
      const firstUnanswered = sortedSjt.findIndex((item) => !item.answered);
      if (firstUnanswered !== -1) {
        setSjtIdx(firstUnanswered);
      }
    }
  }, [sjtProg]);

  useEffect(() => {
    if (laProg?.items) {
      const resps: Record<string, number> = {};
      laProg.items.forEach((item) => {
        if (item.answered && item.responseValue !== null && item.responseValue !== undefined) {
          resps[item.id] = item.responseValue;
        }
      });
      setLaResponses(resps);
    }
  }, [laProg]);

  const sjtItems = sjtProg?.items ? [...sjtProg.items].sort((a, b) => a.displayOrder - b.displayOrder) : [];
  const laItems = laProg?.items ? [...laProg.items].sort((a, b) => a.displayOrder - b.displayOrder) : [];

  useEffect(() => {
    if (sjtProg && laProg) {
      const allSjtAnswered = sjtItems.length > 0 && sjtItems.every((item) => sjtResponses[item.id] !== undefined);
      if (sjtItems.length === 0 || allSjtAnswered) {
        setSection('la');
      }
    }
  }, [sjtProg, laProg, sjtItems, sjtResponses]);

  async function submitSjt(itemId: string, selectedOption: number) {
    setSjtResponses((prev) => ({ ...prev, [itemId]: selectedOption }));
    try {
      await api.post(`/assessments/${assessmentId}/sjt/${participantId}/responses`, { itemId, selectedOption });
    } catch { /* silent */ }
    if (sjtIdx < sjtItems.length - 1) setSjtIdx((i) => i + 1);
    else setSection('la');
  }

  async function submitLa(itemId: string, value: number) {
    setLaResponses((prev) => ({ ...prev, [itemId]: value }));
    try {
      await api.post(`/assessments/${assessmentId}/learning-agility/${participantId}/responses`, { itemId, value });
    } catch { /* silent */ }
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/assessments/${assessmentId}/readiness/${participantId}/compute`, {});
      router.push('/my-assessments');
    } catch {
      alert('Submission failed. Please try again.');
      setSubmitting(false);
    }
  }

  if (loadingSjt || loadingLa) return <PageSpinner />;

  if (sjtItems.length === 0 && laItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 bg-white rounded-2xl border border-gray-200">
        <p className="text-sm text-gray-500">No readiness assessment items found.</p>
      </div>
    );
  }

  if (section === 'sjt') {
    const current = sjtItems[sjtIdx];
    if (!current) return null;
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 font-medium mb-4">
          Section 1 of 2 — Situational Judgement
        </div>
        <ProgressBar current={sjtIdx + 1} total={sjtItems.length} label={`Scenario ${sjtIdx + 1} of ${sjtItems.length}`} />
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Scenario {sjtIdx + 1}</p>
          <p className="text-base text-gray-900 leading-relaxed mb-6">{current.stem}</p>
          <div className="space-y-2.5">
            {(current.options ?? []).map((opt, idx) => (
              <button
                key={idx}
                onClick={() => submitSjt(current.id, idx)}
                disabled={sjtResponses[current.id] !== undefined}
                className={cn(
                  'w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 transition-all',
                  sjtResponses[current.id] === idx ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300 disabled:opacity-60',
                )}
              >
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm text-gray-800 leading-snug">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const laAnswered = Object.keys(laResponses).length;
  const allLaDone = laAnswered >= laItems.length && laItems.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700 font-medium mb-4">
        Section 2 of 2 — Learning Agility
      </div>
      <ProgressBar current={laAnswered} total={laItems.length} label={`${laAnswered} of ${laItems.length} answered`} />
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
        <p className="text-sm text-gray-500">Rate each statement on a scale of 1 (Strongly Disagree) to 5 (Strongly Agree).</p>
        {laItems.map((item) => (
          <div key={item.id}>
            <p className="text-sm text-gray-800 font-medium mb-2 leading-snug">{item.stem}</p>
            <div className="flex gap-2">
              {LA_LABELS.map((label, i) => (
                <ScaleBtn
                  key={i}
                  value={i + 1}
                  label={label}
                  selected={laResponses[item.id] === i + 1}
                  onClick={() => submitLa(item.id, i + 1)}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={handleFinalSubmit}
            disabled={!allLaDone || submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg py-3 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Spinner size="sm" />}
            {!allLaDone ? `Answer all items (${laItems.length - laAnswered} remaining)` : 'Submit Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface AssessmentParticipant { id: string; userId: string; status: string; }

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const currentUser = useAuthStore((s) => s.user);

  const { data: assessment, error: assessmentError, isLoading } =
    useApi<AssessmentDto>(`/assessments/${id}`);

  const { data: participants, isLoading: loadingParticipants } =
    useApi<AssessmentParticipant[]>(assessment ? `/assessments/${id}/participants` : null);

  const myParticipantRecord = participants?.find((p) => p.userId === currentUser?.id);

  const needsCompetencies =
    assessment?.assessmentType === AssessmentType.FEEDBACK_360 ||
    assessment?.assessmentType === AssessmentType.COMPETENCY;

  const { data: allCompetencies, isLoading: loadingComps } =
    useApi<CompetencyDto[]>(needsCompetencies ? '/items/competencies' : null);

  const configIds: string[] = (assessment?.config as any)?.competencyIds ?? [];
  const competencies =
    configIds.length > 0 && allCompetencies
      ? allCompetencies.filter((c) => configIds.includes(c.id))
      : (allCompetencies ?? []);

  const loading = isLoading || loadingParticipants || (needsCompetencies && loadingComps);

  if (loading) return <PageSpinner />;

  if (assessmentError || !assessment) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load assessment. Please go back and try again.
        </div>
      </div>
    );
  }

  if (!myParticipantRecord) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          You are not enrolled as a participant in this assessment.
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/my-assessments/${id}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{assessment.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">
          {assessment.assessmentType.replace(/_/g, ' ')} Assessment
        </p>
      </div>

      {(assessment.assessmentType === AssessmentType.COMPETENCY ||
        assessment.assessmentType === AssessmentType.FEEDBACK_360) && (
        <CompetencyTaker
          assessmentId={id}
          participantId={myParticipantRecord.id}
          competencies={competencies}
        />
      )}

      {assessment.assessmentType === AssessmentType.PERSONALITY && (
        <PersonalityTaker
          assessmentId={id}
          participantId={myParticipantRecord.id}
          isRatingMandatory={(assessment.config as any)?.isRatingMandatory !== false}
        />
      )}

      {assessment.assessmentType === AssessmentType.READINESS && (
        <ReadinessTaker
          assessmentId={id}
          participantId={myParticipantRecord.id}
        />
      )}
    </div>
  );
}
