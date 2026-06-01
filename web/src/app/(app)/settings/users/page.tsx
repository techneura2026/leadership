'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@leaderprism/shared';
import type { UserDto } from '@leaderprism/shared';

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
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

// ── Password strength ──────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; colour: string } {
  if (!pw) return { score: 0, label: '', colour: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Weak', colour: 'bg-red-400' };
  if (score === 3) return { score, label: 'Fair', colour: 'bg-yellow-400' };
  if (score === 4) return { score, label: 'Good', colour: 'bg-blue-400' };
  return { score, label: 'Strong', colour: 'bg-green-500' };
}

// ── Add User Modal ─────────────────────────────────────────────────────────────

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function AddUserModal({ open, onClose, onCreated }: AddUserModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<string>(UserRole.PARTICIPANT);
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pwStrength = passwordStrength(password);

  function reset() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setShowPw(false);
    setRole(UserRole.PARTICIPANT);
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
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/users', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      });
      reset();
      onCreated();
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

        <Field label="Password" required>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls + ' pr-10'}
              placeholder="Min. 8 chars, upper, lower, digit"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPw ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {password && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pwStrength.colour}`}
                  style={{ width: `${(pwStrength.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10">{pwStrength.label}</span>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Role" required>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputCls}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job title">
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. Senior Manager"
            />
          </Field>
        </div>

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
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputCls}
            disabled={isAdminUser}
          >
            {isAdminUser && <option value={UserRole.ORG_ADMIN}>Org Admin</option>}
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
  onDeactivated: () => void;
}

function DeactivateModal({ user, onClose, onDeactivated }: DeactivateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDeactivate() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/users/${user.id}`);
      onDeactivated();
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
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
          >
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UsersSettingsPage() {
  const currentUser = useAuthStore((s) => s.user);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserDto | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');

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
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-1 border-b border-gray-200 sm:border-b-0 sm:border border-gray-200 sm:rounded-lg sm:p-0.5 sm:bg-gray-50">
          {roleTabs.map((tab) => {
            const count = tab.key === 'all' ? (users ?? []).length : (users ?? []).filter((u) => u.role === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  roleFilter === tab.key
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
                        <button
                          onClick={() => setEditUser(u)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {!isSelf && !isAdmin && u.isActive && (
                          <button
                            onClick={() => setDeactivateUser(u)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deactivate user"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
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
        onCreated={() => {
          setAddOpen(false);
          mutate();
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
        onDeactivated={() => {
          setDeactivateUser(null);
          mutate();
        }}
      />
    </div>
  );
}
