'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@leaderprism/shared';
import type { UserDto, DepartmentDto } from '@leaderprism/shared';

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: UserRole.HR_MANAGER, label: 'HR Manager' },
  { value: UserRole.MANAGER, label: 'Manager' },
  { value: UserRole.PARTICIPANT, label: 'Participant' },
] as const;

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Org Admin',
  hr_manager: 'HR Manager',
  manager: 'Manager',
  participant: 'Participant',
};

const ROLE_BADGE_VARIANT: Record<string, 'info' | 'warning' | 'neutral'> = {
  org_admin: 'info',
  hr_manager: 'info',
  manager: 'warning',
  participant: 'neutral',
};

type FilterRole = 'all' | UserRole;

// ── Input component ────────────────────────────────────────────────────────────

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

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700';

// ── Add User Modal ─────────────────────────────────────────────────────────────

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (fullName: string) => void;
}

function AddUserModal({ open, onClose, onCreated }: AddUserModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(UserRole.PARTICIPANT);
  const [departmentId, setDepartmentId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: departments } = useApi<DepartmentDto[]>(open ? '/organisations/me/departments' : null);

  const deptOptions = [
    { value: '', label: 'No department' },
    ...(departments ?? []).filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name })),
  ];

  function reset() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole(UserRole.PARTICIPANT);
    setDepartmentId('');
    setJobTitle('');
    setError('');
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/users', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        ...(departmentId ? { departmentId } : {}),
        ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      });
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      reset();
      onCreated(fullName);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to create user. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add User">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
              placeholder="Kavinda"
              autoFocus
            />
          </Field>
          <Field label="Last name" required>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputCls}
              placeholder="Rajapaksa"
            />
          </Field>
        </div>

        <Field label="Work email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="kavinda@company.lk"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Role" required>
            <Select
              value={role}
              onChange={setRole}
              options={[...ROLE_OPTIONS]}
            />
          </Field>
          <Field label="Department">
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={deptOptions}
            />
          </Field>
        </div>

        <Field label="Job title">
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className={inputCls}
            placeholder="e.g. Senior Manager"
          />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Edit User Modal ────────────────────────────────────────────────────────────

