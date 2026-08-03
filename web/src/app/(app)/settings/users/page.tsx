'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@leaderprism/shared';
import type { UserDto, DepartmentDto } from '@leaderprism/shared';
import {
  Users, UserPlus, Search, CheckCircle2, X, Pencil, Ban, RotateCcw, Trash2,
  Crown, ShieldCheck, UserCog, User as UserIcon, KeyRound,
  User,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: UserRole.HR_MANAGER, label: 'HR Manager' },
  { value: UserRole.MANAGER, label: 'Manager' },
  { value: UserRole.PARTICIPANT, label: 'Participant' },
] as const;

const ROLE_META: Record<string, {
  label: string;
  variant: 'info' | 'warning' | 'neutral' | 'success';
  icon: typeof Crown;
  gradient: string;
  glow: string;
}> = {
  org_admin: {
    label: 'Org Admin', variant: 'info', icon: Crown,
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', glow: 'rgba(168,85,247,0.25)',
  },
  hr_manager: {
    label: 'HR Manager', variant: 'info', icon: ShieldCheck,
    gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)', glow: 'rgba(70,95,255,0.25)',
  },
  manager: {
    label: 'Manager', variant: 'warning', icon: UserCog,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: 'rgba(245,158,11,0.22)',
  },
  participant: {
    label: 'Participant', variant: 'neutral', icon: UserIcon,
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', glow: 'rgba(100,116,139,0.2)',
  },
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
  const [managerId, setManagerId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarURL, setAvatarURL] = useState('');
  const [error, setError] = useState('');

  const { data: departments } = useApi<DepartmentDto[]>(open ? '/organisations/me/departments' : null);
  const { data: allUsers } = useApi<UserDto[]>(open ? '/users' : null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    let file = event.target.files?.[0];
    if (file) {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 800, useWebWorker: true };
      file = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const deptOptions = [
    { value: '', label: 'No department' },
    ...(departments ?? []).filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name })),
  ];

  const managerOptions = [
    { value: '', label: 'No manager' },
    ...(allUsers ?? []).filter((u) => u.isActive).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
  ];

  function reset() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole(UserRole.PARTICIPANT);
    setDepartmentId('');
    setManagerId('');
    setJobTitle('');
    setError('');
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  ///
  ///Need to update with real images daving  URL
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
        avatarUrl: avatarURL,
        ...(departmentId ? { departmentId } : {}),
        ...(managerId ? { managerId } : {}),
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
    <Modal open={open} onClose={handleClose} title="Add User" className="scrollbar-hide">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-4"
      >
        <div className='h-40 w-full border-0  flex justify-center'>
          <div className='h-40 w-40 border-4 border-gray-100 bg-gray-200 rounded-full relative'>

            {avatarURL ? (
              <img src={avatarURL} alt="Avatar" className='w-full h-full rounded-full object-cover' />
            ) :
              <div className='w-full h-full flex justify-center items-center'>
                <User className="h-20 w-20 text-gray-400" />
              </div>
            }

            {!avatarURL ? <label htmlFor="avatar" className='absolute -bottom-1 -right-2 w-10 flex justify-center items-center bg-gray-400 h-10 border-1 rounded-full cursor-pointer hover:bg-gray-300'>
              <Pencil size={20} />
            </label> : <span onClick={() => {
              setAvatarURL('');
              const fileInput = document.getElementById('avatar') as HTMLInputElement;
              if (fileInput) {
                fileInput.value = '';
              }
            }} className='absolute -bottom-1 -right-2 w-10 flex justify-center items-center bg-red-400 h-10 border-1 rounded-full cursor-pointer hover:bg-red-300'>
              <X size={20} />
            </span>}


            <input type="file" onChange={handleFileChange} accept="image/*" name="avatar" id="avatar" className='hidden' />
          </div>

        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
              placeholder="Kavinda"
              autoFocus
            />
          </Field>
          <Field label="Last name" required>
            <input
              name="lastName"
              autoComplete="family-name"
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
            name="email"
            autoComplete="email"
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Job title">
            <input
              name="jobTitle"
              autoComplete="organization-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. Senior Manager"
            />
          </Field>
          <Field label="Reports to">
            <Select
              value={managerId}
              onChange={setManagerId}
              options={managerOptions}
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
            type="button"
            onClick={handleClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
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
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? '');
  const [managerId, setManagerId] = useState(user?.managerId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: departments } = useApi<DepartmentDto[]>(user ? '/organisations/me/departments' : null);
  const { data: allUsers } = useApi<UserDto[]>(user ? '/users' : null);

  // Sync state when user prop changes (modal reopened for different user)
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
    setJobTitle(user.jobTitle ?? '');
    setDepartmentId(user.departmentId ?? '');
    setManagerId(user.managerId ?? '');
    setError('');
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const deptOptions = [
    { value: '', label: 'No department' },
    ...(departments ?? []).filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name })),
  ];

  const managerOptions = [
    { value: '', label: 'No manager' },
    ...(allUsers ?? [])
      .filter((u) => u.isActive && u.id !== user?.id)
      .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
  ];

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
        departmentId: departmentId || null,
        managerId: managerId || null,
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={deptOptions}
            />
          </Field>
          <Field label="Reports to">
            <Select
              value={managerId}
              onChange={setManagerId}
              options={managerOptions}
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

