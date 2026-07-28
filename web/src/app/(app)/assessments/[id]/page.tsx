'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TopCenterToast } from '@/components/ui/TopCenterToast';
import {
  AssessmentDto,
  AssessmentStatus,
  AssessmentType,
  UserDto,
  RaterNominationDto,
  ReportDto,
  UserRole,
  Language,
  RaterRelationship,
  ReportType,
} from '@leaderprism/shared';
import { RadarChart, RadarAxis } from '@/components/ui/RadarChart';
import { generateReportPdf, ReportData } from '@/lib/reportPdf';

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'TABLE';

interface QuestionOption {
  id: string;
  text: string;
}

interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: QuestionOption[];
  tableRows: string[];
  tableColumns: string[];
}

interface Participant {
  id: string;
  userId: string;
  user: UserDto;
  status: 'invited' | 'in_progress' | 'completed';
  completionPercentage: number;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Single Choice',
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short Answer',
  TABLE: 'Table',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'info' | 'warning'> = {
  draft: 'neutral',
  active: 'success',
  closed: 'info',
  archived: 'neutral',
};

const TAB_LIST = [
  { key: 'overview', label: 'Overview' },
  { key: 'participants', label: 'Participants' },
  { key: 'feedback-givers', label: 'Feedback Givers' },
  { key: 'results', label: 'Results' },
  { key: 'reports', label: 'Reports' },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

function makeUser(id: string, firstName: string, lastName: string, email: string, jobTitle: string): UserDto {
  return {
    id,
    organisationId: 'org-demo',
    departmentId: null,
    email,
    firstName,
    lastName,
    role: UserRole.PARTICIPANT,
    jobTitle,
    avatarUrl: null,
    languagePref: Language.EN,
    isActive: true,
    emailVerified: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

const RATING_OPTIONS: QuestionOption[] = [
  { id: 'o1', text: 'Strongly Agree' },
  { id: 'o2', text: 'Agree' },
  { id: 'o3', text: 'Neutral' },
  { id: 'o4', text: 'Disagree' },
  { id: 'o5', text: 'Strongly Disagree' },
];

const MOCK_ASSESSMENTS_MAP: Record<string, AssessmentDto> = {
  '1': {
    id: '1',
    organisationId: 'org-demo',
    title: 'Annual Leadership 360° Review 2025',
    assessmentType: AssessmentType.FEEDBACK_360,
    status: AssessmentStatus.ACTIVE,
    config: {
      questions: [
        { id: 'q1', type: 'SINGLE_CHOICE', title: 'This leader communicates clearly and transparently with their team.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q2', type: 'SINGLE_CHOICE', title: 'This leader demonstrates strategic thinking in their decision-making.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q3', type: 'SINGLE_CHOICE', title: 'This leader actively develops and mentors team members.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q4', type: 'SHORT_ANSWER', title: "What are this leader's greatest strengths?", required: false, options: [], tableRows: [], tableColumns: [] },
      ],
    } as unknown as AssessmentDto['config'],
    startDate: '2025-05-01T00:00:00.000Z',
    endDate: '2025-07-31T00:00:00.000Z',
    createdAt: '2025-04-15T00:00:00.000Z',
  },
  '2': {
    id: '2',
    organisationId: 'org-demo',
    title: 'Q2 Leadership Competency Assessment',
    assessmentType: AssessmentType.COMPETENCY,
    status: AssessmentStatus.DRAFT,
    config: {
      questions: [
        { id: 'q1', type: 'SINGLE_CHOICE', title: 'Demonstrates effective conflict resolution and mediation skills.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q2', type: 'TABLE', title: 'Rate the following leadership competencies.', required: true, options: [], tableRows: ['Strategic Vision', 'Emotional Intelligence', 'Decision Making', 'Team Development'], tableColumns: ['Below Expectation', 'Meets Expectation', 'Exceeds Expectation'] },
      ],
    } as unknown as AssessmentDto['config'],
    startDate: '2025-06-01T00:00:00.000Z',
    endDate: '2025-08-31T00:00:00.000Z',
    createdAt: '2025-05-20T00:00:00.000Z',
  },
  '3': {
    id: '3',
    organisationId: 'org-demo',
    title: 'Big Five Personality Profiling — Cohort 2025',
    assessmentType: AssessmentType.PERSONALITY,
    status: AssessmentStatus.CLOSED,
    config: {
      questions: [
        { id: 'q1', type: 'SINGLE_CHOICE', title: 'I enjoy exploring new ideas and unconventional ways of doing things.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q2', type: 'SINGLE_CHOICE', title: 'I plan tasks carefully and follow through on commitments without prompting.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q3', type: 'SINGLE_CHOICE', title: 'I feel energised when interacting with large groups of people.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q4', type: 'SINGLE_CHOICE', title: 'I find it easy to empathise with others and consider their feelings in decisions.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q5', type: 'SINGLE_CHOICE', title: 'I remain calm and composed when faced with stressful or ambiguous situations.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q6', type: 'TABLE', title: 'Rate how accurately each statement describes you.', required: true, options: [], tableRows: ['I adapt quickly to change', 'I set high personal standards', 'I take initiative without being asked', 'I consider multiple perspectives before deciding'], tableColumns: ['Not at all', 'Somewhat', 'Mostly', 'Very Accurately'] },
        { id: 'q7', type: 'SHORT_ANSWER', title: 'Describe a situation where your personality traits helped you navigate a workplace challenge.', required: false, options: [], tableRows: [], tableColumns: [] },
      ],
    } as unknown as AssessmentDto['config'],
    startDate: '2025-03-01T00:00:00.000Z',
    endDate: '2025-04-30T00:00:00.000Z',
    createdAt: '2025-02-15T00:00:00.000Z',
  },
  '4': {
    id: '4',
    organisationId: 'org-demo',
    title: 'Leadership Readiness Assessment Q3 2025',
    assessmentType: AssessmentType.READINESS,
    status: AssessmentStatus.ACTIVE,
    config: {
      questions: [
        { id: 'q1', type: 'SINGLE_CHOICE', title: 'I am comfortable making high-stakes decisions with incomplete information.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q2', type: 'SINGLE_CHOICE', title: 'I actively seek opportunities to lead cross-functional initiatives.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q3', type: 'SINGLE_CHOICE', title: 'I regularly mentor or develop others within the organisation.', required: true, options: RATING_OPTIONS, tableRows: [], tableColumns: [] },
        { id: 'q4', type: 'TABLE', title: 'Rate your readiness across the following leadership dimensions.', required: true, options: [], tableRows: ['Strategic Thinking', 'Change Management', 'Stakeholder Influence', 'Executive Presence', 'Business Acumen'], tableColumns: ['Not Ready', 'Developing', 'Ready', 'Highly Ready'] },
        { id: 'q5', type: 'MULTIPLE_CHOICE', title: 'Which of the following leadership roles are you prepared to step into within the next 12 months?', required: false, options: [{ id: 'o1', text: 'Team Lead' }, { id: 'o2', text: 'Department Head' }, { id: 'o3', text: 'Project Sponsor' }, { id: 'o4', text: 'C-Suite / Executive' }], tableRows: [], tableColumns: [] },
        { id: 'q6', type: 'SHORT_ANSWER', title: 'What is one leadership capability you are actively working to strengthen, and how?', required: false, options: [], tableRows: [], tableColumns: [] },
      ],
    } as unknown as AssessmentDto['config'],
    startDate: '2025-06-15T00:00:00.000Z',
    endDate: '2025-09-30T00:00:00.000Z',
    createdAt: '2025-06-01T00:00:00.000Z',
  },
};

const MOCK_PARTICIPANTS_MAP: Record<string, Participant[]> = {
  '1': [
    { id: 'p1', userId: 'u1', user: makeUser('u1', 'Sarah', 'Johnson', 'sarah.johnson@company.com', 'Senior Manager'), status: 'completed', completionPercentage: 100 },
    { id: 'p2', userId: 'u2', user: makeUser('u2', 'Mark', 'Davis', 'mark.davis@company.com', 'Operations Lead'), status: 'in_progress', completionPercentage: 65 },
    { id: 'p3', userId: 'u3', user: makeUser('u3', 'Emily', 'Chen', 'emily.chen@company.com', 'Team Lead'), status: 'invited', completionPercentage: 0 },
  ],
  '2': [
    { id: 'p4', userId: 'u4', user: makeUser('u4', 'Alex', 'Morgan', 'alex.morgan@company.com', 'Department Head'), status: 'in_progress', completionPercentage: 40 },
    { id: 'p5', userId: 'u5', user: makeUser('u5', 'Rachel', 'Kim', 'rachel.kim@company.com', 'Strategy Manager'), status: 'invited', completionPercentage: 0 },
  ],
  '3': [
    { id: 'p6', userId: 'u6', user: makeUser('u6', 'Nina', 'Patel', 'nina.patel@company.com', 'Product Director'), status: 'completed', completionPercentage: 100 },
    { id: 'p7', userId: 'u7', user: makeUser('u7', 'David', 'Okonkwo', 'david.okonkwo@company.com', 'Engineering Manager'), status: 'completed', completionPercentage: 100 },
    { id: 'p8', userId: 'u8', user: makeUser('u8', 'Priya', 'Sharma', 'priya.sharma@company.com', 'HR Business Partner'), status: 'completed', completionPercentage: 100 },
  ],
  '4': [
    { id: 'p9', userId: 'u9', user: makeUser('u9', 'James', 'Oliveira', 'james.oliveira@company.com', 'Senior Manager'), status: 'completed', completionPercentage: 100 },
    { id: 'p10', userId: 'u10', user: makeUser('u10', 'Aisha', 'Nakamura', 'aisha.nakamura@company.com', 'Operations Manager'), status: 'in_progress', completionPercentage: 55 },
    { id: 'p11', userId: 'u11', user: makeUser('u11', 'Chris', 'Fernandez', 'chris.fernandez@company.com', 'Finance Lead'), status: 'in_progress', completionPercentage: 20 },
    { id: 'p12', userId: 'u12', user: makeUser('u12', 'Yuki', 'Tanaka', 'yuki.tanaka@company.com', 'Marketing Head'), status: 'invited', completionPercentage: 0 },
  ],
};

const MOCK_NOMINATIONS_MAP: Record<string, RaterNominationDto[]> = {
  '1': [
    { id: 'n1', assessmentId: '1', participantId: 'u1', raterEmail: 'james.wilson@company.com', raterName: 'James Wilson', relationship: RaterRelationship.DIRECT_REPORT, status: 'completed', completedAt: '2025-06-10T08:00:00.000Z' },
    { id: 'n2', assessmentId: '1', participantId: 'u1', raterEmail: 'lisa.park@company.com', raterName: 'Lisa Park', relationship: RaterRelationship.PEER, status: 'pending', completedAt: null },
    { id: 'n3', assessmentId: '1', participantId: 'u2', raterEmail: 'tom.brown@company.com', raterName: 'Tom Brown', relationship: RaterRelationship.SUPERVISOR, status: 'completed', completedAt: '2025-06-12T14:30:00.000Z' },
  ],
  '2': [],
  '3': [],
  '4': [],
};

const MOCK_REPORTS_MAP: Record<string, ReportDto[]> = {
  '1': [
    { id: 'r1', assessmentId: '1', participantId: 'p1', reportType: ReportType.INDIVIDUAL_360, status: 'ready', language: Language.EN, generatedAt: '2025-06-15T10:00:00.000Z' },
  ],
  '2': [],
  '3': [
    { id: 'r2', assessmentId: '3', participantId: 'p6', reportType: ReportType.INDIVIDUAL_360, status: 'ready', language: Language.EN, generatedAt: '2025-05-05T09:00:00.000Z' },
    { id: 'r3', assessmentId: '3', participantId: 'p7', reportType: ReportType.INDIVIDUAL_360, status: 'ready', language: Language.EN, generatedAt: '2025-05-05T09:15:00.000Z' },
    { id: 'r4', assessmentId: '3', participantId: 'p8', reportType: ReportType.INDIVIDUAL_360, status: 'ready', language: Language.EN, generatedAt: '2025-05-05T09:30:00.000Z' },
  ],
  '4': [
    { id: 'r5', assessmentId: '4', participantId: 'p9', reportType: ReportType.INDIVIDUAL_360, status: 'ready', language: Language.EN, generatedAt: '2025-07-01T11:00:00.000Z' },
  ],
};

const MOCK_PERSONALITY_SCORES_MAP: Record<string, FactorScore[]> = {
  p6: [
    { factor: 'openness',           rawScore: 48, tScore: 67, percentile: 84, narrative: 'Highly curious and imaginative; actively seeks novel ideas.' },
    { factor: 'conscientiousness',  rawScore: 44, tScore: 62, percentile: 76, narrative: 'Organised and reliable; follows through with minimal prompting.' },
    { factor: 'extraversion',       rawScore: 46, tScore: 65, percentile: 80, narrative: 'Energised by group interactions; assertive communicator.' },
    { factor: 'agreeableness',      rawScore: 40, tScore: 58, percentile: 70, narrative: 'Cooperative with a balanced approach to conflict.' },
    { factor: 'emotional_stability',rawScore: 42, tScore: 60, percentile: 73, narrative: 'Generally composed under pressure with good stress recovery.' },
  ],
  p7: [
    { factor: 'openness',           rawScore: 45, tScore: 64, percentile: 79, narrative: 'Open to new methodologies and cross-functional thinking.' },
    { factor: 'conscientiousness',  rawScore: 50, tScore: 72, percentile: 91, narrative: 'Exceptionally diligent; sets high personal standards.' },
    { factor: 'extraversion',       rawScore: 35, tScore: 48, percentile: 55, narrative: 'Moderately reserved; prefers depth of interaction over breadth.' },
    { factor: 'agreeableness',      rawScore: 42, tScore: 60, percentile: 73, narrative: 'Collaborative and empathetic in team settings.' },
    { factor: 'emotional_stability',rawScore: 44, tScore: 62, percentile: 76, narrative: 'Resilient under deadlines; maintains focus during setbacks.' },
  ],
  p8: [
    { factor: 'openness',           rawScore: 40, tScore: 58, percentile: 70, narrative: 'Receptive to diverse perspectives and change initiatives.' },
    { factor: 'conscientiousness',  rawScore: 43, tScore: 61, percentile: 74, narrative: 'Structured approach to work with consistent follow-through.' },
    { factor: 'extraversion',       rawScore: 47, tScore: 66, percentile: 82, narrative: 'Highly sociable; thrives in people-facing and facilitation roles.' },
    { factor: 'agreeableness',      rawScore: 50, tScore: 72, percentile: 91, narrative: 'Exceptionally empathetic; prioritises harmony and inclusion.' },
    { factor: 'emotional_stability',rawScore: 45, tScore: 63, percentile: 77, narrative: 'Calm and grounding presence for others during stressful periods.' },
  ],
};

function toReportType(type: AssessmentType): ReportData['reportType'] {
  const m: Record<AssessmentType, ReportData['reportType']> = {
    [AssessmentType.FEEDBACK_360]: 'individual_360',
    [AssessmentType.COMPETENCY]:   'competency',
    [AssessmentType.PERSONALITY]:  'personality',
    [AssessmentType.READINESS]:    'readiness',
  };
  return m[type] ?? 'individual_360';
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({
  assessment,
  participants,
  questions,
  onGoToReports,
}: {
  assessment: AssessmentDto;
  participants: Participant[];
  questions: AssessmentQuestion[];
  onGoToReports: () => void;
}) {
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  function sendReminders() {
    setSendingReminders(true);
    setTimeout(() => {
      setSendingReminders(false);
      showToast('Reminders sent successfully.');
    }, 600);
  }

  function closeAssessment() {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setShowCloseConfirm(false);
      showToast('Assessment has been closed.');
    }, 600);
  }

  const completedCount = participants.filter((p) => p.status === 'completed').length;
  const totalCount = participants.length;
  const responseRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <TopCenterToast
        message={toast?.message ?? null}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />
      {/* Assessment details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{assessment.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="info">
                {assessment.assessmentType === AssessmentType.FEEDBACK_360
                  ? '360° Feedback'
                  : assessment.assessmentType.charAt(0).toUpperCase() +
                  assessment.assessmentType.slice(1)}
              </Badge>
              <Badge variant={STATUS_VARIANT[assessment.status] ?? 'neutral'}>
                {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
              </Badge>
            </div>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              {assessment.startDate && (
                <p>Start: {format(new Date(assessment.startDate), 'dd MMM yyyy')}</p>
              )}
              {assessment.endDate && (
                <p>End: {format(new Date(assessment.endDate), 'dd MMM yyyy')}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {assessment.assessmentType === AssessmentType.FEEDBACK_360 && (
              <button
                onClick={sendReminders}
                disabled={sendingReminders || assessment.status !== AssessmentStatus.ACTIVE}
                className="text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingReminders ? <Spinner size="sm" /> : null}
                Send Reminders
              </button>
            )}
            {assessment.status === AssessmentStatus.ACTIVE && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2.5 transition-colors"
              >
                Close Assessment
              </button>
            )}
            <button
              onClick={onGoToReports}
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 transition-colors shadow-sm"
            >
              Generate Reports
            </button>
          </div>
        </div>
      </div>

      {/* Response rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Response Rate</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall completion</span>
              <span>{responseRate}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${responseRate}%` }}
              />
            </div>
          </div>
          <div className="text-sm font-medium text-gray-700 shrink-0">
            {completedCount}/{totalCount}
          </div>
        </div>

        <div className="space-y-2">
          {participants.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-32 text-xs text-gray-700 truncate">
                {p.user?.firstName} {p.user?.lastName}
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    p.status === 'completed' ? 'bg-green-500' : 'bg-blue-400',
                  )}
                  style={{ width: `${p.completionPercentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">
                {p.completionPercentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Questionnaire — {questions.length} Question{questions.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3 bg-gray-50">
                  <span className="text-xs font-bold text-gray-400 mt-0.5 w-5 shrink-0">Q{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {q.title || <span className="italic text-gray-400">Untitled question</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                        {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      {q.required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">
                          Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') && q.options.length > 0 && (
                  <div className="px-4 py-3 space-y-1.5">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-gray-300 shrink-0">
                          {q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE' ? '○' : '□'}
                        </span>
                        <span>{opt.text || <span className="italic text-gray-400">Empty option</span>}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === 'SHORT_ANSWER' && (
                  <div className="px-4 py-3">
                    <div className="h-10 bg-gray-50 border border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400 italic">Text response</span>
                    </div>
                  </div>
                )}
                {q.type === 'TABLE' && q.tableRows.length > 0 && q.tableColumns.length > 0 && (
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="text-xs border-collapse bg-white rounded-lg overflow-hidden border border-gray-100 w-full">
                      <thead>
                        <tr>
                          <th className="border border-gray-100 px-3 py-1.5 bg-gray-50 min-w-[80px]" />
                          {q.tableColumns.map((col, i) => (
                            <th key={i} className="border border-gray-100 px-3 py-1.5 bg-gray-50 text-gray-700 font-medium text-left min-w-[90px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {q.tableRows.map((row, i) => (
                          <tr key={i}>
                            <td className="border border-gray-100 px-3 py-1.5 bg-gray-50 font-medium text-gray-600">{row}</td>
                            {q.tableColumns.map((_, j) => (
                              <td key={j} className="border border-gray-100 px-3 py-1.5 text-gray-300 italic text-center">—</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close confirmation modal */}
      <Modal
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        title="Close Assessment"
      >
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to close this assessment? No further responses will be accepted
          after closing.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCloseConfirm(false)}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={closeAssessment}
            disabled={closing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {closing ? 'Closing…' : 'Close Assessment'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Participants Tab ──────────────────────────────────────────────────────────
function ParticipantsTab({
  participants,
}: {
  assessmentId: string;
  participants: Participant[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  function addParticipant() {
    if (!email.trim()) return;
    setAdding(true);
    setTimeout(() => {
      setAdding(false);
      setEmail('');
      setShowAdd(false);
      showToast('Participant added.');
    }, 500);
  }

  function removeParticipant(_participantId: string) {
    if (!confirm('Remove this participant?')) return;
    showToast('Participant removed.');
  }

  return (
    <div className="space-y-4">
      <TopCenterToast
        message={toast?.message ?? null}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">
          {participants.length} Participant{participants.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-50 text-blue-600 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors shrink-0"
        >
          + Add Participant
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="participant@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
          />
          <button
            onClick={addParticipant}
            disabled={adding || !email.trim()}
            className="bg-blue-600 text-white text-sm font-medium rounded-lg px-6 py-2.5 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {adding && <Spinner size="sm" className="border-white border-t-transparent" />}
            Add
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="text-gray-500 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-200 transition-colors rounded-lg text-sm px-4 py-2.5"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {participants.length === 0 ? (
          <EmptyState
            title="No participants yet"
            description="Add participants to begin the assessment."
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participants.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {p.user?.firstName} {p.user?.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.user?.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        p.status === 'completed'
                          ? 'success'
                          : p.status === 'in_progress'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {p.status === 'completed'
                        ? 'Completed'
                        : p.status === 'in_progress'
                          ? 'In Progress'
                          : 'Invited'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Feedback Givers Tab ───────────────────────────────────────────────────────
function FeedbackGiversTab({
  participants,
  nominations,
}: {
  assessmentId: string;
  participants: Participant[];
  nominations: RaterNominationDto[];
}) {
  function getParticipantName(participantId: string) {
    const p = participants.find((pt) => pt.userId === participantId);
    if (!p) return '—';
    return `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Feedback Givers{nominations.length > 0 ? ` — ${nominations.length}` : ''}
        </h3>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {nominations.length === 0 ? (
          <EmptyState
            title="No feedback givers yet"
            description="Feedback givers will appear here once participants nominate their raters."
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Feedback Giver
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Giving Feedback For
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Relationship
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {nominations.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{n.raterName ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{n.raterEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {getParticipantName(n.participantId)}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">
                    {n.relationship.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={n.status === 'completed' ? 'success' : 'neutral'}>
                      {n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Reports Tab ────────────────────────────────────────────────────────────────
function ReportsTab({
  assessmentId,
  assessmentType,
  assessmentTitle,
  participants,
  reports,
}: {
  assessmentId: string;
  assessmentType: AssessmentType;
  assessmentTitle: string;
  participants: Participant[];
  reports: ReportDto[];
}) {
  const [localReports, setLocalReports] = useState<ReportDto[]>(reports);
  const [generating, setGenerating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function generateReport(participant: Participant) {
    setGenerating(participant.id);
    await new Promise((r) => setTimeout(r, 1800));
    setLocalReports((prev) => [
      ...prev,
      {
        id: `r-${participant.id}`,
        assessmentId,
        participantId: participant.id,
        reportType: ReportType.INDIVIDUAL_360,
        status: 'ready',
        language: Language.EN,
        generatedAt: new Date().toISOString(),
      },
    ]);
    setGenerating(null);
  }

  async function downloadPdf(participant: Participant) {
    setDownloading(participant.id);
    try {
      await generateReportPdf({
        id: participant.id,
        participantName: `${participant.user?.firstName ?? ''} ${participant.user?.lastName ?? ''}`.trim(),
        participantRole: participant.user?.jobTitle ?? '',
        assessmentTitle,
        reportType: toReportType(assessmentType),
        generatedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        organisationName: 'LeaderPrism Demo Org',
      });
    } finally {
      setDownloading(null);
    }
  }

  function getReportForParticipant(participantId: string) {
    return localReports.find((r) => r.participantId === participantId);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Individual Reports</h3>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {participants.length === 0 ? (
          <EmptyState title="No participants" className="border-0" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Participant
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Generated
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participants.map((p) => {
                const report = getReportForParticipant(p.id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.user?.firstName} {p.user?.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {generating === p.id ? (
                        <Badge variant="warning">Generating…</Badge>
                      ) : report ? (
                        <Badge
                          variant={
                            report.status === 'ready'
                              ? 'success'
                              : report.status === 'failed'
                                ? 'error'
                                : report.status === 'processing'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        >
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {report?.generatedAt
                        ? format(new Date(report.generatedAt), 'dd MMM yyyy HH:mm')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {report?.status === 'ready' ? (
                        <button
                          onClick={() => downloadPdf(p)}
                          disabled={downloading === p.id}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                        >
                          {downloading === p.id && <Spinner size="sm" />}
                          Download PDF
                        </button>
                      ) : (
                        <button
                          onClick={() => generateReport(p)}
                          disabled={generating === p.id}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                        >
                          {generating === p.id && <Spinner size="sm" />}
                          Generate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Personality Results Tab ───────────────────────────────────────────────────

interface FactorScore {
  factor: string;
  rawScore: number;
  tScore: number;
  percentile: number;
  narrative: string;
}

const ADMIN_FACTOR_ORDER = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'emotional_stability',
];

const ADMIN_FACTOR_LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  emotional_stability: 'Emotional Stability',
};

function tScoreBandVariant(t: number): 'success' | 'warning' | 'info' {
  if (t >= 60) return 'success';
  if (t < 40) return 'info';
  return 'warning';
}

function ParticipantRadarCard({
  participant,
  scores,
}: {
  participant: Participant;
  scores: FactorScore[] | null;
}) {
  if (participant.status !== 'completed') {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center text-center min-h-[420px] hover:border-gray-300 transition-colors">
        <Badge variant="neutral" className="mb-4">Pending</Badge>
        <p className="text-sm font-semibold text-gray-900">
          {participant.user?.firstName} {participant.user?.lastName}
        </p>
        <p className="text-xs text-gray-500 mt-1.5 max-w-[200px]">Results will appear once the participant submits.</p>
      </div>
    );
  }

  const axes: RadarAxis[] = ADMIN_FACTOR_ORDER.map((key) => {
    const s = scores?.find((sc) => sc.factor === key);
    return { key, label: ADMIN_FACTOR_LABELS[key] ?? key, value: s ? Math.round(s.percentile) : 0 };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col min-h-[420px]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {participant.user?.firstName} {participant.user?.lastName}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Completed</p>
        </div>
        <Badge variant="success" className="shadow-sm">View</Badge>
      </div>

      {!scores ? (
        <div className="flex justify-center py-6 flex-1 items-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-6 px-2 sm:px-4 [&_svg]:overflow-visible">
            <RadarChart axes={axes} size={200} />
          </div>

          <div className="space-y-3 mt-auto">
            {ADMIN_FACTOR_ORDER.map((key) => {
              const score = scores.find((s) => s.factor === key);
              if (!score) return null;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-700 w-32 shrink-0 truncate">{ADMIN_FACTOR_LABELS[key]}</span>
                  <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round(score.percentile)}%` }}
                    />
                  </div>
                  <Badge variant={tScoreBandVariant(score.tScore)} className="px-1.5 min-w-[2.5rem] text-center justify-center">
                    {Math.round(score.percentile)}th
                  </Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PersonalityResultsTab({
  assessmentId,
  participants,
}: {
  assessmentId: string;
  participants: Participant[];
}) {
  const completed = participants.filter((p) => p.status === 'completed');
  const pending = participants.filter((p) => p.status !== 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Personality Results — {completed.length}/{participants.length} completed
        </h3>
      </div>

      {participants.length === 0 && (
        <EmptyState title="No participants" description="Add participants to begin the assessment." />
      )}

      {participants.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {completed.map((p) => (
            <ParticipantRadarCard key={p.id} participant={p} scores={MOCK_PERSONALITY_SCORES_MAP[p.id] ?? null} />
          ))}
          {pending.map((p) => (
            <ParticipantRadarCard key={p.id} participant={p} scores={null} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── cn helper (inline to avoid extra import issue) ────────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState('overview');

  const assessment = MOCK_ASSESSMENTS_MAP[id] ?? null;
  const participants = MOCK_PARTICIPANTS_MAP[id] ?? [];
  const nominations = MOCK_NOMINATIONS_MAP[id] ?? [];
  const reports = MOCK_REPORTS_MAP[id] ?? [];

  const is360 = assessment?.assessmentType === AssessmentType.FEEDBACK_360;
  const isPersonality = assessment?.assessmentType === AssessmentType.PERSONALITY;

  const visibleTabs = TAB_LIST.filter(
    (t) =>
      (t.key !== 'feedback-givers' || is360) &&
      (t.key !== 'results' || isPersonality),
  );

  if (!assessment) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        Assessment not found.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/assessments')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Assessments
        </button>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">{assessment.title}</h1>
          <button
            onClick={() => router.push(`/assessments/${id}/edit`)}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-50 text-blue-600 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      <Tabs
        tabs={visibleTabs}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 'overview' && (
        <OverviewTab
          assessment={assessment}
          participants={participants}
          questions={((assessment.config as any)?.questions ?? []) as AssessmentQuestion[]}
          onGoToReports={() => setActiveTab('reports')}
        />
      )}

      {activeTab === 'participants' && (
        <ParticipantsTab
          assessmentId={id}
          participants={participants}
          onRefresh={() => {}}
        />
      )}

      {activeTab === 'feedback-givers' && is360 && (
        <FeedbackGiversTab assessmentId={id} participants={participants} nominations={nominations} />
      )}

      {activeTab === 'results' && isPersonality && (
        <PersonalityResultsTab assessmentId={id} participants={participants} />
      )}

      {activeTab === 'reports' && (
        <ReportsTab assessmentId={id} assessmentType={assessment.assessmentType} assessmentTitle={assessment.title} participants={participants} reports={reports} />
      )}
    </div>
  );
}
