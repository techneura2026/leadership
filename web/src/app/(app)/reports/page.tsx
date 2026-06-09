'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { generateReportPdf } from '@/lib/reportPdf';
import type { ReportData } from '@/lib/reportPdf';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ASSESSMENTS = [
  { id: 'a1', title: 'Annual Leadership 360° Review 2025', type: 'individual_360' },
  { id: 'a2', title: 'Q2 Competency Assessment', type: 'competency' },
  { id: 'a3', title: 'Big Five Personality Profiling — May 2025', type: 'personality' },
  { id: 'a4', title: 'Leadership Readiness Cohort 2025', type: 'readiness' },
];

type ReportStatus = 'ready' | 'processing' | 'pending' | 'failed';

interface MockReport {
  id: string;
  assessmentId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  reportType: string;
  status: ReportStatus;
  generatedAt: string | null;
  fileSize: string | null;
  pages: number | null;
}

const MOCK_PARTICIPANTS: Record<string, { id: string; name: string; role: string }[]> = {
  a1: [
    { id: 'p1', name: 'Amara Silva', role: 'Senior Manager' },
    { id: 'p2', name: 'Rohan Perera', role: 'Team Lead' },
    { id: 'p3', name: 'Nisha Fernando', role: 'Product Manager' },
    { id: 'p4', name: 'Kaveen Jayawardena', role: 'Director' },
  ],
  a2: [
    { id: 'p5', name: 'Dilani Wickramasinghe', role: 'HR Manager' },
    { id: 'p6', name: 'Thilina Rajapaksha', role: 'Operations Lead' },
  ],
  a3: [
    { id: 'p7', name: 'Sanjeewa Bandara', role: 'Senior Executive' },
    { id: 'p8', name: 'Malini Dissanayake', role: 'Project Manager' },
    { id: 'p9', name: 'Chathura Gunasekara', role: 'Team Lead' },
  ],
  a4: [
    { id: 'p10', name: 'Ruwan Senanayake', role: 'Associate Manager' },
    { id: 'p11', name: 'Ishara Karunaratne', role: 'Graduate Trainee' },
  ],
};

