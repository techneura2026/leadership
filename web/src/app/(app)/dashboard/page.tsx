'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
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
} from 'recharts';
import { AssessmentStatus, AssessmentType, UserRole } from '@leaderprism/shared';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ── Mock Data ─────────────────────────────────────────────────────────────────

// const MOCK_METRICS = {
//   activeAssessments: 12,
//   totalParticipants: 87,
//   pendingResponses: 23,
//   reportsGenerated: 45,
//   recentAssessments: [
//     { id: '1', title: 'Q2 Leadership 360 Review', assessmentType: AssessmentType.FEEDBACK_360, status: AssessmentStatus.ACTIVE, createdAt: '2026-05-28T09:00:00Z' },
//     { id: '2', title: 'Senior Manager Competency Assessment', assessmentType: AssessmentType.COMPETENCY, status: AssessmentStatus.ACTIVE, createdAt: '2026-05-22T11:30:00Z' },
//     { id: '3', title: 'Personality Profiling – Cohort A', assessmentType: AssessmentType.PERSONALITY, status: AssessmentStatus.CLOSED, createdAt: '2026-05-10T08:15:00Z' },
//     { id: '4', title: 'Leadership Readiness – Batch 2026', assessmentType: AssessmentType.READINESS, status: AssessmentStatus.ACTIVE, createdAt: '2026-04-30T14:00:00Z' },
//     { id: '5', title: 'Mid-Year 360 Feedback', assessmentType: AssessmentType.FEEDBACK_360, status: AssessmentStatus.DRAFT, createdAt: '2026-04-18T10:45:00Z' },
//   ],
// };

// const MOCK_ORG_RADAR: { competencyRadar: RadarAxis[]; personalityRadar: RadarAxis[] } = {
//   competencyRadar: [
//     { key: 'leadership', label: 'Leadership', value: 74 },
//     { key: 'communication', label: 'Communication', value: 81 },
//     { key: 'strategic', label: 'Strategic Thinking', value: 65 },
//     { key: 'teamBuilding', label: 'Team Building', value: 78 },
//     { key: 'innovation', label: 'Innovation', value: 59 },
//     { key: 'decision', label: 'Decision Making', value: 72 },
//   ],
//   personalityRadar: [
//     { key: 'openness', label: 'Openness', value: 68 },
//     { key: 'conscientiousness', label: 'Conscientiousness', value: 77 },
//     { key: 'extraversion', label: 'Extraversion', value: 62 },
//     { key: 'agreeableness', label: 'Agreeableness', value: 83 },
//     { key: 'neuroticism', label: 'Neuroticism', value: 42 },
//   ],
// };

// const MOCK_USER_RADAR: { competencyRadar: RadarAxis[]; personalityRadar: RadarAxis[] } = {
//   competencyRadar: [
//     { key: 'leadership', label: 'Leadership', value: 80 },
//     { key: 'communication', label: 'Communication', value: 73 },
//     { key: 'strategic', label: 'Strategic Thinking', value: 88 },
//     { key: 'teamBuilding', label: 'Team Building', value: 65 },
//     { key: 'innovation', label: 'Innovation', value: 70 },
//     { key: 'decision', label: 'Decision Making', value: 85 },
//   ],
//   personalityRadar: [
//     { key: 'openness', label: 'Openness', value: 72 },
//     { key: 'conscientiousness', label: 'Conscientiousness', value: 85 },
//     { key: 'extraversion', label: 'Extraversion', value: 55 },
//     { key: 'agreeableness', label: 'Agreeableness', value: 79 },
//     { key: 'neuroticism', label: 'Neuroticism', value: 35 },
//   ],
// };

// const MOCK_MONTHLY_ACTIVITY = [
//   { month: 'Jan', completed: 8, launched: 11 },
//   { month: 'Feb', completed: 14, launched: 17 },
//   { month: 'Mar', completed: 19, launched: 22 },
//   { month: 'Apr', completed: 12, launched: 15 },
//   { month: 'May', completed: 24, launched: 28 },
//   { month: 'Jun', completed: 18, launched: 21 },
// ];

