'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AssessmentDto, AssessmentStatus, AssessmentType } from '@leaderprism/shared';

type FilterTab = 'all' | AssessmentStatus;

const TYPE_LABELS: Record<AssessmentType, string> = {
  [AssessmentType.FEEDBACK_360]: '360°',
  [AssessmentType.COMPETENCY]: 'Competency',
  [AssessmentType.PERSONALITY]: 'Personality',
  [AssessmentType.READINESS]: 'Readiness',
};

const STATUS_VARIANT: Record<AssessmentStatus, 'neutral' | 'success' | 'info' | 'warning'> = {
  [AssessmentStatus.DRAFT]: 'neutral',
  [AssessmentStatus.ACTIVE]: 'success',
  [AssessmentStatus.CLOSED]: 'info',
  [AssessmentStatus.ARCHIVED]: 'neutral',
};

export default function AssessmentsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');
  const { data: assessmentsResult, error, isLoading } = useApi<{ data: AssessmentDto[] }>('/assessments');
  const assessments = assessmentsResult?.data;

  const filtered =
    assessments?.filter((a) => filter === 'all' || a.status === filter) ?? [];

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: AssessmentStatus.ACTIVE, label: 'Active' },
    { key: AssessmentStatus.DRAFT, label: 'Draft' },
    { key: AssessmentStatus.CLOSED, label: 'Closed' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assessments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and monitor all assessments</p>
        </div>
        <button
          onClick={() => router.push('/assessments/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Assessment
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && assessments && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
                {assessments.filter((a) => a.status === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <PageSpinner />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load assessments. Please try again.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title="No assessments found"
          description={
            filter === 'all'
              ? 'Create your first assessment to get started.'
              : `No ${filter} assessments at the moment.`
          }
          ctaLabel={filter === 'all' ? 'Create Assessment' : undefined}
          onCta={filter === 'all' ? () => router.push('/assessments/new') : undefined}
        />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              onView={() => router.push(`/assessments/${assessment.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssessmentCard({
  assessment,
  onView,
}: {
  assessment: AssessmentDto;
  onView: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug flex-1">
          {assessment.title}
        </h3>
        <Badge variant={STATUS_VARIANT[assessment.status]}>
          {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="info">{TYPE_LABELS[assessment.assessmentType]}</Badge>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        {assessment.startDate && (
          <p>
            Start: {format(new Date(assessment.startDate), 'dd MMM yyyy')}
          </p>
        )}
        {assessment.endDate && (
          <p>
            End: {format(new Date(assessment.endDate), 'dd MMM yyyy')}
          </p>
        )}
        <p>Created: {format(new Date(assessment.createdAt), 'dd MMM yyyy')}</p>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={onView}
          className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors"
        >
          View →
        </button>
      </div>
    </div>
  );
}
