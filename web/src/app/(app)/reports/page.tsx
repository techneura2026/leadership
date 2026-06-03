'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { formatDate } from '@/lib/utils';
import type { AssessmentDto, ReportDto } from '@leaderprism/shared';
import { AssessmentStatus } from '@leaderprism/shared';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'error'> = {
  ready: 'success', processing: 'warning', pending: 'neutral', failed: 'error',
};

const REPORT_TYPE_OPTIONS = [
  { value: 'individual_360', label: '360° Feedback Report' },
  { value: 'competency', label: 'Competency Profile Report' },
  { value: 'personality', label: 'Personality Profile Report' },
  { value: 'readiness', label: 'Leadership Readiness Report' },
];

export default function ReportsPage() {
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: assessmentsResult } = useApi<{ data: AssessmentDto[] }>('/assessments?status=closed');
  const assessments = assessmentsResult?.data;
  const { data: reports, mutate, isLoading } = useApi<ReportDto[]>(
    selectedAssessment ? `/reports?assessmentId=${selectedAssessment}` : '/reports',
    { refreshInterval: (data) => (data?.some((r: any) => r.status === 'processing') ? 5000 : 0) },
  );
  const { data: participants } = useApi<any[]>(
    selectedAssessment ? `/assessments/${selectedAssessment}/participants` : null,
  );
  const selectedAsmt = (assessments ?? []).find((a) => a.id === selectedAssessment);

  async function generateReport(participantId: string) {
    if (!selectedAssessment || !selectedAsmt) return;
    const typeMap: Record<string, string> = {
      '360_feedback': 'individual_360',
      competency: 'competency',
      personality: 'personality',
      readiness: 'readiness',
    };
    const reportType = typeMap[selectedAsmt.assessmentType] ?? 'individual_360';
    setGenerating(participantId);
    try {
      await api.post('/reports/generate', {
        assessmentId: selectedAssessment, participantId, reportType, language: 'en',
      });
      mutate();
    } finally {
      setGenerating(null);
    }
  }

  async function downloadReport(reportId: string) {
    const res = await api.get(`/reports/${reportId}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Generate and download assessment reports.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Assessment</label>
        <div className="w-full sm:max-w-sm">
          <Select
            value={selectedAssessment}
            onChange={setSelectedAssessment}
            options={[{ value: '', label: 'All assessments' }, ...(assessments ?? []).map(a => ({ value: a.id, label: a.title }))]}
            placeholder="All assessments"
          />
        </div>
      </div>

      {/* Generate section — only when an assessment is selected */}
      {selectedAssessment && (participants ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Generate Reports</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(participants ?? []).map((p: any) => {
              const existing = (reports ?? []).find((r: any) => r.participantId === p.userId);
              return (
                <div key={p.userId} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{p.firstName} {p.lastName}</span>
                  <div className="flex items-center gap-2">
                    {existing && (
                      <Badge variant={STATUS_VARIANT[existing.status]}>{existing.status}</Badge>
                    )}
                    {existing?.status === 'ready' ? (
                      <button
                        onClick={() => downloadReport(existing.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Download PDF
                      </button>
                    ) : (
                      <button
                        onClick={() => generateReport(p.userId)}
                        disabled={generating === p.userId || existing?.status === 'processing'}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {generating === p.userId ? 'Queuing…' : existing?.status === 'processing' ? 'Processing…' : 'Generate'}
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
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">All Reports</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (reports ?? []).length === 0 ? (
          <EmptyState message="No reports generated yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Participant</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Generated</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(reports ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{r.participant?.firstName ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-gray-500">{REPORT_TYPE_OPTIONS.find(o => o.value === r.reportType)?.label ?? r.reportType}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'}>{r.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-400">{r.generatedAt ? formatDate(r.generatedAt) : '—'}</td>
                  <td className="px-4 py-3">
                    {r.status === 'ready' && (
                      <button onClick={() => downloadReport(r.id)} className="text-xs text-blue-600 hover:underline">Download</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
