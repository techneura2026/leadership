'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { NineBoxGrid } from '@/components/charts/NineBoxGrid';
import { ReadinessRating } from '@leaderprism/shared';
import { generateSuccessionPdf } from '@/lib/successionPdf';

// ── Types ─────────────────────────────────────────────────────────────────────

type Performance = 'high' | 'medium' | 'low';
type Potential = 'high' | 'medium' | 'low';

interface Candidate {
  id: string;
  name: string;
  title: string;
  department: string;
  performance: Performance;
  potential: Potential;
  readinessRating: ReadinessRating;
  compositeScore: number;
  completedAssessments: string[];
  keyStrengths: string[];
  developmentAreas: string[];
}

interface Successor {
  candidateId: string;
  name: string;
  readiness: ReadinessRating;
  compositeScore: number;
}

interface KeyRole {
  id: string;
  title: string;
  department: string;
  incumbent: string;
  incumbentTenure: string;
  criticality: 'critical' | 'high' | 'medium';
  successors: Successor[];
}

interface DeptBench {
  department: string;
  totalRoles: number;
  coveredRoles: number;
  readyNow: number;
  oneTwoYears: number;
  developing: number;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    name: 'Amara Perera',
    title: 'Senior Manager – Strategy',
    department: 'Executive',
    performance: 'high',
    potential: 'high',
    readinessRating: ReadinessRating.READY_NOW,
    compositeScore: 92.4,
    completedAssessments: ['360 Feedback', 'Competency', 'Readiness'],
    keyStrengths: ['Strategic Thinking', 'Stakeholder Management', 'Decision Making'],
    developmentAreas: ['Financial Acumen'],
  },
  {
    id: 'c2',
    name: 'David Mendis',
    title: 'Engineering Lead',
    department: 'Engineering',
    performance: 'high',
    potential: 'high',
    readinessRating: ReadinessRating.READY_NOW,
    compositeScore: 89.7,
    completedAssessments: ['360 Feedback', 'Competency', 'Readiness', 'Personality'],
    keyStrengths: ['Innovation', 'Team Building', 'Technical Leadership'],
    developmentAreas: ['Executive Presence', 'P&L Management'],
  },
  {
    id: 'c3',
    name: 'Priya Kumari',
    title: 'Finance Manager',
    department: 'Finance',
    performance: 'medium',
    potential: 'high',
    readinessRating: ReadinessRating.ONE_TWO_YEARS,
    compositeScore: 84.1,
    completedAssessments: ['360 Feedback', 'Competency', 'Readiness'],
    keyStrengths: ['Financial Acumen', 'Analytical Thinking', 'Compliance'],
    developmentAreas: ['Strategic Vision', 'People Leadership'],
  },
  {
    id: 'c4',
    name: 'Kasun Fernando',
    title: 'Senior Software Engineer',
    department: 'Engineering',
    performance: 'medium',
    potential: 'high',
    readinessRating: ReadinessRating.ONE_TWO_YEARS,
    compositeScore: 81.3,
    completedAssessments: ['360 Feedback', 'Competency'],
    keyStrengths: ['Innovation', 'Problem Solving', 'Collaboration'],
    developmentAreas: ['Communication', 'Strategic Planning'],
  },
  {
    id: 'c5',
    name: 'Nirosha Rajapaksa',
    title: 'Senior Finance Analyst',
    department: 'Finance',
    performance: 'high',
    potential: 'medium',
    readinessRating: ReadinessRating.ONE_TWO_YEARS,
    compositeScore: 79.8,
    completedAssessments: ['360 Feedback', 'Competency', 'Readiness'],
    keyStrengths: ['Financial Reporting', 'Risk Management', 'Process Improvement'],
    developmentAreas: ['Leadership Confidence', 'Team Development'],
  },
  {
    id: 'c6',
    name: 'Tom Wickramasinghe',
    title: 'Senior Sales Manager',
    department: 'Sales',
    performance: 'high',
    potential: 'medium',
    readinessRating: ReadinessRating.ONE_TWO_YEARS,
    compositeScore: 77.5,
    completedAssessments: ['360 Feedback', 'Readiness'],
    keyStrengths: ['Relationship Building', 'Revenue Growth', 'Negotiation'],
    developmentAreas: ['Strategic Thinking', 'People Development'],
  },
  {
    id: 'c7',
    name: 'Anika Jayasekara',
    title: 'HR Business Partner',
    department: 'HR',
    performance: 'medium',
    potential: 'medium',
    readinessRating: ReadinessRating.READY_NOW,
    compositeScore: 76.2,
    completedAssessments: ['360 Feedback', 'Competency', 'Personality'],
    keyStrengths: ['People Leadership', 'Organisational Development', 'Coaching'],
    developmentAreas: ['Data Analytics', 'Business Acumen'],
  },
  {
    id: 'c8',
    name: 'Ravi Seneviratne',
    title: 'Operations Manager',
    department: 'Operations',
    performance: 'medium',
    potential: 'medium',
    readinessRating: ReadinessRating.ONE_TWO_YEARS,
    compositeScore: 73.9,
    completedAssessments: ['360 Feedback', 'Competency'],
    keyStrengths: ['Process Excellence', 'Cost Management', 'Vendor Relations'],
    developmentAreas: ['Strategic Vision', 'Change Leadership'],
  },
  {
    id: 'c9',
    name: 'Mark Silva',
    title: 'Sales Account Manager',
    department: 'Sales',
    performance: 'medium',
    potential: 'medium',
    readinessRating: ReadinessRating.DEVELOPING,
    compositeScore: 68.4,
    completedAssessments: ['360 Feedback'],
    keyStrengths: ['Client Relationships', 'Communication', 'Persistence'],
    developmentAreas: ['Strategic Sales', 'Leadership Skills', 'Financial Literacy'],
  },
  {
    id: 'c10',
    name: 'Chamari De Silva',
    title: 'Operations Analyst',
    department: 'Operations',
    performance: 'high',
    potential: 'low',
    readinessRating: ReadinessRating.DEVELOPING,
    compositeScore: 65.1,
    completedAssessments: ['Competency', 'Readiness'],
    keyStrengths: ['Execution', 'Attention to Detail', 'Reliability'],
    developmentAreas: ['Strategic Thinking', 'Leadership', 'Innovation'],
  },
  {
    id: 'c11',
    name: 'Dilshan Maduwantha',
    title: 'Product Designer',
    department: 'Engineering',
    performance: 'low',
    potential: 'high',
    readinessRating: ReadinessRating.DEVELOPING,
    compositeScore: 61.8,
    completedAssessments: ['360 Feedback', 'Personality'],
    keyStrengths: ['Creative Thinking', 'User Empathy', 'Vision'],
    developmentAreas: ['Execution', 'Stakeholder Management', 'Consistency'],
  },
  {
    id: 'c12',
    name: 'Rohan Attanayake',
    title: 'Marketing Manager',
    department: 'Sales',
    performance: 'medium',
    potential: 'low',
    readinessRating: ReadinessRating.DEVELOPING,
    compositeScore: 58.3,
    completedAssessments: ['360 Feedback'],
    keyStrengths: ['Brand Awareness', 'Campaign Management'],
    developmentAreas: ['Leadership', 'Data-Driven Decision Making', 'Strategy'],
  },
  {
    id: 'c13',
    name: 'Fiona Krishnaswamy',
    title: 'HR Coordinator',
    department: 'HR',
    performance: 'low',
    potential: 'medium',
    readinessRating: ReadinessRating.NOT_YET_READY,
    compositeScore: 52.7,
    completedAssessments: ['360 Feedback'],
    keyStrengths: ['Empathy', 'Process Following'],
    developmentAreas: ['Business Acumen', 'Leadership', 'Strategic HR', 'Communication'],
  },
  {
    id: 'c14',
    name: 'Sasha Perera',
    title: 'Finance Coordinator',
    department: 'Finance',
    performance: 'medium',
    potential: 'low',
    readinessRating: ReadinessRating.NOT_YET_READY,
    compositeScore: 49.2,
    completedAssessments: ['Competency'],
    keyStrengths: ['Accuracy', 'Compliance'],
    developmentAreas: ['Leadership', 'Strategic Thinking', 'Communication', 'Team Building'],
  },
  {
    id: 'c15',
    name: 'Leo Bandara',
    title: 'Sales Associate',
    department: 'Sales',
    performance: 'low',
    potential: 'low',
    readinessRating: ReadinessRating.NOT_YET_READY,
    compositeScore: 41.6,
    completedAssessments: ['360 Feedback'],
    keyStrengths: ['Customer Service'],
    developmentAreas: ['Sales Skills', 'Leadership', 'Strategic Vision', 'Communication'],
  },
];

