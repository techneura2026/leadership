'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { UserRole } from '@leaderprism/shared';
import type { UserDto } from '@leaderprism/shared';

const ROLE_OPTIONS = [
  { value: UserRole.HR_MANAGER, label: 'HR Manager' },
  { value: UserRole.MANAGER, label: 'Manager' },
  { value: UserRole.PARTICIPANT, label: 'Participant' },
];

export default function UsersSettingsPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(UserRole.PARTICIPANT);
  const [inviteFirst, setInviteFirst] = useState('');
  const [inviteLast, setInviteLast] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const { data: users, mutate, isLoading } = useApi<UserDto[]>('/organisations/me/users');

  async function invite() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError('');
    try {
      await api.post('/organisations/me/invite', {
        email: inviteEmail,
        role: inviteRole,
        firstName: inviteFirst,
        lastName: inviteLast,
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteFirst('');
      setInviteLast('');
      mutate();
    } catch (err: any) {
      setInviteError(err?.response?.data?.error?.message ?? 'Invite failed. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team members and their roles.</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
          + Invite User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 capitalize text-gray-500">{u.role.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users yet. Invite your first team member.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">First name</label>
              <input value={inviteFirst} onChange={e => setInviteFirst(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Last name</label>
              <input value={inviteLast} onChange={e => setInviteLast(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Perera" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Work email *</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@company.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {inviteError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{inviteError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setInviteOpen(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={invite} disabled={inviting || !inviteEmail}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
              {inviting ? 'Inviting…' : 'Send Invitation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
