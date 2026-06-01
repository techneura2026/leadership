'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface Domain { id: string; name: string; code: string; colour: string; }
interface Level { level: number; label: string; description: string; indicators: string[]; }
interface Competency { id: string; name: string; description: string; organisationId: string | null; levels: Level[]; }

const DOMAIN_COLOURS: Record<string, string> = {
  people: 'bg-blue-100 text-blue-700',
  conceptual: 'bg-purple-100 text-purple-700',
  behavioural: 'bg-green-100 text-green-700',
  technical: 'bg-orange-100 text-orange-700',
};

const LEVEL_COLOURS = ['bg-red-100 text-red-700', 'bg-yellow-100 text-yellow-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700'];

export default function CompetencyLibraryPage() {
  const [activeDomain, setActiveDomain] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: domains, isLoading: domainsLoading } = useApi<Domain[]>('/items/domains');
  const { data: competencies, mutate, isLoading } = useApi<Competency[]>(
    activeDomain ? `/items/competencies?domainId=${activeDomain}` : '/items/competencies',
  );

  async function addCompetency() {
    if (!newName || !newDomain) return;
    setSaving(true);
    try {
      await api.post('/items/competencies', { name: newName, domainId: newDomain, description: newDesc });
      setNewName(''); setNewDesc(''); setShowAddForm(false);
      mutate();
    } finally {
      setSaving(false);
    }
  }

  if (domainsLoading) return <div className="flex justify-center pt-20"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Competency Library</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the competency frameworks used in assessments.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
          + Add Competency
        </button>
      </div>

      {/* Domain tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setActiveDomain('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!activeDomain ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {(domains ?? []).map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDomain(d.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeDomain === d.id ? 'bg-gray-800 text-white' : `${DOMAIN_COLOURS[d.code] ?? 'bg-gray-100 text-gray-600'} hover:opacity-80`}`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Add competency form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Add New Competency</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Strategic Communication" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Domain *</label>
              <select value={newDomain} onChange={e => setNewDomain(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select domain…</option>
                {(domains ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Description</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of this competency…" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddForm(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={addCompetency} disabled={saving || !newName || !newDomain}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Competency'}
            </button>
          </div>
        </div>
      )}

      {/* Competency list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (competencies ?? []).length === 0 ? (
        <EmptyState message="No competencies found." />
      ) : (
        <div className="space-y-2">
          {(competencies ?? []).map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                  {!c.organisationId && <Badge variant="neutral">System</Badge>}
                </div>
                <span className="text-gray-400 text-lg">{expanded === c.id ? '↑' : '↓'}</span>
              </button>

              {expanded === c.id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {c.description && <p className="text-sm text-gray-500 mt-3 mb-4">{c.description}</p>}
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Proficiency Levels</h4>
                  <div className="space-y-2">
                    {(c.levels ?? []).map((l) => (
                      <div key={l.level} className="flex gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full h-fit mt-0.5 ${LEVEL_COLOURS[l.level - 1]}`}>
                          {l.label}
                        </span>
                        <div>
                          <p className="text-sm text-gray-700">{l.description}</p>
                          {(l.indicators ?? []).length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {l.indicators.map((ind, i) => (
                                <li key={i} className="text-xs text-gray-500 flex gap-1"><span>•</span>{ind}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
