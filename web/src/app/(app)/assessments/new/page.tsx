'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  AssessmentType,
  CompetencyDto,
  UserDto,
} from '@leaderprism/shared';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  type: AssessmentType | null;
  title: string;
  startDate: string;
  endDate: string;
  isRatingMandatory: boolean;
  competencyIds: string[];
  participantIds: string[];
}

const TYPE_OPTIONS = [
  {
    type: AssessmentType.FEEDBACK_360,
    label: '360° Feedback',
    description: 'Gather multi-rater feedback from supervisors, peers and direct reports.',
    icon: '🔄',
  },
  {
    type: AssessmentType.COMPETENCY,
    label: 'Competency Assessment',
    description: 'Evaluate proficiency levels across defined competency frameworks.',
    icon: '📊',
  },
  {
    type: AssessmentType.PERSONALITY,
    label: 'Personality Assessment',
    description: 'Measure personality traits using validated psychometric questionnaires.',
    icon: '🧠',
  },
  {
    type: AssessmentType.READINESS,
    label: 'Readiness Assessment',
    description: 'Assess readiness for leadership roles using SJT and learning agility.',
    icon: '🎯',
  },
];

const STEPS = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Competencies' },
  { n: 4, label: 'Participants' },
  { n: 5, label: 'Review' },
];

// ── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto">
      {STEPS.map((step, idx) => (
        <div key={step.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                current > step.n
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : current === step.n
                  ? 'bg-blue-50 border-blue-600 text-blue-600'
                  : 'bg-white border-gray-300 text-gray-400',
              )}
            >
              {current > step.n ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.n
              )}
            </div>
            <span
              className={cn(
                'text-xs font-medium hidden sm:block',
                current === step.n ? 'text-blue-600' : 'text-gray-400',
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={cn(
                'w-12 sm:w-20 h-0.5 mx-1 transition-all',
                current > step.n ? 'bg-blue-600' : 'bg-gray-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Type ───────────────────────────────────────────────────────────────
function StepType({
  selected,
  onSelect,
}: {
  selected: AssessmentType | null;
  onSelect: (t: AssessmentType) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Assessment Type</h2>
      <p className="text-sm text-gray-500 mb-6">Choose the type of assessment you want to create.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className={cn(
              'text-left rounded-xl border-2 p-5 transition-all hover:shadow-md',
              selected === opt.type
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300',
            )}
          >
            <div className="text-2xl mb-2">{opt.icon}</div>
            <h3 className="text-sm font-semibold text-gray-900">{opt.label}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Details ────────────────────────────────────────────────────────────
function StepDetails({
  assessmentType,
  title,
  startDate,
  endDate,
  isRatingMandatory,
  onChange,
  onToggleMandatory,
}: {
  assessmentType: AssessmentType | null;
  title: string;
  startDate: string;
  endDate: string;
  isRatingMandatory: boolean;
  onChange: (field: 'title' | 'startDate' | 'endDate', value: string) => void;
  onToggleMandatory: (val: boolean) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Assessment Details</h2>
      <p className="text-sm text-gray-500 mb-6">Provide a title and schedule for the assessment.</p>
      <div className="space-y-5 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assessment Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="e.g. Mid-Year 360 Feedback 2025"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onChange('startDate', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onChange('endDate', e.target.value)}
              min={startDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {assessmentType === AssessmentType.PERSONALITY && (
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Questionnaire Completion</p>
            <div className="flex flex-col gap-2">
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                isRatingMandatory ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}>
                <input
                  type="radio"
                  checked={isRatingMandatory}
                  onChange={() => onToggleMandatory(true)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Mandatory</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Participants must complete all questionnaire items before results are generated.
                  </p>
                </div>
              </label>
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                !isRatingMandatory ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}>
                <input
                  type="radio"
                  checked={!isRatingMandatory}
                  onChange={() => onToggleMandatory(false)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Optional</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    After completing the questionnaire, participants are immediately shown their personality results in radar charts.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Competencies ───────────────────────────────────────────────────────
function StepCompetencies({
  assessmentType,
  selected,
  onToggle,
}: {
  assessmentType: AssessmentType | null;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { data: competencies, isLoading } = useApi<CompetencyDto[]>('/items/competencies');
  const needsCompetencies =
    assessmentType === AssessmentType.FEEDBACK_360 ||
    assessmentType === AssessmentType.COMPETENCY;

  if (!needsCompetencies) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Competencies</h2>
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-blue-700 font-medium">
            {assessmentType === AssessmentType.PERSONALITY
              ? 'Personality assessments use a built-in psychometric questionnaire — no competencies required.'
              : 'Readiness assessments use SJTs and learning agility scales — no competencies required.'}
          </p>
          <p className="text-xs text-blue-600 mt-2">Click Next to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Competencies</h2>
      <p className="text-sm text-gray-500 mb-6">
        Choose competencies to include ({selected.length} selected).
      </p>

      {isLoading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Spinner />
          <span className="text-sm text-gray-500">Loading competencies…</span>
        </div>
      )}

      {!isLoading && competencies && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {competencies.map((comp) => (
            <label
              key={comp.id}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all',
                selected.includes(comp.id)
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(comp.id)}
                onChange={() => onToggle(comp.id)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{comp.name}</p>
                {comp.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{comp.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {!isLoading && (!competencies || competencies.length === 0) && (
        <p className="text-sm text-gray-500 py-8 text-center">No competencies found in library.</p>
      )}
    </div>
  );
}

// ── Step 4: Participants ───────────────────────────────────────────────────────
function StepParticipants({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { data: users, isLoading } = useApi<UserDto[]>('/organisations/me/users');
  const [search, setSearch] = useState('');

  const filtered =
    users?.filter(
      (u) =>
        `${u.firstName} ${u.lastName} ${u.email}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Participants</h2>
      <p className="text-sm text-gray-500 mb-4">
        Search and select users to include ({selected.length} selected).
      </p>

      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      {isLoading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Spinner />
          <span className="text-sm text-gray-500">Loading users…</span>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((user) => (
            <label
              key={user.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                selected.includes(user.id)
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(user.id)}
                onChange={() => onToggle(user.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <span className="text-xs text-gray-400 capitalize">
                {user.role.replace('_', ' ')}
              </span>
            </label>
          ))}
          {filtered.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 text-center py-6">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review ─────────────────────────────────────────────────────────────
function StepReview({
  state,
  onSaveDraft,
  onLaunch,
  isSubmitting,
}: {
  state: WizardState;
  onSaveDraft: () => void;
  onLaunch: () => void;
  isSubmitting: boolean;
}) {
  const typeLabelMap: Record<string, string> = {
    [AssessmentType.FEEDBACK_360]: '360° Feedback',
    [AssessmentType.COMPETENCY]: 'Competency',
    [AssessmentType.PERSONALITY]: 'Personality',
    [AssessmentType.READINESS]: 'Readiness',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Launch</h2>
      <p className="text-sm text-gray-500 mb-6">Review your assessment before saving or launching.</p>

      <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-200 mb-6">
        <Row label="Type" value={state.type ? typeLabelMap[state.type] : '—'} />
        <Row label="Title" value={state.title || '—'} />
        <Row
          label="Dates"
          value={
            state.startDate && state.endDate
              ? `${state.startDate} → ${state.endDate}`
              : state.startDate || state.endDate || 'Not set'
          }
        />
        <Row
          label="Competencies"
          value={
            state.competencyIds.length > 0
              ? `${state.competencyIds.length} selected`
              : 'None (not required)'
          }
        />
        {state.type === AssessmentType.PERSONALITY && (
          <Row
            label="Questionnaire"
            value={state.isRatingMandatory ? 'Mandatory' : 'Optional — results shown after completion'}
          />
        )}
        <Row label="Participants" value={`${state.participantIds.length} selected`} />
      </div>

      {state.participantIds.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No participants selected. You can add them after creation.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          onClick={onLaunch}
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="border-white border-t-transparent" />
              Launching…
            </>
          ) : (
            'Launch Assessment'
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

// ── Main Wizard Component ──────────────────────────────────────────────────────
export default function NewAssessmentPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>({
    step: 1,
    type: null,
    title: '',
    startDate: '',
    endDate: '',
    isRatingMandatory: true,
    competencyIds: [],
    participantIds: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  function canProceed(): boolean {
    switch (state.step) {
      case 1:
        return state.type !== null;
      case 2:
        return state.title.trim().length > 0;
      default:
        return true;
    }
  }

  function next() {
    if (state.step < 5) update({ step: (state.step + 1) as WizardState['step'] });
  }

  function prev() {
    if (state.step > 1) update({ step: (state.step - 1) as WizardState['step'] });
  }

  function toggleId(list: 'competencyIds' | 'participantIds', id: string) {
    setState((prev) => {
      const arr = prev[list];
      return {
        ...prev,
        [list]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
      };
    });
  }

  async function submit(launch: boolean) {
    setError('');
    setIsSubmitting(true);
    try {
      const payload = {
        title: state.title,
        assessmentType: state.type,
        startDate: state.startDate || null,
        endDate: state.endDate || null,
        config: {
          competencyIds: state.competencyIds.length ? state.competencyIds : undefined,
          ...(state.type === AssessmentType.PERSONALITY
            ? { isRatingMandatory: state.isRatingMandatory }
            : {}),
        },
      };

      const res = await api.post<{ data: { id: string } }>('/assessments', payload);
      const assessmentId = res.data.data.id;

      // Add participants
      if (state.participantIds.length > 0) {
        await Promise.all(
          state.participantIds.map((pid) =>
            api.post(`/assessments/${assessmentId}/participants`, { userId: pid }),
          ),
        );
      }

      // Launch if requested
      if (launch) {
        await api.post(`/assessments/${assessmentId}/launch`);
      }

      router.push(`/assessments/${assessmentId}`);
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.error?.message ?? 'Failed to create assessment.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => (state.step > 1 ? prev() : router.back())}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {state.step > 1 ? `Back to ${STEPS[state.step - 2].label}` : 'Back'}
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">New Assessment</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <Stepper current={state.step} />

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {state.step === 1 && (
          <StepType selected={state.type} onSelect={(t) => update({ type: t })} />
        )}
        {state.step === 2 && (
          <StepDetails
            assessmentType={state.type}
            title={state.title}
            startDate={state.startDate}
            endDate={state.endDate}
            isRatingMandatory={state.isRatingMandatory}
            onChange={(field, value) => update({ [field]: value })}
            onToggleMandatory={(val) => update({ isRatingMandatory: val })}
          />
        )}
        {state.step === 3 && (
          <StepCompetencies
            assessmentType={state.type}
            selected={state.competencyIds}
            onToggle={(id) => toggleId('competencyIds', id)}
          />
        )}
        {state.step === 4 && (
          <StepParticipants
            selected={state.participantIds}
            onToggle={(id) => toggleId('participantIds', id)}
          />
        )}
        {state.step === 5 && (
          <StepReview
            state={state}
            onSaveDraft={() => submit(false)}
            onLaunch={() => submit(true)}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Navigation buttons */}
        {state.step < 5 && (
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={prev}
              disabled={state.step === 1}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={next}
              disabled={!canProceed()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
