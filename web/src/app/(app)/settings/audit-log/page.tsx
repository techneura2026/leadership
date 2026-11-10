'use client';

import { useState } from 'react';
import { Download, ScrollText } from 'lucide-react';
import { UserRole } from '@leaderprism/shared';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

interface AuditEntry {
  id: string;
  actorType: 'user' | 'api_client' | 'system';
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ACTOR_LABEL = { user: 'User', api_client: 'API key', system: 'System' } as const;
const inputCls =
  'bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function AuditLogPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const [action, setAction] = useState('');
  const [actorType, setActorType] = useState('');
  const [filters, setFilters] = useState({ action: '', actorType: '' });
  const [cursors, setCursors] = useState<string[]>([]);

  const params = new URLSearchParams({ limit: '50' });
  if (filters.action) params.set('action', filters.action);
  if (filters.actorType) params.set('actorType', filters.actorType);
  if (cursors.length) params.set('cursor', cursors[cursors.length - 1]);
  const { data, isLoading } = useApi<{ data: AuditEntry[]; nextCursor: string | null }>(
    isAdmin ? `/audit-logs?${params.toString()}` : null,
  );

  async function exportCsv() {
    const res = await api.get('/audit-logs/export.csv', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (user && !isAdmin) {
    return <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600">Only organisation admins can view the audit log.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-gray-500" /> Audit log
          </h1>
          <p className="mt-1 text-sm text-gray-500">Integration activity, HRIS syncs, 9-box overrides and SSO sign-ins. Entries cannot be changed.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setCursors([]);
          setFilters({ action: action.trim(), actorType });
        }}
      >
        <div>
          <label htmlFor="audit-action" className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <input id="audit-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. integration.employees.synced" className={`${inputCls} w-72`} />
        </div>
        <div>
          <label htmlFor="audit-actor" className="block text-xs font-medium text-gray-600 mb-1">Actor</label>
          <select id="audit-actor" value={actorType} onChange={(e) => setActorType(e.target.value)} className={inputCls}>
            <option value="">All</option>
            <option value="user">User</option>
            <option value="api_client">API key</option>
            <option value="system">System</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Apply</button>
      </form>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : !data || data.data.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500">No audit entries match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3"><Badge variant={e.actorType === 'user' ? 'info' : 'neutral'}>{ACTOR_LABEL[e.actorType]}</Badge></td>
                  <td className="px-4 py-3"><code className="text-xs text-gray-800">{e.action}</code></td>
                  <td className="px-4 py-3 text-gray-600">{e.entityType}{e.entityId ? <span className="block text-xs text-gray-400 break-all">{e.entityId}</span> : null}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 break-all">
                    {e.reason ? <span className="block text-gray-700">“{e.reason}”</span> : null}
                    {Object.keys(e.metadata ?? {}).length ? JSON.stringify(e.metadata) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex justify-between">
        <button disabled={cursors.length === 0} onClick={() => setCursors((c) => c.slice(0, -1))} className="text-sm font-medium text-blue-600 disabled:text-gray-300">
          ← Newer
        </button>
        <button disabled={!data?.nextCursor} onClick={() => data?.nextCursor && setCursors((c) => [...c, data.nextCursor as string])} className="text-sm font-medium text-blue-600 disabled:text-gray-300">
          Older →
        </button>
      </div>
    </div>
  );
}
