'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft, Pencil, Send, XCircle, Sparkles, Download,
  Plus as PlusIcon, Trash2, CheckCircle2, Clock3,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TopCenterToast } from '@/components/ui/TopCenterToast';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { TYPE_META, QUESTION_TYPE_META } from '@/lib/assessmentTypeMeta';
import {
  AssessmentDto,
  AssessmentStatus,
  AssessmentType,
  UserDto,
  RaterNominationDto,
  ReportDto,
  UserRole,
  RaterRelationship,
} from '@leaderprism/shared';
import { RadarChart, RadarAxis } from '@/components/ui/RadarChart';
type ReportKind = 'individual_360' | 'competency' | 'personality' | 'readiness';

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'TABLE';

interface QuestionOption {
  id: string;
  text: string;
}

interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: QuestionOption[];
  tableRows: string[];
  tableColumns: string[];
}

interface Participant {
  id: string;
  userId: string;
  user: UserDto;
  status: 'invited' | 'in_progress' | 'completed';
  completionPercentage?: number;
}

// The live API doesn't return a granular completionPercentage — fall back to a
// status-derived estimate so the response-rate bars degrade gracefully.
function participantCompletion(p: Participant): number {
  if (typeof p.completionPercentage === 'number') return p.completionPercentage;
  return p.status === 'completed' ? 100 : p.status === 'in_progress' ? 50 : 0;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Single Choice',
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short Answer',
  TABLE: 'Table',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'info' | 'warning'> = {
  draft: 'neutral',
  active: 'success',
  closed: 'info',
  archived: 'neutral',
};

const TAB_LIST = [
  { key: 'overview', label: 'Overview' },
  { key: 'participants', label: 'Participants' },
  { key: 'feedback-givers', label: 'Feedback Givers' },
  { key: 'results', label: 'Results' },
  { key: 'reports', label: 'Reports' },
];

function toReportType(type: AssessmentType): ReportKind {
  const m: Record<AssessmentType, ReportKind> = {
    [AssessmentType.FEEDBACK_360]: 'individual_360',
    [AssessmentType.COMPETENCY]: 'competency',
    [AssessmentType.PERSONALITY]: 'personality',
    [AssessmentType.READINESS]: 'readiness',
  };
  return m[type] ?? 'individual_360';
}

// Shown on non-completed participant/rater rows once the assessment has an end date.
function DueBadge({ endDate, done }: { endDate: string | null | undefined; done: boolean }) {
  if (done || !endDate) return null;
  const due = new Date(endDate);
  const overdue = due.getTime() < Date.now();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
        overdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200',
      )}
    >
      <Clock3 className="w-3 h-3" strokeWidth={2} />
      {overdue ? 'Overdue' : `Due ${format(due, 'dd MMM')}`}
    </span>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({
  assessment,
  participants,
  questions,
  onGoToReports,
  onCloseAssessment,
}: {
  assessment: AssessmentDto;
  participants: Participant[];
  questions: AssessmentQuestion[];
  onGoToReports: () => void;
  onCloseAssessment: () => Promise<void>;
}) {
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const meta = TYPE_META[assessment.assessmentType];
  const Icon = meta.icon;

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  async function sendReminders() {
    setSendingReminders(true);
    try {
      const endpoint =
        assessment.assessmentType === AssessmentType.FEEDBACK_360
          ? `/assessments/${assessment.id}/360/reminders`
          : `/assessments/${assessment.id}/send-reminders`;
      const res = await api.post(endpoint);
      const sent = res.data?.data?.sent ?? 0;
      showToast(sent > 0 ? `Reminder sent to ${sent} ${sent === 1 ? 'person' : 'people'}.` : 'Everyone has already responded — no reminders needed.');
    } catch (error) {
      showToast('Failed to send reminders.', 'error');
    } finally {
      setSendingReminders(false);
    }
  }

async function closeAssessment() {
  try {
    setClosing(true);

    await onCloseAssessment();

    setShowCloseConfirm(false);

    showToast('Assessment has been closed.');
  } catch (err) {
    console.error(err);
    showToast('Failed to close assessment.', 'error');
  } finally {
    setClosing(false);
  }
}

  const completedCount = participants.filter((p) => p.status === 'completed').length;
  const totalCount = participants.length;
  const responseRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <TopCenterToast
        message={toast?.message ?? null}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />
      {/* Assessment details — colorful hero */}
      <div className={cn('relative overflow-hidden rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all', meta.soft)}>
        <span className="absolute top-0 left-0 right-0 h-1.5" style={{ background: meta.gradient }} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: meta.gradient, boxShadow: `0 8px 20px -4px ${meta.glow}` }}
            >
              <Icon className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{assessment.title}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn('inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-1 border', meta.chip)}>
                  {meta.label}
                </span>
                <Badge variant={STATUS_VARIANT[assessment.status] ?? 'neutral'}>
                  {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
                </Badge>
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                {assessment.startDate && (
                  <p className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" strokeWidth={2} /> Start: {format(new Date(assessment.startDate), 'dd MMM yyyy')}</p>
                )}
                {assessment.endDate && (
                  <p className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" strokeWidth={2} /> End: {format(new Date(assessment.endDate), 'dd MMM yyyy')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {assessment.status === AssessmentStatus.ACTIVE && (
              <button
                onClick={sendReminders}
                disabled={sendingReminders}
                className="text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingReminders ? <Spinner size="sm" /> : <Send className="w-4 h-4" strokeWidth={2} />}
                Send Reminders
              </button>
            )}
            {assessment.status === AssessmentStatus.ACTIVE && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="text-sm font-medium border border-red-200 bg-white text-red-600 hover:bg-red-50 rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" strokeWidth={2} />
                Close Assessment
              </button>
            )}
            <button
              onClick={onGoToReports}
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 transition-colors shadow-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" strokeWidth={2} />
              Generate Reports
            </button>
          </div>
        </div>
      </div>

      {/* Response rate */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Response Rate</h3>
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall completion</span>
              <span>{responseRate}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${responseRate}%`, background: meta.gradient }}
              />
            </div>
          </div>
          <div className="text-sm font-semibold text-gray-700 shrink-0 tabular-nums">
            {completedCount}/{totalCount}
          </div>
        </div>

        <div className="space-y-3">
          {participants.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <Avatar seed={p.userId} src={p.user?.avatarUrl} size="xs" />
              <div className="w-28 text-xs font-medium text-gray-700 truncate shrink-0">
                {p.user?.firstName} {p.user?.lastName}
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    p.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-400',
                  )}
                  style={{ width: `${participantCompletion(p)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
                {participantCompletion(p)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Questionnaire — {questions.length} Question{questions.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3 bg-gray-50">
                  <span className="text-xs font-bold text-gray-400 mt-0.5 w-5 shrink-0">Q{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {q.title || <span className="italic text-gray-400">Untitled question</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', QUESTION_TYPE_META[q.type]?.chip ?? 'bg-blue-50 text-blue-600')}>
                        {QUESTION_TYPE_META[q.type]?.label ?? QUESTION_TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      {q.required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">
                          Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') && q.options.length > 0 && (
                  <div className="px-4 py-3 space-y-1.5">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-gray-300 shrink-0">
                          {q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE' ? '○' : '□'}
                        </span>
                        <span>{opt.text || <span className="italic text-gray-400">Empty option</span>}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === 'SHORT_ANSWER' && (
                  <div className="px-4 py-3">
                    <div className="h-10 bg-gray-50 border border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400 italic">Text response</span>
                    </div>
                  </div>
                )}
                {q.type === 'TABLE' && q.tableRows.length > 0 && q.tableColumns.length > 0 && (
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="text-xs border-collapse bg-white rounded-lg overflow-hidden border border-gray-100 w-full">
                      <thead>
                        <tr>
                          <th className="border border-gray-100 px-3 py-1.5 bg-gray-50 min-w-[80px]" />
                          {q.tableColumns.map((col, i) => (
                            <th key={i} className="border border-gray-100 px-3 py-1.5 bg-gray-50 text-gray-700 font-medium text-left min-w-[90px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {q.tableRows.map((row, i) => (
                          <tr key={i}>
                            <td className="border border-gray-100 px-3 py-1.5 bg-gray-50 font-medium text-gray-600">{row}</td>
                            {q.tableColumns.map((_, j) => (
                              <td key={j} className="border border-gray-100 px-3 py-1.5 text-gray-300 italic text-center">—</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
  assessmentStatus,
  assessmentEndDate,
}: {
  assessmentId: string;
  participants: Participant[];
  onRefresh: () => void;
  assessmentStatus: AssessmentStatus;
  assessmentEndDate: string | null;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [search, setSearch] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [page, setPage] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: departments } = useApi<any[]>('/organisations/me/departments');

  const limit = 10;
  const url = `/organisations/me/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&departmentId=${selectedDeptId}`;
  const { data: paginatedResponse, isLoading: usersLoading } = useApi<{ data: UserDto[]; total: number; page: number; limit: number }>(url);

  const participantUserIds = participants.map((p) => p.userId);
  const dropdownUsers = paginatedResponse?.data.filter(u => !participantUserIds.includes(u.id)) ?? [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  async function handleAddParticipant(userId: string) {
    setAdding(true);
    try {
      await api.post(`/assessments/${assessmentId}/participants`, { userId });
      showToast('Participant added.');
      setSearch('');
      setDropdownOpen(false);
      onRefresh();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to add participant.';
      showToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleAddByEmail(email: string) {
    if (!email.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setAdding(true);
    try {
      await api.post(`/assessments/${assessmentId}/participants`, { email });
      showToast('Participant added.');
      setSearch('');
      setDropdownOpen(false);
      onRefresh();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to add participant.';
      showToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function removeParticipant(assessmentId: string, _participantId: string) {
    // if (!confirm('Remove this participant?')) return;
    try {
      const res = await api.post(`/assessments/${assessmentId}/participants/${_participantId}/remove`);
      if (res?.data) {
        showToast('Participant removed.');
        onRefresh();
      }
    } catch (error) {
      console.log(error);
      showToast('Participant removal failed.', 'error');
    }
  }

  async function remindParticipant(participantId: string) {
    setRemindingId(participantId);
    try {
      await api.post(`/assessments/${assessmentId}/participants/${participantId}/remind`);
      showToast('Reminder sent.');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to send reminder.', 'error');
    } finally {
      setRemindingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <TopCenterToast
        message={toast?.message ?? null}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">
          {participants.length} Participant{participants.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-sm font-medium bg-blue-50 text-blue-600 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors shrink-0"
        >
          <PlusIcon className="w-4 h-4" strokeWidth={2.5} />
          Add Participant
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col gap-3 relative" ref={dropdownRef}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name or enter email…"
                value={search}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  setDropdownOpen(true);
                }}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    if (search.includes('@')) {
                      handleAddByEmail(search.trim());
                    } else {
                      showToast('Please select a user from the suggestions or type a valid email.', 'info');
                    }
                  }
                }}
              />
            </div>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setPage(1);
                setDropdownOpen(true);
              }}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (search.trim()) {
                  handleAddByEmail(search.trim());
                }
              }}
              disabled={adding || !search.trim()}
              className="bg-blue-600 text-white text-sm font-medium rounded-lg px-6 py-2.5 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              {adding && <Spinner size="sm" className="border-white border-t-transparent" />}
              Add
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setSearch('');
              }}
              className="text-gray-500 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-200 transition-colors rounded-lg text-sm px-4 py-2.5 shrink-0"
            >
              Cancel
            </button>
          </div>

          {dropdownOpen && (
            <div className="absolute z-20 top-full left-5 right-5 mt-1 border border-gray-200 rounded-xl shadow-xl bg-white overflow-hidden divide-y divide-gray-100 dark:bg-gray-800">
              {usersLoading ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Spinner />
                  <span className="text-sm text-gray-500">Searching...</span>
                </div>
              ) : dropdownUsers.length > 0 ? (
                <>
                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                    {dropdownUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAddParticipant(user.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50/80 text-left transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {paginatedResponse && paginatedResponse.total > limit && (
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-xs text-gray-500">
                      <span>
                        Page {page} of {Math.ceil(paginatedResponse.total / limit)} ({paginatedResponse.total} total)
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          disabled={page <= 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPage((p) => Math.max(1, p - 1));
                          }}
                          className="px-2 py-1 border border-gray-200 rounded bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        >
                          Prev
                        </button>
                        <button
                          disabled={page >= Math.ceil(paginatedResponse.total / limit)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPage((p) => p + 1);
                          }}
                          className="px-2 py-1 border border-gray-200 rounded bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-3 py-6 text-center text-sm text-gray-450">
                  No matching users found.
                </div>
              )}
            </div>
          )}
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
                    <div className="flex items-center gap-2.5">
                      <Avatar seed={p.userId} src={p.user?.avatarUrl} size="sm" />
                      {p.user?.firstName} {p.user?.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.user?.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <DueBadge endDate={assessmentEndDate} done={p.status === 'completed'} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {p.status !== 'completed' && assessmentStatus === AssessmentStatus.ACTIVE && (
                        <button
                          onClick={() => remindParticipant(p.id)}
                          disabled={remindingId === p.id}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {remindingId === p.id ? <Spinner size="sm" className="w-3 h-3" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
                          Remind
                        </button>
                      )}
                      <button
                        onClick={() => removeParticipant(assessmentId,p.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        Remove
                      </button>
                    </div>
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

// ── Feedback Givers Tab ───────────────────────────────────────────────────────
function FeedbackGiversTab({
  assessmentId,
  participants,
  nominations,
  assessmentStatus,
  assessmentEndDate,
}: {
  assessmentId: string;
  participants: Participant[];
  nominations: RaterNominationDto[];
  assessmentStatus: AssessmentStatus;
  assessmentEndDate: string | null;
}) {
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function getParticipantName(participantId: string) {
    // RaterNominationDto.participantId is the AssessmentParticipant record id, not the userId.
    const p = participants.find((pt) => pt.id === participantId);
    if (!p) return '—';
    return `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim();
  }

  async function remindNomination(nominationId: string) {
    setRemindingId(nominationId);
    try {
      await api.post(`/assessments/${assessmentId}/360/nominations/${nominationId}/remind`);
      setToast({ message: 'Reminder sent.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.response?.data?.message || 'Failed to send reminder.', type: 'error' });
    } finally {
      setRemindingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <TopCenterToast
        message={toast?.message ?? null}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Feedback Givers{nominations.length > 0 ? ` — ${nominations.length}` : ''}
        </h3>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {nominations.length === 0 ? (
          <EmptyState
            title="No feedback givers yet"
            description="Feedback givers will appear here once participants nominate their raters."
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Feedback Giver
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Giving Feedback For
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Relationship
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
              {nominations.map((n) => {
                const outstanding = n.status !== 'completed' && n.status !== 'declined';
                return (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar seed={n.raterEmail} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{n.raterName ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{n.raterEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {getParticipantName(n.participantId)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center text-xs font-medium capitalize px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60">
                      {n.relationship.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={n.status === 'completed' ? 'success' : 'neutral'}>
                        {n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                      </Badge>
                      <DueBadge endDate={assessmentEndDate} done={n.status === 'completed'} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {outstanding && assessmentStatus === AssessmentStatus.ACTIVE && (
                      <button
                        onClick={() => remindNomination(n.id)}
                        disabled={remindingId === n.id}
                        className="text-xs text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {remindingId === n.id ? <Spinner size="sm" className="w-3 h-3" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
                        Remind
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

// ── Reports Tab ────────────────────────────────────────────────────────────────
function ReportsTab({
  assessmentId,
  assessmentType,
  assessmentTitle,
  participants,
  reports,
}: {
  assessmentId: string;
  assessmentType: AssessmentType;
  assessmentTitle: string;
  participants: Participant[];
  reports: ReportDto[];
}) {
  // Polls while any report is still queued/rendering on the BullMQ worker.
  const { data: liveReports, mutate: mutateReports } = useApi<ReportDto[]>(`/reports?assessmentId=${assessmentId}`, {
    refreshInterval: (data) =>
      data?.some((r) => r.status === 'pending' || r.status === 'processing') ? 2000 : 0,
  });
  const localReports = liveReports ?? reports;
  const [generating, setGenerating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function generateReport(participant: Participant) {
    setGenerating(participant.id);
    try {
      // Enqueues a BullMQ job and returns immediately; the polling useApi call above
      // picks up the 'ready'/'failed' transition once the worker finishes.
      await api.post('/reports/generate', {
        assessmentId,
        participantId: participant.id,
        reportType: toReportType(assessmentType),
        language: 'en',
      });
      await mutateReports();
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setGenerating(null);
    }
  }

  async function downloadPdf(participant: Participant) {
    const report = getReportForParticipant(participant.id);
    if (!report) return;
    setDownloading(participant.id);
    try {
      const res = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report', err);
    } finally {
      setDownloading(null);
    }
  }

  function getReportForParticipant(participantId: string) {
    return localReports.find((r) => r.participantId === participantId);
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
                const report = getReportForParticipant(p.id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <Avatar seed={p.userId} src={p.user?.avatarUrl} size="sm" />
                        {p.user?.firstName} {p.user?.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {generating === p.id ? (
                        <Badge variant="warning">Generating…</Badge>
                      ) : report ? (
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
                          onClick={() => downloadPdf(p)}
                          disabled={downloading === p.id}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                        >
                          {downloading === p.id ? <Spinner size="sm" /> : <Download className="w-3.5 h-3.5" strokeWidth={2} />}
                          Download PDF
                        </button>
                      ) : (
                        <button
                          onClick={() => generateReport(p)}
                          disabled={generating === p.id}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                        >
                          {generating === p.id ? <Spinner size="sm" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
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
  assessmentId,
  participant,
}: {
  assessmentId: string;
  participant: Participant;
}) {
  const { data: scores } = useApi<FactorScore[]>(
    participant.status === 'completed'
      ? `/assessments/${assessmentId}/personality/scores/${participant.id}`
      : null,
  );

  if (participant.status !== 'completed') {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center text-center min-h-[420px] hover:border-gray-300 transition-colors">
        <Avatar seed={participant.userId} src={participant.user?.avatarUrl} size="lg" className="mb-4 opacity-60 grayscale" />
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
    <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col min-h-[420px]">
      <span className="absolute top-0 left-0 right-0 h-1" style={{ background: TYPE_META[AssessmentType.PERSONALITY].gradient }} />
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Avatar seed={participant.userId} src={participant.user?.avatarUrl} size="md" ring />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {participant.user?.firstName} {participant.user?.lastName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Completed</p>
          </div>
        </div>
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" strokeWidth={2} />
      </div>

      {!scores ? (
        <div className="flex justify-center py-6 flex-1 items-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-6 px-2 sm:px-4 [&_svg]:overflow-visible">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {completed.map((p) => (
            <ParticipantRadarCard key={p.id} assessmentId={assessmentId} participant={p} />
          ))}
          {pending.map((p) => (
            <ParticipantRadarCard key={p.id} assessmentId={assessmentId} participant={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState('overview');

  const [assessment, setAssessment] = useState<AssessmentDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssessment = async () => {
      try {
        const res = await api.get(`/assessments/${id}`);
        setAssessment(res.data.data);
      } catch (err) {
        console.error(err);
        setAssessment(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadAssessment();
    }
  }, [id]);


  const [participants, setParticipants] = useState<Participant[]>([]);

  const loadParticipants = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/assessments/${id}/participants`);
      setParticipants(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const is360 = assessment?.assessmentType === AssessmentType.FEEDBACK_360;
  const isPersonality = assessment?.assessmentType === AssessmentType.PERSONALITY;

  const { data: nominations } = useApi<RaterNominationDto[]>(
    is360 ? `/assessments/${id}/360/nominations` : null,
  );
  const { data: reports } = useApi<ReportDto[]>(`/reports?assessmentId=${id}`);

  const visibleTabs = TAB_LIST.filter(
    (t) =>
      (t.key !== 'feedback-givers' || is360) &&
      (t.key !== 'results' || isPersonality),
  );



  const handleCloseAssessment = async () => {
  try {
    await api.post(`/assessments/${id}/close`);

    const res = await api.get(`/assessments/${id}`);
    setAssessment(res.data.data);
  } catch (err) {
    console.error(err);
    throw err;
  }
};

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }






  if (!assessment) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        Assessment not found.
      </div>
    );
  }

  const headerMeta = TYPE_META[assessment.assessmentType];
  const HeaderIcon = headerMeta.icon;

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/assessments')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Assessments
        </button>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: headerMeta.gradient, boxShadow: `0 4px 12px ${headerMeta.glow}` }}
            >
              <HeaderIcon className="w-5 h-5 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 truncate">{assessment.title}</h1>
          </div>
          <button
            onClick={() => router.push(`/assessments/${id}/edit`)}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-50 text-blue-600 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors shrink-0"
          >
            <Pencil className="w-4 h-4" strokeWidth={1.8} />
            Edit
          </button>
        </div>
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
          participants={participants}
          questions={((assessment.config as any)?.questions ?? []) as AssessmentQuestion[]}
          onGoToReports={() => setActiveTab('reports')}
          onCloseAssessment={handleCloseAssessment}
        />
      )}

      {activeTab === 'participants' && (
        <ParticipantsTab
          assessmentId={id}
          participants={participants}
          onRefresh={loadParticipants}
          assessmentStatus={assessment.status}
          assessmentEndDate={assessment.endDate}
        />
      )}

      {activeTab === 'feedback-givers' && is360 && (
        <FeedbackGiversTab
          assessmentId={id}
          participants={participants}
          nominations={nominations ?? []}
          assessmentStatus={assessment.status}
          assessmentEndDate={assessment.endDate}
        />
      )}

      {activeTab === 'results' && isPersonality && (
        <PersonalityResultsTab assessmentId={id} participants={participants} />
      )}

      {activeTab === 'reports' && (
        <ReportsTab assessmentId={id} assessmentType={assessment.assessmentType} assessmentTitle={assessment.title} participants={participants} reports={reports ?? []} />
      )}
    </div>
  );
}
