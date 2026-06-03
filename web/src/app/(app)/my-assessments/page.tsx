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
          {assessments.map((assessment) => {
            const isCompleted = assessment.participantStatus === 'completed';
            const canViewResults = isCompleted && assessment.assessmentType === AssessmentType.PERSONALITY;
            return (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                onStart={() => router.push(`/my-assessments/${assessment.id}`)}
                resultsEnabled={canViewResults}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssessmentCard({
  assessment,
  onStart,
  resultsEnabled = false,
}: {
  assessment: ParticipantAssessment;
  onStart: () => void;
  resultsEnabled?: boolean;
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

  const statusConfig = {
    completed: { label: 'Completed', color: 'text-green-600', bg: 'bg-green-50' },
    in_progress: { label: 'In Progress', color: 'text-amber-600', bg: 'bg-amber-50' },
    not_started: { label: 'Not Started', color: 'text-slate-500', bg: 'bg-slate-50' },
  };
  const cfg = statusConfig[status] ?? statusConfig.not_started;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
              {status === 'completed' && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {status === 'in_progress' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
              {cfg.label}
            </span>
            <Badge variant="info">{TYPE_LABELS[assessment.assessmentType]}</Badge>
          </div>

          <h3 className="text-base font-semibold text-gray-900 truncate">{assessment.title}</h3>

          {assessment.endDate && (
            <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Due {format(new Date(assessment.endDate), 'dd MMM yyyy')}
            </p>
          )}

          {status === 'in_progress' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>Progress</span>
                <span className="font-semibold text-blue-600">{completion}%</span>
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
            disabled={status === 'completed' && !resultsEnabled}
            className={
              getCtaVariant() === 'primary'
                ? 'bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all disabled:opacity-50 whitespace-nowrap'
                : 'border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl px-5 py-2.5 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 whitespace-nowrap'
            }
          >
            {getCtaLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
