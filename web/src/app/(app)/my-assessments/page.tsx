'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AssessmentDto, AssessmentType } from '@leaderprism/shared';

const TYPE_LABELS: Record<AssessmentType, string> = {
  [AssessmentType.FEEDBACK_360]: '360° Feedback',
  [AssessmentType.COMPETENCY]: 'Competency',
  [AssessmentType.PERSONALITY]: 'Personality',
  [AssessmentType.READINESS]: 'Readiness',
};

interface ParticipantAssessment extends AssessmentDto {
  participantStatus?: 'not_started' | 'in_progress' | 'completed';
  completionPercentage?: number;
}

export default function MyAssessmentsPage() {
  const router = useRouter();
  const { data: assessments, error, isLoading } =
    useApi<ParticipantAssessment[]>('/assessments/mine');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Assessments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete your pending assessments</p>
      </div>

      {isLoading && <PageSpinner />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load your assessments. Please refresh to try again.
        </div>
      )}

      {!isLoading && !error && (!assessments || assessments.length === 0) && (
        <EmptyState
          title="No assessments assigned"
          description="You have no assessments to complete at the moment. Check back later."
        />
      )}

      {!isLoading && assessments && assessments.length > 0 && (
        <div className="space-y-4">
          {assessments.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              onStart={() => router.push(`/my-assessments/${assessment.id}/take`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssessmentCard({
  assessment,
  onStart,
}: {
  assessment: ParticipantAssessment;
  onStart: () => void;
}) {
  const status = assessment.participantStatus ?? 'not_started';
  const completion = assessment.completionPercentage ?? 0;

  function getCtaLabel() {
    if (status === 'completed') return 'View Results';
    if (status === 'in_progress') return 'Continue';
    return 'Start Assessment';
  }

  function getCtaVariant() {
    if (status === 'completed') return 'secondary';
    return 'primary';
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="info">{TYPE_LABELS[assessment.assessmentType]}</Badge>
            {status === 'completed' && <Badge variant="success">Completed</Badge>}
            {status === 'in_progress' && <Badge variant="warning">In Progress</Badge>}
            {status === 'not_started' && <Badge variant="neutral">Not Started</Badge>}
          </div>

          <h3 className="text-base font-semibold text-gray-900 truncate">{assessment.title}</h3>

          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
            {assessment.endDate && (
              <p>Due: {format(new Date(assessment.endDate), 'dd MMM yyyy')}</p>
            )}
          </div>

          {status === 'in_progress' && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{completion}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <button
            onClick={onStart}
            disabled={status === 'completed'}
            className={
              getCtaVariant() === 'primary'
                ? 'bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap'
                : 'border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-5 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap'
            }
          >
            {getCtaLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