interface EditUserModalProps {
  user: UserDto | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditUserModal({ user, onClose, onSaved }: EditUserModalProps) {
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [role, setRole] = useState(user?.role ?? UserRole.PARTICIPANT);
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync state when user prop changes (modal reopened for different user)
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
    setJobTitle(user.jobTitle ?? '');
    setError('');
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!user) return;
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/users/${user.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        jobTitle: jobTitle.trim() || null,
      });
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to save changes.'));
    } finally {
      setLoading(false);
    }
  }

  const isAdminUser = user?.role === UserRole.ORG_ADMIN;

  return (
    <Modal open={!!user} onClose={onClose} title="Edit User">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Last name" required>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Role" required>
          <Select
            value={role}
            onChange={(v) => setRole(v as UserRole)}
            options={isAdminUser ? [{ value: UserRole.ORG_ADMIN, label: 'Org Admin' }] : [...ROLE_OPTIONS]}
            disabled={isAdminUser}
          />
          {isAdminUser && (
            <p className="text-xs text-gray-400 mt-1">Org Admin role cannot be changed here.</p>
          )}
        </Field>

        <Field label="Job title">
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className={inputCls}
            placeholder="e.g. Senior Manager"
          />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Deactivate Confirm Modal ───────────────────────────────────────────────────

interface DeactivateModalProps {
  user: UserDto | null;
  onClose: () => void;
  onDone: () => void;
}

function DeactivateModal({ user, onClose, onDone }: DeactivateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDeactivate() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/users/${user.id}`);
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to deactivate user.'));
      setLoading(false);
    }
  }

  return (
    <Modal open={!!user} onClose={onClose} title="Deactivate User">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to deactivate{' '}
          <span className="font-semibold text-gray-900">
            {user?.firstName} {user?.lastName}
          </span>
          ? They will no longer be able to log in or participate in assessments.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Reactivate Confirm Modal ───────────────────────────────────────────────────

function ReactivateModal({ user, onClose, onDone }: DeactivateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReactivate() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${user.id}`, { isActive: true });
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to reactivate user.'));
      setLoading(false);
    }
  }

  return (
    <Modal open={!!user} onClose={onClose} title="Reactivate User">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Reactivate{' '}
          <span className="font-semibold text-gray-900">
            {user?.firstName} {user?.lastName}
          </span>
          ? They will be able to log in and participate in assessments again.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleReactivate}
            disabled={loading}
            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Reactivating…' : 'Reactivate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onDone }: DeactivateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/users/${user.id}/permanent`);
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to delete user.'));
      setLoading(false);
    }
  }

  return (
    <Modal open={!!user} onClose={onClose} title="Delete User">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Permanently delete{' '}
          <span className="font-semibold text-gray-900">
            {user?.firstName} {user?.lastName}
          </span>
          ? This cannot be undone — all their data will be removed.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-red-700 text-white rounded-lg py-2 text-sm hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UsersSettingsPage() {
  const currentUser = useAuthStore((s) => s.user);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserDto | null>(null);
  const [reactivateUser, setReactivateUser] = useState<UserDto | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserDto | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const { data: users, mutate, isLoading } = useApi<UserDto[]>('/users');

  const filtered = useMemo(() => {
    const list = users ?? [];
    return list.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, roleFilter, search]);

  const roleTabs: { key: FilterRole; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: UserRole.HR_MANAGER, label: 'HR Manager' },
    { key: UserRole.MANAGER, label: 'Manager' },
    { key: UserRole.PARTICIPANT, label: 'Participant' },
  ];

  return (
    <div>
      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-green-600 hover:text-green-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage team members, roles, and access.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative w-full sm:w-64">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
          />
        </div>

        <div className="flex gap-1 border-b border-gray-200 sm:border-b-0 sm:border border-gray-200 sm:rounded-lg sm:p-0.5 sm:bg-gray-50">
          {roleTabs.map((tab) => {
            const count = tab.key === 'all' ? (users ?? []).length : (users ?? []).filter((u) => u.role === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${roleFilter === tab.key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 text-gray-400">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {search || roleFilter !== 'all'
              ? 'No users match your search.'
              : 'No users yet. Add your first team member.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Job Title</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isAdmin = u.role === UserRole.ORG_ADMIN;
                return (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {u.firstName} {u.lastName}
                            {isSelf && (
                              <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_BADGE_VARIANT[u.role] ?? 'neutral'}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      {u.jobTitle ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? 'success' : 'neutral'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                      {u.createdAt ? formatDate(u.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!isSelf && !isAdmin && (
                          <button
                            onClick={() => setEditUser(u)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit user"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        {!isSelf && !isAdmin && u.isActive && (
                          <button
                            onClick={() => setDeactivateUser(u)}
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Deactivate user"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                        {!isSelf && !isAdmin && !u.isActive && (
                          <button
                            onClick={() => setReactivateUser(u)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Reactivate user"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        {!isSelf && !isAdmin && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Total count */}
      {!isLoading && (users ?? []).length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {filtered.length} of {users!.length} users
        </p>
      )}

      {/* Modals */}
      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(fullName) => {
          setAddOpen(false);
          mutate();
          setSuccessMsg(`${fullName} was added successfully. Temporary password: 12345678`);
        }}
      />

      <EditUserModal
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => {
          setEditUser(null);
          mutate();
        }}
      />

      <DeactivateModal
        user={deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onDone={() => { setDeactivateUser(null); mutate(); }}
      />

      <ReactivateModal
        user={reactivateUser}
        onClose={() => setReactivateUser(null)}
        onDone={() => { setReactivateUser(null); mutate(); }}
      />

      <DeleteUserModal
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onDone={() => { setDeleteUser(null); mutate(); }}
      />
    </div>
  );
}