// ── Reset Password Modal ─────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  user: UserDto | null;
  onClose: () => void;
  onDone: (newPassword: string) => void;
}

function generateTempPassword(): string {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 14; i++) out += charset[Math.floor(Math.random() * charset.length)];
  return out;
}

function ResetPasswordModal({ user, onClose, onDone }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setPassword(generateTempPassword());
  }, [user]);

  async function handleReset() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${user.id}/password`, { password });
      onDone(password);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to reset password.'));
      setLoading(false);
    }
  }

  return (
    <Modal open={!!user} onClose={onClose} title="Reset Password">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Set a new temporary password for{' '}
          <span className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</span>.
          They&apos;ll be required to change it on their next login. This also signs them out of all
          existing sessions.
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            New temporary password
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setPassword(generateTempPassword())}
              className="border border-gray-200 rounded-lg px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
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
            onClick={handleReset}
            disabled={loading || password.length < 8}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Resetting…' : 'Reset Password'}
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

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, gradient, glow }: {
  label: string; value: number; icon: typeof Users; gradient: string; glow: string;
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UsersSettingsPage() {
  const currentUser = useAuthStore((s) => s.user);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserDto | null>(null);
  const [reactivateUser, setReactivateUser] = useState<UserDto | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserDto | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserDto | null>(null);
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

  const stats = {
    total: (users ?? []).length,
    active: (users ?? []).filter((u) => u.isActive).length,
    admins: (users ?? []).filter((u) => u.role === UserRole.ORG_ADMIN || u.role === UserRole.HR_MANAGER).length,
    participants: (users ?? []).filter((u) => u.role === UserRole.PARTICIPANT).length,
  };

  return (
    <div>
      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" strokeWidth={2} />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', boxShadow: '0 4px 12px rgba(168,85,247,0.25)' }}
          >
            <Users className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage team members, roles, and access.</p>
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" strokeWidth={2} />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={stats.total} icon={Users} gradient="linear-gradient(135deg, #465fff 0%, #2a31d8 100%)" glow="rgba(70,95,255,0.25)" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} gradient="linear-gradient(135deg, #22c55e 0%, #15803d 100%)" glow="rgba(34,197,94,0.22)" />
        <StatCard label="Admins & HR" value={stats.admins} icon={ShieldCheck} gradient="linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)" glow="rgba(168,85,247,0.25)" />
        <StatCard label="Participants" value={stats.participants} icon={UserIcon} gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" glow="rgba(245,158,11,0.22)" />
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
          <input
            name="usersTableSearch"
            autoComplete="off"
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
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                  roleFilter === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn('ml-1', roleFilter === tab.key ? 'text-white/70' : 'text-gray-400')}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
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
                  const roleMeta = ROLE_META[u.role] ?? ROLE_META.participant;
                  return (
                    <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar seed={u.id} src={u.avatarUrl} size="sm" />
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
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1')} style={{ color: '#fff', background: roleMeta.gradient }}>
                          <roleMeta.icon className="w-3 h-3" strokeWidth={2.25} />
                          {roleMeta.label}
                        </span>
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
                              <Pencil className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                          {!isSelf && u.isActive && (
                            <button
                              onClick={() => setResetPasswordUser(u)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Reset password"
                            >
                              <KeyRound className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                          {!isSelf && !isAdmin && u.isActive && (
                            <button
                              onClick={() => setDeactivateUser(u)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Deactivate user"
                            >
                              <Ban className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                          {!isSelf && !isAdmin && !u.isActive && (
                            <button
                              onClick={() => setReactivateUser(u)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Reactivate user"
                            >
                              <RotateCcw className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                          {!isSelf && !isAdmin && (
                            <button
                              onClick={() => setDeleteUser(u)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          setSuccessMsg(`${fullName} was added successfully. Their login credentials have been emailed to them.`);
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

      <ResetPasswordModal
        user={resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        onDone={() => {
          const name = resetPasswordUser ? `${resetPasswordUser.firstName} ${resetPasswordUser.lastName}` : 'User';
          setResetPasswordUser(null);
          mutate();
          setSuccessMsg(`Password reset for ${name}. They'll be required to set a new password on their next login.`);
        }}
      />

      <DeleteUserModal
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onDone={() => { setDeleteUser(null); mutate(); }}
      />
    </div>
  );
}
