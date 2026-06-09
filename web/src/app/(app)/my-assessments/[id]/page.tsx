'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { AssessmentDto, AssessmentType } from '@leaderprism/shared';

const TypeIcon360 = () => (
  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
  </svg>
);
const TypeIconCompetency = () => (
  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);
const TypeIconPersonality = () => (
  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);
const TypeIconReadiness = () => (
  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);

const TYPE_META: Record<
  AssessmentType,
  { label: string; icon: React.ReactNode; description: string; participantAction: string }
> = {
  [AssessmentType.FEEDBACK_360]: {
    label: '360° Feedback',
    icon: <TypeIcon360 />,
    description:
      'Rate your own leadership behaviours across competency areas. For each competency, select the proficiency level that best reflects your current performance and optionally provide supporting evidence. Your results will be grouped by domain.',
    participantAction: 'Start Assessment',
  },
  [AssessmentType.COMPETENCY]: {
    label: 'Competency Assessment',
    icon: <TypeIconCompetency />,
    description:
      'Rate your own proficiency across defined leadership competencies. For each competency you will select a proficiency level and optionally provide evidence or examples from your work.',
    participantAction: 'Start Self-Assessment',
  },
  [AssessmentType.PERSONALITY]: {
    label: 'Personality Assessment',
    icon: <TypeIconPersonality />,
    description:
      'Complete a validated Big Five psychometric questionnaire. Each item asks how strongly you agree with a behavioural statement. There are no right or wrong answers — answer honestly for the most accurate profile.',
    participantAction: 'Start Questionnaire',
  },
  [AssessmentType.READINESS]: {
    label: 'Readiness Assessment',
    icon: <TypeIconReadiness />,
    description:
      'This assessment has two sections: a Situational Judgement Test (SJT) where you choose the best response to leadership scenarios, followed by a Learning Agility questionnaire measuring your adaptability and growth mindset.',
    participantAction: 'Start Assessment',
  },
};

interface AssessmentParticipant {
  id: string;
  userId: string;
  status: string;
}

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const currentUser = useAuthStore((s) => s.user);

  const { data: assessment, isLoading: loadingAssessment } =
    useApi<AssessmentDto>(`/assessments/${id}`);

  const { data: participants, isLoading: loadingParticipants } =
    useApi<AssessmentParticipant[]>(assessment ? `/assessments/${id}/participants` : null);

  const myRecord = participants?.find((p) => p.userId === currentUser?.id);
  const participantStatus = myRecord?.status ?? 'not_started';

  const loading = loadingAssessment || loadingParticipants;

  if (loading) return <PageSpinner />;

  if (!assessment) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Assessment not found.
        </div>
      </div>
    );
  }

  const meta = TYPE_META[assessment.assessmentType];
  const isCompleted = participantStatus === 'completed';
  const isInProgress = participantStatus === 'in_progress';
  const canViewResults = isCompleted && assessment.assessmentType === AssessmentType.PERSONALITY;

  const isFutureStart = (() => {
    if (!assessment.startDate) return false;
    const start = new Date(assessment.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return start > today;
  })();

  function getCtaLabel() {
    if (canViewResults) return 'View My Results';
    if (isCompleted) return 'Assessment Completed';
    if (isInProgress) return 'Continue Assessment';
    if (isFutureStart && assessment?.startDate)
      return `Available from ${format(new Date(assessment.startDate), 'dd MMM yyyy')}`;
    return meta.participantAction;
  }

  function handleCta() {
    if (canViewResults) {
      router.push(`/my-assessments/${id}/results`);
    } else {
      router.push(`/my-assessments/${id}/take`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* Back nav */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/my-assessments')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          My Assessments
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-4">
        <div className="flex items-start gap-4">
          <div className="text-4xl shrink-0">{meta.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="info">{meta.label}</Badge>
              {isCompleted && <Badge variant="success">Completed</Badge>}
              {isInProgress && <Badge variant="warning">In Progress</Badge>}
              {!isCompleted && !isInProgress && <Badge variant="neutral">Not Started</Badge>}
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{assessment.title}</h1>
            {isFutureStart && assessment.startDate && (
              <p className="text-sm text-orange-500 mt-1 font-medium">
                Opens: {format(new Date(assessment.startDate), 'dd MMM yyyy')}
              </p>
            )}
            {assessment.endDate && (
              <p className="text-sm text-gray-500 mt-1">
                Due: {format(new Date(assessment.endDate), 'dd MMM yyyy')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* What to expect */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          What to expect
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{meta.description}</p>
      </div>

      {/* CTA */}
      <button
        onClick={handleCta}
        disabled={(isCompleted && !canViewResults) || isFutureStart}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl py-3.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getCtaLabel()}
      </button>
    </div>
  );
}