const MOCK_REPORTS: MockReport[] = [
  {
    id: 'r1', assessmentId: 'a1', participantId: 'p1',
    participantName: 'Amara Silva', participantRole: 'Senior Manager',
    reportType: 'individual_360', status: 'ready',
    generatedAt: '2025-06-01T09:14:00Z', fileSize: '2.4 MB', pages: 18,
  },
  {
    id: 'r2', assessmentId: 'a1', participantId: 'p2',
    participantName: 'Rohan Perera', participantRole: 'Team Lead',
    reportType: 'individual_360', status: 'ready',
    generatedAt: '2025-06-01T09:22:00Z', fileSize: '2.1 MB', pages: 16,
  },
  {
    id: 'r3', assessmentId: 'a1', participantId: 'p3',
    participantName: 'Nisha Fernando', participantRole: 'Product Manager',
    reportType: 'individual_360', status: 'processing',
    generatedAt: null, fileSize: null, pages: null,
  },
  {
    id: 'r4', assessmentId: 'a1', participantId: 'p4',
    participantName: 'Kaveen Jayawardena', participantRole: 'Director',
    reportType: 'individual_360', status: 'failed',
    generatedAt: null, fileSize: null, pages: null,
  },
  {
    id: 'r5', assessmentId: 'a2', participantId: 'p5',
    participantName: 'Dilani Wickramasinghe', participantRole: 'HR Manager',
    reportType: 'competency', status: 'ready',
    generatedAt: '2025-05-28T14:05:00Z', fileSize: '1.8 MB', pages: 14,
  },
  {
    id: 'r6', assessmentId: 'a2', participantId: 'p6',
    participantName: 'Thilina Rajapaksha', participantRole: 'Operations Lead',
    reportType: 'competency', status: 'ready',
    generatedAt: '2025-05-28T14:11:00Z', fileSize: '1.9 MB', pages: 14,
  },
  {
    id: 'r7', assessmentId: 'a3', participantId: 'p7',
    participantName: 'Sanjeewa Bandara', participantRole: 'Senior Executive',
    reportType: 'personality', status: 'ready',
    generatedAt: '2025-05-15T11:00:00Z', fileSize: '1.2 MB', pages: 10,
  },
  {
    id: 'r8', assessmentId: 'a3', participantId: 'p8',
    participantName: 'Malini Dissanayake', participantRole: 'Project Manager',
    reportType: 'personality', status: 'processing',
    generatedAt: null, fileSize: null, pages: null,
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<string, string> = {
  individual_360: '360° Feedback',
  competency: 'Competency',
  personality: 'Personality',
  readiness: 'Readiness',
};

const REPORT_TYPE_ICON: Record<string, string> = {
  individual_360: '🔄',
  competency: '🎯',
  personality: '🧠',
  readiness: '🚀',
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [localReports, setLocalReports] = useState<MockReport[]>(MOCK_REPORTS);

  const participants = selectedAssessment ? (MOCK_PARTICIPANTS[selectedAssessment] ?? []) : [];

  const filteredReports = localReports.filter((r) => {
    if (selectedAssessment && r.assessmentId !== selectedAssessment) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: localReports.length,
    ready: localReports.filter((r) => r.status === 'ready').length,
    processing: localReports.filter((r) => r.status === 'processing').length,
    failed: localReports.filter((r) => r.status === 'failed').length,
  };

  function handleGenerate(participantId: string, participantName: string, participantRole: string) {
    const asmt = MOCK_ASSESSMENTS.find((a) => a.id === selectedAssessment);
    if (!asmt) return;
    const existing = localReports.find(
      (r) => r.participantId === participantId && r.assessmentId === selectedAssessment,
    );
    if (existing) return;
    setGenerating(participantId);
    setTimeout(() => {
      const newReport: MockReport = {
        id: `r-${Date.now()}`,
        assessmentId: selectedAssessment,
        participantId,
        participantName,
        participantRole,
        reportType: asmt.type,
        status: 'processing',
        generatedAt: null,
        fileSize: null,
        pages: null,
      };
      setLocalReports((prev) => [...prev, newReport]);
      setGenerating(null);
    }, 1200);
  }

  async function handleDownload(report: MockReport) {
    const asmt = MOCK_ASSESSMENTS.find((a) => a.id === report.assessmentId);
    const data: ReportData = {
      id: report.id,
      participantName: report.participantName,
      participantRole: report.participantRole,
      assessmentTitle: asmt?.title ?? report.assessmentId,
      reportType: report.reportType as ReportData['reportType'],
      generatedAt: report.generatedAt
        ? format(new Date(report.generatedAt), 'dd MMM yyyy, HH:mm')
        : format(new Date(), 'dd MMM yyyy, HH:mm'),
      organisationName: 'TechNeura Demo Corp',
    };
    await generateReportPdf(data);
  }

  function handleBulkGenerate() {
    const assessmentsToProcess = selectedAssessment
      ? MOCK_ASSESSMENTS.filter((a) => a.id === selectedAssessment)
      : MOCK_ASSESSMENTS;

    const now = Date.now();
    const newReports: MockReport[] = [];

    for (const asmt of assessmentsToProcess) {
      const asmtParticipants = MOCK_PARTICIPANTS[asmt.id] ?? [];
      for (const p of asmtParticipants) {
        const existing = localReports.find(
          (r) => r.participantId === p.id && r.assessmentId === asmt.id,
        );
        if (!existing) {
          newReports.push({
            id: `r-${now}-${p.id}`,
            assessmentId: asmt.id,
            participantId: p.id,
            participantName: p.name,
            participantRole: p.role,
            reportType: asmt.type,
            status: 'processing',
            generatedAt: null,
            fileSize: null,
            pages: null,
          });
        }
      }
    }

    if (newReports.length === 0) return;

    setBulkGenerating(true);
    setTimeout(() => {
      setLocalReports((prev) => [...prev, ...newReports]);
      setBulkGenerating(false);
    }, 1000);
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ready', label: 'Ready' },
    { key: 'processing', label: 'Processing' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and download PDF assessment reports</p>
        </div>
        {/* <button
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Bulk Generate
            </>
          )}
        </button> */}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: stats.total, icon: '📄', color: 'bg-blue-50 text-blue-600' },
          { label: 'Ready to Download', value: stats.ready, icon: '✅', color: 'bg-green-50 text-green-600' },
          { label: 'Processing', value: stats.processing, icon: '⏳', color: 'bg-yellow-50 text-yellow-600' },
          { label: 'Failed', value: stats.failed, icon: '❌', color: 'bg-red-50 text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Assessment</label>
        <div className="w-full sm:max-w-xs">
          <select
            value={selectedAssessment}
            onChange={(e) => setSelectedAssessment(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All assessments</option>
            {MOCK_ASSESSMENTS.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>
        {selectedAssessment && (
          <button
            onClick={() => setSelectedAssessment('')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Generate section — only when an assessment is selected */}
      {selectedAssessment && participants.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
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
              const existing = localReports.find(
                (r) => r.participantId === p.id && r.assessmentId === selectedAssessment,
              );
              const isGenerating = generating === p.id;
              return (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.role}</p>
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
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        Download PDF
                      </button>
                    ) : existing?.status === 'processing' ? (
                      <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                        <span className="inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : existing?.status === 'failed' ? (
                      <button
                        onClick={() => {
                          setLocalReports((prev) => prev.filter((r) => r.id !== existing.id));
                        }}
                        className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        Retry
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerate(p.id, p.name, p.role)}
                        disabled={isGenerating}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-1.5"
                      >
                        {isGenerating ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Queuing…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Generate
                          </>
                        )}
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
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">All Reports</h2>
            <p className="text-xs text-gray-400 mt-0.5">{filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1">
            {statusTabs.map((tab) => {
              const count = tab.key === 'all'
                ? localReports.filter((r) => !selectedAssessment || r.assessmentId === selectedAssessment).length
                : localReports.filter((r) => r.status === tab.key && (!selectedAssessment || r.assessmentId === selectedAssessment)).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    statusFilter === tab.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                    statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
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
            description={
              statusFilter !== 'all'
                ? `No ${statusFilter} reports${selectedAssessment ? ' for this assessment' : ''}.`
                : selectedAssessment
                ? 'No reports generated for this assessment yet.'
                : 'No reports generated yet. Select an assessment above to generate reports.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Participant</th>
                  <th className="text-left px-5 py-3 font-medium">Assessment</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Generated</th>
                  <th className="text-left px-5 py-3 font-medium">Details</th>
                  <th className="text-left px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredReports.map((r) => {
                  const asmt = MOCK_ASSESSMENTS.find((a) => a.id === r.assessmentId);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {r.participantName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{r.participantName}</p>
                            <p className="text-xs text-gray-400">{r.participantRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-gray-600 max-w-[180px] truncate" title={asmt?.title}>
                          {asmt?.title ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
                          <span>{REPORT_TYPE_ICON[r.reportType]}</span>
                          {REPORT_TYPE_LABELS[r.reportType] ?? r.reportType}
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
                        {r.generatedAt ? format(new Date(r.generatedAt), 'dd MMM yyyy, HH:mm') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.fileSize && r.pages ? (
                          <div className="text-xs text-gray-400 space-y-0.5">
                            <p>{r.fileSize}</p>
                            <p>{r.pages} pages</p>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.status === 'ready' ? (
                          <button
                            onClick={() => handleDownload(r)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </button>
                        ) : r.status === 'failed' ? (
                          <button
                            onClick={() => {
                              setLocalReports((prev) =>
                                prev.map((rep) => rep.id === r.id ? { ...rep, status: 'processing' } : rep),
                              );
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
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

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
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
