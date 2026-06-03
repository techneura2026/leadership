'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { RadarChart, RadarAxis } from '@/components/ui/RadarChart';
import { useAuthStore } from '@/store/auth.store';
import { useState } from 'react';
import { AssessmentDto, AssessmentStatus, AssessmentType, UserRole } from '@leaderprism/shared';

interface DashboardMetrics {
  activeAssessments: number;
  totalParticipants: number;
  pendingResponses: number;
  reportsGenerated: number;
  recentAssessments: AssessmentDto[];
}

interface RadarAggregate {
  competencyRadar: RadarAxis[];
  personalityRadar: RadarAxis[];
}

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

// ── Shared Radar View ────────────────────────────────────────────────────────

function RadarViews({ radarData, title }: { radarData: RadarAggregate; title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-8 hover:shadow-md transition-shadow">
      <h2 className="text-xl font-bold text-gray-900 mb-8">{title}</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 sm:gap-14">
        {radarData.competencyRadar && radarData.competencyRadar.length >= 3 ? (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-6 tracking-wide">COMPETENCY PROFILE</h3>
            <div className="w-full flex justify-center items-center px-2 sm:px-8 py-4 [&_svg]:overflow-visible">
              <RadarChart axes={radarData.competencyRadar} size={280} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full bg-gray-50 rounded-2xl h-72 border border-gray-100 text-sm text-gray-400 font-medium">
            Not enough competency data
          </div>
        )}

        {radarData.personalityRadar && radarData.personalityRadar.length >= 3 ? (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-6 tracking-wide">PERSONALITY PROFILE</h3>
            <div className="w-full flex justify-center items-center px-2 sm:px-8 py-4 [&_svg]:overflow-visible">
              <RadarChart axes={radarData.personalityRadar} size={280} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full bg-gray-50 rounded-2xl h-72 border border-gray-100 text-sm text-gray-400 font-medium">
            Not enough personality data
          </div>
        )}
      </div>
    </div>
  );
}

// ── User Dashboard ────────────────────────────────────────────────────────────

function UserDashboard() {
  const { data: radarData, isLoading } = useApi<RadarAggregate>('/analytics/radar/me');

  if (isLoading) return <PageSpinner />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-base text-gray-500 mt-1">Your aggregated assessment insights</p>
      </div>

      {radarData ? (
        <RadarViews radarData={radarData} title="My Aggregate Profile" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500 shadow-sm">
          Complete some assessments to see your aggregate charts here.
        </div>
      )}
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const router = useRouter();
  const { data: metrics, isLoading: loadingMetrics } = useApi<DashboardMetrics>('/analytics/dashboard');
  const { data: orgRadarData, isLoading: loadingOrgRadar } = useApi<RadarAggregate>('/analytics/radar/org');

  const [lookupUserId, setLookupUserId] = useState('');
  const [activeLookupId, setActiveLookupId] = useState('');
  const { data: userRadarData, isLoading: loadingUserRadar } = useApi<RadarAggregate>(
    activeLookupId ? `/analytics/radar/user/${activeLookupId}` : null
  );

  if (loadingMetrics || loadingOrgRadar) return <PageSpinner />;

  const stats = [
    {
      label: 'Active Assessments',
      value: metrics?.activeAssessments ?? 0,
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      glow: 'rgba(59,130,246,0.25)',
    },
    {
      label: 'Total Participants',
      value: metrics?.totalParticipants ?? 0,
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
      glow: 'rgba(34,197,94,0.22)',
    },
    {
      label: 'Pending Responses',
      value: metrics?.pendingResponses ?? 0,
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      glow: 'rgba(245,158,11,0.22)',
    },
    {
      label: 'Reports Generated',
      value: metrics?.reportsGenerated ?? 0,
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      glow: 'rgba(168,85,247,0.22)',
    },
  ];

  const recentAssessments = metrics?.recentAssessments ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Organisation analytics &amp; overview</p>
        </div>
        <button
          onClick={() => router.push('/assessments/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Assessment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="flex items-start justify-between mb-5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: s.gradient, boxShadow: `0 4px 12px ${s.glow}` }}
              >
                {s.icon}
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {orgRadarData && (
        <RadarViews radarData={orgRadarData} title="Organisation Aggregate Charts" />
      )}

      {/* User specific radar charts lookup */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-10 hover:shadow-md transition-shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Participant Analysis</h2>
        <div className="flex gap-4 mb-8 max-w-lg">
          <input
            type="text"
            placeholder="Enter Participant ID (UUID)"
            value={lookupUserId}
            onChange={(e) => setLookupUserId(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            onClick={() => setActiveLookupId(lookupUserId)}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all hover:shadow-lg active:scale-95"
          >
            View Charts
          </button>
        </div>

        {loadingUserRadar && <Spinner className="mx-auto my-10" />}
        {!loadingUserRadar && userRadarData && activeLookupId && (
          <div className="pt-8 border-t border-gray-100">
            <RadarViews radarData={userRadarData} title={`Charts for ${activeLookupId}`} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Recent Assessments</h2>
          <button
            onClick={() => router.push('/assessments')}
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors"
          >
            View all →
          </button>
        </div>

        {recentAssessments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base text-gray-500 mb-4">No assessments yet.</p>
            <button
              onClick={() => router.push('/assessments/new')}
              className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
            >
              Create your first assessment →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentAssessments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/assessments/${a.id}`)}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-base font-semibold text-gray-900 truncate mb-1">{a.title}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(a.createdAt), 'dd MMM yyyy')} <span className="mx-2 text-gray-300">•</span>{' '}
                    {TYPE_LABELS[a.assessmentType]}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[a.status]}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <PageSpinner />;

  const isAdmin = user.role === UserRole.ORG_ADMIN || user.role === UserRole.HR_MANAGER;

  if (isAdmin) {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
}
