'use client';

import { useRouter } from 'next/navigation';

import { useApi } from '@/hooks/useApi';
import { DashboardData } from '@/lib/api';

import { format } from 'date-fns';
import {
  ClipboardList,
  Users,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { RadarChart, RadarAxis } from '@/components/ui/RadarChart';
import { useAuthStore } from '@/store/auth.store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AssessmentStatus, AssessmentType, UserRole } from '@leaderprism/shared';

// ── Types (mirroring real backend response shapes) ─────────────────────────────

interface DashboardStatMetric {
  count: number;
  percentage_change: number;
}

interface OrgDashboardDataRaw {
  active_assessments: DashboardStatMetric;
  total_participants: DashboardStatMetric;
  pending_responses: DashboardStatMetric;
  reports_generated: DashboardStatMetric;
}

interface MonthlyActivityRow {
  month: string;
  count: number;
  status: string;
}

interface ParticipantActivityRow {
  month: string;
  participants: number;
}

interface DepartmentParticipationRow {
  department: string;
  count: number;
}

interface RadarAggregate {
  competencyRadar: RadarAxis[];
  personalityRadar: RadarAxis[];
}

interface MyAssessmentItem {
  participantStatus: string;
  isRater?: boolean;
  nominationStatus?: string;
}

// ── Label Maps ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AssessmentType, string> = {
  [AssessmentType.FEEDBACK_360]: '360°',
  [AssessmentType.COMPETENCY]: 'Competency',
  [AssessmentType.PERSONALITY]: 'Personality',
  [AssessmentType.READINESS]: 'Readiness',
};

const TYPE_COLORS: Record<string, string> = {
  [AssessmentType.FEEDBACK_360]: '#465fff',
  [AssessmentType.COMPETENCY]: '#7592ff',
  [AssessmentType.PERSONALITY]: '#a855f7',
  [AssessmentType.READINESS]: '#f59e0b',
};

const STATUS_VARIANT: Record<AssessmentStatus, 'neutral' | 'success' | 'info' | 'warning'> = {
  [AssessmentStatus.DRAFT]: 'neutral',
  [AssessmentStatus.ACTIVE]: 'success',
  [AssessmentStatus.CLOSED]: 'info',
  [AssessmentStatus.ARCHIVED]: 'neutral',
};

// ── Shared Radar View ────────────────────────────────────────────────────────

