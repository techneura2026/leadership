'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { AssessmentDto, AssessmentType } from '@leaderprism/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyAssessmentItem extends AssessmentDto {
  participantStatus: 'invited' | 'in_progress' | 'completed' | 'withdrawn' | 'not_started';
  completionPercentage: number;
  isRater?: boolean;
  raterToken?: string;
  nominationStatus?: 'approved' | 'sent' | 'completed';
  selfRaterToken?: string;
  selfNominationStatus?: 'pending' | 'approved' | 'sent' | 'completed' | 'declined';
}

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TYPE_LABELS: Record<AssessmentType, string> = {
  [AssessmentType.FEEDBACK_360]: '360°',
  [AssessmentType.COMPETENCY]: 'Competency',
  [AssessmentType.PERSONALITY]: 'Personality',
  [AssessmentType.READINESS]: 'Readiness',
};

// ── Card state mapping ────────────────────────────────────────────────────────

function getCardMeta(item: MyAssessmentItem): {
  statusLabel: string;
  badgeVariant: BadgeVariant;
  buttonLabel: string;
  href: string | null;
} {
  if (item.isRater) {
    if (item.nominationStatus === 'completed') {
      return { statusLabel: 'Feedback Given', badgeVariant: 'success', buttonLabel: 'Feedback Given', href: null };
    }
    return {
      statusLabel: 'Feedback Requested',
      badgeVariant: 'info',
      buttonLabel: 'Give Feedback',
      href: `/rater/${item.raterToken}`,
    };
  }

  // 360 assessments: the reviewee's own "self" rating is captured via the same
  // rater-response flow as peers/supervisors (see EngineService.findMine), not a
  // separate self-assessment form — route there directly when a self nomination exists.
  if (item.assessmentType === AssessmentType.FEEDBACK_360 && item.selfRaterToken) {
    if (item.selfNominationStatus === 'completed') {
      return { statusLabel: 'Self-Rating Given', badgeVariant: 'success', buttonLabel: 'Self-Rating Given', href: null };
    }
    return {
      statusLabel: 'Self-Rating Requested',
      badgeVariant: 'info',
      buttonLabel: 'Rate Yourself',
      href: `/rater/${item.selfRaterToken}`,
    };
  }

  switch (item.participantStatus) {
    case 'completed':
      return { statusLabel: 'Completed', badgeVariant: 'success', buttonLabel: 'View', href: `/my-assessments/${item.id}` };
    case 'in_progress':
      return { statusLabel: 'In Progress', badgeVariant: 'warning', buttonLabel: 'Continue', href: `/my-assessments/${item.id}` };
    case 'withdrawn':
      return { statusLabel: 'Withdrawn', badgeVariant: 'neutral', buttonLabel: 'View', href: `/my-assessments/${item.id}` };
    default:
      return { statusLabel: 'Not Started', badgeVariant: 'neutral', buttonLabel: 'Start Assessment', href: `/my-assessments/${item.id}` };
  }
}

// ── Card ──────────────────────────────────────────────────────────────────────

function MyAssessmentCard({ item }: { item: MyAssessmentItem }) {
  const meta = getCardMeta(item);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant={meta.badgeVariant}>{meta.statusLabel}</Badge>
          <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-50 rounded-full px-2.5 py-1">
            {TYPE_LABELS[item.assessmentType]}
          </span>
          {item.isRater && <Badge variant="neutral">Giving Feedback</Badge>}
        </div>

        <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>

        {item.endDate && (
          <p className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Due {format(new Date(item.endDate), 'dd MMM yyyy')}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {meta.href ? (
          <Link
            href={meta.href}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all whitespace-nowrap"
          >
            {meta.buttonLabel}
          </Link>
        ) : (
          <span className="inline-block border border-gray-200 text-gray-500 text-sm font-semibold rounded-xl px-5 py-2.5 opacity-60 cursor-not-allowed whitespace-nowrap">
            {meta.buttonLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyAssessmentsPage() {
  const { data: items, isLoading } = useApi<MyAssessmentItem[]>('/assessments/mine');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Assessments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete your pending assessments</p>
      </div>

      {isLoading && <PageSpinner />}

      {!isLoading && (!items || items.length === 0) && (
        <EmptyState
          title="No assessments assigned"
          description="You don't have any active assessments or feedback requests right now."
        />
      )}

      {!isLoading && items && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <MyAssessmentCard key={item.isRater ? item.raterToken : item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
