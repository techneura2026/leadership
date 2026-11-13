'use client';

import { useState } from 'react';
import { KeyRound, Plus, Copy, Check } from 'lucide-react';
import type { ApiClientDto, CreatedApiClientDto, IntegrationScope } from '@leaderprism/shared';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

/** Mirrors api/src/integrations/api-clients/scopes.ts. */
const SCOPES: { value: IntegrationScope; help: string }[] = [
  { value: 'employees:write', help: 'Sync employees and departments' },
  { value: 'assessments:write', help: 'Start assessments for review cycles' },
  { value: 'results:read', help: 'Read competency and 360° results' },
  { value: 'reports:read', help: 'Request and download PDF reports' },
  { value: 'sso:issue', help: 'Sign employees in from the HRIS' },
  { value: 'scores:write', help: 'Send final performance scores (9-box)' },
  { value: 'talent:read', help: 'Read readiness, 9-box and succession' },
  { value: 'personality:read', help: 'Read personality profiles (development use only)' },
];

/** One-click set for connecting an HRIS: sync employees, sign HR admins in, read results. */
const HRIS_PRESET: IntegrationScope[] = ['employees:write', 'sso:issue', 'results:read'];
const OPTIONAL_HRIS = new Set<IntegrationScope>(['assessments:write', 'reports:read', 'scores:write', 'talent:read']);

function ScopePicker({ value, onChange }: { value: IntegrationScope[]; onChange: (s: IntegrationScope[]) => void }) {
  return (
    <fieldset>
      <div className="flex items-center justify-between mb-2">
        <legend className="block text-xs font-medium text-gray-600">Scopes</legend>
        <button
          type="button"
          onClick={() => onChange([...HRIS_PRESET])}
          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          HRIS integration
        </button>
      </div>
      <p className="mb-2 text-xs text-gray-500">The HRIS preset ticks employees:write, sso:issue and results:read. Other HRIS scopes are optional.</p>
      <div className="space-y-2">
        {SCOPES.map((s) => (
          <label key={s.value} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              aria-label={s.value}
              className="mt-0.5"
              checked={value.includes(s.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, s.value] : value.filter((x) => x !== s.value))}
            />
            <span>
              <code className="text-xs text-gray-800">{s.value}</code>
              {OPTIONAL_HRIS.has(s.value) && <span className="ml-1 text-xs text-gray-400">(optional for HRIS)</span>}
              <span className="block text-xs text-gray-500">{s.help}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ApiKeysSection() {
  const { data: clients, isLoading, mutate } = useApi<ApiClientDto[]>('/integrations/api-clients');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<IntegrationScope[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiClientDto | null>(null);
  const [copied, setCopied] = useState<'key' | 'connection' | null>(null);
  const [editing, setEditing] = useState<ApiClientDto | null>(null);
  const [editScopes, setEditScopes] = useState<IntegrationScope[]>([]);

  function resetForm() {
    setName('');
    setScopes([]);
    setError(null);
  }

  async function createKey() {
    if (!name.trim() || scopes.length === 0) {
      setError('Enter a name and choose at least one scope.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/integrations/api-clients', { name: name.trim(), scopes });
      setCreated(res.data.data);
      setCreateOpen(false);
      resetForm();
      await mutate();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not create the key.');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(client: ApiClientDto) {
    if (!window.confirm(`Revoke "${client.name}"? Integrations using this key will stop working immediately.`)) return;
    await api.delete(`/integrations/api-clients/${client.id}`);
    await mutate();
  }

  function startEdit(client: ApiClientDto) {
    setEditing(client);
    setEditScopes(client.scopes);
    setError(null);
  }

  async function savePermissions() {
    if (!editing) return;
    if (editScopes.length === 0) {
      setError('Choose at least one scope.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/integrations/api-clients/${editing.id}`, { scopes: editScopes });
      setEditing(null);
      await mutate();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not update the permissions.');
    } finally {
      setSaving(false);
    }
  }

  async function copy(kind: 'key' | 'connection') {
    if (!created) return;
    await navigator.clipboard.writeText(kind === 'key' ? created.rawKey : created.connectionString ?? '').catch(() => undefined);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">API keys</h2>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Create API key
        </button>
      </div>

      {created && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">New key for “{created.name}”</p>
          <div className="mt-2 flex items-center gap-2">
            <code data-testid="new-api-key" className="flex-1 break-all rounded-md bg-white px-3 py-2 text-xs text-gray-800 border border-amber-200">
              {created.rawKey}
            </code>
            <button
              onClick={() => copy('key')}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              {copied === 'key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied === 'key' ? 'Copied' : 'Copy'}
            </button>
          </div>
          {created.connectionString && (
            <>
              <p className="mt-3 text-sm font-medium text-amber-900">HRIS connection string</p>
              <div className="mt-1 flex items-center gap-2">
                <code data-testid="new-connection-string" className="flex-1 break-all rounded-md bg-white px-3 py-2 text-xs text-gray-800 border border-amber-200">
                  {created.connectionString}
                </code>
                <button
                  onClick={() => copy('connection')}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  {copied === 'connection' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied === 'connection' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-amber-800">
            {created.connectionString ? 'This key and connection string will not be shown again.' : 'This key will not be shown again.'}
          </p>
        </div>
      )}

      <div className="px-6 py-4 overflow-x-auto">
        {isLoading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : !clients || clients.length === 0 ? (
          <p className="py-6 text-sm text-gray-500">No API keys yet. Create one to connect your HRIS.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Key</th>
                <th className="py-2 pr-4 font-medium">Scopes</th>
                <th className="py-2 pr-4 font-medium">Last used</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 align-top">
                  <td className="py-3 pr-4 font-medium text-gray-900">{c.name}</td>
                  <td className="py-3 pr-4"><code className="text-xs text-gray-600">lpk_{c.keyPrefix}_…</code></td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {c.scopes.map((s) => <Badge key={s} variant="info">{s}</Badge>)}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">{c.lastUsedAt ? formatDate(c.lastUsedAt) : 'Never'}</td>
                  <td className="py-3 text-right">
                    {c.revokedAt ? (
                      <Badge variant="neutral">Revoked</Badge>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => startEdit(c)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          Edit permissions
                        </button>
                        <button onClick={() => revoke(c)} className="text-sm font-medium text-red-600 hover:text-red-700">
                          Revoke
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title="Create API key">
        <div className="space-y-4">
          <div>
            <label htmlFor="api-key-name" className="block text-xs font-medium text-gray-600 mb-1">Key name</label>
            <input
              id="api-key-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production HRIS"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <ScopePicker value={scopes} onChange={setScopes} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setCreateOpen(false); resetForm(); }}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={createKey}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create key'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit permissions${editing ? ` — ${editing.name}` : ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">The key and its secret do not change. New permissions apply on the key’s next request.</p>
          <ScopePicker value={editScopes} onChange={setEditScopes} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={savePermissions}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