function RadarViews({
  radarData,
  title,
}: {
  radarData: RadarAggregate | undefined;
  title: string;
}) {
  const competencyRadar = radarData?.competencyRadar ?? [];
  const personalityRadar = radarData?.personalityRadar ?? [];
  const hasLowSample = [...competencyRadar, ...personalityRadar].some(
    (axis) => axis.sampleSize !== undefined && axis.sampleSize < 3,
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-8 hover:shadow-md transition-shadow">
      <h2 className="text-xl font-bold text-gray-900 mb-8">{title}</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 sm:gap-14">
        {competencyRadar.length >= 3 ? (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-6 tracking-wide">COMPETENCY PROFILE</h3>
            <div className="w-full flex justify-center items-center px-2 sm:px-8 py-4 [&_svg]:overflow-visible">
              <RadarChart axes={competencyRadar} size={280} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full bg-gray-50 rounded-2xl h-72 border border-gray-100 text-sm text-gray-400 font-medium">
            Not enough competency data
          </div>
        )}

        {personalityRadar.length >= 3 ? (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-6 tracking-wide">PERSONALITY PROFILE</h3>
            <div className="w-full flex justify-center items-center px-2 sm:px-8 py-4 [&_svg]:overflow-visible">
              <RadarChart axes={personalityRadar} size={280} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full bg-gray-50 rounded-2xl h-72 border border-gray-100 text-sm text-gray-400 font-medium">
            Not enough personality data
          </div>
        )}
      </div>
      {hasLowSample && (
        <p className="text-xs text-gray-400 mt-4">
          * Based on fewer than 3 people — treat as indicative, not statistically reliable.
        </p>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: any }) {
  const Icon = stat.icon;
  const hasTrend = typeof stat.delta === 'number' && stat.delta !== 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: stat.gradient, boxShadow: `0 4px 12px ${stat.glow}` }}
        >
          <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        {hasTrend && (
          <span
            className="flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full"
            style={
              stat.up
                ? { color: '#12b76a', background: 'rgba(18,183,106,0.10)' }
                : { color: '#f04438', background: 'rgba(240,68,56,0.10)' }
            }
            title="Change vs. the prior 30-day period"
          >
            {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(stat.delta)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{stat.value}</p>
      <p className="text-sm text-gray-500 mt-1.5 font-medium">{stat.label}</p>
    </div>
  );
}

// ── Completion Rate Gauge ────────────────────────────────────────────────────

function CompletionGauge() {
  const { data: completion } = useApi<{ rate: number; completed: number; inProgress: number; notStarted: number }>(
    '/analytics/completion/participants',
  );

  const rate = completion?.rate ?? 0;
  const completed = completion?.completed ?? 0;
  const inProgress = completion?.inProgress ?? 0;
  const notStarted = completion?.notStarted ?? 0;

  const r = 70;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270° arc, open at the bottom
  const arcLen = c * sweep;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 h-full flex flex-col hover:shadow-md transition-shadow">
      <div className="mb-1">
        <h2 className="text-lg font-bold text-gray-900">Completion Rate</h2>
        <p className="text-sm text-gray-500">Across all active assessments</p>
      </div>

      <div className="flex-1 flex items-center justify-center py-4">
        <div className="relative w-[180px] h-[160px]">
          <svg viewBox="0 0 180 180" className="w-full h-full overflow-visible">
            <circle
              cx="90" cy="90" r={r} fill="none"
              stroke="var(--border)" strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${arcLen} ${c}`}
              transform="rotate(-225 90 90)"
            />
            <circle
              cx="90" cy="90" r={r} fill="none"
              stroke="#465fff" strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${(arcLen * rate) / 100} ${c}`}
              transform="rotate(-225 90 90)"
              style={{ transition: 'stroke-dasharray 0.6s var(--ease-out, ease)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-gray-900">{rate}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-center flex-1">
          <p className="text-sm font-bold text-gray-900">{completed}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Completed</p>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border)' }} />
        <div className="text-center flex-1">
          <p className="text-sm font-bold text-gray-900">{inProgress}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">In Progress</p>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border)' }} />
        <div className="text-center flex-1">
          <p className="text-sm font-bold text-gray-900">{notStarted}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Not Started</p>
        </div>
      </div>
    </div>
  );
}

// ── Activity + Distribution Charts ───────────────────────────────────────────

function ActivityCharts() {
  const { data: monthlyRaw } = useApi<MonthlyActivityRow[]>('/analytics/activity/monthly');

  // Pivot per-status-per-month rows into { month, launched, completed } series.
  // "Launched" = assessments created that month currently active; "completed" = currently closed.
  // (Based on current status, not a separate launch/close event date — the schema doesn't track those separately.)
  const monthlyPivot = (() => {
    const byMonth = new Map<string, { month: string; launched: number; completed: number }>();
    for (const row of monthlyRaw ?? []) {
      if (!byMonth.has(row.month)) byMonth.set(row.month, { month: row.month, launched: 0, completed: 0 });
      const entry = byMonth.get(row.month)!;
      if (row.status === AssessmentStatus.ACTIVE) entry.launched += row.count;
      if (row.status === AssessmentStatus.CLOSED) entry.completed += row.count;
    }
    return Array.from(byMonth.values()).map((e) => ({
      ...e,
      month: e.month.length === 7 ? format(new Date(e.month + '-01'), 'MMM') : e.month,
    }));
  })();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      {/* Monthly Activity — spans 2 columns */}
      <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Monthly Assessment Activity</h2>
        <p className="text-sm text-gray-500 mb-6">Active vs. closed assessments, by creation month</p>
        {monthlyPivot.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-gray-400">
            No assessment activity yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyPivot} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="launched" name="Active" fill="#c2d6ff" radius={[6, 6, 0, 0]} />
              <Bar dataKey="completed" name="Closed" fill="#465fff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-5 mt-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#c2d6ff' }} /> Active
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#465fff' }} /> Closed
          </span>
        </div>
      </div>

      {/* Completion Gauge */}
      <CompletionGauge />
    </div>
  );
}