const MOCK_KEY_ROLES: KeyRole[] = [
  {
    id: 'r1',
    title: 'Chief Executive Officer',
    department: 'Executive',
    incumbent: 'Michael Chen',
    incumbentTenure: '6 years',
    criticality: 'critical',
    successors: [
      { candidateId: 'c1', name: 'Amara Perera', readiness: ReadinessRating.READY_NOW, compositeScore: 92.4 },
      { candidateId: 'c2', name: 'David Mendis', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 89.7 },
    ],
  },
  {
    id: 'r2',
    title: 'Chief Financial Officer',
    department: 'Finance',
    incumbent: 'Sarah Park',
    incumbentTenure: '4 years',
    criticality: 'critical',
    successors: [
      { candidateId: 'c3', name: 'Priya Kumari', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 84.1 },
      { candidateId: 'c5', name: 'Nirosha Rajapaksa', readiness: ReadinessRating.DEVELOPING, compositeScore: 79.8 },
    ],
  },
  {
    id: 'r3',
    title: 'VP Engineering',
    department: 'Engineering',
    incumbent: 'James Wilson',
    incumbentTenure: '3 years',
    criticality: 'critical',
    successors: [
      { candidateId: 'c2', name: 'David Mendis', readiness: ReadinessRating.READY_NOW, compositeScore: 89.7 },
      { candidateId: 'c4', name: 'Kasun Fernando', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 81.3 },
    ],
  },
  {
    id: 'r4',
    title: 'VP Sales',
    department: 'Sales',
    incumbent: 'Elena Torres',
    incumbentTenure: '5 years',
    criticality: 'high',
    successors: [
      { candidateId: 'c6', name: 'Tom Wickramasinghe', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 77.5 },
      { candidateId: 'c9', name: 'Mark Silva', readiness: ReadinessRating.DEVELOPING, compositeScore: 68.4 },
    ],
  },
  {
    id: 'r5',
    title: 'Head of HR',
    department: 'HR',
    incumbent: 'Raj Patel',
    incumbentTenure: '2 years',
    criticality: 'high',
    successors: [
      { candidateId: 'c7', name: 'Anika Jayasekara', readiness: ReadinessRating.READY_NOW, compositeScore: 76.2 },
    ],
  },
  {
    id: 'r6',
    title: 'Head of Operations',
    department: 'Operations',
    incumbent: 'Lisa Wang',
    incumbentTenure: '4 years',
    criticality: 'high',
    successors: [
      { candidateId: 'c8', name: 'Ravi Seneviratne', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 73.9 },
      { candidateId: 'c10', name: 'Chamari De Silva', readiness: ReadinessRating.DEVELOPING, compositeScore: 65.1 },
    ],
  },
  {
    id: 'r7',
    title: 'Finance Controller',
    department: 'Finance',
    incumbent: 'Nina Shah',
    incumbentTenure: '7 years',
    criticality: 'medium',
    successors: [
      { candidateId: 'c5', name: 'Nirosha Rajapaksa', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 79.8 },
    ],
  },
  {
    id: 'r8',
    title: 'Engineering Manager',
    department: 'Engineering',
    incumbent: 'Alan Rodrigo',
    incumbentTenure: '2 years',
    criticality: 'medium',
    successors: [
      { candidateId: 'c4', name: 'Kasun Fernando', readiness: ReadinessRating.ONE_TWO_YEARS, compositeScore: 81.3 },
    ],
  },
];

