'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import type { DepartmentDto } from '@leaderprism/shared';
import {
  Network, Plus, Search, Pencil, Trash2, Power, PowerOff, Building2,
  CheckCircle2, XCircle, Boxes,
} from 'lucide-react';

// ── Colour cycle for department icon chips ──────────────────────────────────

const DEPT_COLORS = [
  { gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)', glow: 'rgba(70,95,255,0.22)' },
  { gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', glow: 'rgba(168,85,247,0.22)' },
  { gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', glow: 'rgba(34,197,94,0.2)' },
  { gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: 'rgba(245,158,11,0.2)' },
  { gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', glow: 'rgba(236,72,153,0.22)' },
  { gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', glow: 'rgba(20,184,166,0.2)' },
];

function deptColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return DEPT_COLORS[hash % DEPT_COLORS.length];
}

// ── Description cell with expand/collapse ──────────────────────────────────

const DESCRIPTION_LIMIT = 80;

function DescriptionCell({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return <span className="text-gray-300">—</span>;

  const isLong = text.length > DESCRIPTION_LIMIT;
  const displayed = isLong && !expanded ? text.slice(0, DESCRIPTION_LIMIT) + '…' : text;

  return (
    <span className="text-gray-500">
      {displayed}
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-blue-500 hover:text-blue-700 text-xs font-medium whitespace-nowrap"
        >
          {expanded ? 'View less' : 'View more'}
        </button>
      )}
    </span>
  );
}

// ── Field + input helpers ───────────────────────────────────────────────────

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700';

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── Add Department Modal ────────────────────────────────────────────────────

interface AddDepartmentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function AddDepartmentModal({ open, onClose, onCreated }: AddDepartmentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setDescription('');
    setError('');
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Department name is required.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/organisations/me/departments', {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      reset();
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create department.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Department">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <Field label="Department Name" required>
          <input
            className={inputCls}
            placeholder="e.g. Engineering"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputCls + ' resize-none'}
            placeholder="Optional description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            Create Department
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Department Modal ───────────────────────────────────────────────────

interface EditDepartmentModalProps {
  department: DepartmentDto | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditDepartmentModal({ department, onClose, onSaved }: EditDepartmentModalProps) {
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(department?.name ?? '');
    setDescription(department?.description ?? '');
    setError('');
  }, [department]);

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!department) return;
    setError('');
    if (!name.trim()) {
      setError('Department name is required.');
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/organisations/me/departments/${department.id}`, {
        name: name.trim(),
        description: description.trim() || null,
      });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update department.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!department} onClose={handleClose} title="Edit Department">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <Field label="Department Name" required>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputCls + ' resize-none'}
            placeholder="Optional description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Toggle Status Confirmation Modal ───────────────────────────────────────

interface ToggleStatusModalProps {
  department: DepartmentDto | null;
  onClose: () => void;
  onConfirmed: () => void;
}

function ToggleStatusModal({ department, onClose, onConfirmed }: ToggleStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const action = department?.isActive ? 'deactivate' : 'activate';

  async function handleConfirm() {
    if (!department) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/organisations/me/departments/${department.id}`, {
        isActive: !department.isActive,
      });
      onConfirmed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!department} onClose={onClose} title={`${action.charAt(0).toUpperCase() + action.slice(1)} Department`}>
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <p className="text-sm text-gray-600">
          Are you sure you want to <strong>{action}</strong>{' '}
          <strong className="text-gray-900">{department?.name}</strong>?
          {action === 'deactivate' && (
            <span className="block mt-1 text-yellow-700">
              Deactivated departments will not appear in user assignments.
            </span>
          )}
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${action === 'deactivate'
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            {loading && <Spinner size="sm" />}
            {action.charAt(0).toUpperCase() + action.slice(1)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete Confirmation Modal ───────────────────────────────────────────────

interface DeleteModalProps {
  department: DepartmentDto | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteModal({ department, onClose, onDeleted }: DeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!department) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/organisations/me/departments/${department.id}`);
      onDeleted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!department} onClose={onClose} title="Delete Department">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <p className="text-sm text-gray-600">
          Are you sure you want to permanently delete{' '}
          <strong className="text-gray-900">{department?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, gradient, glow }: {
  label: string; value: number; icon: typeof Boxes; gradient: string; glow: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mb-4"
        style={{ background: gradient, boxShadow: `0 4px 12px ${glow}` }}
      >
        <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
      </div>
      <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{value}</p>
      <p className="text-sm text-gray-500 mt-1.5 font-medium">{label}</p>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const { data: departments, mutate, isLoading } = useApi<DepartmentDto[]>('/organisations/me/departments');

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentDto | null>(null);
  const [toggleTarget, setToggleTarget] = useState<DepartmentDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentDto | null>(null);

  const filtered = useMemo(() => {
    if (!departments) return [];
    const q = search.toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  const stats = {
    total: (departments ?? []).length,
    active: (departments ?? []).filter((d) => d.isActive).length,
    inactive: (departments ?? []).filter((d) => !d.isActive).length,
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(245,158,11,0.25)' }}
          >
            <Network className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Departments</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage your organisation&apos;s departments.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Department
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Departments" value={stats.total} icon={Boxes} gradient="linear-gradient(135deg, #465fff 0%, #2a31d8 100%)" glow="rgba(70,95,255,0.25)" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} gradient="linear-gradient(135deg, #22c55e 0%, #15803d 100%)" glow="rgba(34,197,94,0.22)" />
        <StatCard label="Inactive" value={stats.inactive} icon={XCircle} gradient="linear-gradient(135deg, #64748b 0%, #475569 100%)" glow="rgba(100,116,139,0.2)" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={2} />
        <input
          type="text"
          placeholder="Search departments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Network className="w-7 h-7 text-gray-300" strokeWidth={1.5} />}
            title={search ? 'No departments match your search' : 'No departments yet'}
            description={!search ? 'Create your first department to get started.' : undefined}
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                    Created
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dept) => {
                  const color = deptColor(dept.id);
                  return (
                    <tr
                      key={dept.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: color.gradient, boxShadow: `0 2px 8px ${color.glow}` }}
                          >
                            <Building2 className="w-4 h-4 text-white" strokeWidth={2} />
                          </div>
                          <span className="font-medium text-gray-900 truncate">{dept.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                        <DescriptionCell text={dept.description} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={dept.isActive ? 'success' : 'neutral'}>
                          {dept.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                        {dept.createdAt ? formatDate(dept.createdAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle status */}
                          <button
                            onClick={() => setToggleTarget(dept)}
                            title={dept.isActive ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg transition-colors ${dept.isActive
                                ? 'text-yellow-600 hover:bg-yellow-50'
                                : 'text-green-600 hover:bg-green-50'
                              }`}
                          >
                            {dept.isActive ? (
                              <PowerOff className="w-4 h-4" strokeWidth={2} />
                            ) : (
                              <Power className="w-4 h-4" strokeWidth={2} />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setEditTarget(dept)}
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" strokeWidth={2} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(dept)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} of {departments?.length ?? 0} department{departments?.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddDepartmentModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          mutate();
        }}
      />

      <EditDepartmentModal
        department={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          mutate();
        }}
      />

      <ToggleStatusModal
        department={toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirmed={() => {
          setToggleTarget(null);
          mutate();
        }}
      />

      <DeleteModal
        department={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          mutate();
        }}
      />
    </div>
  );
}
