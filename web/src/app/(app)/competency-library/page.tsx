'use client';

import { useMemo, useState } from 'react';
import {
  Plus, X, Search, BookOpen, Users, MessageSquare, Compass, Target,
  Sparkles, Brain, ShieldCheck, Lightbulb, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { CompetencyDto } from '@leaderprism/shared';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DomainDto {
  id: string;
  organisationId: string | null;
  name: string;
  code: string;
  colour: string;
  displayOrder: number;
}

interface CompetencyItem extends CompetencyDto {
  organisationId: string | null;
  isActive: boolean;
}

// ── Domain icon lookup ───────────────────────────────────────────────────────
// Backend domains are seeded with a fixed code (COMM, TEAM, ...); custom org
// domains (if any are ever added) fall back to a generic icon.

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  COMM: MessageSquare,
  TEAM: Users,
  DECS: Compass,
  STRA: Target,
  EMOT: Brain,
  ACCT: ShieldCheck,
  CHNG: Sparkles,
  RESL: Lightbulb,
};

function domainIcon(code: string): LucideIcon {
  return DOMAIN_ICONS[code] ?? BookOpen;
}

const LEVEL_COLOURS = [
  'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50',
  'bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800/50',
  'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50',
  'bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50',
];

function domainOf(domains: DomainDto[], domainId: string): DomainDto | undefined {
  return domains.find((d) => d.id === domainId);
}

// ── Competency Card ───────────────────────────────────────────────────────────

function CompetencyCard({
  competency,
  domain,
  onOpen,
}: {
  competency: CompetencyItem;
  domain: DomainDto | undefined;
  onOpen: () => void;
}) {
  const Icon = domainIcon(domain?.code ?? '');
  const colour = domain?.colour ?? '#6B7280';
  return (
    <button
      onClick={onOpen}
      className="text-left bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${colour}1a`, color: colour }}
        >
          <Icon className="w-5 h-5" strokeWidth={1.8} />
        </div>
        {competency.organisationId === null && <Badge variant="neutral">System</Badge>}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1.5 leading-snug">{competency.name}</h3>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4 flex-1">{competency.description}</p>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span
          className="text-[11px] font-medium px-2 py-1 rounded-full border"
          style={{ backgroundColor: `${colour}0d`, color: colour, borderColor: `${colour}33` }}
        >
          {domain?.name ?? 'Uncategorised'}
        </span>
        <span className="text-[11px] text-gray-400 shrink-0">{competency.levels.length} levels</span>
      </div>
    </button>
  );
}

// ── Add Competency Modal ─────────────────────────────────────────────────────