const MOCK_BENCH: DeptBench[] = [
  { department: 'Executive',   totalRoles: 2, coveredRoles: 2, readyNow: 1, oneTwoYears: 1, developing: 0 },
  { department: 'Engineering', totalRoles: 3, coveredRoles: 3, readyNow: 1, oneTwoYears: 2, developing: 0 },
  { department: 'Finance',     totalRoles: 3, coveredRoles: 3, readyNow: 0, oneTwoYears: 2, developing: 1 },
  { department: 'Sales',       totalRoles: 3, coveredRoles: 2, readyNow: 0, oneTwoYears: 1, developing: 1 },
  { department: 'HR',          totalRoles: 2, coveredRoles: 1, readyNow: 1, oneTwoYears: 0, developing: 0 },
  { department: 'Operations',  totalRoles: 2, coveredRoles: 2, readyNow: 0, oneTwoYears: 1, developing: 1 },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const READINESS_META: Record<ReadinessRating, { variant: 'success' | 'warning' | 'info' | 'neutral'; label: string; color: string }> = {
  [ReadinessRating.READY_NOW]:     { variant: 'success', label: 'Ready Now',    color: 'bg-green-500' },
  [ReadinessRating.ONE_TWO_YEARS]: { variant: 'warning', label: '1–2 Years',    color: 'bg-yellow-400' },
  [ReadinessRating.DEVELOPING]:    { variant: 'info',    label: 'Developing',   color: 'bg-blue-400' },
  [ReadinessRating.NOT_YET_READY]: { variant: 'neutral', label: 'Not Ready',    color: 'bg-gray-400' },
};

const CRITICALITY_META: Record<string, { variant: 'error' | 'warning' | 'info'; label: string }> = {
  critical: { variant: 'error',   label: 'Critical' },
  high:     { variant: 'warning', label: 'High' },
  medium:   { variant: 'info',    label: 'Medium' },
};

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'ninebox',    label: '9-Box Grid' },
  { key: 'key-roles',  label: 'Key Roles' },
  { key: 'talent',     label: 'Talent Pool' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ count, label, variant, icon }: {
  count: number;
  label: string;
  variant: 'success' | 'warning' | 'info' | 'neutral';
  icon: React.ReactNode;
}) {
  const bg = {
    success: 'from-green-50 to-white border-green-200 dark:from-green-950/40 dark:to-slate-900 dark:border-green-800/60',
    warning: 'from-yellow-50 to-white border-yellow-200 dark:from-yellow-950/40 dark:to-slate-900 dark:border-yellow-800/60',
    info:    'from-blue-50 to-white border-blue-200 dark:from-blue-950/40 dark:to-slate-900 dark:border-blue-800/60',
    neutral: 'from-gray-50 to-white border-gray-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700',
  }[variant];
  const iconBg = {
    success: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300',
    info:    'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    neutral: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300',
  }[variant];
  const textColor = {
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-yellow-700 dark:text-yellow-300',
    info:    'text-blue-700 dark:text-blue-300',
    neutral: 'text-gray-600 dark:text-slate-300',
  }[variant];
  return (
    <div className={`bg-gradient-to-b ${bg} rounded-xl border p-5 flex items-center gap-4 shadow-sm dark:shadow-slate-950/20`}>
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className={`text-3xl font-bold ${textColor}`}>{count}</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-12 h-12 text-sm' };
  return (
    <div className={`${sizes[size]} rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 65 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score.toFixed(0)}</span>
    </div>
  );
}

// ── Tab Views ─────────────────────────────────────────────────────────────────

function OverviewTab({ candidates, roles, bench }: {
  candidates: Candidate[];
  roles: KeyRole[];
  bench: DeptBench[];
}) {
  const readyNow = candidates.filter(c => c.readinessRating === ReadinessRating.READY_NOW).length;
  const hipos = candidates.filter(c => c.potential === 'high');
  const coverageRate = Math.round((roles.filter(r => r.successors.length > 0).length / roles.length) * 100);

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard count={candidates.length} label="Total Candidates" variant="info"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" /></svg>}
        />
        <StatCard count={readyNow} label="Ready Now" variant="success"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
        />
        <StatCard count={hipos.length} label="High Potential" variant="warning"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard count={coverageRate} label="Role Coverage %" variant="info"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
      </div>

      {/* Readiness Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Readiness Distribution</h2>
        <div className="space-y-3">
          {Object.entries(READINESS_META).map(([rating, meta]) => {
            const count = candidates.filter(c => c.readinessRating === rating).length;
            const pct = Math.round((count / candidates.length) * 100);
            return (
              <div key={rating} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 shrink-0">{meta.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full ${meta.color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-6 text-right">{count}</span>
                <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bench Strength by Department */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Bench Strength by Department</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-xs text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Department</th>
                <th className="text-center px-4 py-2.5 font-medium">Roles</th>
                <th className="text-center px-4 py-2.5 font-medium">Covered</th>
                <th className="text-center px-4 py-2.5 font-medium">Ready Now</th>
                <th className="text-center px-4 py-2.5 font-medium">1–2 Years</th>
                <th className="text-center px-4 py-2.5 font-medium">Developing</th>
                <th className="text-left px-4 py-2.5 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {bench.map(d => {
                const pct = Math.round((d.coveredRoles / d.totalRoles) * 100);
                const coverColor = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
                return (
                  <tr key={d.department} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{d.department}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{d.totalRoles}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{d.coveredRoles}</td>
                    <td className="px-4 py-3 text-center">
                      {d.readyNow > 0 ? <Badge variant="success">{d.readyNow}</Badge> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.oneTwoYears > 0 ? <Badge variant="warning">{d.oneTwoYears}</Badge> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.developing > 0 ? <Badge variant="info">{d.developing}</Badge> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full ${coverColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* High Potential Spotlight */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">High Potential Spotlight</h2>
          <Badge variant="warning">{hipos.length} identified</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {hipos.map(c => {
            const meta = READINESS_META[c.readinessRating];
            return (
              <div key={c.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar name={c.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.title}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="text-xs font-bold text-gray-700">{c.compositeScore.toFixed(1)}</span>
                </div>
                <ScoreBar score={c.compositeScore} />
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.keyStrengths.slice(0, 2).map(s => (
                    <span key={s} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NineBoxTab({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700">9-Box Grid — Performance × Potential</h2>
          <span className="text-xs text-gray-400">{candidates.length} candidates plotted</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Performance (X-axis) reflects assessment outcomes. Potential (Y-axis) reflects readiness trajectory.
        </p>
        <NineBoxGrid candidates={candidates.map(c => ({
          name: c.name,
          performance: c.performance,
          potential: c.potential,
          readinessRating: c.readinessRating,
        }))} />
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">Grid Cell Legend</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { cell: 'High × High', label: 'Star', color: 'bg-green-100 border-green-300', desc: 'Top priority for succession' },
            { cell: 'Med × High', label: 'Future Star', color: 'bg-green-50 border-green-200', desc: 'HiPo, needs development' },
            { cell: 'High × Med', label: 'High Performer', color: 'bg-green-50 border-green-200', desc: 'Delivering, limited upside' },
            { cell: 'Med × Med', label: 'Core Player', color: 'bg-yellow-50 border-yellow-200', desc: 'Solid foundation' },
            { cell: 'Low × High', label: 'Enigma', color: 'bg-yellow-50 border-yellow-200', desc: 'Potential unrealised' },
            { cell: 'High × Low', label: 'Solid Contributor', color: 'bg-yellow-50 border-yellow-200', desc: 'High output, limited growth' },
            { cell: 'Med × Low', label: 'Effective', color: 'bg-gray-50 border-gray-200', desc: 'Competent, steady' },
            { cell: 'Low × Med', label: 'Inconsistent', color: 'bg-gray-50 border-gray-200', desc: 'Needs coaching' },
            { cell: 'Low × Low', label: 'Risk', color: 'bg-red-50 border-red-200', desc: 'Immediate attention needed' },
          ].map(item => (
            <div key={item.label} className={`flex items-start gap-2 border rounded-lg p-2 ${item.color}`}>
              <div>
                <p className="font-semibold text-gray-700">{item.label}</p>
                <p className="text-gray-500">{item.cell}</p>
                <p className="text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KeyRolesTab({ roles }: { roles: KeyRole[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Key Roles & Succession Pipeline ({roles.length} roles)</h2>
        <div className="flex gap-2 text-xs">
          {Object.entries(CRITICALITY_META).map(([k, v]) => (
            <Badge key={k} variant={v.variant}>{v.label}</Badge>
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {roles.map(role => {
          const isOpen = expanded === role.id;
          const crit = CRITICALITY_META[role.criticality];
          const hasCover = role.successors.length > 0;
          return (
            <div key={role.id}>
              <button
                className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : role.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Expand icon */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {/* Role info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{role.title}</span>
                      <Badge variant={crit.variant}>{crit.label}</Badge>
                      {!hasCover && <Badge variant="error">No Successor</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {role.department} · Incumbent: <span className="font-medium text-gray-700">{role.incumbent}</span>
                      <span className="text-gray-400"> ({role.incumbentTenure})</span>
                    </p>
                  </div>
                  {/* Successor avatars preview */}
                  <div className="flex items-center -space-x-2 shrink-0">
                    {role.successors.slice(0, 3).map(s => (
                      <div
                        key={s.candidateId}
                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-semibold border-2 border-white"
                        title={s.name}
                      >
                        {s.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                      </div>
                    ))}
                    {role.successors.length === 0 && (
                      <span className="text-xs text-gray-400 italic">None</span>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-11 pb-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-500 font-medium pt-3 mb-2">
                    Succession Pipeline ({role.successors.length} successors)
                  </p>
                  <div className="space-y-2">
                    {role.successors.map((s, idx) => {
                      const rm = READINESS_META[s.readiness];
                      return (
                        <div key={s.candidateId} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                          <span className="text-xs text-gray-400 font-bold w-4">#{idx + 1}</span>
                          <Avatar name={s.name} size="sm" />
                          <span className="text-sm font-medium text-gray-800 flex-1">{s.name}</span>
                          <Badge variant={rm.variant}>{rm.label}</Badge>
                          <div className="w-32">
                            <ScoreBar score={s.compositeScore} />
                          </div>
                        </div>
                      );
                    })}
                    {role.successors.length === 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-600">
                        No successors identified. This role is a succession gap — consider initiating a readiness assessment.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TalentPoolTab({ candidates }: { candidates: Candidate[] }) {
  const [filter, setFilter] = useState<ReadinessRating | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = candidates.filter(c => {
    const matchRating = filter === 'all' || c.readinessRating === filter;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.department.toLowerCase().includes(search.toLowerCase());
    return matchRating && matchSearch;
  });

  const filterTabs = [
    { key: 'all', label: `All (${candidates.length})` },
    ...Object.entries(READINESS_META).map(([k, v]) => ({
      key: k,
      label: `${v.label} (${candidates.filter(c => c.readinessRating === k).length})`,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Filter + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {filterTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key as ReadinessRating | 'all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filter === t.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          {!search && (<svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>)}
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="placeholder:px-4  text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-52"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Candidate</th>
              <th className="text-left px-4 py-3 font-medium">Department</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Performance</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Potential</th>
              <th className="text-left px-4 py-3 font-medium">Readiness</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Score</th>
              <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Key Strengths</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const rm = READINESS_META[c.readinessRating];
              const perfColor = c.performance === 'high' ? 'text-green-600' : c.performance === 'medium' ? 'text-yellow-600' : 'text-red-500';
              const potColor = c.potential === 'high' ? 'text-green-600' : c.potential === 'medium' ? 'text-yellow-600' : 'text-red-500';
              return (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.department}</td>
                  <td className={`px-4 py-3 capitalize font-medium hidden md:table-cell ${perfColor}`}>{c.performance}</td>
                  <td className={`px-4 py-3 capitalize font-medium hidden md:table-cell ${potColor}`}>{c.potential}</td>
                  <td className="px-4 py-3"><Badge variant={rm.variant}>{rm.label}</Badge></td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="w-28">
                      <ScoreBar score={c.compositeScore} />
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.keyStrengths.slice(0, 2).map(s => (
                        <span key={s} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">No candidates match the current filter.</div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuccessionPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await generateSuccessionPdf({
        organisationName: 'LeaderPrism Demo Org',
        generatedAt: 'Jun 2026',
        candidates: MOCK_CANDIDATES,
        keyRoles: MOCK_KEY_ROLES,
        bench: MOCK_BENCH,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Succession Planning</h1>
          <p className="text-sm text-gray-500 mt-1">Leadership talent pipeline, readiness overview, and bench strength analysis.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            Updated Jun 2026
          </span>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {exporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab candidates={MOCK_CANDIDATES} roles={MOCK_KEY_ROLES} bench={MOCK_BENCH} />
      )}
      {activeTab === 'ninebox' && (
        <NineBoxTab candidates={MOCK_CANDIDATES} />
      )}
      {activeTab === 'key-roles' && (
        <KeyRolesTab roles={MOCK_KEY_ROLES} />
      )}
      {activeTab === 'talent' && (
        <TalentPoolTab candidates={MOCK_CANDIDATES} />
      )}
    </div>
  );
}
