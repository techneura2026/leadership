'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { TYPE_META, ALL_ASSESSMENT_TYPES } from '@/lib/assessmentTypeMeta';
import { AssessmentDto, AssessmentStatus, AssessmentType } from '@leaderprism/shared';
import { api } from '@/lib/api';

type FilterTab = 'all' | AssessmentStatus;

const ALL_TYPES = ALL_ASSESSMENT_TYPES;

const STATUS_VARIANT: Record<AssessmentStatus, 'neutral' | 'success' | 'info' | 'warning'> = {
  [AssessmentStatus.DRAFT]: 'neutral',
  [AssessmentStatus.ACTIVE]: 'success',
  [AssessmentStatus.CLOSED]: 'info',
  [AssessmentStatus.ARCHIVED]: 'neutral',
};

const PAGE_SIZE = 9;

type AssessmentListResponse = {
  data: { data: AssessmentDto[]; total: number; page: number; limit: number };
};

// ── Category Card ─────────────────────────────────────────────────────────────

function CategoryCard({
  type,
  count,
  active,
  onClick,
}: {
  type: AssessmentType;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left bg-white rounded-2xl border p-5 transition-all duration-200 flex flex-col gap-4',
        active
          ? 'border-transparent shadow-md -translate-y-0.5'
          : 'border-gray-100 hover:shadow-md hover:-translate-y-0.5',
      )}
      style={active ? { boxShadow: `0 0 0 2px ${meta.ring}, 0 8px 20px -6px ${meta.glow}` } : undefined}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: meta.gradient, boxShadow: `0 4px 14px ${meta.glow}` }}
        >
          <Icon className="w-6 h-6 text-white" strokeWidth={1.75} />
        </div>
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{count}</span>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{meta.label}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{meta.tagline}</p>
      </div>
    </button>
  );
}

// ── Assessment Card ───────────────────────────────────────────────────────────

function AssessmentCard({
  assessment,
  onView,
}: {
  assessment: AssessmentDto;
  onView: () => void;
}) {
  const meta = TYPE_META[assessment.assessmentType];
  const Icon = meta.icon;

  return (
    <div
      className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-4 cursor-pointer group"
      onClick={onView}
    >
      <span className="absolute top-0 left-0 right-0 h-1" style={{ background: meta.gradient }} />

      <div className="p-5 pb-0 flex items-start justify-between gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: meta.gradient, boxShadow: `0 4px 12px ${meta.glow}` }}
        >
          <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        <Badge variant={STATUS_VARIANT[assessment.status]}>
          {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
        </Badge>
      </div>

      <div className="px-5">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-2">
          {assessment.title}
        </h3>
        <span className={cn('inline-flex items-center text-xs font-medium rounded-full px-2.5 py-1 border', meta.chip)}>
          {meta.label}
        </span>
      </div>

      <div className="px-5 text-xs text-gray-400 space-y-1.5 pt-3 border-t border-gray-50">
        {assessment.endDate && (
          <p className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
            Due {format(new Date(assessment.endDate), 'dd MMM yyyy')}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" strokeWidth={2} />
          Created {format(new Date(assessment.createdAt), 'dd MMM yyyy')}
        </p>
      </div>

      <div className="px-5 pb-5 flex items-center justify-end">
        <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors flex items-center gap-1">
          View details
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentDto[]>([]);
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [typeFilter, setTypeFilter] = useState<AssessmentType | null>(null);
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
  const [typeCounts, setTypeCounts] = useState<Record<AssessmentType, number>>({
    [AssessmentType.FEEDBACK_360]: 0,
    [AssessmentType.COMPETENCY]: 0,
    [AssessmentType.PERSONALITY]: 0,
    [AssessmentType.READINESS]: 0,
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

  function handleTypeChange(type: AssessmentType) {
    setTypeFilter((prev) => (prev === type ? null : type));
    setPage(1);
  }

  // Fetch the current page of assessments whenever the filters or page change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (filter !== 'all') params.status = filter;
      if (typeFilter) params.assessmentType = typeFilter;

      const res = await api.get<AssessmentListResponse>('/assessments', { params });
      if (cancelled) return;
      setAssessments(res.data.data.data);
      setTotal(res.data.data.total);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, typeFilter, page]);

  // Fetch per-tab and per-type counts once, independent of the current page
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

      const typeResults = await Promise.all(
        ALL_TYPES.map((type) =>
          api.get<AssessmentListResponse>('/assessments', {
            params: { page: 1, limit: 1, assessmentType: type },
          }),
        ),
      );
      setTypeCounts((prev) => {
        const next = { ...prev };
        ALL_TYPES.forEach((type, i) => {
          next[type] = typeResults[i].data.data.total;
        });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and monitor all assessments</p>
        </div>
        <button
          onClick={() => router.push('/assessments/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Create Assessment
        </button>
      </div>

      {/* Category cards — the 4 assessment use cases */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {ALL_TYPES.map((type) => (
          <CategoryCard
            key={type}
            type={type}
            count={typeCounts[type]}
            active={typeFilter === type}
            onClick={() => handleTypeChange(type)}
          />
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {tabs.map((tab) => {
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                filter === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
              )}>
                {count}
              </span>
            </button>
          );
        })}

        {typeFilter && (
          <button
            onClick={() => { setTypeFilter(null); setPage(1); }}
            className={cn('ml-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border', TYPE_META[typeFilter].chip)}
          >
            {TYPE_META[typeFilter].label}
            <span className="text-current opacity-60">✕</span>
          </button>
        )}
      </div>

      {!loading && assessments.length === 0 && (
        <EmptyState
          title="No assessments found"
          description={
            filter === 'all' && !typeFilter
              ? 'Create your first assessment to get started.'
              : 'No assessments match the current filters.'
          }
          ctaLabel={filter === 'all' && !typeFilter ? 'Create Assessment' : undefined}
          onCta={filter === 'all' && !typeFilter ? () => router.push('/assessments/new') : undefined}
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
