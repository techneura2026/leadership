'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { AssessmentDto, AssessmentType } from '@leaderprism/shared';

const TYPE_META: Record<
  AssessmentType,
  { label: string; icon: string; description: string; participantAction: string }
> = {
  [AssessmentType.FEEDBACK_360]: {
    label: '360° Feedback',
    icon: '🔄',
    description:
      'Rate your own leadership behaviours across competency areas. For each competency, select the proficiency level that best reflects your current performance and optionally provide supporting evidence. Your results will be grouped by domain.',
    participantAction: 'Start Assessment',
  },
  [AssessmentType.COMPETENCY]: {
    label: 'Competency Assessment',
    icon: '📊',
    description:
      'Rate your own proficiency across defined leadership competencies. For each competency you will select a proficiency level and optionally provide evidence or examples from your work.',
    participantAction: 'Start Self-Assessment',
  },
  [AssessmentType.PERSONALITY]: {
    label: 'Personality Assessment',
    icon: '🧠',
    description:
      'Complete a validated Big Five psychometric questionnaire. Each item asks how strongly you agree with a behavioural statement. There are no right or wrong answers — answer honestly for the most accurate profile.',
    participantAction: 'Start Questionnaire',
  },
  [AssessmentType.READINESS]: {
    label: 'Readiness Assessment',
    icon: '🎯',
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

  function getCtaLabel() {
    if (canViewResults) return 'View My Results';
    if (isCompleted) return 'Assessment Completed';
    if (isInProgress) return 'Continue Assessment';
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
        disabled={isCompleted && !canViewResults}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl py-3.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getCtaLabel()}
      </button>
    </div>
  );
}
