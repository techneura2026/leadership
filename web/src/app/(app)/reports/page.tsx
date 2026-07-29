'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { TYPE_META } from '@/lib/assessmentTypeMeta';
import {
  Files,
  BadgeCheck,
  LoaderCircle,
  TriangleAlert,
  Zap,
  Download,
  RotateCcw,
  ChevronDown,
  Check,
  Info,
  Plus,
} from 'lucide-react';
import { AssessmentType } from '@leaderprism/shared';
import { generateReportPdf, type ReportData } from '@/lib/reportPdf';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportStatus = 'ready' | 'processing' | 'pending' | 'failed';
type ReportType = 'individual_360' | 'competency' | 'personality' | 'readiness';

interface ReportModel {
  id: string;
  assessmentId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  reportType: ReportType;
  status: ReportStatus;
  generatedAt: string | null;
  fileSize: string | null;
  pages: number | null;
}

interface MockAssessment {
  id: string;
  title: string;
  assessmentType: AssessmentType;
}

interface MockParticipant {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_ASSESSMENTS: MockAssessment[] = [
  { id: 'ra1', title: 'Q3 Leadership 360° Review', assessmentType: AssessmentType.FEEDBACK_360 },
  { id: 'ra2', title: 'Senior Manager Competency Assessment', assessmentType: AssessmentType.COMPETENCY },
  { id: 'ra3', title: 'Personality Profiling — Cohort C', assessmentType: AssessmentType.PERSONALITY },
  { id: 'ra4', title: 'Leadership Readiness — Batch 2026-H2', assessmentType: AssessmentType.READINESS },
  { id: 'ra5', title: 'Engineering Competency Refresh', assessmentType: AssessmentType.COMPETENCY },
  { id: 'ra6', title: 'Mid-Year 360° Feedback', assessmentType: AssessmentType.FEEDBACK_360 },
];

const MOCK_PARTICIPANTS_BY_ASSESSMENT: Record<string, MockParticipant[]> = {
  ra1: [
    { id: 'p1', firstName: 'Amara', lastName: 'Perera', jobTitle: 'Senior Manager – Strategy' },
    { id: 'p2', firstName: 'David', lastName: 'Mendis', jobTitle: 'Engineering Lead' },
    { id: 'p3', firstName: 'Anika', lastName: 'Jayasekara', jobTitle: 'HR Business Partner' },
  ],
  ra2: [
    { id: 'p4', firstName: 'Priya', lastName: 'Kumari', jobTitle: 'Finance Manager' },
    { id: 'p5', firstName: 'Kasun', lastName: 'Fernando', jobTitle: 'Senior Software Engineer' },
  ],
  ra3: [
    { id: 'p6', firstName: 'Nirosha', lastName: 'Rajapaksa', jobTitle: 'Senior Finance Analyst' },
    { id: 'p7', firstName: 'Dilshan', lastName: 'Maduwantha', jobTitle: 'Product Designer' },
    { id: 'p8', firstName: 'Fiona', lastName: 'Krishnaswamy', jobTitle: 'HR Coordinator' },
  ],
  ra4: [
    { id: 'p9', firstName: 'Tom', lastName: 'Wickramasinghe', jobTitle: 'Senior Sales Manager' },
    { id: 'p10', firstName: 'Ravi', lastName: 'Seneviratne', jobTitle: 'Operations Manager' },
  ],
  ra5: [
    { id: 'p5', firstName: 'Kasun', lastName: 'Fernando', jobTitle: 'Senior Software Engineer' },
    { id: 'p11', firstName: 'Chamari', lastName: 'De Silva', jobTitle: 'Operations Analyst' },
  ],
  ra6: [
    { id: 'p12', firstName: 'Mark', lastName: 'Silva', jobTitle: 'Sales Account Manager' },
    { id: 'p13', firstName: 'Sasha', lastName: 'Perera', jobTitle: 'Finance Coordinator' },
    { id: 'p14', firstName: 'Leo', lastName: 'Bandara', jobTitle: 'Sales Associate' },
  ],
};

function makeReport(
  id: string, assessmentId: string, participantId: string, reportType: ReportType,
  status: ReportStatus, generatedAt: string | null, fileSize: string | null, pages: number | null,
): ReportModel {
  const participant = MOCK_PARTICIPANTS_BY_ASSESSMENT[assessmentId]?.find((p) => p.id === participantId);
  return {
    id, assessmentId, participantId,
    participantName: participant ? `${participant.firstName} ${participant.lastName}` : 'Participant',
    participantRole: participant?.jobTitle ?? '',
    reportType, status, generatedAt, fileSize, pages,
  };
}

const MOCK_REPORTS_INITIAL: ReportModel[] = [
  makeReport('r1', 'ra1', 'p1', 'individual_360', 'ready', '2026-07-24T09:12:00Z', '1.4 MB', 9),
  makeReport('r2', 'ra1', 'p2', 'individual_360', 'ready', '2026-07-24T09:15:00Z', '1.6 MB', 10),
  makeReport('r3', 'ra1', 'p3', 'individual_360', 'processing', null, null, null),
  makeReport('r4', 'ra2', 'p4', 'competency', 'ready', '2026-07-20T14:02:00Z', '980 KB', 6),
  makeReport('r5', 'ra2', 'p5', 'competency', 'failed', null, null, null),
  makeReport('r6', 'ra3', 'p6', 'personality', 'ready', '2026-07-15T08:45:00Z', '1.1 MB', 7),
  makeReport('r7', 'ra3', 'p7', 'personality', 'ready', '2026-07-15T08:47:00Z', '1.1 MB', 7),
  makeReport('r8', 'ra3', 'p8', 'personality', 'ready', '2026-07-15T08:50:00Z', '1.0 MB', 7),
  makeReport('r9', 'ra4', 'p9', 'readiness', 'ready', '2026-07-05T11:30:00Z', '1.3 MB', 8),
  makeReport('r10', 'ra4', 'p10', 'readiness', 'processing', null, null, null),
  makeReport('r11', 'ra5', 'p5', 'competency', 'ready', '2026-06-28T10:00:00Z', '950 KB', 6),
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const REPORT_TYPE_ASSESSMENT: Record<ReportType, AssessmentType> = {
  individual_360: AssessmentType.FEEDBACK_360,
  competency: AssessmentType.COMPETENCY,
  personality: AssessmentType.PERSONALITY,
  readiness: AssessmentType.READINESS,
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  individual_360: '360° Feedback',
  competency: 'Competency',
  personality: 'Personality',
  readiness: 'Readiness',
};

const STATUS_VARIANT: Record<ReportStatus, 'success' | 'warning' | 'neutral' | 'error'> = {
  ready: 'success',
  processing: 'warning',
  pending: 'neutral',
  failed: 'error',
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  ready: 'Ready',
  processing: 'Processing',
  pending: 'Pending',
  failed: 'Failed',
};

type StatusFilter = 'all' | ReportStatus;

function reportTypeOf(assessmentType: AssessmentType): ReportType {
  const entry = Object.entries(REPORT_TYPE_ASSESSMENT).find(([, v]) => v === assessmentType);
  return (entry?.[0] as ReportType) ?? 'individual_360';
}

function randomPages() { return 6 + Math.floor(Math.random() * 5); }
function randomSize() { return `${(0.8 + Math.random() * 0.9).toFixed(1)} MB`; }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [reports, setReports] = useState<ReportModel[]>(MOCK_REPORTS_INITIAL);

  const [showAssessmentMenu, setShowAssessmentMenu] = useState(false);
  const assessmentMenuRef = useRef<HTMLDivElement>(null);

  const assessments = MOCK_ASSESSMENTS;
  const participants = selectedAssessment ? (MOCK_PARTICIPANTS_BY_ASSESSMENT[selectedAssessment] ?? []) : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assessmentMenuRef.current && !assessmentMenuRef.current.contains(event.target as Node)) {
        setShowAssessmentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredReports = reports.filter((r) => {
    if (selectedAssessment && r.assessmentId !== selectedAssessment) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: reports.length,
    ready: reports.filter((r) => r.status === 'ready').length,
    processing: reports.filter((r) => r.status === 'processing').length,
    failed: reports.filter((r) => r.status === 'failed').length,
  };

  // Simulate async PDF generation entirely client-side against mock state
  function completeReport(id: string, delay: number) {
    setTimeout(() => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'ready', generatedAt: new Date().toISOString(), fileSize: randomSize(), pages: randomPages() }
            : r,
        ),
      );
    }, delay);
  }

  function queueReport(assessmentId: string, participantId: string) {
    const asmt = assessments.find((a) => a.id === assessmentId);
    if (!asmt) return;
    const reportType = reportTypeOf(asmt.assessmentType);
    const id = `r-${assessmentId}-${participantId}-${Date.now()}`;

    setReports((prev) => [
      makeReport(id, assessmentId, participantId, reportType, 'processing', null, null, null),
      ...prev.filter((r) => !(r.assessmentId === assessmentId && r.participantId === participantId)),
    ]);

    completeReport(id, 1600 + Math.random() * 900);
  }

  // Any reports seeded as "processing" in the initial mock data should still resolve on their own,
  // as if they were queued moments before the page loaded.
  useEffect(() => {
    MOCK_REPORTS_INITIAL.filter((r) => r.status === 'processing').forEach((r, i) => {
      completeReport(r.id, 2200 + i * 900);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(participantId: string) {
    if (!selectedAssessment) return;
    setGenerating(participantId);
    queueReport(selectedAssessment, participantId);
    setTimeout(() => setGenerating(null), 400);
  }

  async function handleRetry(report: ReportModel) {
    queueReport(report.assessmentId, report.participantId);
  }

  async function handleBulkGenerate() {
    if (!selectedAssessment || participants.length === 0) return;
    setBulkGenerating(true);
    participants.forEach((p) => {
      const existing = reports.find((r) => r.participantId === p.id && r.assessmentId === selectedAssessment);
      if (!existing || existing.status === 'failed') queueReport(selectedAssessment, p.id);
    });
    setTimeout(() => setBulkGenerating(false), 500);
  }

  async function handleDownload(report: ReportModel) {
    const asmt = assessments.find((a) => a.id === report.assessmentId);
    const data: ReportData = {
      id: report.id,
      participantName: report.participantName,
      participantRole: report.participantRole,
      assessmentTitle: asmt?.title ?? 'Assessment Report',
      reportType: report.reportType,
      generatedAt: report.generatedAt
        ? format(new Date(report.generatedAt), 'dd MMM yyyy')
        : format(new Date(), 'dd MMM yyyy'),
      organisationName: 'LeaderPrism Demo Org',
    };
    await generateReportPdf(data);
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ready', label: 'Ready' },
    { key: 'processing', label: 'Processing' },
    { key: 'failed', label: 'Failed' },
  ];

  const STAT_CARDS = [
    { label: 'Total Reports', value: stats.total, icon: Files, gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)', glow: 'rgba(70,95,255,0.25)' },
    { label: 'Ready to Download', value: stats.ready, icon: BadgeCheck, gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', glow: 'rgba(34,197,94,0.22)' },
    { label: 'Processing', value: stats.processing, icon: LoaderCircle, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: 'rgba(245,158,11,0.22)', spin: true },
    { label: 'Failed', value: stats.failed, icon: TriangleAlert, gradient: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)', glow: 'rgba(244,63,94,0.22)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and download PDF assessment reports</p>
        </div>
        {selectedAssessment && participants.length > 0 && (
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            {bulkGenerating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" strokeWidth={2.25} />
                Bulk Generate
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mb-4"
                style={{ background: stat.gradient, boxShadow: `0 4px 12px ${stat.glow}` }}
              >
                <Icon className={cn('w-5 h-5 text-white', stat.spin && 'animate-spin')} strokeWidth={1.75} />
              </div>
              <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1.5 font-medium">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Assessment</label>
        <div className="relative w-full sm:max-w-sm" ref={assessmentMenuRef}>
          <button
            type="button"
            onClick={() => setShowAssessmentMenu((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <span className="flex items-center gap-2 min-w-0">
              {selectedAssessment && (() => {
                const asmt = assessments.find((a) => a.id === selectedAssessment);
                if (!asmt) return null;
                const meta = TYPE_META[asmt.assessmentType];
                const Icon = meta.icon;
                return (
                  <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: meta.gradient }}>
                    <Icon className="w-3 h-3 text-white" strokeWidth={2} />
                  </span>
                );
              })()}
              <span className={cn('truncate', selectedAssessment ? 'text-gray-900' : 'text-gray-500')}>
                {selectedAssessment
                  ? (assessments.find((a) => a.id === selectedAssessment)?.title ?? 'Select assessment')
                  : 'All assessments'}
              </span>
            </span>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200', showAssessmentMenu && 'rotate-180')} strokeWidth={2} />
          </button>

          {showAssessmentMenu && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg py-1">
              <button
                type="button"
                onClick={() => { setSelectedAssessment(''); setShowAssessmentMenu(false); }}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
              >
                <span className={!selectedAssessment ? 'font-semibold text-blue-700' : 'text-gray-600'}>All assessments</span>
                {!selectedAssessment && <Check className="w-4 h-4 text-blue-600" strokeWidth={2.5} />}
              </button>
              {assessments.map((a) => {
                const isSelected = selectedAssessment === a.id;
                const meta = TYPE_META[a.assessmentType];
                const Icon = meta.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSelectedAssessment(a.id); setShowAssessmentMenu(false); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                  >
                    <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: meta.gradient }}>
                      <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                    </span>
                    <span className={cn('flex-1 truncate', isSelected ? 'font-semibold text-gray-900' : 'text-gray-600')}>{a.title}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedAssessment && (
          <button
            onClick={() => setSelectedAssessment('')}
            className="text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Generate section — only when an assessment is selected */}
      {selectedAssessment && participants.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Generate Reports</h2>
              <p className="text-xs text-gray-400 mt-0.5">Queue individual PDF reports for participants</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2.5 py-1 rounded-full">
              {participants.length} participants
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {participants.map((p) => {
              const existing = reports.find((r) => r.participantId === p.id && r.assessmentId === selectedAssessment);
              const isGenerating = generating === p.id;
              const name = `${p.firstName} ${p.lastName}`;

              return (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar seed={p.id} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-400">{p.jobTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {existing && (
                      <Badge variant={STATUS_VARIANT[existing.status]}>{STATUS_LABELS[existing.status]}</Badge>
                    )}
                    {existing?.status === 'ready' ? (
                      <button
                        onClick={() => handleDownload(existing)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={2} />
                        Download PDF
                      </button>
                    ) : existing?.status === 'processing' ? (
                      <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                        <span className="inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      <button
                        onClick={() => handleGenerate(p.id)}
                        disabled={isGenerating}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-1.5"
                      >
                        {isGenerating ? 'Queuing…' : (existing?.status === 'failed' ? 'Retry' : 'Generate')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reports table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">All Reports</h2>
            <p className="text-xs text-gray-400 mt-0.5">{filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {statusTabs.map((tab) => {
              const count = tab.key === 'all'
                ? reports.filter((r) => !selectedAssessment || r.assessmentId === selectedAssessment).length
                : reports.filter((r) => r.status === tab.key && (!selectedAssessment || r.assessmentId === selectedAssessment)).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    statusFilter === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
                  )}
                >
                  {tab.label}
                  <span className={cn('ml-1 rounded-full px-1.5 py-0.5 text-xs', statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <EmptyState
            title="No reports found"
            description="No reports generated yet. Select an assessment above to generate reports."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Participant</th>
                  <th className="text-left px-5 py-3 font-medium">Assessment</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Generated</th>
                  <th className="text-left px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredReports.map((r) => {
                  const asmt = assessments.find((a) => a.id === r.assessmentId);
                  const meta = TYPE_META[REPORT_TYPE_ASSESSMENT[r.reportType]];
                  const TypeIcon = meta.icon;

                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar seed={r.participantId} size="sm" />
                          <div>
                            <p className="font-medium text-gray-900">{r.participantName}</p>
                            <p className="text-xs text-gray-400">{r.participantRole || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-gray-600 max-w-[180px] truncate" title={asmt?.title}>
                          {asmt?.title ?? r.assessmentId}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border', meta.chip)}>
                          <TypeIcon className="w-3 h-3" strokeWidth={2} />
                          {REPORT_TYPE_LABELS[r.reportType]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {r.status === 'processing' && (
                            <span className="inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {r.generatedAt ? (
                          <>
                            <p>{format(new Date(r.generatedAt), 'dd MMM yyyy, HH:mm')}</p>
                            {r.pages && r.fileSize && <p className="text-gray-300 mt-0.5">{r.pages} pages · {r.fileSize}</p>}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.status === 'ready' ? (
                          <button
                            onClick={() => handleDownload(r)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={2} />
                            Download
                          </button>
                        ) : r.status === 'failed' ? (
                          <button
                            onClick={() => handleRetry(r)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                            Retry
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick-add: generate a report for an assessment not yet started */}
      {!selectedAssessment && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-gray-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Need to generate a report?</p>
              <p className="text-xs text-gray-400 mt-0.5">Select an assessment above to view its participants and queue reports.</p>
            </div>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Info className="w-4 h-4 text-blue-600" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-medium text-blue-800">About PDF Reports</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Reports are generated as multi-page PDFs and are typically ready within 30–60 seconds.
            Processing reports are automatically updated — no need to refresh the page.
            Generated reports are available for download for 90 days.
          </p>
        </div>
      </div>
    </div>
  );
}
