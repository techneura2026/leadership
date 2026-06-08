'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { AssessmentChatbot, type GeneratedQuestion } from '@/components/AssessmentChatbot';
import {
  AssessmentType,
  CompetencyDto,
  UserDto,
} from '@leaderprism/shared';

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'TABLE';
type RaterRelationship = 'SUPERVISOR' | 'PEER' | 'DIRECT_REPORT';

interface QuestionOption {
  id: string;
  text: string;
}

interface FormQuestion {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: QuestionOption[];
  tableRows: string[];
  tableColumns: string[];
}

interface RaterEntry {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  relationship: RaterRelationship;
}

interface Participant360 {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  raters: RaterEntry[];
}

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  type: AssessmentType | null;
  title: string;
  startDate: string;
  endDate: string;
  isRatingMandatory: boolean;
  competencyIds: string[];
  participantIds: string[];
  participants360: Participant360[];
  questions: FormQuestion[];
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const TypeIcon360 = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
  </svg>
);
const TypeIconCompetency = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);
const TypeIconPersonality = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);
const TypeIconReadiness = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);

const TYPE_ICONS: Record<string, () => React.JSX.Element> = {
  [AssessmentType.FEEDBACK_360]: TypeIcon360,
  [AssessmentType.COMPETENCY]: TypeIconCompetency,
  [AssessmentType.PERSONALITY]: TypeIconPersonality,
  [AssessmentType.READINESS]: TypeIconReadiness,
};

const TYPE_OPTIONS = [
  {
    type: AssessmentType.FEEDBACK_360,
    label: '360° Feedback',
    description: 'Gather multi-rater feedback from supervisors, peers and direct reports.',
  },
  {
    type: AssessmentType.COMPETENCY,
    label: 'Competency Assessment',
    description: 'Evaluate proficiency levels across defined competency frameworks.',
  },
  {
    type: AssessmentType.PERSONALITY,
    label: 'Personality Assessment',
    description: 'Measure personality traits using validated psychometric questionnaires.',
  },
  {
    type: AssessmentType.READINESS,
    label: 'Readiness Assessment',
    description: 'Assess readiness for leadership roles using SJT and learning agility.',
  },
];

const STEPS_DEFAULT = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Competencies' },
  { n: 4, label: 'Participants' },
  { n: 5, label: 'Review' },
];

const STEPS_360 = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Participants' },
  { n: 4, label: 'Questions' },
  { n: 5, label: 'Review' },
];

// ── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ current, steps }: { current: number; steps: typeof STEPS_DEFAULT }) {
  return (
    <div className="mb-8">
      <div className="hidden sm:flex items-center justify-between w-full mx-auto relative z-10 max-w-lg">
        {steps.map((step, idx) => (
          <div key={step.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  current > step.n
                    ? 'bg-blue-600 text-white'
                    : current === step.n
                    ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-50'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {current > step.n ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.n
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap absolute mt-10 transition-colors duration-300',
                  current === step.n ? 'text-gray-900 font-semibold' : current > step.n ? 'text-gray-600' : 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-[2px] mx-4 rounded-full transition-all duration-300',
                  current > step.n ? 'bg-blue-600' : 'bg-gray-100',
                )}
              />
            )}
          </div>
        ))}
      </div>
      <div className="hidden sm:block h-6" />
      <div className="flex sm:hidden flex-col items-center gap-3">
        <div className="flex items-center gap-2 w-full max-w-xs">
          {steps.map((step) => (
            <div
              key={step.n}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-all duration-300',
                current >= step.n ? 'bg-blue-600' : 'bg-gray-100',
              )}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-gray-500">
          Step {current} of {steps.length}
          <span className="text-gray-900 ml-1.5 font-semibold">{steps[current - 1].label}</span>
        </p>
      </div>
    </div>
  );
}

