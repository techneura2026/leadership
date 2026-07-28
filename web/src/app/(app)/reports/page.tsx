'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Files,
  BadgeCheck,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';

type ReportStatus = 'ready' | 'processing' | 'pending' | 'failed';

interface ReportModel {
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

export default function ReportsPage() {
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Real State connected to backend
  const [reports, setReports] = useState<ReportModel[]>([]);
  const [assessments, setAssessments] = useState<any[]>();
  const [participants, setParticipants] = useState<any[]>([]);

  const [showAssessmentMenu, setShowAssessmentMenu] = useState(false);
  const assessmentMenuRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Assessments and Reports on load
  useEffect(() => {
    const getInitialData = async () => {
      try {
        // Fetch generated reports from GET /reports
        const reportsRes = await api.get('/reports');
        const reportsPayload = reportsRes.data?.data || reportsRes.data || [];
        setReports(Array.isArray(reportsPayload) ? reportsPayload : []);
        console.log(reportsRes, "\n\n---------------\n\n")

        const assessmentsRes = await api.get('/assessments');
        console.log(assessmentsRes, "\n\n------assessmentsRes---------\n\n")
        const assessmentsPayload = assessmentsRes.data?.data?.data || assessmentsRes.data || [];
        setAssessments(Array.isArray(assessmentsPayload) ? assessmentsPayload : []);
        console.log('assessments', assessments, Array.isArray(assessmentsRes.data?.data?.data))
      } catch (error) {
        console.error("Error loading initial data: ", error);
      }
    };

    getInitialData();

    // 2. Polling: Refresh reports every 5 seconds to catch "processing" -> "ready" transitions
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/reports');
        const payload = res.data?.data || res.data || [];
        if (Array.isArray(payload)) setReports(payload);
      } catch (e) { }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 3. Fetch Participants whenever selectedAssessment changes
  useEffect(() => {
    if (!selectedAssessment) {
      setParticipants([]);
      return;
    }

    const getParticipants = async () => {
      try {
        // NOTE: Make sure your backend has a GET /assessments/:id/participants endpoint!
        const res = await api.get(`/assessments/${selectedAssessment}/participants`);
        const payload = res.data?.data || res.data || [];
        setParticipants(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Error loading participants: ", error);
      }
    };

    getParticipants();
  }, [selectedAssessment]);

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

  // 4. Connect Individual Generate to POST /reports/generate
  async function handleGenerate(participantId: string) {
    const asmt = assessments?.find((a) => a.id === selectedAssessment);
    if (!asmt) return;

    if (asmt.assessmentType == '360_feedback') {
      asmt.assessmentType = 'individual_360'
    }

    setGenerating(participantId);
    // console.log('asmt.assessmentType', asmt)
    try {
      const res = await api.post('/reports/generate', {
        assessmentId: selectedAssessment,
        participantId: participantId,
        reportType: asmt.assessmentType,
        language: 'en'
      });

      const newReport = res.data?.data || res.data;
      if (newReport) {
        setReports((prev) => {
          // Remove existing report with the same ID before adding the new one
          const filtered = prev.filter((item) => item.id !== newReport.id);
          return [newReport, ...filtered];
        });
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setGenerating(null);
    }
  }

  // 5. Connect Bulk Generate by looping through participants and calling POST /reports/generate
  async function handleBulkGenerate() {
    if (!selectedAssessment || participants.length === 0) return;
    const asmt = assessments?.find((a) => a.id === selectedAssessment);
    if (!asmt) return;

    setBulkGenerating(true);
    try {
      for (const p of participants) {
        const existing = reports.find((r) => r.participantId === p.id && r.assessmentId === selectedAssessment);
        console.log('selectedAssessment', selectedAssessment)
        console.log('existing', existing)

        if (!existing) {
          await api.post('/reports/generate', {
            assessmentId: selectedAssessment,
            participantId: p.id,
            reportType: asmt.type,
            language: 'en'
          });
        }
      }
      // Refresh list after bulk triggering
      const res = await api.get('/reports');
      setReports(res.data?.data || res.data || []);
    } catch (error) {
      console.error("Bulk generate failed:", error);
    } finally {
      setBulkGenerating(false);
    }
  }

  // 6. Connect PDF Download to GET /reports/:id/download
  async function handleDownload(report: ReportModel) {
    try {
      const response = await api.get(`/reports/${report.id}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${report.participantName || report.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed:", error);
    }
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ready', label: 'Ready' },
    { key: 'processing', label: 'Processing' },
    { key: 'failed', label: 'Failed' },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assessmentMenuRef.current && !assessmentMenuRef.current.contains(event.target as Node)) {
        setShowAssessmentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Generate and download PDF assessment reports</p>
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Bulk Generate
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: stats.total, icon: Files, color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300' },
          { label: 'Ready to Download', value: stats.ready, icon: BadgeCheck, color: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-300' },
          { label: 'Processing', value: stats.processing, icon: LoaderCircle, color: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-300' },
          { label: 'Failed', value: stats.failed, icon: TriangleAlert, color: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                <Icon className={`h-5 w-5 ${stat.label === 'Processing' ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">Assessment</label>
        <div className="relative w-full sm:max-w-xs" ref={assessmentMenuRef}>
          <button
            type="button"
            onClick={() => setShowAssessmentMenu((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-left text-sm text-gray-700 dark:text-slate-200 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <span className={selectedAssessment ? 'text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}>
              {selectedAssessment
                ? (assessments?.find((a) => a.id === selectedAssessment)?.title ?? 'Select assessment')
                : 'All assessments'}
            </span>
            <svg className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showAssessmentMenu ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </button>

          {showAssessmentMenu && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setSelectedAssessment('');
                  setShowAssessmentMenu(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <span className={!selectedAssessment ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-slate-300'}>
                  All assessments
                </span>
              </button>
              {assessments?.map((a) => {
                const isSelected = selectedAssessment === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAssessment(a.id);
                      setShowAssessmentMenu(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <span className={isSelected ? 'font-medium text-gray-900 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300'}>{a.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedAssessment && (
          <button
            onClick={() => setSelectedAssessment('')}
            className="text-xs text-gray-400 dark:text-slate-500 transition-colors hover:text-gray-600 dark:hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Generate section — only when an assessment is selected */}
      {selectedAssessment && participants.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Generate Reports</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Queue individual PDF reports for participants</p>
            </div>
            <span className="text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-medium px-2.5 py-1 rounded-full">
              {participants.length} participants
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {participants.map((p) => {
              const existing = reports.find((r) => r.participantId === p.id && r.assessmentId === selectedAssessment);
              const isGenerating = generating === p.id;
              const name = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User';
              const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

              return (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{p.role || p.jobTitle || 'Participant'}</p>
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
                        {isGenerating ? 'Queuing…' : 'Generate'}
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">All Reports</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex items-center gap-1">
            {statusTabs.map((tab) => {
              const count = tab.key === 'all'
                ? reports.filter((r) => !selectedAssessment || r.assessmentId === selectedAssessment).length
                : reports.filter((r) => r.status === tab.key && (!selectedAssessment || r.assessmentId === selectedAssessment)).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${statusFilter === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                >
                  {tab.label}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
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
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/70 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Participant</th>
                  <th className="text-left px-5 py-3 font-medium">Assessment</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Generated</th>
                  <th className="text-left px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {filteredReports.map((r) => {
                  const asmt = assessments?.find((a) => a.id === r.assessmentId);
                  const name = r.participantName || 'Participant';
                  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">{name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{r.participantRole || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-gray-600 dark:text-slate-300 max-w-[180px] truncate" title={asmt?.title}>
                          {asmt?.title ?? r.assessmentId}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full px-2.5 py-1">
                          <span>{REPORT_TYPE_ICON[r.reportType] || '📄'}</span>
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
                      <td className="px-5 py-3.5 text-gray-400 dark:text-slate-500 text-xs">
                        {r.generatedAt ? format(new Date(r.generatedAt), 'dd MMM yyyy, HH:mm') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.status === 'ready' ? (
                          <button
                            onClick={() => handleDownload(r)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-50 dark:bg-blue-950/50 hover:bg-gray-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Download
                          </button>
                        ) : r.status === 'failed' ? (
                          <button
                            onClick={() => handleGenerate(r.participantId)}
                            className="text-xs font-medium text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/70 px-3 py-1.5 rounded-lg transition-colors"
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
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl px-5 py-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-blue-500 dark:text-blue-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">About PDF Reports</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Reports are generated as multi-page PDFs and are typically ready within 30–60 seconds.
            Processing reports are automatically updated — no need to refresh the page.
            Generated reports are available for download for 90 days.
          </p>
        </div>
      </div>
    </div>
  );
}