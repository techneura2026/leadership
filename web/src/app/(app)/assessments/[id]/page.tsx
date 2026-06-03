'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AssessmentDto,
  AssessmentStatus,
  AssessmentType,
  UserDto,
  RaterNominationDto,
  ReportDto,
} from '@leaderprism/shared';
import { RadarChart, RadarAxis } from '@/components/ui/RadarChart';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Participant {
  id: string;
  userId: string;
  user: UserDto;
  status: 'invited' | 'in_progress' | 'completed';
  completionPercentage: number;
}

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'info' | 'warning'> = {
  draft: 'neutral',
  active: 'success',
  closed: 'info',
  archived: 'neutral',
};

const TAB_LIST = [
  { key: 'overview', label: 'Overview' },
  { key: 'participants', label: 'Participants' },
  { key: 'nominations', label: 'Nominations' },
  { key: 'results', label: 'Results' },
  { key: 'reports', label: 'Reports' },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({
  assessment,
  participants,
  onGoToReports,
}: {
  assessment: AssessmentDto;
  participants: Participant[];
  onGoToReports: () => void;
}) {
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  async function sendReminders() {
    setSendingReminders(true);
    try {
      await api.post(`/assessments/${assessment.id}/360/reminders`);
      alert('Reminders sent successfully.');
    } catch {
      alert('Failed to send reminders.');
    } finally {
      setSendingReminders(false);
    }
  }

  async function closeAssessment() {
    setClosing(true);
    try {
      await api.patch(`/assessments/${assessment.id}`, { status: AssessmentStatus.CLOSED });
      setShowCloseConfirm(false);
      window.location.reload();
    } catch {
      alert('Failed to close assessment.');
    } finally {
      setClosing(false);
    }
  }

  const completedCount = participants.filter((p) => p.status === 'completed').length;
  const totalCount = participants.length;
  const responseRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Assessment details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{assessment.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="info">
                {assessment.assessmentType === AssessmentType.FEEDBACK_360
                  ? '360° Feedback'
                  : assessment.assessmentType.charAt(0).toUpperCase() +
                    assessment.assessmentType.slice(1)}
              </Badge>
              <Badge variant={STATUS_VARIANT[assessment.status] ?? 'neutral'}>
                {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
              </Badge>
            </div>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              {assessment.startDate && (
                <p>Start: {format(new Date(assessment.startDate), 'dd MMM yyyy')}</p>
              )}
              {assessment.endDate && (
                <p>End: {format(new Date(assessment.endDate), 'dd MMM yyyy')}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {assessment.assessmentType === AssessmentType.FEEDBACK_360 && (
              <button
                onClick={sendReminders}
                disabled={sendingReminders || assessment.status !== AssessmentStatus.ACTIVE}
                className="text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingReminders ? <Spinner size="sm" /> : null}
                Send Reminders
              </button>
            )}
            {assessment.status === AssessmentStatus.ACTIVE && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2.5 transition-colors"
              >
                Close Assessment
              </button>
            )}
            <button
              onClick={onGoToReports}
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 transition-colors shadow-sm"
            >
              Generate Reports
            </button>
          </div>
        </div>
      </div>

      {/* Response rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Response Rate</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall completion</span>
              <span>{responseRate}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${responseRate}%` }}
              />
            </div>
          </div>
          <div className="text-sm font-medium text-gray-700 shrink-0">
            {completedCount}/{totalCount}
          </div>
        </div>

        <div className="space-y-2">
          {participants.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-32 text-xs text-gray-700 truncate">
                {p.user?.firstName} {p.user?.lastName}
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    p.status === 'completed' ? 'bg-green-500' : 'bg-blue-400',
                  )}
                  style={{ width: `${p.completionPercentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">
                {p.completionPercentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Close confirmation modal */}
      <Modal
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        title="Close Assessment"
      >
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to close this assessment? No further responses will be accepted
          after closing.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCloseConfirm(false)}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={closeAssessment}
            disabled={closing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {closing ? 'Closing…' : 'Close Assessment'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Participants Tab ──────────────────────────────────────────────────────────
function ParticipantsTab({
  assessmentId,
  participants,
  onRefresh,
}: {
  assessmentId: string;
  participants: Participant[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  async function addParticipant() {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await api.post(`/assessments/${assessmentId}/participants`, { email });
      setEmail('');
      setShowAdd(false);
      onRefresh();
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.error?.message ?? 'Failed to add participant.');
    } finally {
      setAdding(false);
    }
  }

  async function removeParticipant(participantId: string) {
    if (!confirm('Remove this participant?')) return;
    try {
      await api.delete(`/assessments/${assessmentId}/participants/${participantId}`);
      onRefresh();
    } catch {
      alert('Failed to remove participant.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">
          {participants.length} Participant{participants.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          + Add Participant
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="participant@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
          />
          <button
            onClick={addParticipant}
            disabled={adding || !email.trim()}
            className="bg-blue-600 text-white text-sm font-medium rounded-lg px-6 py-2.5 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {adding && <Spinner size="sm" className="border-white border-t-transparent" />}
            Add
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="text-gray-500 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-200 transition-colors rounded-lg text-sm px-4 py-2.5"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {participants.length === 0 ? (
          <EmptyState
            title="No participants yet"
            description="Add participants to begin the assessment."
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participants.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {p.user?.firstName} {p.user?.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.user?.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        p.status === 'completed'
                          ? 'success'
                          : p.status === 'in_progress'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {p.status === 'completed'
                        ? 'Completed'
                        : p.status === 'in_progress'
                        ? 'In Progress'
                        : 'Invited'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
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

// ── Nominations Tab ───────────────────────────────────────────────────────────
function NominationsTab({
  assessmentId,
  participants,
}: {
  assessmentId: string;
  participants: Participant[];
}) {
  const { data: nominations } = useApi<RaterNominationDto[]>(
    `/assessments/${assessmentId}/360/nominations`,
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  async function approveAll() {
    setApproving(true);
    try {
      await api.post(`/assessments/${assessmentId}/360/nominations/approve`);
      alert('All nominations approved.');
    } catch {
      alert('Failed to approve nominations.');
    } finally {
      setApproving(false);
    }
  }

  function getNominationsForParticipant(participantId: string) {
    return nominations?.filter((n) => n.participantId === participantId) ?? [];
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">Rater Nominations</h3>
        <button
          onClick={approveAll}
          disabled={approving}
          className="text-sm font-medium bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {approving && <Spinner size="sm" className="border-white border-t-transparent" />}
          Approve All Nominations
        </button>
      </div>

      <div className="space-y-2">
        {participants.map((p) => {
          const pNominations = getNominationsForParticipant(p.userId);
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:border-gray-300 transition-colors">
              <button
                onClick={() => setExpanded(isOpen ? null : p.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {p.user?.firstName} {p.user?.lastName}
                  </span>
                  <Badge variant="neutral">{pNominations.length} raters</Badge>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {pNominations.length === 0 ? (
                    <p className="text-sm text-gray-500 px-5 py-4">No raters nominated yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">
                            Rater
                          </th>
                          <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">
                            Relationship
                          </th>
                          <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pNominations.map((n) => (
                          <tr key={n.id}>
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-900">
                                {n.raterName ?? 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-500">{n.raterEmail}</p>
                            </td>
                            <td className="px-5 py-3 capitalize text-gray-600">
                              {n.relationship.replace('_', ' ')}
                            </td>
                            <td className="px-5 py-3">
                              <Badge
                                variant={n.status === 'completed' ? 'success' : 'neutral'}
                              >
                                {n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {participants.length === 0 && (
          <EmptyState title="No participants" description="Add participants to view nominations." />
        )}
      </div>
    </div>
  );
}

// ── Reports Tab ────────────────────────────────────────────────────────────────
function ReportsTab({
  assessmentId,
  participants,
}: {
  assessmentId: string;
  participants: Participant[];
}) {
  const { data: reports, mutate } = useApi<ReportDto[]>(`/reports?assessmentId=${assessmentId}`);
  const [generating, setGenerating] = useState<string | null>(null);

  async function generateReport(participantId: string) {
    setGenerating(participantId);
    try {
      await api.post('/reports/generate', {
        assessmentId,
        participantId,
        reportType: 'individual_360',
      });
      mutate();
    } catch {
      alert('Failed to generate report.');
    } finally {
      setGenerating(null);
    }
  }

  async function downloadReport(reportId: string) {
    try {
      const res = await api.get(`/reports/${reportId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download report.');
    }
  }

  function getReportForParticipant(participantId: string) {
    return reports?.find((r) => r.participantId === participantId);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Individual Reports</h3>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {participants.length === 0 ? (
          <EmptyState title="No participants" className="border-0" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Participant
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Generated
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participants.map((p) => {
                const report = getReportForParticipant(p.userId);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.user?.firstName} {p.user?.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {report ? (
                        <Badge
                          variant={
                            report.status === 'ready'
                              ? 'success'
                              : report.status === 'failed'
                              ? 'error'
                              : report.status === 'processing'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {report?.generatedAt
                        ? format(new Date(report.generatedAt), 'dd MMM yyyy HH:mm')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {report?.status === 'ready' ? (
                        <button
                          onClick={() => downloadReport(report.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          Download
                        </button>
                      ) : (
                        <button
                          onClick={() => generateReport(p.userId)}
                          disabled={generating === p.userId || report?.status === 'processing'}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                        >
                          {generating === p.userId && <Spinner size="sm" />}
                          Generate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Personality Results Tab ───────────────────────────────────────────────────

interface FactorScore {
  factor: string;
  rawScore: number;
  tScore: number;
  percentile: number;
  narrative: string;
}

const ADMIN_FACTOR_ORDER = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'emotional_stability',
];

const ADMIN_FACTOR_LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  emotional_stability: 'Emotional Stability',
};

function tScoreBandVariant(t: number): 'success' | 'warning' | 'info' {
  if (t >= 60) return 'success';
  if (t < 40) return 'info';
  return 'warning';
}

function ParticipantRadarCard({
  participant,
  assessmentId,
}: {
  participant: Participant;
  assessmentId: string;
}) {
  const { data: scores } = useApi<FactorScore[]>(
    participant.status === 'completed'
      ? `/assessments/${assessmentId}/personality/scores/${participant.id}`
      : null,
  );

  if (participant.status !== 'completed') {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center text-center min-h-[420px] hover:border-gray-300 transition-colors">
        <Badge variant="neutral" className="mb-4">Pending</Badge>
        <p className="text-sm font-semibold text-gray-900">
          {participant.user?.firstName} {participant.user?.lastName}
        </p>
        <p className="text-xs text-gray-500 mt-1.5 max-w-[200px]">Results will appear once the participant submits.</p>
      </div>
    );
  }

  const axes: RadarAxis[] = ADMIN_FACTOR_ORDER.map((key) => {
    const s = scores?.find((sc) => sc.factor === key);
    return { key, label: ADMIN_FACTOR_LABELS[key] ?? key, value: s ? Math.round(s.percentile) : 0 };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col min-h-[420px]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {participant.user?.firstName} {participant.user?.lastName}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Completed</p>
        </div>
        <Badge variant="success" className="shadow-sm">View</Badge>
      </div>

      {!scores ? (
        <div className="flex justify-center py-6 flex-1 items-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-6">
            <RadarChart axes={axes} size={200} />
          </div>

          <div className="space-y-3 mt-auto">
            {ADMIN_FACTOR_ORDER.map((key) => {
              const score = scores.find((s) => s.factor === key);
              if (!score) return null;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-700 w-32 shrink-0 truncate">{ADMIN_FACTOR_LABELS[key]}</span>
                  <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round(score.percentile)}%` }}
                    />
                  </div>
                  <Badge variant={tScoreBandVariant(score.tScore)} className="px-1.5 min-w-[2.5rem] text-center justify-center">
                    {Math.round(score.percentile)}th
                  </Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PersonalityResultsTab({
  assessmentId,
  participants,
}: {
  assessmentId: string;
  participants: Participant[];
}) {
  const completed = participants.filter((p) => p.status === 'completed');
  const pending = participants.filter((p) => p.status !== 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Personality Results — {completed.length}/{participants.length} completed
        </h3>
      </div>

      {participants.length === 0 && (
        <EmptyState title="No participants" description="Add participants to begin the assessment." />
      )}

      {participants.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {completed.map((p) => (
            <ParticipantRadarCard key={p.id} participant={p} assessmentId={assessmentId} />
          ))}
          {pending.map((p) => (
            <ParticipantRadarCard key={p.id} participant={p} assessmentId={assessmentId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── cn helper (inline to avoid extra import issue) ────────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState('overview');

  const { data: assessment, error, isLoading } = useApi<AssessmentDto>(`/assessments/${id}`);
  const {
    data: participants,
    mutate: refreshParticipants,
  } = useApi<Participant[]>(`/assessments/${id}/participants`);

  const is360 = assessment?.assessmentType === AssessmentType.FEEDBACK_360;
  const isPersonality = assessment?.assessmentType === AssessmentType.PERSONALITY;

  const visibleTabs = TAB_LIST.filter(
    (t) =>
      (t.key !== 'nominations' || is360) &&
      (t.key !== 'results' || isPersonality),
  );

  if (isLoading) return <PageSpinner />;
  if (error || !assessment) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error ? 'Failed to load assessment.' : 'Assessment not found.'}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/assessments')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Assessments
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{assessment.title}</h1>
      </div>

      <Tabs
        tabs={visibleTabs}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 'overview' && (
        <OverviewTab
          assessment={assessment}
          participants={participants ?? []}
          onGoToReports={() => setActiveTab('reports')}
        />
      )}

      {activeTab === 'participants' && (
        <ParticipantsTab
          assessmentId={id}
          participants={participants ?? []}
          onRefresh={() => refreshParticipants()}
        />
      )}

      {activeTab === 'nominations' && is360 && (
        <NominationsTab assessmentId={id} participants={participants ?? []} />
      )}

      {activeTab === 'results' && isPersonality && (
        <PersonalityResultsTab assessmentId={id} participants={participants ?? []} />
      )}

      {activeTab === 'reports' && (
        <ReportsTab assessmentId={id} participants={participants ?? []} />
      )}
    </div>
  );
}
