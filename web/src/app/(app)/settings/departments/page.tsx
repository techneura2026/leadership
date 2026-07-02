'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import type { DepartmentDto } from '@leaderprism/shared';

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

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Departments</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your organisation&apos;s departments.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Department
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        {!search && (<svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>)}
        <input
          type="text"
          placeholder="Search departments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="placeholder:px-5  w-full !pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21H5a2 2 0 0 1-2-2V7l7-4 7 4v12a2 2 0 0 1-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">
              {search ? 'No departments match your search' : 'No departments yet'}
            </p>
            {!search && (
              <p className="text-xs text-gray-400 mt-1">Create your first department to get started.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
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
              {filtered.map((dept) => (
                <tr
                  key={dept.id}
                  className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="overflow-scroll px-4 py-3 font-medium text-gray-900 max-w-xs">{dept.name}</td>
                  <td className="overflow-scroll text-wrap px-4 py-3 hidden md:table-cell max-w-xs">
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
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 0 0 5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                          </svg>
                        )}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => setEditTarget(dept)}
                        title="Edit"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(dept)}
                        title="Delete"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
