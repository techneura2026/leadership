'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Plus, X, Search, Paperclip, Upload, Download, FileText,
  BookOpen, Users, MessageSquare, Compass, Target, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Domain {
  id: string;
  name: string;
  code: string;
  icon: LucideIcon;
  chip: string;
  iconBg: string;
}

interface Level {
  level: number;
  label: string;
  description: string;
  indicators: string[];
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string | null; // null for pre-seeded demo attachments with no real backing file
  uploadedAt: string;
}

interface Competency {
  id: string;
  name: string;
  domainId: string;
  description: string;
  isSystem: boolean;
  levels: Level[];
  attachments: Attachment[];
}

// ── Mock Domains ──────────────────────────────────────────────────────────────

const MOCK_DOMAINS: Domain[] = [
  { id: 'd1', name: 'Leadership & People', code: 'LEAD', icon: Users, chip: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60', iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { id: 'd2', name: 'Communication & Influence', code: 'COMM', icon: MessageSquare, chip: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60', iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'd3', name: 'Strategic Thinking', code: 'STRAT', icon: Compass, chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60', iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
  { id: 'd4', name: 'Execution & Results', code: 'EXEC', icon: Target, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60', iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { id: 'd5', name: 'Innovation & Change', code: 'INNOV', icon: Sparkles, chip: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60', iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' },
];

const LEVEL_COLOURS = [
  'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50',
  'bg-yellow-50 text-yellow-700 border-yellow-200/60 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800/50',
  'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50',
  'bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50',
];

function levels(desc: [string, string[]][]): Level[] {
  const labels = ['Foundational', 'Developing', 'Proficient', 'Expert'];
  return desc.map(([description, indicators], i) => ({ level: i + 1, label: labels[i], description, indicators }));
}

// ── Mock Competencies ─────────────────────────────────────────────────────────

const MOCK_COMPETENCIES: Competency[] = [
  {
    id: 'c1', domainId: 'd1', isSystem: true,
    name: 'Team Leadership & Development',
    description: 'Building, motivating, and developing high-performing teams that consistently deliver results.',
    levels: levels([
      ['Manages day-to-day tasks but relies on others to resolve team conflicts.', ['Assigns tasks based on availability rather than strengths', 'Struggles to give constructive feedback']],
      ['Builds working relationships and provides basic coaching to direct reports.', ['Delegates routine tasks appropriately', 'Gives feedback but avoids difficult conversations']],
      ['Actively develops team members and builds a culture of accountability.', ['Identifies and grows individual strengths', 'Holds team members accountable to commitments']],
      ['Builds bench strength and creates a high-trust, high-performance team culture.', ['Develops future leaders within the team', 'Anticipates and resolves conflict before it escalates']],
    ]),
    attachments: [
      { id: 'a1', name: 'Team-Leadership-Rubric.pdf', size: 482_000, type: 'application/pdf', url: null, uploadedAt: '2026-05-12T09:00:00Z' },
    ],
  },
  {
    id: 'c2', domainId: 'd1', isSystem: true,
    name: 'Coaching & Mentoring',
    description: "Guiding others' growth through structured feedback, coaching conversations, and mentorship.",
    levels: levels([
      ['Offers guidance only when explicitly asked.', ['Provides instructions rather than asking questions', 'Feedback is infrequent and generic']],
      ['Uses basic coaching questions to help others think through problems.', ['Asks open-ended questions in 1:1s', 'Sets simple development goals with reports']],
      ['Applies structured coaching models to unlock others’ potential.', ['Uses GROW or similar coaching frameworks', 'Tailors coaching style to the individual']],
      ['Recognised as a go-to coach who develops leaders beyond their own team.', ['Mentors high-potential talent across the organisation', 'Builds coaching capability in other managers']],
    ]),
    attachments: [],
  },
  {
    id: 'c3', domainId: 'd2', isSystem: true,
    name: 'Strategic Communication',
    description: 'Crafting and delivering messages that inform, persuade, and align diverse audiences.',
    levels: levels([
      ['Communicates clearly on routine, familiar topics.', ['Shares updates via standard channels', 'Struggles to simplify complex information']],
      ['Adapts communication style for different audiences.', ['Tailors tone for peers vs. leadership', 'Uses data to support key points']],
      ['Crafts compelling narratives that drive alignment across teams.', ['Frames change in terms of stakeholder impact', 'Anticipates and addresses objections proactively']],
      ['Shapes organisational narrative and influences executive decision-making.', ['Sets communication strategy for major initiatives', 'Recognised as a trusted voice by senior leadership']],
    ]),
    attachments: [
      { id: 'a2', name: 'Comms-Style-Guide.docx', size: 214_000, type: 'application/msword', url: null, uploadedAt: '2026-04-02T09:00:00Z' },
    ],
  },
  {
    id: 'c4', domainId: 'd2', isSystem: false,
    name: 'Stakeholder Influence',
    description: 'Building trust and influencing outcomes without relying on formal authority.',
    levels: levels([
      ['Relies on position or process to get things done.', ['Escalates disagreements rather than negotiating', 'Limited network beyond immediate team']],
      ['Builds rapport with key stakeholders and finds common ground.', ['Identifies stakeholder needs before proposing solutions', 'Builds informal relationships across departments']],
      ['Negotiates win-win outcomes with cross-functional stakeholders.', ['Uses data and storytelling to influence decisions', 'Navigates competing priorities diplomatically']],
      ['Shapes strategic decisions through trusted senior relationships.', ['Influences outcomes at the executive/board level', 'Builds coalitions to drive organisation-wide change']],
    ]),
    attachments: [],
  },
  {
    id: 'c5', domainId: 'd3', isSystem: true,
    name: 'Business Acumen',
    description: 'Understanding how the business creates value and applying that lens to decisions.',
    levels: levels([
      ['Understands own function but not how it connects to the business.', ['Focuses on task completion over business impact', 'Limited awareness of P&L drivers']],
      ['Connects day-to-day work to team and departmental goals.', ['References KPIs when prioritising work', 'Understands basic cost/revenue drivers']],
      ['Makes decisions with a clear view of financial and market impact.', ['Evaluates trade-offs using business case thinking', 'Understands competitive and market dynamics']],
      ['Shapes business strategy with a holistic, enterprise-wide view.', ['Advises on investment and resourcing priorities', 'Anticipates market shifts and their implications']],
    ]),
    attachments: [
      { id: 'a3', name: 'Business-Acumen-Framework.pdf', size: 761_000, type: 'application/pdf', url: null, uploadedAt: '2026-03-19T09:00:00Z' },
    ],
  },
  {
    id: 'c6', domainId: 'd3', isSystem: false,
    name: 'Systems Thinking',
    description: 'Seeing the bigger picture and understanding how parts of the organisation interconnect.',
    levels: levels([
      ['Focuses on isolated problems without broader context.', ['Solves symptoms rather than root causes', 'Rarely considers downstream impact']],
      ['Recognises how decisions affect adjacent teams.', ['Consults adjacent teams before finalising decisions', 'Identifies obvious dependencies']],
      ['Maps interdependencies and anticipates second-order effects.', ['Designs solutions that account for multiple stakeholders', 'Identifies root causes, not just symptoms']],
      ['Redesigns systems and processes for long-term organisational health.', ['Leads cross-functional redesign of core processes', 'Balances short-term needs with long-term sustainability']],
    ]),
    attachments: [],
  },
  {
    id: 'c7', domainId: 'd4', isSystem: true,
    name: 'Accountability & Ownership',
    description: 'Taking personal responsibility for outcomes and following through on commitments.',
    levels: levels([
      ['Completes assigned tasks but avoids ownership of outcomes.', ['Attributes setbacks to external factors', 'Requires close follow-up to complete tasks']],
      ['Follows through on commitments with minimal oversight.', ['Proactively updates stakeholders on progress', 'Owns mistakes and corrects course']],
      ['Takes ownership of team outcomes, not just individual tasks.', ['Holds self and team to high standards', 'Resolves issues before they escalate']],
      ['Models accountability that shapes organisational culture.', ['Takes ownership of enterprise-level outcomes', 'Creates systems that reinforce accountability at scale']],
    ]),
    attachments: [],
  },
  {
    id: 'c8', domainId: 'd4', isSystem: false,
    name: 'Decision Making Under Pressure',
    description: 'Making sound, timely decisions in ambiguous or high-stakes situations.',
    levels: levels([
      ['Defers decisions or seeks excessive approval under pressure.', ['Delays action while waiting for full information', 'Becomes reactive when priorities shift quickly']],
      ['Makes reasonable decisions with limited information.', ['Uses available data to make timely calls', 'Stays composed under moderate pressure']],
      ['Balances speed and rigor to make sound calls under ambiguity.', ['Weighs risk versus speed appropriately', 'Communicates decisions and rationale clearly']],
      ['Makes high-stakes decisions decisively while managing organisational risk.', ['Leads through crisis with clarity and calm', 'Builds decision frameworks others rely on']],
    ]),
    attachments: [
      { id: 'a4', name: 'Decision-Matrix-Template.xlsx', size: 98_000, type: 'application/vnd.ms-excel', url: null, uploadedAt: '2026-02-11T09:00:00Z' },
    ],
  },
  {
    id: 'c9', domainId: 'd5', isSystem: true,
    name: 'Change Leadership',
    description: 'Leading individuals and teams through organisational change and uncertainty.',
    levels: levels([
      ['Resists or is slow to adapt to change.', ['Expresses skepticism about new initiatives', 'Needs significant support to adopt new ways of working']],
      ['Adapts personally to change and supports immediate team.', ['Communicates changes to direct reports', 'Adjusts own workflow to new processes']],
      ['Actively champions change and helps others navigate transitions.', ['Addresses resistance with empathy and clarity', 'Builds change plans with clear milestones']],
      ['Architects and leads large-scale organisational transformation.', ['Sets vision and strategy for major transformation', 'Builds organisational resilience for continuous change']],
    ]),
    attachments: [],
  },
  {
    id: 'c10', domainId: 'd5', isSystem: false,
    name: 'Creative Problem Solving',
    description: 'Generating novel solutions and challenging conventional approaches.',
    levels: levels([
      ['Applies standard solutions to familiar problems.', ['Relies on established processes', 'Rarely proposes alternative approaches']],
      ['Suggests improvements to existing processes.', ['Identifies inefficiencies in current workflows', 'Proposes incremental improvements']],
      ['Generates original solutions to complex, ambiguous problems.', ['Uses structured ideation techniques', 'Tests and iterates on new approaches']],
      ['Drives a culture of innovation and reimagines how work gets done.', ['Sponsors innovation initiatives across teams', 'Creates safe-to-fail environments for experimentation']],
    ]),
    attachments: [],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function domainOf(domainId: string): Domain {
  return MOCK_DOMAINS.find((d) => d.id === domainId) ?? MOCK_DOMAINS[0];
}

function filesToAttachments(files: FileList | File[]): Attachment[] {
  return Array.from(files).map((file) => ({
    id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    url: URL.createObjectURL(file),
    uploadedAt: new Date().toISOString(),
  }));
}

// ── Attachment Chip ──────────────────────────────────────────────────────────

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const inner = (
    <>
      <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate max-w-[140px]">{attachment.name}</span>
      <span className="text-gray-400 shrink-0">· {formatBytes(attachment.size)}</span>
      {attachment.url ? (
        <Download className="w-3 h-3 shrink-0 opacity-70" strokeWidth={2} />
      ) : (
        <span className="text-[9px] uppercase tracking-wide font-semibold shrink-0 text-gray-400">sample</span>
      )}
    </>
  );

  const className = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-[var(--bg-subtle)] border-[var(--border)] text-gray-600';

  return attachment.url ? (
    <a href={attachment.url} download={attachment.name} target="_blank" rel="noreferrer" className={cn(className, 'hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer')}>
      {inner}
    </a>
  ) : (
    <span className={cn(className, 'cursor-default')} title="Demo attachment — no downloadable content">
      {inner}
    </span>
  );
}

// ── Competency Card ───────────────────────────────────────────────────────────

function CompetencyCard({ competency, onOpen }: { competency: Competency; onOpen: () => void }) {
  const domain = domainOf(competency.domainId);
  const Icon = domain.icon;
  return (
    <button
      onClick={onOpen}
      className="text-left bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', domain.iconBg)}>
          <Icon className="w-5 h-5" strokeWidth={1.8} />
        </div>
        {competency.isSystem && <Badge variant="neutral">System</Badge>}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1.5 leading-snug">{competency.name}</h3>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4 flex-1">{competency.description}</p>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full border', domain.chip)}>{domain.name}</span>
        <div className="flex items-center gap-2 text-gray-400 shrink-0">
          {competency.attachments.length > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <Paperclip className="w-3 h-3" strokeWidth={2} />
              {competency.attachments.length}
            </span>
          )}
          <span className="text-[11px]">{competency.levels.length} levels</span>
        </div>
      </div>
    </button>
  );
}

// ── Add Competency Modal ─────────────────────────────────────────────────────

function AddCompetencyModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Competency) => void;
}) {
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [description, setDescription] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName(''); setDomainId(''); setDescription(''); setStagedFiles([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setStagedFiles((prev) => [...prev, ...Array.from(files)]);
  }

  function removeStagedFile(idx: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleCreate() {
    if (!name || !domainId) return;
    onCreate({
      id: `c_${Date.now()}`,
      name,
      domainId,
      description,
      isSystem: false,
      levels: levels([
        ['Not yet demonstrating this competency consistently.', ['Add proficiency-level indicators to complete this framework']],
        ['Beginning to demonstrate this competency in familiar situations.', ['Add proficiency-level indicators to complete this framework']],
        ['Consistently demonstrates this competency across situations.', ['Add proficiency-level indicators to complete this framework']],
        ['Recognised as an expert model of this competency for others.', ['Add proficiency-level indicators to complete this framework']],
      ]),
      attachments: filesToAttachments(stagedFiles),
    });
    reset();
    onClose();
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
            options={MOCK_DOMAINS.map((d) => ({ value: d.id, label: d.name }))}
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

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Supporting files</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-xl py-6 px-4 cursor-pointer transition-colors text-center"
          >
            <Upload className="w-5 h-5 text-gray-400" strokeWidth={1.75} />
            <p className="text-xs text-gray-500"><span className="text-blue-600 font-medium">Click to upload</span> or drag and drop files</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>
          {stagedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {stagedFiles.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 text-xs pl-2.5 pr-1.5 py-1.5 rounded-lg border bg-[var(--bg-subtle)] border-[var(--border)] text-gray-600">
                  <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <span className="text-gray-400 shrink-0">· {formatBytes(f.size)}</span>
                  <button onClick={() => removeStagedFile(i)} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Remove file">
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200/60">
          <button onClick={handleClose} className="flex-1 sm:flex-none sm:w-24 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors text-gray-700">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name || !domainId}
            className="flex-1 sm:flex-none sm:w-44 bg-blue-600 text-white font-medium rounded-lg py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add Competency
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Competency Detail Modal ───────────────────────────────────────────────────

function CompetencyDetailModal({
  competency,
  onClose,
  onAddAttachments,
}: {
  competency: Competency | null;
  onClose: () => void;
  onAddAttachments: (competencyId: string, files: FileList) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!competency) return null;
  const domain = domainOf(competency.domainId);
  const Icon = domain.icon;

  return (
    <Modal open={Boolean(competency)} onClose={onClose} className="max-w-2xl">
      <div className="flex items-start gap-3 mb-1">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', domain.iconBg)}>
          <Icon className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-semibold text-gray-900">{competency.name}</h2>
            {competency.isSystem && <Badge variant="neutral">System</Badge>}
          </div>
          <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full border', domain.chip)}>{domain.name}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 shrink-0" aria-label="Close">
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {competency.description && <p className="text-sm text-gray-600 mt-4 mb-6 leading-relaxed">{competency.description}</p>}

      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Proficiency Levels</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {competency.levels.map((l) => (
          <div key={l.level} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', LEVEL_COLOURS[l.level - 1])}>{l.label}</span>
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

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attachments</h4>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" strokeWidth={2} />
          Upload file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) onAddAttachments(competency.id, e.target.files); e.target.value = ''; }}
        />
      </div>
      {competency.attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {competency.attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No files attached yet. Upload a rubric, framework document, or supporting material.</p>
      )}
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetencyLibraryPage() {
  const [competencies, setCompetencies] = useState<Competency[]>(MOCK_COMPETENCIES);
  const [activeDomain, setActiveDomain] = useState('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selected, setSelected] = useState<Competency | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return competencies.filter((c) => {
      const matchDomain = !activeDomain || c.domainId === activeDomain;
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchDomain && matchSearch;
    });
  }, [competencies, activeDomain, search]);

  function handleCreate(c: Competency) {
    setCompetencies((prev) => [c, ...prev]);
  }

  function handleAddAttachments(competencyId: string, files: FileList) {
    const newAttachments = filesToAttachments(files);
    setCompetencies((prev) =>
      prev.map((c) => (c.id === competencyId ? { ...c, attachments: [...c.attachments, ...newAttachments] } : c)),
    );
    setSelected((prev) => (prev && prev.id === competencyId ? { ...prev, attachments: [...prev.attachments, ...newAttachments] } : prev));
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
            All ({competencies.length})
          </button>
          {MOCK_DOMAINS.map((d) => (
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
            className="pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-56"
          />
        </div>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
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
            <CompetencyCard key={c.id} competency={c} onOpen={() => setSelected(c)} />
          ))}
        </div>
      )}

      <AddCompetencyModal open={showAddForm} onClose={() => setShowAddForm(false)} onCreate={handleCreate} />
      <CompetencyDetailModal competency={selected} onClose={() => setSelected(null)} onAddAttachments={handleAddAttachments} />
    </div>
  );
}
