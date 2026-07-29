'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AssessmentDto, AssessmentStatus, AssessmentType } from '@leaderprism/shared';
import { api } from '@/lib/api';

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

// Mock data
// const MOCK_ASSESSMENTS: AssessmentDto[] = [
//   {
//     id: '1',
//     organisationId: 'org-demo',
//     title: 'Annual Leadership 360° Review 2025',
//     assessmentType: AssessmentType.FEEDBACK_360,
//     status: AssessmentStatus.ACTIVE,
//     config: {},
//     startDate: '2025-05-01T00:00:00.000Z',
//     endDate: '2025-07-31T00:00:00.000Z',
//     createdAt: '2025-04-15T00:00:00.000Z',
//   },
//   {
//     id: '2',
//     organisationId: 'org-demo',
//     title: 'Q2 Leadership Competency Assessment',
//     assessmentType: AssessmentType.COMPETENCY,
//     status: AssessmentStatus.DRAFT,
//     config: {},
//     startDate: '2025-06-01T00:00:00.000Z',
//     endDate: '2025-08-31T00:00:00.000Z',
//     createdAt: '2025-05-20T00:00:00.000Z',
//   },
//   {
//     id: '3',
//     organisationId: 'org-demo',
//     title: 'Big Five Personality Profiling — Cohort 2025',
//     assessmentType: AssessmentType.PERSONALITY,
//     status: AssessmentStatus.CLOSED,
//     config: {},
//     startDate: '2025-03-01T00:00:00.000Z',
//     endDate: '2025-04-30T00:00:00.000Z',
//     createdAt: '2025-02-15T00:00:00.000Z',
//   },
//   {
//     id: '4',
//     organisationId: 'org-demo',
//     title: 'Leadership Readiness Assessment Q3 2025',
//     assessmentType: AssessmentType.READINESS,
//     status: AssessmentStatus.ACTIVE,
//     config: {},
//     startDate: '2025-06-15T00:00:00.000Z',
//     endDate: '2025-09-30T00:00:00.000Z',
//     createdAt: '2025-06-01T00:00:00.000Z',
//   },
// ];


const PAGE_SIZE = 9;

type AssessmentListResponse = {
  data: { data: AssessmentDto[]; total: number; page: number; limit: number };
};

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentDto[]>([]);
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tabCounts, setTabCounts] = useState<Record<FilterTab, number>>({
    all: 0,
    [AssessmentStatus.ACTIVE]: 0,
    [AssessmentStatus.DRAFT]: 0,
    [AssessmentStatus.CLOSED]: 0,
    [AssessmentStatus.ARCHIVED]: 0,
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: AssessmentStatus.ACTIVE, label: 'Active' },
    { key: AssessmentStatus.DRAFT, label: 'Draft' },
    { key: AssessmentStatus.CLOSED, label: 'Closed' },
  ];

  function handleFilterChange(next: FilterTab) {
    setFilter(next);
    setPage(1);
  }

  // Fetch the current page of assessments whenever the filter or page changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (filter !== 'all') params.status = filter;

      const res = await api.get<AssessmentListResponse>('/assessments', { params });
      if (cancelled) return;
      setAssessments(res.data.data.data);
      setTotal(res.data.data.total);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  // Fetch per-tab counts once, independent of the current page
  useEffect(() => {
    (async () => {
      const statuses = tabs.map((t) => t.key);
      const results = await Promise.all(
        statuses.map((status) =>
          api.get<AssessmentListResponse>('/assessments', {
            params: { page: 1, limit: 1, ...(status !== 'all' ? { status } : {}) },
          }),
        ),
      );
      setTabCounts((prev) => {
        const next = { ...prev };
        statuses.forEach((status, i) => {
          next[status] = results[i].data.data.total;
        });
        return next;
      });
    })();
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                filter === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {!loading && assessments.length === 0 && (
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

      {assessments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assessments.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              onView={() => router.push(`/assessments/${assessment.id}`)}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
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
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-4 cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-3">
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