function AddCompetencyModal({
  open,
  onClose,
  domains,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  domains: DomainDto[];
  onCreate: (payload: { domainId: string; name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(''); setDomainId(''); setDescription(''); setError(null);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleCreate() {
    if (!name || !domainId) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ domainId, name, description });
      reset();
      onClose();
    } catch {
      setError('Failed to create competency. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New Competency" className="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            placeholder="e.g. Strategic Communication"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Domain <span className="text-red-500">*</span></label>
          <Select
            value={domainId}
            onChange={setDomainId}
            options={domains.map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Select domain…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            placeholder="Brief description of this competency…"
          />
        </div>

        <p className="text-xs text-gray-400">
          Proficiency levels and behavioural indicators can be added once the framework editor is available; the competency is created immediately and can be selected in new assessments right away.
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3 pt-4 border-t border-gray-200/60">
          <button onClick={handleClose} disabled={saving} className="flex-1 sm:flex-none sm:w-24 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors text-gray-700">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name || !domainId || saving}
            className="flex-1 sm:flex-none sm:w-44 bg-blue-600 text-white font-medium rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Add Competency'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Competency Detail Modal ───────────────────────────────────────────────────

function CompetencyDetailModal({
  competency,
  domain,
  onClose,
}: {
  competency: CompetencyItem | null;
  domain: DomainDto | undefined;
  onClose: () => void;
}) {
  if (!competency) return null;
  const Icon = domainIcon(domain?.code ?? '');
  const colour = domain?.colour ?? '#6B7280';

  return (
    <Modal open={Boolean(competency)} onClose={onClose} className="max-w-2xl">
      <div className="flex items-start gap-3 mb-1">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${colour}1a`, color: colour }}
        >
          <Icon className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-semibold text-gray-900">{competency.name}</h2>
            {competency.organisationId === null && <Badge variant="neutral">System</Badge>}
          </div>
          <span
            className="text-[11px] font-medium px-2 py-1 rounded-full border"
            style={{ backgroundColor: `${colour}0d`, color: colour, borderColor: `${colour}33` }}
          >
            {domain?.name ?? 'Uncategorised'}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 shrink-0" aria-label="Close">
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {competency.description && <p className="text-sm text-gray-600 mt-4 mb-6 leading-relaxed">{competency.description}</p>}

      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Proficiency Levels</h4>
      {competency.levels.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {competency.levels.map((l) => (
            <div key={l.level} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', LEVEL_COLOURS[(l.level - 1) % LEVEL_COLOURS.length])}>{l.label}</span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{l.description}</p>
              {l.indicators.length > 0 && (
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
      ) : (
        <p className="text-xs text-gray-400 mb-6">No proficiency levels defined yet for this competency.</p>
      )}

      {competency.behaviours.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Key Behaviours</h4>
          <ul className="space-y-1.5">
            {competency.behaviours.map((b) => (
              <li key={b.id} className="text-xs text-gray-500 flex items-start gap-1.5">
                <span className="text-gray-300 mt-0.5">•</span>
                <span>{b.statement}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetencyLibraryPage() {
  const { data: domains, isLoading: domainsLoading } = useApi<DomainDto[]>('/items/domains');
  const { data: competencies, isLoading: competenciesLoading, mutate } = useApi<CompetencyItem[]>('/items/competencies');

  const [activeDomain, setActiveDomain] = useState('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selected, setSelected] = useState<CompetencyItem | null>(null);

  const domainList = domains ?? [];
  const competencyList = competencies ?? [];
  const loading = domainsLoading || competenciesLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (competencies ?? []).filter((c) => {
      const matchDomain = !activeDomain || c.domainId === activeDomain;
      const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
      return matchDomain && matchSearch;
    });
  }, [competencies, activeDomain, search]);

  async function handleCreate(payload: { domainId: string; name: string; description: string }) {
    await api.post('/items/competencies', {
      domainId: payload.domainId,
      name: payload.name,
      description: payload.description || undefined,
    });
    await mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Competency Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the competency frameworks used in assessments.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Competency
        </button>
      </div>

      {/* Toolbar: domain chips + search */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 flex-wrap overflow-x-auto w-fit max-w-full">
          <button
            onClick={() => setActiveDomain('')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
              !activeDomain ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            All ({competencyList.length})
          </button>
          {domainList.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDomain(d.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                activeDomain === d.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search competencies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all w-full sm:w-56"
          />
        </div>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center">
          <Spinner />
          <span className="text-sm text-gray-500">Loading competency library…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-dashed border-gray-200 bg-white">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-gray-50 border border-gray-100">
            <BookOpen className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No competencies found</h3>
          <p className="text-sm text-gray-400 max-w-xs leading-relaxed">Try a different domain or search term, or add a new competency.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((c) => (
            <CompetencyCard key={c.id} competency={c} domain={domainOf(domainList, c.domainId)} onOpen={() => setSelected(c)} />
          ))}
        </div>
      )}

      <AddCompetencyModal open={showAddForm} onClose={() => setShowAddForm(false)} domains={domainList} onCreate={handleCreate} />
      <CompetencyDetailModal competency={selected} domain={selected ? domainOf(domainList, selected.domainId) : undefined} onClose={() => setSelected(null)} />
    </div>
  );
}
