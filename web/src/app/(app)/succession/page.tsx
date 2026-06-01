'use client';

import { useApi } from '@/hooks/useApi';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { NineBoxGrid } from '@/components/charts/NineBoxGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReadinessRating } from '@leaderprism/shared';

const READINESS_BADGE: Record<string, { variant: 'success' | 'warning' | 'info' | 'neutral' | 'error'; label: string }> = {
  [ReadinessRating.READY_NOW]:      { variant: 'success',  label: 'Ready Now' },
  [ReadinessRating.ONE_TWO_YEARS]:  { variant: 'warning',  label: '1-2 Years' },
  [ReadinessRating.DEVELOPING]:     { variant: 'info',     label: 'Developing' },
  [ReadinessRating.NOT_YET_READY]:  { variant: 'neutral',  label: 'Not Yet Ready' },
};

export default function SuccessionPage() {
  const { data: succession, isLoading } = useApi<any>('/succession/dashboard');
  const candidates: any[] = (succession?.byRole ?? []).flatMap((role: any) =>
    (role.candidates ?? []).map((c: any) => ({
      ...c,
      roleProfileTitle: role.roleTitle !== 'Unassigned' ? role.roleTitle : null,
    })),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Succession Planning</h1>
        <p className="text-sm text-gray-500 mt-1">Leadership talent pipeline and readiness overview.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center pt-20"><Spinner /></div>
      ) : candidates.length === 0 ? (
        <EmptyState message="No readiness assessments completed yet. Run a Readiness assessment to populate the succession dashboard." />
      ) : (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {Object.entries(READINESS_BADGE).map(([rating, meta]) => {
              const count = candidates.filter(c => c.readinessRating === rating).length;
              return (
                <div key={rating} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{count}</p>
                  <Badge variant={meta.variant} className="mt-1">{meta.label}</Badge>
                </div>
              );
            })}
          </div>

          {/* 9-Box Grid */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">9-Box Grid — Performance × Potential</h2>
            <NineBoxGrid candidates={candidates.map((c: any) => ({
              name: c.name,
              performance: c.gridPerformance ?? 'medium',
              potential: c.gridPotential ?? 'medium',
              readinessRating: c.readinessRating,
            }))} />
          </div>

          {/* Talent pool table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Talent Pool ({candidates.length} candidates)</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3">Candidate</th>
                  <th className="text-left px-4 py-3">Target Role</th>
                  <th className="text-left px-4 py-3">Readiness</th>
                  <th className="text-right px-4 py-3">Composite Score</th>
                  <th className="text-left px-4 py-3">Performance</th>
                  <th className="text-left px-4 py-3">Potential</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c: any) => {
                  const meta = READINESS_BADGE[c.readinessRating] ?? { variant: 'neutral', label: c.readinessRating };
                  return (
                    <tr key={c.participantId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.roleProfileTitle ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{c.compositeScore?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{c.gridPerformance}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{c.gridPotential}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
