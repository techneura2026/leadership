'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Users, CheckCircle2, TrendingUp, Layers, Search, ChevronRight, ChevronUp, ChevronDown,
  Download, FileWarning, Briefcase, Network, Plus, Pencil, Trash2, UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { NineBoxGrid } from '@/components/charts/NineBoxGrid';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ReadinessRating } from '@leaderprism/shared';
import type { DepartmentDto, UserDto } from '@leaderprism/shared';
import { generateSuccessionPdf } from '@/lib/successionPdf';

// ── Types ─────────────────────────────────────────────────────────────────────

type Performance = 'high' | 'medium' | 'low';
type Potential = 'high' | 'medium' | 'low';

// Shapes returned by the real backend (api/src/succession/succession.service.ts)
interface ApiCandidate {
  readinessScoreId: string;
  participantId: string;
  userId: string;
  name: string;
  title: string | null;
  department: string | null;
  roleProfileId: string;
  roleTitle: string;
  readinessRating: ReadinessRating;
  compositeScore: number;
  gridPerformance: Performance;
  manualGridPerformance: Performance | null;
  effectiveGridPerformance: Performance;
  gridPotential: Potential;
  keyStrengths: string[];
  developmentAreas: string[];
}

interface ApiSuccessor {
  id: string;
  candidateUserId: string | null;
  candidateName: string;
  readinessRating: ReadinessRating | null;
  compositeScore: number | null;
  notes: string | null;
}

interface ApiKeyRole {
  id: string;
  title: string;
  departmentId: string | null;
  departmentName: string | null;
  criticality: 'critical' | 'high' | 'medium';
  incumbentId: string | null;
  incumbentName: string | null;
  incumbentSince: string | null;
  flightRisk: 'high' | 'medium' | 'low';
  successors: ApiSuccessor[];
}

interface ApiBench {
  departmentId: string | null;
  departmentName: string;
  totalRoles: number;
  coveredRoles: number;
  readinessBreakdown: Record<string, number>;
}

interface ApiOrgUser {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  managerId: string | null;
}

// Display-layer types used by the tab components below (unchanged shape from before,
// so the existing rendering logic keeps working — only where the data comes from changed).
interface Candidate {
  id: string; // userId
  readinessScoreId: string;
  name: string;
  title: string;
  department: string;
  performance: Performance; // effective (manual override, falling back to auto)
  autoPerformance: Performance;
  manualGridPerformance: Performance | null;
  potential: Potential;
  readinessRating: ReadinessRating;
  compositeScore: number;
  keyStrengths: string[];
  developmentAreas: string[];
}

interface Successor {
  id: string;
  candidateId: string | null;
  name: string;
  readiness: ReadinessRating | null;
  compositeScore: number | null;
}