// const MOCK_PARTICIPANT_TREND = [
//   { month: 'Jan', participants: 42 },
//   { month: 'Feb', participants: 55 },
//   { month: 'Mar', participants: 63 },
//   { month: 'Apr', participants: 71 },
//   { month: 'May', participants: 80 },
//   { month: 'Jun', participants: 87 },
// ];

// ── Label Maps ────────────────────────────────────────────────────────────────

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

function RadarViews({
  radarData,
  title,
}: {
  radarData: { competencyRadar: RadarAxis[]; personalityRadar: RadarAxis[] };
  title: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-8 hover:shadow-md transition-shadow">
      <h2 className="text-xl font-bold text-gray-900 mb-8">{title}</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 sm:gap-14">
        {radarData.competencyRadar.length >= 3 ? (
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

        {radarData.personalityRadar.length >= 3 ? (
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

// ── Activity Charts ───────────────────────────────────────────────────────────

function ActivityCharts() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'))
  const [MOCK_MONTHLY_ACTIVITY, setMonthlyActivity] = useState([
    { month: 'Jan', completed: 8, launched: 11 },
    { month: 'Feb', completed: 14, launched: 17 },
    { month: 'Mar', completed: 19, launched: 3 },
    { month: 'Apr', completed: 12, launched: 5 },
    { month: 'May', completed: 24, launched: 7 },
    { month: 'Jun', completed: 18, launched: 23 },
  ]);
  const [MOCK_PARTICIPANT_TREND, setParticipantTrend] = useState([
    { month: 'Jan', participants: 42 },
    { month: 'Feb', participants: 55 },
    { month: 'Mar', participants: 23 },
    { month: 'Apr', participants: 30 },
    { month: 'May', participants: 20 },
    { month: 'Jun', participants: 34 },
  ]);

  useEffect(() => {
    // 1. Function to check current theme
    const checkTheme = () => document.documentElement.classList.contains('dark');

    // 2. Set the initial theme on load
    setIsDark(checkTheme());

    // 3. Watch the <html> tag for changes to its classes
    const observer = new MutationObserver(() => {
      setIsDark(checkTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // 4. Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    //not set..................................................................................................
    const getMonthlyActivity = async () => {

      try {
        const res = await api.get<{ data: any }>('/analytics/activity/monthly');
        console.log("---------fetchMonthlyActivity-----------------"); 
        console.log(res.data.data);
        console.log("--------------------------");
        // setMonthlyActivity(res.data.data);
      } catch (e) {
        console.log("error in getMonthlyActivity ", e)
      }
    }

    //not set.........................................................................................................
    const getParticipantTrend = async () => {
      try {

        const res = await api.get<{ data: any }>('/analytics/activity/participants');
        console.log("---------fetchParticipantTrend-----------------");
        console.log(res.data.data);
        console.log("--------------------------");
        setParticipantTrend(res.data.data);
      } catch (e) {
        console.log("error in getParticipantTrend ", e)
      }
    }

    getMonthlyActivity();
    getParticipantTrend();
    console.log(MOCK_MONTHLY_ACTIVITY,"MOCK_MONTHLY_ACTIVITY")

  }, [])



  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      {/* Monthly Completions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Monthly Assessment Activity</h2>
        <p className="text-sm text-gray-500 mb-6">Launched vs. completed assessments</p>
        <ResponsiveContainer width="100%" height={220} >
          <BarChart data={MOCK_MONTHLY_ACTIVITY} barGap={4} barCategoryGap="30%"  >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
              cursor={{ fill: 'transparent' }}
            />
            <Bar dataKey="launched" name="Launched" fill="#bfdbfe" radius={[6, 6, 0, 0]} />
            <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-4 ">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-200" /> Launched
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Completed {isDark && <span className="text-gray-400">(dark mode)</span>}
          </span>
        </div>
      </div>

      {/* Participant Growth */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Participant Growth</h2>
        <p className="text-sm text-gray-500 mb-6">Total participants over the past 6 months</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={MOCK_PARTICIPANT_TREND}>
            <defs>
              <linearGradient id="participantGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
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
      </div>
    </div>
  );
}

// ── User Dashboard ────────────────────────────────────────────────────────────

function UserDashboard() {
  const [MOCK_USER_RADAR, setMockUserRadar] = useState({ competencyRadar: [], personalityRadar: [] });

  useEffect(() => {
    const getUsesrRadar = async () => {
      try {
        const res = await api.get<{ data: any }>('/analytics/radar/user');
        console.log("---------fetchUserRadar-----------------");
        console.log(res.data.data);
        console.log("--------------------------");
        setMockUserRadar(res.data.data);
      } catch (e) {
        console.log(e)
        setMockUserRadar({ competencyRadar: [], personalityRadar: [] });
      }
    }
    getUsesrRadar()
  }, [])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-base text-gray-500 mt-1">Your aggregated assessment insights</p>
      </div>
      <RadarViews radarData={MOCK_USER_RADAR} title="My Aggregate Profile" />
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const [MOCK_METRICS, setMonthlyActivity] = useState({ activeAssessments: 10, totalParticipants: 10, pendingResponses: 10, reportsGenerated: 10, recentAssessments: [] });
  const [MOCK_ORG_RADAR, setOrgRadar] = useState({ competencyRadar: [], personalityRadar:  [] });

  useEffect(() => {
    const getDashboardMetrics = async () => {
      try {
        const res = await api.get<{ data: any }>('/analytics/dashboard');
        console.log("---------fetchDashboardMetrics-----------------");
        console.log(res.data.data);
        console.log("--------------------------");
        // setMonthlyActivity(res.data.data);
      } catch (e) {
        console.error("Error fetching dashboard metrics:", e);
        // setMonthlyActivity({ activeAssessments: 0, totalParticipants: 0, pendingResponses: 0, reportsGenerated: 0, recentAssessments: [] });
      }
    }

    const getFetchOrgRadar = async () => {
      try {
        const res = await api.get<{ data: any }>('/analytics/radar/org');
        console.log("---------fetchOrgRadar-----------------");
        console.log(res.data.data);
        console.log("--------------------------");
        setOrgRadar(res.data.data);
      }
      catch (e) {
        console.error("Error fetching organization radar data:", e);
        setOrgRadar({ competencyRadar: [], personalityRadar: [] });
      }
    }

    getDashboardMetrics();
    getFetchOrgRadar();
  }, []);


  const router = useRouter();

  const stats = [
    {
      label: 'Active Assessments',
      value: MOCK_METRICS.activeAssessments,
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
      value: MOCK_METRICS.totalParticipants,
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
      value: MOCK_METRICS.pendingResponses,
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
      value: MOCK_METRICS.reportsGenerated,
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      glow: 'rgba(168,85,247,0.22)',
    },
  ];

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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

      {/* Activity Charts */}
      <ActivityCharts />

      {/* Org Radar Charts */}
      <RadarViews radarData={MOCK_ORG_RADAR} title="Organisation Aggregate Charts" />

      {/* Recent Assessments */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 ">
          <h2 className="text-lg font-bold text-gray-900">Recent Assessments</h2>
          <button
            onClick={() => router.push('/assessments')}
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors"
          >
            View all →
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {MOCK_METRICS.recentAssessments.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => router.push(`/assessments/${a.id}`)}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-base font-semibold text-gray-900 truncate mb-1">{a.title}</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(a.createdAt), 'dd MMM yyyy')} <span className="mx-2 text-gray-300">•</span>
                  {TYPE_LABELS[a.assessmentType as AssessmentType]}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[a.status as AssessmentStatus]}>
                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </Badge>
            </div>
          ))}
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
