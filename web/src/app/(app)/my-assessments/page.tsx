'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'TABLE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
type AssessmentTypeName = '360° Feedback' | 'Competency' | 'Personality' | 'Readiness';
type BadgeVariant = 'info' | 'warning' | 'success' | 'neutral';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: Option[];
  tableRows: string[];
  tableColumns: string[];
}

type Answer = string | string[] | Record<string, string>;

interface MockAssessmentItem {
  id: string;
  title: string;
  type: AssessmentTypeName;
  typeVariant: BadgeVariant;
  roleLabel: string;
  subject?: string;
  endDate: string;
  pendingStatusLabel: string;
  completedStatusLabel: string;
  pendingActionLabel: string;
  completedActionLabel: string;
  successTitle: string;
  successBody: string;
  successNextSteps: string;
  questions: Question[];
  hasVideoInterview?: boolean;
}

// ── Questions per assessment type ─────────────────────────────────────────────

const FEEDBACK_360_QUESTIONS: Question[] = [
  {
    id: 'q1',
    type: 'TABLE',
    title: 'Please rate the following behaviours related to emotional intelligence:',
    required: true,
    options: [],
    tableRows: [
      'Recognises and understands own emotions',
      "Empathises with others' feelings",
      'Manages emotions effectively in stressful situations',
      "Responds to others' emotional cues appropriately",
      'Builds strong relationships through emotional awareness',
    ],
    tableColumns: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'q2',
    type: 'SINGLE_CHOICE',
    title: 'This person effectively manages their emotions in challenging situations.',
    required: true,
    options: [
      { id: 'sd', text: 'Strongly Disagree' },
      { id: 'd', text: 'Disagree' },
      { id: 'n', text: 'Neutral' },
      { id: 'a', text: 'Agree' },
      { id: 'sa', text: 'Strongly Agree' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'q3',
    type: 'MULTIPLE_CHOICE',
    title:
      "Which of the following best describes this person's ability to empathise with others? (Select all that apply)",
    required: true,
    options: [
      { id: 'al', text: 'Actively listens to others' },
      { id: 'su', text: "Shows understanding of others' perspectives" },
      { id: 'os', text: 'Offers support when others are feeling down' },
      { id: 'df', text: "Is dismissive of others' feelings" },
      { id: 'sr', text: 'Struggles to relate to others' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'q4',
    type: 'TRUE_FALSE',
    title: 'This person is aware of how their emotions affect their behaviour.',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'q5',
    type: 'SHORT_ANSWER',
    title:
      'Can you provide an example of a time when this person demonstrated strong emotional intelligence?',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
];

const COMPETENCY_QUESTIONS: Question[] = [
  {
    id: 'cq1',
    type: 'TABLE',
    title: 'Rate your proficiency in the following leadership competencies:',
    required: true,
    options: [],
    tableRows: [
      'Strategic thinking and vision',
      'Decision-making under uncertainty',
      'Building and motivating high-performing teams',
      'Communicating with clarity and influence',
      'Driving continuous improvement',
    ],
    tableColumns: ['Developing', 'Competent', 'Proficient', 'Expert', 'Role Model'],
  },
  {
    id: 'cq2',
    type: 'SINGLE_CHOICE',
    title: 'I effectively delegate tasks and responsibilities to the right people.',
    required: true,
    options: [
      { id: 'sd', text: 'Strongly Disagree' },
      { id: 'd', text: 'Disagree' },
      { id: 'n', text: 'Neutral' },
      { id: 'a', text: 'Agree' },
      { id: 'sa', text: 'Strongly Agree' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'cq3',
    type: 'MULTIPLE_CHOICE',
    title: 'Which leadership styles do you regularly apply? (Select all that apply)',
    required: true,
    options: [
      { id: 'tl', text: 'Transformational — inspiring change and innovation' },
      { id: 'sv', text: 'Servant — prioritising team needs over personal gain' },
      { id: 'co', text: 'Coaching — developing individuals through guidance' },
      { id: 'ds', text: 'Democratic — involving the team in decisions' },
      { id: 'pa', text: 'Pacesetting — setting high standards by example' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'cq4',
    type: 'TRUE_FALSE',
    title: 'I regularly seek feedback from my team to improve my leadership approach.',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'cq5',
    type: 'SHORT_ANSWER',
    title:
      'Describe a recent situation where you applied a key leadership competency to achieve a positive outcome.',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
];

const PERSONALITY_QUESTIONS: Question[] = [
  {
    id: 'pq1',
    type: 'TABLE',
    title: 'Rate how accurately each statement describes your typical behaviour:',
    required: true,
    options: [],
    tableRows: [
      'I stay calm and composed under pressure',
      'I enjoy collaborating with people from diverse backgrounds',
      'I prefer to plan ahead rather than act spontaneously',
      'I tend to generate new ideas and creative solutions',
      'I follow through on commitments and meet deadlines',
    ],
    tableColumns: ['Very Inaccurate', 'Inaccurate', 'Neutral', 'Accurate', 'Very Accurate'],
  },
  {
    id: 'pq2',
    type: 'SINGLE_CHOICE',
    title: 'In a team setting, I most often take on the role of:',
    required: true,
    options: [
      { id: 'vi', text: 'Visionary — generating ideas and setting direction' },
      { id: 'ex', text: 'Executor — turning plans into action' },
      { id: 'me', text: 'Mediator — resolving conflict and building harmony' },
      { id: 'an', text: 'Analyst — evaluating options and ensuring quality' },
      { id: 'su', text: 'Supporter — encouraging others and maintaining morale' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'pq3',
    type: 'MULTIPLE_CHOICE',
    title: 'Which traits do you consider your strongest? (Select up to 3)',
    required: true,
    options: [
      { id: 'op', text: 'Openness to new experiences' },
      { id: 'cn', text: 'Conscientiousness and reliability' },
      { id: 'eg', text: 'Extraversion and sociability' },
      { id: 'ag', text: 'Agreeableness and cooperation' },
      { id: 'es', text: 'Emotional stability under stress' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'pq4',
    type: 'TRUE_FALSE',
    title: 'I find it easy to adapt my communication style to suit different audiences.',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'pq5',
    type: 'SHORT_ANSWER',
    title:
      'How does your personality influence the way you lead or work within a team? Give a specific example.',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
];

const READINESS_QUESTIONS: Question[] = [
  {
    id: 'rq1',
    type: 'TABLE',
    title: 'Rate your current readiness in each leadership area:',
    required: true,
    options: [],
    tableRows: [
      'Leading cross-functional teams',
      'Managing organisational change',
      'Executive-level stakeholder engagement',
      'Strategic planning and resource allocation',
      'Mentoring and succession planning',
    ],
    tableColumns: ['Not Ready', 'Developing', 'Nearly Ready', 'Ready', 'Excelling'],
  },
  {
    id: 'rq2',
    type: 'SINGLE_CHOICE',
    title:
      'How confident are you in taking on a senior leadership role within the next 12 months?',
    required: true,
    options: [
      { id: 'nc', text: 'Not confident at all' },
      { id: 'sc', text: 'Slightly confident' },
      { id: 'mc', text: 'Moderately confident' },
      { id: 'qc', text: 'Quite confident' },
      { id: 'vc', text: 'Very confident' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'rq3',
    type: 'MULTIPLE_CHOICE',
    title:
      'Which development areas would best prepare you for a higher leadership role? (Select all that apply)',
    required: true,
    options: [
      { id: 'fi', text: 'Financial acumen and business literacy' },
      { id: 'ch', text: 'Change management and transformation' },
      { id: 'ep', text: 'Executive presence and communication' },
      { id: 'im', text: 'Industry and market knowledge' },
      { id: 'pe', text: 'People and talent development' },
    ],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'rq4',
    type: 'TRUE_FALSE',
    title: 'I have a clear personal development plan aligned to a future leadership role.',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
  {
    id: 'rq5',
    type: 'SHORT_ANSWER',
    title:
      'What is the most significant leadership challenge you anticipate in your next role, and how do you plan to address it?',
    required: true,
    options: [],
    tableRows: [],
    tableColumns: [],
  },
];

// ── Video interview questions ─────────────────────────────────────────────────

const INTERVIEW_QUESTIONS = [
  {
    id: 'iv1',
    question:
      'Tell me about a time you had to communicate a difficult decision to your team. How did you approach it, and what was the outcome?',
    hint: 'Focus on clarity, empathy, and the specific steps you took.',
  },
  {
    id: 'iv2',
    question:
      'Describe a situation where you needed to explain a complex idea to stakeholders with different levels of understanding. How did you tailor your message?',
    hint: 'Think about your audience analysis and how you adapted your communication style.',
  },
  {
    id: 'iv3',
    question:
      'How do you ensure your team stays aligned and informed during periods of rapid change or uncertainty?',
    hint: 'Consider your communication cadence, the channels you used, and how you handled concerns.',
  },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Mock assessments ──────────────────────────────────────────────────────────

const MOCK_ASSESSMENTS: MockAssessmentItem[] = [
  {
    id: 'mock-360-001',
    title: 'Annual Leadership Review 2025',
    type: '360° Feedback',
    typeVariant: 'info',
    roleLabel: 'Giving Feedback',
    subject: 'Sarah Johnson',
    endDate: '2025-06-30T00:00:00.000Z',
    pendingStatusLabel: 'Feedback Requested',
    completedStatusLabel: 'Feedback Given',
    pendingActionLabel: 'Give Feedback',
    completedActionLabel: 'Feedback Given',
    successTitle: 'Feedback Submitted!',
    successBody:
      'Your responses have been recorded and will be included in the final report.',
    successNextSteps:
      'Once all raters complete their feedback, the HR team will compile the results into a comprehensive 360° report for Sarah.',
    questions: FEEDBACK_360_QUESTIONS,
  },
  {
    id: 'mock-comp-001',
    title: 'Leadership Competency Assessment Q2 2025',
    type: 'Competency',
    typeVariant: 'warning',
    roleLabel: 'Self Assessment',
    endDate: '2025-07-15T00:00:00.000Z',
    pendingStatusLabel: 'Pending',
    completedStatusLabel: 'Completed',
    pendingActionLabel: 'Start Assessment',
    completedActionLabel: 'Completed',
    successTitle: 'Assessment Submitted!',
    successBody: 'Your competency self-assessment has been recorded.',
    successNextSteps:
      'Your HR manager will review your responses and schedule a debrief session to discuss your competency profile.',
    questions: COMPETENCY_QUESTIONS,
    hasVideoInterview: true,
  },
  {
    id: 'mock-pers-001',
    title: 'Big Five Personality Profile 2025',
    type: 'Personality',
    typeVariant: 'success',
    roleLabel: 'Self Assessment',
    endDate: '2025-07-20T00:00:00.000Z',
    pendingStatusLabel: 'Pending',
    completedStatusLabel: 'Completed',
    pendingActionLabel: 'Start Assessment',
    completedActionLabel: 'Completed',
    successTitle: 'Profile Submitted!',
    successBody: 'Your personality profile responses have been recorded.',
    successNextSteps:
      'Your Big Five personality report will be generated and shared with your HR manager within 2 business days.',
    questions: PERSONALITY_QUESTIONS,
  },
  {
    id: 'mock-read-001',
    title: 'Leadership Readiness Assessment 2025',
    type: 'Readiness',
    typeVariant: 'neutral',
    roleLabel: 'Self Assessment',
    endDate: '2025-07-31T00:00:00.000Z',
    pendingStatusLabel: 'Pending',
    completedStatusLabel: 'Completed',
    pendingActionLabel: 'Start Assessment',
    completedActionLabel: 'Completed',
    successTitle: 'Assessment Submitted!',
    successBody: 'Your leadership readiness assessment has been recorded.',
    successNextSteps:
      'A detailed readiness report will be prepared to support your succession planning discussion with your HR team.',
    questions: READINESS_QUESTIONS,
  },
];

// ── Answer helpers ────────────────────────────────────────────────────────────

function isAnswered(q: Question, answer: Answer | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  if (q.type === 'SHORT_ANSWER') return typeof answer === 'string' && answer.trim().length > 0;
  if (q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE')
    return typeof answer === 'string' && answer.length > 0;
  if (q.type === 'MULTIPLE_CHOICE') return Array.isArray(answer) && answer.length > 0;
  if (q.type === 'TABLE') {
    const obj = answer as Record<string, string>;
    return Object.keys(obj).length === q.tableRows.length;
  }
  return false;
}

function formatAnswer(q: Question, answer: Answer): string {
  if (q.type === 'SINGLE_CHOICE') {
    return q.options.find((o) => o.id === answer)?.text ?? String(answer);
  }
  if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(answer)) {
    return answer.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(', ') || '—';
  }
  if (q.type === 'TRUE_FALSE') return answer === 'true' ? 'True' : 'False';
  if (q.type === 'TABLE' && typeof answer === 'object' && !Array.isArray(answer)) {
    const entries = Object.entries(answer as Record<string, string>);
    return entries
      .map(([ri, ci]) => `${q.tableRows[Number(ri)]}: ${q.tableColumns[Number(ci)]}`)
      .join(' · ');
  }
  return String(answer);
}

// ── Question renderers ────────────────────────────────────────────────────────

function SingleChoice({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  return (
    <div className="space-y-2.5">
      {question.options.map((opt) => {
        const selected = answer === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
              selected
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
              )}
            >
              {selected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <span className="text-sm text-gray-800">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultipleChoice({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  const selected = Array.isArray(answer) ? answer : [];
  return (
    <div className="space-y-2.5">
      {question.options.map((opt) => {
        const checked = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => {
              const next = checked
                ? selected.filter((id) => id !== opt.id)
                : [...selected, opt.id];
              onChange(next);
            }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
              checked
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
              )}
            >
              {checked && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-800">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalse({
  answer,
  onChange,
}: {
  answer: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  return (
    <div className="flex gap-4">
      {(['true', 'false'] as const).map((val) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={cn(
            'flex-1 py-4 rounded-xl border-2 text-sm font-semibold transition-all',
            answer === val
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50',
          )}
        >
          {val === 'true' ? 'True' : 'False'}
        </button>
      ))}
    </div>
  );
}

function ShortAnswer({
  answer,
  onChange,
}: {
  answer: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  return (
    <textarea
      rows={4}
      value={(answer as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer here…"
      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
    />
  );
}

function TableQuestion({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  const tableAnswer = (
    typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
  ) as Record<string, string>;

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm border-collapse min-w-[520px]">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 text-gray-400 font-medium min-w-[180px]" />
            {question.tableColumns.map((col, ci) => (
              <th
                key={ci}
                className="text-center px-3 py-2 text-xs text-gray-600 font-semibold whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {question.tableRows.map((row, ri) => {
            const rowKey = String(ri);
            return (
              <tr key={ri} className="border-t border-gray-100">
                <td className="py-3 pr-4 text-gray-800 text-sm leading-snug">{row}</td>
                {question.tableColumns.map((_, ci) => {
                  const colKey = String(ci);
                  const selected = tableAnswer[rowKey] === colKey;
                  return (
                    <td key={ci} className="text-center px-3 py-3">
                      <button
                        onClick={() => onChange({ ...tableAnswer, [rowKey]: colKey })}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all',
                          selected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300 hover:border-blue-400',
                        )}
                      >
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  if (question.type === 'SINGLE_CHOICE')
    return <SingleChoice question={question} answer={answer} onChange={onChange} />;
  if (question.type === 'MULTIPLE_CHOICE')
    return <MultipleChoice question={question} answer={answer} onChange={onChange} />;
  if (question.type === 'TRUE_FALSE')
    return <TrueFalse answer={answer} onChange={onChange} />;
  if (question.type === 'SHORT_ANSWER')
    return <ShortAnswer answer={answer} onChange={onChange} />;
  if (question.type === 'TABLE')
    return <TableQuestion question={question} answer={answer} onChange={onChange} />;
  return null;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>
          Question {current} of {total}
        </span>
        <span className="font-semibold text-blue-600">{pct}%</span>
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

// ── Video interview intro ─────────────────────────────────────────────────────

function VideoInterviewIntro({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
            <svg
              className="w-6 h-6 text-violet-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Video Interview</h2>
            <p className="text-sm text-gray-500">Communication Skills Assessment</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Great work completing the written section! The final step is a short AI-facilitated video
          interview to assess your{' '}
          <span className="font-semibold text-gray-800">communication skills</span>. The AI
          interviewer will ask you three spoken questions — respond naturally, as you would in a
          real interview.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            What to expect
          </p>
          {[
            {
              label: '3 questions',
              desc: 'Spoken questions displayed on screen by the AI interviewer',
              icon: (
                <svg
                  className="w-4 h-4 text-violet-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                  />
                </svg>
              ),
            },
            {
              label: '~2 minutes per answer',
              desc: 'Take your time — there is no strict time limit per question',
              icon: (
                <svg
                  className="w-4 h-4 text-violet-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              ),
            },
            {
              label: 'Camera & microphone required',
              desc: 'Speak directly to the camera as you would in a real interview',
              icon: (
                <svg
                  className="w-4 h-4 text-violet-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              ),
            },
          ].map(({ label, desc, icon }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                {icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5 mb-8">
          <p className="text-xs font-semibold text-blue-700 mb-2">Before you begin</p>
          <ul className="space-y-1 text-xs text-blue-700">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              Find a quiet, well-lit space with minimal background distractions
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              Position yourself so your face is clearly visible in the frame
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              Your browser will ask for camera and microphone permission — please allow both
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              Speak clearly and naturally — there are no right or wrong answers
            </li>
          </ul>
        </div>

        <button
          onClick={onBegin}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-xl py-3 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
          Begin Video Interview
        </button>
      </div>
    </div>
  );
}

// ── Video interview ───────────────────────────────────────────────────────────

function VideoInterview({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permState, setPermState] = useState<'requesting' | 'granted' | 'denied'>('requesting');
  const [permError, setPermError] = useState('');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answerPhase, setAnswerPhase] = useState<'ready' | 'recording'>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Request camera/mic — store stream in ref so we can attach it once the video element renders
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setPermState('granted');
      })
      .catch((err) => {
        if (!cancelled) {
          setPermError(
            err.name === 'NotAllowedError'
              ? 'Camera or microphone access was denied. Please allow access in your browser settings and try again.'
              : err.message,
          );
          setPermState('denied');
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      window.speechSynthesis.cancel();
    };
  }, []);

  // Attach stream to video element after it renders (permState flips to 'granted' → re-render → then this runs)
  useEffect(() => {
    if (permState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [permState]);

  // Speak each question aloud using the Web Speech API
  useEffect(() => {
    if (permState !== 'granted' || allDone) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(INTERVIEW_QUESTIONS[questionIdx].question);
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };
  }, [questionIdx, permState, allDone]);

  useEffect(() => {
    if (answerPhase !== 'recording') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [answerPhase, questionIdx]);

  const currentQ = INTERVIEW_QUESTIONS[questionIdx];
  const isLastQ = questionIdx === INTERVIEW_QUESTIONS.length - 1;

  function handleStartAnswering() {
    setElapsed(0);
    setAnswerPhase('recording');
  }

  function handleNext() {
    setAnswerPhase('ready');
    setElapsed(0);
    if (isLastQ) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setAllDone(true);
    } else {
      setQuestionIdx((i) => i + 1);
    }
  }

  if (permState === 'denied') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Camera Access Required</h3>
          <p className="text-sm text-gray-500 mb-6">{permError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-6 py-2.5 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (permState === 'requesting') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg
              className="w-7 h-7 text-violet-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Requesting camera &amp; microphone access
          </h3>
          <p className="text-sm text-gray-500">
            Please allow access when prompted by your browser.
          </p>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Interview Complete</h3>
          <p className="text-sm text-gray-500 mb-8">
            You've answered all {INTERVIEW_QUESTIONS.length} interview questions. Your responses
            have been captured.
          </p>
          <button
            onClick={onComplete}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl py-3 transition-colors"
          >
            Submit Full Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-sm font-semibold text-gray-700">AI Video Interview</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">
          Question {questionIdx + 1} of {INTERVIEW_QUESTIONS.length}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all',
            isSpeaking ? 'bg-violet-600 shadow-lg shadow-violet-300 animate-pulse' : 'bg-violet-100',
          )}>
            <svg
              className={cn('w-4 h-4 transition-colors', isSpeaking ? 'text-white' : 'text-violet-600')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-violet-600">AI Interviewer</p>
              {isSpeaking && (
                <span className="inline-flex items-center gap-1 text-xs text-violet-500">
                  <span className="flex gap-0.5">
                    <span className="w-0.5 h-3 bg-violet-400 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" />
                    <span className="w-0.5 h-3 bg-violet-400 rounded-full animate-[bounce_0.6s_ease-in-out_0.15s_infinite]" />
                    <span className="w-0.5 h-3 bg-violet-400 rounded-full animate-[bounce_0.6s_ease-in-out_0.3s_infinite]" />
                  </span>
                  Speaking…
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-900 leading-relaxed">
              {currentQ.question}
            </p>
            <p className="text-xs text-gray-400 italic mt-1.5">{currentQ.hint}</p>
          </div>
        </div>
      </div>

      <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {answerPhase === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-semibold tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <span className="text-white/50 text-xs font-medium">You</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4">
        {answerPhase === 'ready' ? (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg
                className="w-3.5 h-3.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500 truncate">
              Press <span className="font-medium text-gray-700">Start Answering</span> when you're
              ready
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 animate-pulse">
              <svg
                className="w-3.5 h-3.5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Recording</p>
              <p className="text-xs text-gray-400 tabular-nums">{formatElapsed(elapsed)} elapsed</p>
            </div>
          </div>
        )}

        {answerPhase === 'ready' ? (
          <button
            onClick={handleStartAnswering}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors flex items-center gap-2 shrink-0"
          >
            <div className="w-2 h-2 rounded-full bg-white" />
            Start Answering
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors shrink-0"
          >
            {isLastQ ? 'Finish Interview' : 'Next Question'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Assessment form ───────────────────────────────────────────────────────────

type FormStep = 'questions' | 'interview-intro' | 'interview';

function AssessmentForm({
  assessment,
  onComplete,
}: {
  assessment: MockAssessmentItem;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<FormStep>('questions');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (step === 'interview-intro') {
    return <VideoInterviewIntro onBegin={() => setStep('interview')} />;
  }

  if (step === 'interview') {
    return <VideoInterview onComplete={onComplete} />;
  }

  const questions = assessment.questions;
  const total = questions.length;
  const current = questions[idx];
  const isLast = idx === total - 1;
  const canProceed = current ? isAnswered(current, answers[current.id]) : false;

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      if (assessment.hasVideoInterview) {
        setStep('interview-intro');
      } else {
        onComplete();
      }
    }, 1200);
  }

  if (reviewing) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Submit</h2>
          <p className="text-sm text-gray-500 mb-6">
            Check your answers
            {assessment.subject && (
              <>
                {' '}
                for{' '}
                <span className="font-medium text-gray-800">{assessment.subject}</span>
              </>
            )}{' '}
            before submitting.
          </p>

          <div className="space-y-3 mb-6">
            {questions.map((q, i) => (
              <div key={q.id} className="py-3 border-b border-gray-100 last:border-0">
                <p className="text-xs text-gray-400 mb-0.5">Q{i + 1}</p>
                <p className="text-sm font-medium text-gray-800 mb-1.5 leading-snug">{q.title}</p>
                {answers[q.id] !== undefined ? (
                  q.type === 'TABLE' ? (
                    <div className="space-y-1">
                      {q.tableRows.map((row, ri) => {
                        const colIdx = (answers[q.id] as Record<string, string>)[String(ri)];
                        return (
                          <div key={ri} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-600">{row}</span>
                            {colIdx !== undefined ? (
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {q.tableColumns[Number(colIdx)]}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Not rated</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-blue-700">{formatAnswer(q, answers[q.id])}</p>
                  )
                ) : (
                  <span className="text-xs text-gray-400 italic">No answer</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setReviewing(false);
                setIdx(total - 1);
              }}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Submitting…
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const typeLabel: Record<QuestionType, string> = {
    TABLE: 'Table',
    SINGLE_CHOICE: 'Single Choice',
    MULTIPLE_CHOICE: 'Multiple Choice',
    TRUE_FALSE: 'True / False',
    SHORT_ANSWER: 'Short Answer',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{assessment.title}</p>
          <p className="text-xs text-gray-500">
            {assessment.subject
              ? `Giving feedback for ${assessment.subject}`
              : assessment.roleLabel}
          </p>
        </div>
      </div>

      <ProgressBar current={idx + 1} total={total} />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Q{idx + 1}
          </span>
          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {typeLabel[current.type]}
          </span>
          {current.required && (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
              Required
            </span>
          )}
        </div>

        <h2 className="text-base font-semibold text-gray-900 mb-6 leading-snug">
          {current.title}
        </h2>

        <QuestionCard
          question={current}
          answer={answers[current.id]}
          onChange={(val) => setAnswers((prev) => ({ ...prev, [current.id]: val }))}
        />

        <div className="flex justify-between pt-6 mt-6 border-t border-gray-100">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (isLast) setReviewing(true);
              else setIdx((i) => i + 1);
            }}
            disabled={current.required && !canProceed}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {isLast ? 'Review & Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  assessment,
  onBack,
}: {
  assessment: MockAssessmentItem;
  onBack: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto mt-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{assessment.successTitle}</h2>
        {assessment.subject && (
          <p className="text-sm text-gray-500 mb-1">
            Thank you for completing your feedback for{' '}
            <span className="font-medium text-gray-700">{assessment.subject}</span>.
          </p>
        )}
        <p className="text-sm text-gray-400 mb-8">{assessment.successBody}</p>

        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800">What happens next?</p>
              <p className="text-xs text-green-700 mt-1 leading-relaxed">
                {assessment.successNextSteps}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onBack}
          className="w-full border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to My Assessments
        </button>
      </div>
    </div>
  );
}

// ── Assessment card ───────────────────────────────────────────────────────────

function AssessmentCard({
  assessment,
  completed,
  onStart,
}: {
  assessment: MockAssessmentItem;
  completed: boolean;
  onStart: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {completed ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {assessment.completedStatusLabel}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                {assessment.pendingStatusLabel}
              </span>
            )}
            <Badge variant={assessment.typeVariant}>{assessment.type}</Badge>
            <Badge variant="neutral">{assessment.roleLabel}</Badge>
          </div>

          <h3 className="text-base font-semibold text-gray-900">{assessment.title}</h3>
          {assessment.subject && (
            <p className="text-xs text-gray-500 mt-0.5">
              Feedback for{' '}
              <span className="font-medium text-gray-700">{assessment.subject}</span>
            </p>
          )}

          <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Due {format(new Date(assessment.endDate), 'dd MMM yyyy')}
          </p>
        </div>

        <div className="shrink-0">
          <button
            onClick={onStart}
            disabled={completed}
            className={
              completed
                ? 'border border-gray-200 text-gray-500 text-sm font-semibold rounded-xl px-5 py-2.5 opacity-60 cursor-not-allowed whitespace-nowrap'
                : 'bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all whitespace-nowrap'
            }
          >
            {completed ? assessment.completedActionLabel : assessment.pendingActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = 'list' | 'take' | 'success';

export default function MyAssessmentsPage() {
  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const selectedAssessment = MOCK_ASSESSMENTS.find((a) => a.id === selectedId);

  function handleStart(id: string) {
    setSelectedId(id);
    setView('take');
  }

  function handleComplete() {
    if (selectedId) {
      setCompletedIds((prev) => new Set(prev).add(selectedId));
    }
    setView('success');
  }

  function handleBack() {
    setSelectedId(null);
    setView('list');
  }

  if (view === 'take' && selectedAssessment) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            My Assessments
          </button>
        </div>
        <AssessmentForm assessment={selectedAssessment} onComplete={handleComplete} />
      </div>
    );
  }

  if (view === 'success' && selectedAssessment) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">My Assessments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete your pending assessments</p>
        </div>
        <SuccessScreen assessment={selectedAssessment} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Assessments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete your pending assessments</p>
      </div>

      <div className="space-y-4">
        {MOCK_ASSESSMENTS.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            assessment={assessment}
            completed={completedIds.has(assessment.id)}
            onStart={() => handleStart(assessment.id)}
          />
        ))}
      </div>
    </div>
  );
}
