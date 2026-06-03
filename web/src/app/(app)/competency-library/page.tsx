'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

interface Domain { id: string; name: string; code: string; colour: string; }
interface Level { level: number; label: string; description: string; indicators: string[]; }
interface Competency { id: string; name: string; description: string; organisationId: string | null; levels: Level[]; }

const LEVEL_COLOURS = [
  'bg-red-50 text-red-700 border-red-200/60',
  'bg-yellow-50 text-yellow-700 border-yellow-200/60',
  'bg-blue-50 text-blue-700 border-blue-200/60',
  'bg-green-50 text-green-700 border-green-200/60'
];

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
          <p className="text-sm text-gray-500 mt-0.5">Manage the competency frameworks used in assessments.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Competency
        </button>
      </div>

      {/* Domain tabs */}
      <div className="flex gap-1 mb-6 border border-gray-200 rounded-lg p-0.5 bg-gray-50 flex-wrap overflow-x-auto w-fit max-w-full">
        <button
          onClick={() => setActiveDomain('')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
            !activeDomain ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          All
        </button>
        {(domains ?? []).map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDomain(d.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
              activeDomain === d.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Add competency form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Add New Competency</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
                placeholder="e.g. Strategic Communication" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Domain <span className="text-red-500">*</span></label>
              <Select
                value={newDomain}
                onChange={setNewDomain}
                options={(domains ?? []).map(d => ({ value: d.id, label: d.name }))}
                placeholder="Select domain…"
              />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
              placeholder="Brief description of this competency…" />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-200/60">
            <button onClick={() => setShowAddForm(false)} className="flex-1 sm:flex-none sm:w-24 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-white transition-colors text-gray-700">Cancel</button>
            <button onClick={addCompetency} disabled={saving || !newName || !newDomain}
              className="flex-1 sm:flex-none sm:w-40 bg-blue-600 text-white font-medium rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {(competencies ?? []).map((c, i) => (
            <div key={c.id} className={cn("group", i > 0 && "border-t border-gray-100")}>
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                  {!c.organisationId && <Badge variant="neutral">System</Badge>}
                </div>
                <svg
                  className={cn("w-4 h-4 text-gray-400 transition-transform duration-200 group-hover:text-gray-600", expanded === c.id && "rotate-180")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === c.id && (
                <div className="px-5 pb-5 pt-1">
                  {c.description && <p className="text-sm text-gray-600 mb-5">{c.description}</p>}
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Proficiency Levels</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(c.levels ?? []).map((l) => (
                      <div key={l.level} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", LEVEL_COLOURS[l.level - 1])}>
                            {l.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{l.description}</p>
                        {(l.indicators ?? []).length > 0 && (
                          <ul className="space-y-1.5">
                            {l.indicators.map((ind, i) => (
                              <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                                <span className="text-gray-300 mt-0.5">•</span>
                                <span>{ind}</span>
                              </li>
                            ))}
                          </ul>
                        )}
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
