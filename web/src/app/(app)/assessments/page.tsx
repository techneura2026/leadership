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
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and monitor all assessments</p>
        </div>
        <button
          onClick={() => router.push('/assessments/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Assessment
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {tabs.map((tab) => {
          const count = tab.key !== 'all' && assessments
            ? assessments.filter((a) => a.status === tab.key).length
            : null;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                filter === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {count !== null && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
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

const TYPE_GRADIENTS: Record<AssessmentType, string> = {
  [AssessmentType.FEEDBACK_360]: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  [AssessmentType.COMPETENCY]: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
  [AssessmentType.PERSONALITY]: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
  [AssessmentType.READINESS]: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
};

function AssessmentCard({
  assessment,
  onView,
}: {
  assessment: AssessmentDto;
  onView: () => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-4 cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ background: TYPE_GRADIENTS[assessment.assessmentType] }}
        >
          {TYPE_LABELS[assessment.assessmentType].slice(0, 2)}
        </div>
        <Badge variant={STATUS_VARIANT[assessment.status]}>
          {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
        </Badge>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1.5">
          {assessment.title}
        </h3>
        <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-50 rounded-full px-2.5 py-1">
          {TYPE_LABELS[assessment.assessmentType]}
        </span>
      </div>

      <div className="text-xs text-gray-400 space-y-1 pt-1 border-t border-gray-50">
        {assessment.endDate && (
          <p className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Due {format(new Date(assessment.endDate), 'dd MMM yyyy')}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          Created {format(new Date(assessment.createdAt), 'dd MMM yyyy')}
        </p>
      </div>

      <div className="flex items-center justify-end">
        <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors flex items-center gap-1">
          View details
          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