function DistributionCharts({ assessmentsByType }: { assessmentsByType: Record<string, number> | undefined }) {
  const { data: participantTrendRaw } = useApi<ParticipantActivityRow[]>('/analytics/activity/participants');
  const participantTrend = participantTrendRaw ?? [];

  const typeDistribution = Object.entries(assessmentsByType ?? {}).map(([type, value]) => ({
    name: TYPE_LABELS[type as AssessmentType] ?? type,
    value,
    color: TYPE_COLORS[type] ?? '#9ca3af',
  }));
  const total = typeDistribution.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      {/* Assessment Type Distribution (Donut) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Assessment Type Distribution</h2>
        <p className="text-sm text-gray-500 mb-4">Share of assessments by use case</p>
        {total === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
            No assessments yet.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-[180px] h-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {typeDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-gray-900">{total}</span>
                <span className="text-[11px] text-gray-500">assessments</span>
              </div>
            </div>
            <div className="flex-1 w-full space-y-3">
              {typeDistribution.map((d) => (
                <div key={d.name} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-sm text-gray-600 flex-1">{d.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Participant Growth */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Participant Growth</h2>
        <p className="text-sm text-gray-500 mb-6">Total participants over the past 12 months</p>
        {participantTrend.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
            No participant activity yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={participantTrend}>
              <defs>
                <linearGradient id="participantGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
                cursor={{ stroke: '#e9d5ff' }}
              />
              <Area
                type="monotone"
                dataKey="participants"
                name="Participants"
                stroke="#a855f7"
                strokeWidth={2.5}
                fill="url(#participantGradient)"
                dot={{ r: 4, fill: '#a855f7', stroke: 'white', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DepartmentParticipation() {
  const { data: rows } = useApi<DepartmentParticipationRow[]>('/analytics/participation/departments');
  const data = rows ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 hover:shadow-md transition-shadow">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Participation by Department</h2>
      <p className="text-sm text-gray-500 mb-6">Number of participants engaged per department</p>
      {data.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-sm text-gray-400">
          No participants yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="department"
              tick={{ fontSize: 12.5, fill: '#374151' }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
              cursor={{ fill: 'var(--bg-subtle)' }}
            />
            <Bar dataKey="count" name="Participants" fill="#465fff" radius={[0, 8, 8, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── User Dashboard ────────────────────────────────────────────────────────────

function UserDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: myAssessments } = useApi<MyAssessmentItem[]>('/assessments/mine');
  const { data: userRadar } = useApi<RadarAggregate>('/analytics/radar/me');

  const completedCount = (myAssessments ?? []).filter(
    (a) => a.participantStatus === 'completed' || a.nominationStatus === 'completed',
  ).length;
  const totalAssigned = (myAssessments ?? []).length;

  const stats = [
    { label: 'Assessments Completed', value: String(completedCount), icon: ClipboardList, gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)', glow: 'rgba(70,95,255,0.25)' },
    { label: 'Total Assigned', value: String(totalAssigned), icon: Users, gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', glow: 'rgba(168,85,247,0.22)' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back{user?.firstName ? `, ${user.firstName}` : ''}</h1>
        <p className="text-base text-gray-500 mt-1">Your aggregated assessment insights</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mb-5"
                style={{ background: s.gradient, boxShadow: `0 4px 12px ${s.glow}` }}
              >
                <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
              </div>
              <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1.5 font-medium">{s.label}</p>
            </div>
          );
        })}
      </div>

      <RadarViews radarData={userRadar} title="My Aggregate Profile" />
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const router = useRouter();
  const { data: dashboard } = useApi<OrgDashboardDataRaw & DashboardData & { assessmentsByType: Record<string, number> }>(
    '/analytics/dashboard',
  );
  const { data: orgRadar } = useApi<RadarAggregate>('/analytics/radar/org');

  const dashboardStats = [
    {
      label: 'Active Assessments',
      value: dashboard?.active_assessments.count ?? 0,
      delta: dashboard?.active_assessments.percentage_change ?? 0,
      up: (dashboard?.active_assessments.percentage_change ?? 0) >= 0,
      icon: ClipboardList,
      gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)',
      glow: 'rgba(70,95,255,0.25)',
    },
    {
      label: 'Total Participants',
      value: dashboard?.total_participants.count ?? 0,
      delta: dashboard?.total_participants.percentage_change ?? 0,
      up: (dashboard?.total_participants.percentage_change ?? 0) >= 0,
      icon: Users,
      gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
      glow: 'rgba(34,197,94,0.22)',
    },
    {
      label: 'Pending Responses',
      value: dashboard?.pending_responses.count ?? 0,
      delta: dashboard?.pending_responses.percentage_change ?? 0,
      up: (dashboard?.pending_responses.percentage_change ?? 0) >= 0,
      icon: Clock,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      glow: 'rgba(245,158,11,0.22)',
    },
    {
      label: 'Reports Generated',
      value: dashboard?.reports_generated.count ?? 0,
      delta: dashboard?.reports_generated.percentage_change ?? 0,
      up: (dashboard?.reports_generated.percentage_change ?? 0) >= 0,
      icon: FileText,
      gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      glow: 'rgba(168,85,247,0.22)',
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Organisation analytics &amp; overview</p>
        </div>
        <button
          onClick={() => router.push('/assessments/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Assessment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {dashboardStats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      {/* Monthly Activity + Completion Gauge */}
      <ActivityCharts />

      {/* Distribution + Growth */}
      <DistributionCharts assessmentsByType={dashboard?.assessmentsByType} />

      {/* Department Participation */}
      <DepartmentParticipation />

      {/* Org Radar Charts */}
      <RadarViews radarData={orgRadar} title="Organisation Aggregate Charts" />

      {/* Recent Assessments */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Recent Assessments</h2>
          <button
            onClick={() => router.push('/assessments')}
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors"
          >
            View all →
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {dashboard?.recentAssessments?.length ? (
            dashboard.recentAssessments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors gap-4"
                onClick={() => router.push(`/assessments/${a.id}`)}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-base font-semibold text-gray-900 truncate mb-1">
                    {a.title}
                  </p>

                  <p className="text-sm text-gray-500">
                    {format(new Date(a.createdAt), 'dd MMM yyyy')}
                    <span className="mx-2 text-gray-300">•</span>

                    {TYPE_LABELS[a.assessmentType as AssessmentType]}

                    {a.participants && (
                      <>
                        <span className="mx-2 text-gray-300">•</span>
                        {a.participants} participants
                      </>
                    )}
                  </p>
                </div>

                <Badge variant={STATUS_VARIANT[a.status as AssessmentStatus]}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </Badge>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent assessments found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user.role === UserRole.ORG_ADMIN || user.role === UserRole.HR_MANAGER;

  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}