// ── Step 1: Type ───────────────────────────────────────────────────────────────
function StepType({ selected, onSelect }: { selected: AssessmentType | null; onSelect: (t: AssessmentType) => void }) {
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
              selected === opt.type ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300',
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
              selected === opt.type ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500',
            )}>
              {TYPE_ICONS[opt.type]()}
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{opt.label}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── DatePicker ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DatePicker({
  value,
  onChange,
  min,
  placeholder = 'Select date',
}: {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getFullYear();
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getMonth();
    return new Date().getMonth();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const minDate = min ? new Date(min + 'T00:00:00') : null;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    onChange(d.toISOString().slice(0, 10));
    setOpen(false);
  }

  function isDayDisabled(day: number) {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const m = new Date(minDate);
    m.setHours(0, 0, 0, 0);
    return d < m;
  }

  function isDaySelected(day: number) {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === day;
  }

  function isDayToday(day: number) {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day;
  }

  const displayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg border transition-all text-left',
          open
            ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300',
          displayLabel ? 'text-gray-700' : 'text-gray-400',
        )}
      >
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="flex-1 truncate">{displayLabel || placeholder}</span>
        {displayLabel && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month / year nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900 select-none">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_ABBRS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1 select-none">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) =>
              day === null ? (
                <div key={`e-${idx}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDayDisabled(day) && selectDay(day)}
                  disabled={isDayDisabled(day)}
                  className={cn(
                    'w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all select-none',
                    isDaySelected(day)
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : isDayDisabled(day)
                      ? 'text-gray-300 cursor-not-allowed'
                      : isDayToday(day)
                      ? 'text-blue-600 font-semibold hover:bg-blue-50 ring-1 ring-blue-200'
                      : 'text-gray-700 hover:bg-gray-100',
                  )}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      )}
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
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
            <DatePicker
              value={startDate}
              onChange={(val) => onChange('startDate', val)}
              placeholder="Pick start date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
            <DatePicker
              value={endDate}
              onChange={(val) => onChange('endDate', val)}
              min={startDate || undefined}
              placeholder="Pick end date"
            />
          </div>
        </div>
        {assessmentType === AssessmentType.PERSONALITY && (
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Questionnaire Completion</p>
            <div className="flex flex-col gap-2">
              {[true, false].map((mandatory) => (
                <label
                  key={String(mandatory)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                    isRatingMandatory === mandatory ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <input type="radio" checked={isRatingMandatory === mandatory} onChange={() => onToggleMandatory(mandatory)} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{mandatory ? 'Mandatory' : 'Optional'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {mandatory
                        ? 'Participants must complete all questionnaire items before results are generated.'
                        : 'After completing the questionnaire, participants are immediately shown their personality results in radar charts.'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3a: Competencies (non-360 types) ─────────────────────────────────────
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
      <p className="text-sm text-gray-500 mb-6">Choose competencies to include ({selected.length} selected).</p>
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
                selected.includes(comp.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
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
                {comp.description && <p className="text-xs text-gray-500 mt-0.5">{comp.description}</p>}
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

// ── Step 3b: Participants & Raters (360° only) ────────────────────────────────
function StepParticipants360({
  participants360,
  onAddParticipant,
  onRemoveParticipant,
  onAddRater,
  onRemoveRater,
}: {
  participants360: Participant360[];
  onAddParticipant: (user: UserDto) => void;
  onRemoveParticipant: (userId: string) => void;
  onAddRater: (participantUserId: string, rater: RaterEntry) => void;
  onRemoveRater: (participantUserId: string, raterUserId: string) => void;
}) {
  const { data: users } = useApi<UserDto[]>('/organisations/me/users');
  const [participantSearch, setParticipantSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [raterSearches, setRaterSearches] = useState<Record<string, string>>({});
  const [raterRelationships, setRaterRelationships] = useState<Record<string, RaterRelationship>>({});

  const selectedIds = participants360.map((p) => p.userId);

  const filteredForParticipant =
    users?.filter(
      (u) =>
        !selectedIds.includes(u.id) &&
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(participantSearch.toLowerCase()),
    ) ?? [];

  function getFilteredRaters(participantId: string, participant: Participant360) {
    const search = (raterSearches[participantId] ?? '').toLowerCase();
    const existingRaterIds = participant.raters.map((r) => r.userId);
    return (
      users?.filter(
        (u) =>
          u.id !== participantId &&
          !existingRaterIds.includes(u.id) &&
          `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search),
      ) ?? []
    );
  }

  const RELATIONSHIP_LABELS: Record<RaterRelationship, string> = {
    SUPERVISOR: 'Supervisor',
    PEER: 'Peer',
    DIRECT_REPORT: 'Direct Report',
  };

  const RELATIONSHIP_COLORS: Record<RaterRelationship, string> = {
    SUPERVISOR: 'bg-purple-100 text-purple-700',
    PEER: 'bg-blue-100 text-blue-700',
    DIRECT_REPORT: 'bg-orange-100 text-orange-700',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Participants & Feedback Givers</h2>
      <p className="text-sm text-gray-500 mb-5">
        Add participants to be assessed, then assign who will give them feedback.
      </p>

      {/* Add participant search */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Add Participant
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search users by name or email…"
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
          />
          {participantSearch && filteredForParticipant.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 border border-gray-200 rounded-xl shadow-lg bg-white overflow-hidden max-h-52 overflow-y-auto">
              {filteredForParticipant.slice(0, 8).map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onAddParticipant(user);
                    setParticipantSearch('');
                    setExpandedId(user.id);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {participantSearch && filteredForParticipant.length === 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 border border-gray-200 rounded-xl shadow-lg bg-white px-3 py-3">
              <p className="text-sm text-gray-400">No matching users found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected participants */}
      {participants360.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">No participants added yet. Search above to add.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Participants ({participants360.length})
          </p>
          {participants360.map((participant) => {
            const isExpanded = expandedId === participant.userId;
            const raterSearch = raterSearches[participant.userId] ?? '';
            const relationship = raterRelationships[participant.userId] ?? 'PEER';
            const filteredRaters = getFilteredRaters(participant.userId, participant);

            return (
              <div key={participant.userId} className="border border-gray-200 rounded-xl overflow-visible">
                {/* Header row */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-xl"
                  onClick={() => setExpandedId(isExpanded ? null : participant.userId)}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                    {participant.firstName[0]}{participant.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{participant.firstName} {participant.lastName}</p>
                    <p className="text-xs text-gray-400">
                      {participant.raters.length === 0
                        ? 'No feedback givers assigned'
                        : `${participant.raters.length} feedback giver${participant.raters.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveParticipant(participant.userId); }}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <svg
                      className={cn('w-4 h-4 text-gray-400 transition-transform duration-200', isExpanded && 'rotate-180')}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded rater panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 rounded-b-xl space-y-3">
                    {/* Existing raters */}
                    {participant.raters.length > 0 && (
                      <div className="space-y-1.5">
                        {participant.raters.map((rater) => (
                          <div key={rater.userId} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                              {rater.firstName[0]}{rater.lastName[0]}
                            </div>
                            <span className="flex-1 text-sm text-gray-800 truncate">
                              {rater.firstName} {rater.lastName}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', RELATIONSHIP_COLORS[rater.relationship])}>
                              {RELATIONSHIP_LABELS[rater.relationship]}
                            </span>
                            <button
                              onClick={() => onRemoveRater(participant.userId, rater.userId)}
                              className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add rater row */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Add Feedback Giver</p>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Search by name or email…"
                            value={raterSearch}
                            onChange={(e) => setRaterSearches((prev) => ({ ...prev, [participant.userId]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                          {raterSearch && filteredRaters.length > 0 && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg shadow-md bg-white overflow-hidden max-h-40 overflow-y-auto">
                              {filteredRaters.slice(0, 6).map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    onAddRater(participant.userId, {
                                      userId: user.id,
                                      firstName: user.firstName,
                                      lastName: user.lastName,
                                      email: user.email,
                                      relationship,
                                    });
                                    setRaterSearches((prev) => ({ ...prev, [participant.userId]: '' }));
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-blue-50 text-left border-b border-gray-100 last:border-0"
                                >
                                  <span className="text-sm text-gray-900">{user.firstName} {user.lastName}</span>
                                  <span className="text-xs text-gray-400 truncate">{user.email}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <select
                          value={relationship}
                          onChange={(e) =>
                            setRaterRelationships((prev) => ({
                              ...prev,
                              [participant.userId]: e.target.value as RaterRelationship,
                            }))
                          }
                          className="bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 shrink-0"
                        >
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="PEER">Peer</option>
                          <option value="DIRECT_REPORT">Direct Report</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step 4a: Participants (non-360 types) ─────────────────────────────────────
function StepParticipants({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { data: users, isLoading } = useApi<UserDto[]>('/organisations/me/users');
  const [search, setSearch] = useState('');

  const filtered =
    users?.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Participants</h2>
      <p className="text-sm text-gray-500 mb-4">Search and select users to include ({selected.length} selected).</p>
      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700 mb-4"
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
                selected.includes(user.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(user.id)}
                onChange={() => onToggle(user.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <span className="text-xs text-gray-400 capitalize">{user.role.replace('_', ' ')}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 4b: Question Builder (360° only) ─────────────────────────────────────
const QUESTION_TYPE_META: { type: QuestionType; label: string }[] = [
  { type: 'SINGLE_CHOICE', label: 'Single Choice' },
  { type: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { type: 'TRUE_FALSE', label: 'True / False' },
  { type: 'SHORT_ANSWER', label: 'Short Answer' },
  { type: 'TABLE', label: 'Table' },
];

function QuestionCard({
  question,
  index,
  onUpdate,
  onRemove,
}: {
  question: FormQuestion;
  index: number;
  onUpdate: (patch: Partial<FormQuestion>) => void;
  onRemove: () => void;
}) {
  function updateOption(optId: string, text: string) {
    onUpdate({ options: question.options.map((o) => (o.id === optId ? { ...o, text } : o)) });
  }

  function addOption() {
    onUpdate({ options: [...question.options, { id: crypto.randomUUID(), text: '' }] });
  }

  function removeOption(optId: string) {
    if (question.options.length <= 2) return;
    onUpdate({ options: question.options.filter((o) => o.id !== optId) });
  }

  function updateRow(idx: number, value: string) {
    const rows = [...question.tableRows];
    rows[idx] = value;
    onUpdate({ tableRows: rows });
  }

  function updateColumn(idx: number, value: string) {
    const cols = [...question.tableColumns];
    cols[idx] = value;
    onUpdate({ tableColumns: cols });
  }

  function handleTypeChange(newType: QuestionType) {
    const patch: Partial<FormQuestion> = { type: newType };
    if (newType === 'SINGLE_CHOICE' || newType === 'MULTIPLE_CHOICE') {
      if (question.options.length < 2) {
        patch.options = [
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' },
        ];
      }
    } else if (newType === 'TRUE_FALSE') {
      patch.options = [
        { id: 'opt-true', text: 'True' },
        { id: 'opt-false', text: 'False' },
      ];
    } else if (newType === 'TABLE') {
      if (question.tableRows.length === 0) patch.tableRows = ['Row 1', 'Row 2'];
      if (question.tableColumns.length === 0) patch.tableColumns = ['Column 1', 'Column 2'];
    }
    onUpdate(patch);
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Question header */}
      <div className="flex items-start gap-3 p-4">
        <span className="text-xs font-bold text-gray-400 mt-2.5 w-6 shrink-0 text-center">Q{index + 1}</span>
        <div className="flex-1 space-y-3">
          <input
            type="text"
            value={question.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Enter your question here…"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800 font-medium"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={question.type}
              onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {QUESTION_TYPE_META.map((qt) => (
                <option key={qt.type} value={qt.type}>{qt.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">Required</span>
            </label>
            <button
              onClick={onRemove}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Choice options */}
      {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
          {question.options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="text-gray-300 text-sm shrink-0 w-4 text-center">
                {question.type === 'SINGLE_CHOICE' ? '○' : '□'}
              </span>
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updateOption(opt.id, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                onClick={() => removeOption(opt.id)}
                disabled={question.options.length <= 2}
                className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors pl-6 mt-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add option
          </button>
        </div>
      )}

      {/* True/False preview */}
      {question.type === 'TRUE_FALSE' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="flex gap-6">
            {['True', 'False'].map((opt) => (
              <div key={opt} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                {opt}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Respondents choose one of the two options.</p>
        </div>
      )}

      {/* Short answer preview */}
      {question.type === 'SHORT_ANSWER' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="w-full h-14 bg-white border border-dashed border-gray-200 rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-400 italic">Respondent types their answer here</span>
          </div>
        </div>
      )}

      {/* Table builder */}
      {question.type === 'TABLE' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Columns</p>
              <div className="space-y-1.5">
                {question.tableColumns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={col}
                      onChange={(e) => updateColumn(idx, e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
                    />
                    {question.tableColumns.length > 1 && (
                      <button
                        onClick={() => onUpdate({ tableColumns: question.tableColumns.filter((_, i) => i !== idx) })}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => onUpdate({ tableColumns: [...question.tableColumns, `Column ${question.tableColumns.length + 1}`] })}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add column
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Rows</p>
              <div className="space-y-1.5">
                {question.tableRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={row}
                      onChange={(e) => updateRow(idx, e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
                    />
                    {question.tableRows.length > 1 && (
                      <button
                        onClick={() => onUpdate({ tableRows: question.tableRows.filter((_, i) => i !== idx) })}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => onUpdate({ tableRows: [...question.tableRows, `Row ${question.tableRows.length + 1}`] })}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add row
                </button>
              </div>
            </div>
          </div>

          {/* Table preview */}
          {question.tableColumns.length > 0 && question.tableRows.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Preview</p>
              <table className="text-xs border-collapse bg-white rounded-lg overflow-hidden border border-gray-200">
                <thead>
                  <tr>
                    <th className="border border-gray-200 px-3 py-1.5 bg-gray-100 min-w-[80px]" />
                    {question.tableColumns.map((col, i) => (
                      <th key={i} className="border border-gray-200 px-3 py-1.5 bg-gray-100 text-gray-700 font-medium text-left min-w-[90px]">
                        {col || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {question.tableRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-gray-200 px-3 py-1.5 bg-gray-50 font-medium text-gray-600">
                        {row || `Row ${i + 1}`}
                      </td>
                      {question.tableColumns.map((_, j) => (
                        <td key={j} className="border border-gray-200 px-3 py-1.5 text-gray-300 italic">
                          —
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepQuestions({
  questions,
  onAdd,
  onUpdate,
  onRemove,
}: {
  questions: FormQuestion[];
  onAdd: (type: QuestionType) => void;
  onUpdate: (id: string, patch: Partial<FormQuestion>) => void;
  onRemove: (id: string) => void;
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Build Questionnaire</h2>
      <p className="text-sm text-gray-500 mb-5">
        Create questions that feedback givers will answer for each participant.
      </p>

      <div className="space-y-3 mb-4">
        {questions.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">No questions yet. Add your first question below.</p>
          </div>
        )}
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={idx}
            onUpdate={(patch) => onUpdate(q.id, patch)}
            onRemove={() => onRemove(q.id)}
          />
        ))}
      </div>

      {/* Add question button with dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowTypeMenu((v) => !v)}
          className="flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-400 rounded-xl px-4 py-3 w-full transition-all hover:bg-blue-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Question
        </button>
        {showTypeMenu && (
          <div className="absolute bottom-full mb-2 left-0 right-0 border border-gray-200 rounded-xl shadow-xl bg-white overflow-hidden z-10">
            {QUESTION_TYPE_META.map((qt) => (
              <button
                key={qt.type}
                onClick={() => { onAdd(qt.type); setShowTypeMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-700">{qt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 5: Review ─────────────────────────────────────────────────────────────
function StepReview({
  state,
  onSaveDraft,
  onSubmit,
  isSubmitting,
}: {
  state: WizardState;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const is360 = state.type === AssessmentType.FEEDBACK_360;
  const typeLabelMap: Record<string, string> = {
    [AssessmentType.FEEDBACK_360]: '360° Feedback',
    [AssessmentType.COMPETENCY]: 'Competency',
    [AssessmentType.PERSONALITY]: 'Personality',
    [AssessmentType.READINESS]: 'Readiness',
  };

  const totalRaters = state.participants360.reduce((sum, p) => sum + p.raters.length, 0);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Submit</h2>
      <p className="text-sm text-gray-500 mb-6">Review your assessment before saving or submitting.</p>

      <div className="space-y-3 bg-gray-50 rounded-xl p-5 border border-gray-200 mb-5">
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
        {is360 ? (
          <>
            <Row label="Participants" value={`${state.participants360.length}`} />
            <Row label="Feedback givers" value={`${totalRaters} total`} />
            <Row label="Questions" value={`${state.questions.length}`} />
          </>
        ) : (
          <>
            <Row
              label="Competencies"
              value={state.competencyIds.length > 0 ? `${state.competencyIds.length} selected` : 'None (not required)'}
            />
            {state.type === AssessmentType.PERSONALITY && (
              <Row label="Questionnaire" value={state.isRatingMandatory ? 'Mandatory' : 'Optional — results shown after completion'} />
            )}
            <Row label="Participants" value={`${state.participantIds.length} selected`} />
          </>
        )}
      </div>

      {/* 360° participant summary */}
      {is360 && state.participants360.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Participant Summary</p>
          {state.participants360.map((p) => (
            <div key={p.userId} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                  {p.firstName[0]}{p.lastName[0]}
                </div>
                <span className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</span>
              </div>
              <span className="text-xs text-gray-500">
                {p.raters.length} feedback giver{p.raters.length !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {is360 && state.participants360.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No participants selected. You can add them after creation.
        </div>
      )}
      {is360 && state.questions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-5">
          No questions added. Feedback givers will see a blank form.
        </div>
      )}
      {!is360 && state.participantIds.length === 0 && (
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
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="border-white border-t-transparent" />
              Submitting…
            </>
          ) : is360 ? (
            'Submit Assessment'
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

// ── Submit Overlay (loading / success / error) ─────────────────────────────────
function SubmitOverlay({
  phase,
  step,
  error,
  wasDraft,
  onDismissError,
  onViewAssessment,
  onCreateAnother,
}: {
  phase: 'idle' | 'submitting' | 'success' | 'error';
  step: string;
  error: string;
  wasDraft: boolean;
  onDismissError: () => void;
  onViewAssessment: () => void;
  onCreateAnother: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || phase === 'idle') return null;

  return createPortal(
    <>
      {/* ── Loading ── */}
      {phase === 'submitting' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs mx-4 flex flex-col items-center gap-5">
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">Please wait…</p>
              <p className="text-sm text-gray-500 mt-1">{step}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Success ── */}
      {phase === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-gray-900">
                {wasDraft ? 'Draft Saved!' : 'Assessment Created!'}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {wasDraft
                  ? 'Your assessment has been saved as a draft. You can launch it at any time.'
                  : 'Your assessment is live and participants have been notified.'}
              </p>
            </div>
            <div className="flex flex-col w-full gap-2.5">
              <button
                onClick={onViewAssessment}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
              >
                View Assessment
              </button>
              <button
                onClick={onCreateAnother}
                className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error toast ── */}
      {phase === 'error' && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center px-4 z-50 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Submission Failed</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={onDismissError}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────
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
    participants360: [],
    questions: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [submittingStep, setSubmittingStep] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [wasDraft, setWasDraft] = useState(false);

  const is360 = state.type === AssessmentType.FEEDBACK_360;
  const steps = is360 ? STEPS_360 : STEPS_DEFAULT;

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  function canProceed(): boolean {
    switch (state.step) {
      case 1: return state.type !== null;
      case 2: return state.title.trim().length > 0;
      default: return true;
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
      return { ...prev, [list]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] };
    });
  }

  // 360° participant management
  function addParticipant360(user: UserDto) {
    setState((prev) => {
      if (prev.participants360.some((p) => p.userId === user.id)) return prev;
      return {
        ...prev,
        participants360: [
          ...prev.participants360,
          { userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, raters: [] },
        ],
      };
    });
  }

  function removeParticipant360(userId: string) {
    setState((prev) => ({ ...prev, participants360: prev.participants360.filter((p) => p.userId !== userId) }));
  }

  function addRater(participantUserId: string, rater: RaterEntry) {
    setState((prev) => ({
      ...prev,
      participants360: prev.participants360.map((p) =>
        p.userId === participantUserId ? { ...p, raters: [...p.raters, rater] } : p,
      ),
    }));
  }

  function removeRater(participantUserId: string, raterUserId: string) {
    setState((prev) => ({
      ...prev,
      participants360: prev.participants360.map((p) =>
        p.userId === participantUserId ? { ...p, raters: p.raters.filter((r) => r.userId !== raterUserId) } : p,
      ),
    }));
  }

  // Question management
  function addQuestion(type: QuestionType) {
    const defaultOptions =
      type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
        ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]
        : type === 'TRUE_FALSE'
        ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
        : [];
    const newQ: FormQuestion = {
      id: crypto.randomUUID(),
      type,
      title: '',
      required: false,
      options: defaultOptions,
      tableRows: type === 'TABLE' ? ['Row 1', 'Row 2'] : [],
      tableColumns: type === 'TABLE' ? ['Column 1', 'Column 2'] : [],
    };
    setState((prev) => ({ ...prev, questions: [...prev.questions, newQ] }));
  }

  function updateQuestion(id: string, patch: Partial<FormQuestion>) {
    setState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }

  function removeQuestion(id: string) {
    setState((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
  }

  function insertGeneratedQuestions(generated: GeneratedQuestion[]) {
    const newQuestions: FormQuestion[] = generated.map((gq) => ({
      id: crypto.randomUUID(),
      type: gq.type,
      title: gq.title,
      required: gq.required ?? false,
      options:
        gq.type === 'TRUE_FALSE'
          ? [{ id: 'opt-true', text: 'True' }, { id: 'opt-false', text: 'False' }]
          : (gq.options ?? []).map((text) => ({ id: crypto.randomUUID(), text })),
      tableRows: gq.tableRows ?? [],
      tableColumns: gq.tableColumns ?? [],
    }));
    setState((prev) => ({ ...prev, questions: [...prev.questions, ...newQuestions] }));
  }

  async function submit(launch: boolean) {
    setIsSubmitting(true);
    setSubmitPhase('submitting');
    setWasDraft(!launch);

    try {
      if (is360) {
        setSubmittingStep('Creating assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: AssessmentType.FEEDBACK_360,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: { questions: state.questions },
        });
        const assessmentId = res.data.data.id;

        setSubmittingStep('Adding participants…');
        for (const participant of state.participants360) {
          const pRes = await api.post<{ data: { id: string } }>(
            `/assessments/${assessmentId}/participants`,
            { userId: participant.userId },
          );
          const participantId = pRes.data.data.id;

          if (participant.raters.length > 0) {
            setSubmittingStep('Sending nominations…');
            await api.post(`/assessments/${assessmentId}/360/nominations`, {
              participantId,
              raters: participant.raters.map((rater) => ({
                raterEmail: rater.email,
                raterName: `${rater.firstName} ${rater.lastName}`,
                relationship: rater.relationship,
              })),
            });
          }
        }

        if (launch) {
          setSubmittingStep('Launching assessment…');
          await api.post(`/assessments/${assessmentId}/launch`);
        }
        setCreatedId(assessmentId);
        setSubmitPhase('success');
      } else {
        setSubmittingStep('Creating assessment…');
        const res = await api.post<{ data: { id: string } }>('/assessments', {
          title: state.title,
          assessmentType: state.type,
          startDate: state.startDate || null,
          endDate: state.endDate || null,
          config: {
            competencyIds: state.competencyIds.length ? state.competencyIds : undefined,
            ...(state.type === AssessmentType.PERSONALITY ? { isRatingMandatory: state.isRatingMandatory } : {}),
          },
        });
        const assessmentId = res.data.data.id;

        if (state.participantIds.length > 0) {
          setSubmittingStep('Adding participants…');
          await Promise.all(
            state.participantIds.map((pid) => api.post(`/assessments/${assessmentId}/participants`, { userId: pid })),
          );
        }

        if (launch) {
          setSubmittingStep('Launching assessment…');
          await api.post(`/assessments/${assessmentId}/launch`);
        }
        setCreatedId(assessmentId);
        setSubmitPhase('success');
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message ?? 'Failed to create assessment.';
      setSubmitError(msg);
      setSubmitPhase('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => (state.step > 1 ? prev() : router.back())}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {state.step > 1 ? `Back to ${steps[state.step - 2].label}` : 'Back'}
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">New Assessment</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <Stepper current={state.step} steps={steps} />

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
          is360 ? (
            <StepParticipants360
              participants360={state.participants360}
              onAddParticipant={addParticipant360}
              onRemoveParticipant={removeParticipant360}
              onAddRater={addRater}
              onRemoveRater={removeRater}
            />
          ) : (
            <StepCompetencies
              assessmentType={state.type}
              selected={state.competencyIds}
              onToggle={(id) => toggleId('competencyIds', id)}
            />
          )
        )}
        {state.step === 4 && (
          is360 ? (
            <StepQuestions
              questions={state.questions}
              onAdd={addQuestion}
              onUpdate={updateQuestion}
              onRemove={removeQuestion}
            />
          ) : (
            <StepParticipants
              selected={state.participantIds}
              onToggle={(id) => toggleId('participantIds', id)}
            />
          )
        )}
        {state.step === 5 && (
          <StepReview
            state={state}
            onSaveDraft={() => submit(false)}
            onSubmit={() => submit(true)}
            isSubmitting={isSubmitting}
          />
        )}

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

    {is360 && state.step === 4 && (
      <AssessmentChatbot
        context="360° Feedback Assessment — Questions Builder. Help the user design effective questionnaire questions."
        onInsertQuestions={insertGeneratedQuestions}
      />
    )}

    <SubmitOverlay
      phase={submitPhase}
      step={submittingStep}
      error={submitError}
      wasDraft={wasDraft}
      onDismissError={() => setSubmitPhase('idle')}
      onViewAssessment={() => router.push(`/assessments/${createdId}`)}
      onCreateAnother={() => {
        setSubmitPhase('idle');
        router.push('/assessments/new');
      }}
    />
    </>
  );
}
