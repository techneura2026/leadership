'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import type { OrganisationDto } from '@leaderprism/shared';

// Extended with optional branding field not yet in the shared type
type OrgWithBranding = OrganisationDto & { brandingName?: string };

export default function OrgSettingsPage() {
  const { organisation } = useAuthStore();
  const { data: org, mutate, isLoading } = useApi<OrgWithBranding>('/organisations/me');
  const [name, setName] = useState('');
  const [brandingName, setBrandingName] = useState('');
  const [primaryColour, setPrimaryColour] = useState('#1E40AF');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setBrandingName(org.brandingName ?? '');
      setPrimaryColour(org.primaryColour);
    }
  }, [org]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.patch('/organisations/me', { name, brandingName, primaryColour });
      mutate(updated.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const planMeta: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
    trial: { label: 'Trial', variant: 'warning' },
    starter: { label: 'Starter', variant: 'info' },
    professional: { label: 'Professional', variant: 'success' },
    enterprise: { label: 'Enterprise', variant: 'success' },
  };

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner /></div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Organisation Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your organisation profile and branding.</p>
      </div>

      {/* Plan card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Plan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={planMeta[org?.plan ?? 'trial']?.variant ?? 'neutral'}>
              {planMeta[org?.plan ?? 'trial']?.label ?? org?.plan}
            </Badge>
            {org?.trialEndsAt && (
              <span className="text-sm text-gray-500">
                Trial expires {formatDate(org.trialEndsAt)}
              </span>
            )}
          </div>
          {(org?.plan === 'trial' || org?.plan === 'starter') && (
            <button className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors">Upgrade →</button>
          )}
        </div>
        <div className="mt-3 text-xs text-gray-400">
          Organisation ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{org?.id}</code>
          {' · '}
          Slug: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{org?.slug}</code>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Organisation Profile</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Branding Name
              <span className="text-gray-400 font-normal ml-1">(shown on reports as "Assessment Partner")</span>
            </label>
            <input value={brandingName} onChange={e => setBrandingName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
              placeholder="e.g. Acme HR Consulting" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Primary Brand Colour</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColour} onChange={e => setPrimaryColour(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-gray-50 hover:bg-white hover:border-gray-300 transition-colors" />
              <input value={primaryColour} onChange={e => setPrimaryColour(e.target.value)}
                className="w-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700 uppercase"
                placeholder="#1E40AF" />
              <div className="w-8 h-8 rounded-md shadow-sm border border-black/10" style={{ backgroundColor: primaryColour }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo</label>
            <div className="border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <svg className="w-8 h-8 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-400">Logo upload available in a future update.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors shadow-sm">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