interface KeyRole {
  id: string;
  title: string;
  departmentId: string | null;
  department: string;
  incumbentId: string | null;
  incumbent: string;
  incumbentSince: string | null;
  incumbentTenure: string;
  criticality: 'critical' | 'high' | 'medium';
  flightRisk: 'high' | 'medium' | 'low';
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

// ── Mappers (real API response → display types) ──────────────────────────────

function mapCandidate(c: ApiCandidate): Candidate {
  return {
    id: c.userId,
    readinessScoreId: c.readinessScoreId,
    name: c.name,
    title: c.title ?? c.roleTitle ?? '—',
    department: c.department ?? 'Unassigned',
    performance: c.effectiveGridPerformance,
    autoPerformance: c.gridPerformance,
    manualGridPerformance: c.manualGridPerformance,
    potential: c.gridPotential,
    readinessRating: c.readinessRating,
    compositeScore: c.compositeScore,
    keyStrengths: c.keyStrengths,
    developmentAreas: c.developmentAreas,
  };
}

function formatTenure(since: string | null): string {
  if (!since) return 'Tenure unknown';
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return 'Tenure unknown';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} mo${remMonths === 1 ? '' : 's'}`;
  if (remMonths === 0) return `${years} yr${years === 1 ? '' : 's'}`;
  return `${years} yr${years === 1 ? '' : 's'} ${remMonths} mo`;
}

function mapKeyRole(r: ApiKeyRole): KeyRole {
  return {
    id: r.id,
    title: r.title,
    departmentId: r.departmentId,
    department: r.departmentName ?? 'Unassigned',
    incumbentId: r.incumbentId,
    incumbent: r.incumbentName ?? 'Vacant',
    incumbentSince: r.incumbentSince,
    incumbentTenure: r.incumbentName ? formatTenure(r.incumbentSince) : 'Vacant',
    criticality: r.criticality,
    flightRisk: r.flightRisk,
    successors: r.successors.map((s) => ({
      id: s.id,
      candidateId: s.candidateUserId,
      name: s.candidateName,
      readiness: s.readinessRating,
      compositeScore: s.compositeScore,
    })),
  };
}

function mapBench(b: ApiBench): DeptBench {
  const breakdown = b.readinessBreakdown ?? {};
  return {
    department: b.departmentName,
    totalRoles: b.totalRoles,
    coveredRoles: b.coveredRoles,
    readyNow: breakdown[ReadinessRating.READY_NOW] ?? 0,
    oneTwoYears: breakdown[ReadinessRating.ONE_TWO_YEARS] ?? 0,
    developing:
      (breakdown[ReadinessRating.DEVELOPING] ?? 0) +
      (breakdown[ReadinessRating.NOT_YET_READY] ?? 0) +
      (breakdown['not_yet_assessed'] ?? 0),
  };
}

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

const CRITICALITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
];

const FLIGHT_RISK_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PERFORMANCE_OVERRIDE_OPTIONS = [
  { value: '', label: 'Auto (from 360 feedback)' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'ninebox',    label: '9-Box Grid' },
  { key: 'key-roles',  label: 'Key Roles' },
  { key: 'talent',     label: 'Talent Pool' },
];

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

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
    <div className={`bg-gradient-to-b ${bg} rounded-2xl border p-5 flex items-center gap-4 shadow-sm dark:shadow-slate-950/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
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
  if (candidates.length === 0 && roles.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-600">No succession data yet</p>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          Once readiness assessments are completed and key roles are defined, this dashboard will show your leadership pipeline.
        </p>
      </div>
    );
  }

  const readyNow = candidates.filter(c => c.readinessRating === ReadinessRating.READY_NOW).length;
  const hipos = candidates.filter(c => c.potential === 'high');
  const coverageRate = roles.length > 0
    ? Math.round((roles.filter(r => r.successors.length > 0).length / roles.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard count={candidates.length} label="Total Candidates" variant="info" icon={<Users className="w-5 h-5" strokeWidth={2} />} />
        <StatCard count={readyNow} label="Ready Now" variant="success" icon={<CheckCircle2 className="w-5 h-5" strokeWidth={2} />} />
        <StatCard count={hipos.length} label="High Potential" variant="warning" icon={<TrendingUp className="w-5 h-5" strokeWidth={2} />} />
        <StatCard count={coverageRate} label="Role Coverage %" variant="info" icon={<Layers className="w-5 h-5" strokeWidth={2} />} />
      </div>

      {/* Readiness Distribution */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Readiness Distribution</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-gray-400">No candidates with a computed readiness score yet.</p>
        ) : (
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
        )}
      </div>

      {/* Bench Strength by Department */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
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
              {bench.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">No key roles defined yet.</td>
                </tr>
              ) : bench.map(d => {
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
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">High Potential Spotlight</h2>
          <Badge variant="warning">{hipos.length} identified</Badge>
        </div>
        {hipos.length === 0 ? (
          <p className="text-sm text-gray-400">No high-potential candidates identified yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {hipos.map(c => {
              const meta = READINESS_META[c.readinessRating];
              return (
                <div key={c.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar seed={c.id} size="md" ring />
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
        )}
      </div>
    </div>
  );
}

function PerformanceOverridePanel({ candidates, onMutate }: { candidates: Candidate[]; onMutate: () => void }) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleChange(readinessScoreId: string, value: string) {
    setSavingId(readinessScoreId);
    setError('');
    try {
      await api.patch(`/readiness-scores/${readinessScoreId}/performance-override`, {
        gridPerformance: value || null,
      });
      onMutate();
    } catch {
      setError('Failed to update the override. Please try again.');
    } finally {
      setSavingId(null);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Performance Calibration</h3>
      <p className="text-xs text-gray-400 mb-4">
        The performance axis defaults to each candidate&apos;s 360-feedback score. Override it here when you have better data, e.g. from a formal performance review.
      </p>
      {error && <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
      <div className="space-y-2">
        {candidates.map((c) => (
          <div key={c.readinessScoreId} className="flex items-center gap-3 border border-gray-100 rounded-lg px-3 py-2">
            <Avatar seed={c.id} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
              <p className="text-xs text-gray-400 capitalize">Auto-derived: {c.autoPerformance}</p>
            </div>
            <div className="w-56">
              <Select
                value={c.manualGridPerformance ?? ''}
                onChange={(v) => handleChange(c.readinessScoreId, v)}
                options={PERFORMANCE_OVERRIDE_OPTIONS}
                disabled={savingId === c.readinessScoreId}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NineBoxTab({ candidates, onMutate }: { candidates: Candidate[]; onMutate: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-700">9-Box Grid — Performance × Potential</h2>
          <span className="text-xs text-gray-400">{candidates.length} candidates plotted</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Performance (X-axis) reflects assessment outcomes. Potential (Y-axis) reflects readiness trajectory.
        </p>
        <NineBoxGrid candidates={candidates.map(c => ({
          id: c.id,
          name: c.name,
          performance: c.performance,
          potential: c.potential,
          readinessRating: c.readinessRating,
        }))} />
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
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

      <PerformanceOverridePanel candidates={candidates} onMutate={onMutate} />
    </div>
  );
}

// ── Key Role modals ────────────────────────────────────────────────────────────

interface KeyRoleFormModalProps {
  open: boolean;
  keyRole: KeyRole | null; // null = create
  departments: DepartmentDto[];
  users: UserDto[];
  onClose: () => void;
  onSaved: () => void;
}

function KeyRoleFormModal({ open, keyRole, departments, users, onClose, onSaved }: KeyRoleFormModalProps) {
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [criticality, setCriticality] = useState<'critical' | 'high' | 'medium'>('medium');
  const [incumbentId, setIncumbentId] = useState('');
  const [incumbentSince, setIncumbentSince] = useState('');
  const [flightRisk, setFlightRisk] = useState<'high' | 'medium' | 'low'>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(keyRole?.title ?? '');
    setDepartmentId(keyRole?.departmentId ?? '');
    setCriticality(keyRole?.criticality ?? 'medium');
    setIncumbentId(keyRole?.incumbentId ?? '');
    setIncumbentSince(keyRole?.incumbentSince ?? '');
    setFlightRisk(keyRole?.flightRisk ?? 'medium');
    setError('');
  }, [open, keyRole?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const deptOptions = [
    { value: '', label: 'No department' },
    ...departments.filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name })),
  ];
  const incumbentOptions = [
    { value: '', label: 'Vacant' },
    ...users.filter((u) => u.isActive).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
  ];

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Role title is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        departmentId: departmentId || null,
        criticality,
        incumbentId: incumbentId || null,
        incumbentSince: incumbentSince || null,
        flightRisk,
      };
      if (keyRole) {
        await api.patch(`/succession/key-roles/${keyRole.id}`, payload);
      } else {
        await api.post('/succession/key-roles', payload);
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to save key role.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={keyRole ? 'Edit Key Role' : 'Add Key Role'}>
      <div className="space-y-4">
        <Field label="Role title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="e.g. VP Engineering"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Select value={departmentId} onChange={setDepartmentId} options={deptOptions} />
          </Field>
          <Field label="Criticality">
            <Select value={criticality} onChange={(v) => setCriticality(v as 'critical' | 'high' | 'medium')} options={CRITICALITY_OPTIONS} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Incumbent">
            <Select value={incumbentId} onChange={setIncumbentId} options={incumbentOptions} />
          </Field>
          <Field label="Incumbent since">
            <input
              type="date"
              value={incumbentSince}
              onChange={(e) => setIncumbentSince(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Flight risk">
          <Select value={flightRisk} onChange={(v) => setFlightRisk(v as 'high' | 'medium' | 'low')} options={FLIGHT_RISK_OPTIONS} />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : keyRole ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteKeyRoleModal({ keyRole, onClose, onDone }: { keyRole: KeyRole | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!keyRole) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/succession/key-roles/${keyRole.id}`);
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to delete key role.'));
      setLoading(false);
    }
  }

  return (
    <Modal open={!!keyRole} onClose={onClose} title="Delete Key Role">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Delete <span className="font-semibold text-gray-900">{keyRole?.title}</span>? This also removes its successor pipeline. This cannot be undone.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NominateSuccessorModal({ keyRole, users, onClose, onDone }: {
  keyRole: KeyRole | null;
  users: UserDto[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [candidateUserId, setCandidateUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCandidateUserId('');
    setNotes('');
    setError('');
  }, [keyRole?.id]);

  const alreadyNominated = new Set((keyRole?.successors ?? []).map((s) => s.candidateId).filter(Boolean));
  const candidateOptions = users
    .filter((u) => u.isActive && !alreadyNominated.has(u.id))
    .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }));

  async function handleSubmit() {
    if (!keyRole) return;
    if (!candidateUserId) {
      setError('Select a candidate.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/succession/key-roles/${keyRole.id}/successors`, {
        candidateUserId,
        notes: notes.trim() || undefined,
      });
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to nominate successor.'));
      setLoading(false);
    }
  }

  return (
    <Modal open={!!keyRole} onClose={onClose} title={keyRole ? `Nominate Successor — ${keyRole.title}` : 'Nominate Successor'}>
      <div className="space-y-4">
        <Field label="Candidate" required>
          <Select
            value={candidateUserId}
            onChange={setCandidateUserId}
            options={[{ value: '', label: 'Select a candidate…' }, ...candidateOptions]}
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} min-h-[80px]`}
            placeholder="Optional context for this nomination"
          />
        </Field>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Nominating…' : 'Nominate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function KeyRolesTab({ roles, departments, users, onMutate }: {
  roles: KeyRole[];
  departments: DepartmentDto[];
  users: UserDto[];
  onMutate: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formRole, setFormRole] = useState<KeyRole | 'new' | null>(null);
  const [deleteRole, setDeleteRole] = useState<KeyRole | null>(null);
  const [nominateRole, setNominateRole] = useState<KeyRole | null>(null);

  async function handleRemoveSuccessor(roleId: string, successorId: string) {
    if (!window.confirm('Remove this successor nomination?')) return;
    await api.delete(`/succession/key-roles/${roleId}/successors/${successorId}`);
    onMutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setFormRole('new')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} /> Add Key Role
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Key Roles & Succession Pipeline ({roles.length} roles)</h2>
          <div className="flex gap-2 text-xs">
            {Object.entries(CRITICALITY_META).map(([k, v]) => (
              <Badge key={k} variant={v.variant}>{v.label}</Badge>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {roles.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No key roles defined yet. Add your organisation&apos;s critical roles to start tracking succession coverage.
            </div>
          ) : roles.map(role => {
            const isOpen = expanded === role.id;
            const crit = CRITICALITY_META[role.criticality];
            const hasCover = role.successors.length > 0;
            return (
              <div key={role.id}>
                <div className="w-full px-4 py-4 hover:bg-gray-50 transition-colors flex items-center gap-3">
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => setExpanded(isOpen ? null : role.id)}
                  >
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} strokeWidth={2} />
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
                  </button>
                  <div className="flex items-center -space-x-2 shrink-0">
                    {role.successors.slice(0, 3).map(s => (
                      <Avatar key={s.id} seed={s.candidateId ?? s.id} size="sm" ring />
                    ))}
                    {role.successors.length === 0 && (
                      <span className="text-xs text-gray-400 italic">None</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setFormRole(role)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit role"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => setDeleteRole(role)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete role"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-11 pb-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-between pt-3 mb-2">
                      <p className="text-xs text-gray-500 font-medium">
                        Succession Pipeline ({role.successors.length} successors)
                      </p>
                      <button
                        onClick={() => setNominateRole(role)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <UserPlus className="w-3.5 h-3.5" strokeWidth={2} /> Nominate Successor
                      </button>
                    </div>
                    <div className="space-y-2">
                      {role.successors.map((s, idx) => {
                        const rm = s.readiness ? READINESS_META[s.readiness] : null;
                        return (
                          <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                            <span className="text-xs text-gray-400 font-bold w-4">#{idx + 1}</span>
                            <Avatar seed={s.candidateId ?? s.id} size="sm" />
                            <span className="text-sm font-medium text-gray-800 flex-1">{s.name}</span>
                            {rm ? <Badge variant={rm.variant}>{rm.label}</Badge> : <Badge variant="neutral">Not assessed</Badge>}
                            <div className="w-32">
                              {s.compositeScore !== null ? <ScoreBar score={s.compositeScore} /> : <span className="text-xs text-gray-400">—</span>}
                            </div>
                            <button
                              onClick={() => handleRemoveSuccessor(role.id, s.id)}
                              className="p-1 text-gray-300 hover:text-red-600 transition-colors"
                              title="Remove nomination"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        );
                      })}
                      {role.successors.length === 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-600 flex items-center gap-2">
                          <FileWarning className="w-4 h-4 shrink-0" strokeWidth={2} />
                          No successors identified. This role is a succession gap — nominate a candidate above.
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

      <KeyRoleFormModal
        open={formRole !== null}
        keyRole={formRole === 'new' ? null : formRole}
        departments={departments}
        users={users}
        onClose={() => setFormRole(null)}
        onSaved={() => { setFormRole(null); onMutate(); }}
      />
      <DeleteKeyRoleModal
        keyRole={deleteRole}
        onClose={() => setDeleteRole(null)}
        onDone={() => { setDeleteRole(null); onMutate(); }}
      />
      <NominateSuccessorModal
        keyRole={nominateRole}
        users={users}
        onClose={() => setNominateRole(null)}
        onDone={() => { setNominateRole(null); onMutate(); }}
      />
    </div>
  );
}

// ── Talent Pool — Organisation Hierarchy Tree (real manager-based reporting lines) ────

interface OrgNode {
  id: string;
  name: string;
  title: string;
  department: string;
  candidate: Candidate | null; // set when this user is also a succession candidate somewhere
  children: OrgNode[];
}

/** Builds a forest (not a single tree) since real org data can have multiple top-level users
 *  (no manager set) — unlike the old mock, which always had exactly one CEO root. */
function buildOrgForest(users: ApiOrgUser[], candidatesByUserId: Map<string, Candidate>): OrgNode[] {
  const nodes = new Map<string, OrgNode>();
  users.forEach((u) => {
    const candidate = candidatesByUserId.get(u.id) ?? null;
    nodes.set(u.id, {
      id: u.id,
      name: u.name,
      title: candidate?.title ?? u.title ?? '',
      department: candidate?.department ?? u.department ?? '',
      candidate,
      children: [],
    });
  });

  const validIds = new Set(users.map((u) => u.id));
  const roots: OrgNode[] = [];
  users.forEach((u) => {
    const node = nodes.get(u.id)!;
    if (u.managerId && u.managerId !== u.id && validIds.has(u.managerId)) {
      nodes.get(u.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function nodeMatchesQuery(node: OrgNode, q: string): boolean {
  return (
    node.name.toLowerCase().includes(q) ||
    node.title.toLowerCase().includes(q) ||
    node.department.toLowerCase().includes(q)
  );
}

function filterOrgTree(node: OrgNode, q: string): OrgNode | null {
  const children = node.children
    .map((c) => filterOrgTree(c, q))
    .filter((c): c is OrgNode => c !== null);
  if (nodeMatchesQuery(node, q) || children.length > 0) {
    return { ...node, children };
  }
  return null;
}

function collectIds(node: OrgNode, out: string[] = []): string[] {
  out.push(node.id);
  node.children.forEach((c) => collectIds(c, out));
  return out;
}

const READINESS_RING: Record<ReadinessRating, string> = {
  [ReadinessRating.READY_NOW]: '#22c55e',
  [ReadinessRating.ONE_TWO_YEARS]: '#facc15',
  [ReadinessRating.DEVELOPING]: '#60a5fa',
  [ReadinessRating.NOT_YET_READY]: '#9ca3af',
};
const INCUMBENT_RING = '#cbd5e1';

function OrgChartNode({
  node,
  openIds,
  onToggle,
  forceOpen,
}: {
  node: OrgNode;
  openIds: Set<string>;
  onToggle: (id: string) => void;
  forceOpen: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = forceOpen || openIds.has(node.id);
  const rm = node.candidate ? READINESS_META[node.candidate.readinessRating] : null;
  const ringColor = node.candidate ? READINESS_RING[node.candidate.readinessRating] : INCUMBENT_RING;

  return (
    <li>
      <div className="relative inline-flex flex-col items-center w-44">
        {/* Avatar — overlaps the top edge of the card, ringed by readiness colour */}
        <div
          className="relative z-10 rounded-full p-0.5"
          style={{ background: 'var(--bg-surface)', boxShadow: `0 0 0 3px ${ringColor}` }}
        >
          <Avatar seed={node.id} size="xl" />
        </div>

        {/* Card */}
        <div className="w-full -mt-8 pt-10 pb-3 px-3 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-bold text-gray-900 truncate">{node.name}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{node.title}</p>
          {node.candidate && rm ? (
            <div className="mt-2 flex flex-col items-center gap-1">
              <Badge variant={rm.variant} className="!text-[10px]">{rm.label}</Badge>
              <span className="text-[11px] font-semibold text-gray-600 tabular-nums">{node.candidate.compositeScore.toFixed(0)} pts</span>
            </div>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              <Briefcase className="w-3 h-3" strokeWidth={2} /> Team member
            </span>
          )}
        </div>

        {/* Expand / collapse toggle — overlaps the bottom edge of the card */}
        {hasChildren && (
          <button
            onClick={() => onToggle(node.id)}
            className="relative z-10 -mt-3 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            {isOpen ? <ChevronUp className="w-3 h-3" strokeWidth={2.5} /> : <ChevronDown className="w-3 h-3" strokeWidth={2.5} />}
            {node.children.length}
          </button>
        )}
      </div>

      {isOpen && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} openIds={openIds} onToggle={onToggle} forceOpen={forceOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TalentPoolTab({ users, candidates }: { users: ApiOrgUser[]; candidates: Candidate[] }) {
  const [search, setSearch] = useState('');
  const candidatesByUserId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const forest = useMemo(() => buildOrgForest(users, candidatesByUserId), [users, candidatesByUserId]);
  const allIds = useMemo(() => forest.flatMap((r) => collectIds(r)), [forest]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(forest.map((r) => r.id)));

  const query = search.trim().toLowerCase();
  const displayForest = query
    ? forest.map((r) => filterOrgTree(r, query)).filter((r): r is OrgNode => r !== null)
    : forest;

  const totalCount = allIds.length;
  const candidateCount = candidates.length;
  const incumbentCount = Math.max(0, totalCount - candidateCount);

  function toggleNode(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function expandAll() {
    setOpenIds(new Set(allIds));
  }
  function collapseAll() {
    setOpenIds(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Summary + legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">
          <Network className="w-3.5 h-3.5" strokeWidth={2} />
          {totalCount} people · {candidateCount} succession candidates · {incumbentCount} others
        </span>
        <span className="flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5" strokeWidth={2} /> Team member — not currently a succession candidate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Candidate readiness colour-coded
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search the org chart…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Org chart tree */}
      <div className="bg-white rounded-2xl border border-gray-200">
        {displayForest.length > 0 ? (
          <div className="org-chart-scroll">
            <ul className="org-chart">
              {displayForest.map((root) => (
                <OrgChartNode key={root.id} node={root} openIds={openIds} onToggle={toggleNode} forceOpen={Boolean(query)} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-16 text-sm text-gray-400">
            {users.length === 0
              ? 'No users yet — add team members in Settings to build the org chart.'
              : `No people match "${search}".`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuccessionPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const organisation = useAuthStore((s) => s.organisation);

  const { data: candidatesRaw, mutate: mutateCandidates, isLoading: loadingCandidates, error: candidatesError } = useApi<ApiCandidate[]>('/succession/candidates');
  const { data: keyRolesRaw, mutate: mutateKeyRoles, isLoading: loadingKeyRoles, error: keyRolesError } = useApi<ApiKeyRole[]>('/succession/key-roles');
  const { data: benchRaw, isLoading: loadingBench, error: benchError } = useApi<ApiBench[]>('/succession/bench');
  const { data: orgChartRaw, isLoading: loadingOrgChart, error: orgChartError } = useApi<ApiOrgUser[]>('/succession/org-chart');
  const { data: departments } = useApi<DepartmentDto[]>('/organisations/me/departments');
  const { data: allUsers } = useApi<UserDto[]>('/users');

  const candidates = useMemo(() => (candidatesRaw ?? []).map(mapCandidate), [candidatesRaw]);
  const roles = useMemo(() => (keyRolesRaw ?? []).map(mapKeyRole), [keyRolesRaw]);
  const bench = useMemo(() => (benchRaw ?? []).map(mapBench), [benchRaw]);

  function refreshAll() {
    mutateCandidates();
    mutateKeyRoles();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await generateSuccessionPdf({
        organisationName: organisation?.name,
        generatedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          title: c.title,
          department: c.department,
          performance: c.performance,
          potential: c.potential,
          readinessRating: c.readinessRating,
          compositeScore: c.compositeScore,
          keyStrengths: c.keyStrengths,
          developmentAreas: c.developmentAreas,
        })),
        keyRoles: roles.map((r) => ({
          id: r.id,
          title: r.title,
          department: r.department,
          incumbent: r.incumbent,
          incumbentTenure: r.incumbentTenure,
          criticality: r.criticality,
          successors: r.successors.map((s) => ({
            candidateId: s.candidateId ?? s.id,
            name: s.name,
            readiness: s.readiness ?? ReadinessRating.NOT_YET_READY,
            compositeScore: s.compositeScore ?? 0,
          })),
        })),
        bench,
      });
    } finally {
      setExporting(false);
    }
  }

  const isLoading = loadingCandidates || loadingKeyRoles || loadingBench || loadingOrgChart;
  const loadError = candidatesError || keyRolesError || benchError || orgChartError;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Succession Planning</h1>
          <p className="text-sm text-gray-500 mt-1">Leadership talent pipeline, readiness overview, and bench strength analysis.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            Updated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <button
            onClick={handleExport}
            disabled={exporting || isLoading}
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
                <Download className="w-4 h-4" strokeWidth={2} />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          Failed to load succession data. Please refresh the page or try again later.
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Tab Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab candidates={candidates} roles={roles} bench={bench} />
          )}
          {activeTab === 'ninebox' && (
            <NineBoxTab candidates={candidates} onMutate={mutateCandidates} />
          )}
          {activeTab === 'key-roles' && (
            <KeyRolesTab roles={roles} departments={departments ?? []} users={allUsers ?? []} onMutate={refreshAll} />
          )}
          {activeTab === 'talent' && (
            <TalentPoolTab users={orgChartRaw ?? []} candidates={candidates} />
          )}
        </>
      )}
    </div>
  );
}
