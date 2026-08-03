'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import {
  Building2, Sparkles, Star, Crown, Zap, ImagePlus, CheckCircle2,
} from 'lucide-react';
import type { OrganisationDto } from '@leaderprism/shared';

// Extended with optional branding field not yet in the shared type
type OrgWithBranding = OrganisationDto & { brandingName?: string };

const PLAN_META: Record<string, {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'neutral';
  icon: typeof Zap;
  gradient: string;
  glow: string;
}> = {
  trial: {
    label: 'Trial', variant: 'warning', icon: Zap,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', glow: 'rgba(245,158,11,0.25)',
  },
  starter: {
    label: 'Starter', variant: 'info', icon: Sparkles,
    gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)', glow: 'rgba(70,95,255,0.25)',
  },
  professional: {
    label: 'Professional', variant: 'success', icon: Star,
    gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', glow: 'rgba(34,197,94,0.22)',
  },
  enterprise: {
    label: 'Enterprise', variant: 'success', icon: Crown,
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', glow: 'rgba(168,85,247,0.25)',
  },
};

export default function OrgSettingsPage() {
  const { organisation } = useAuthStore();
  const { data: org, mutate, isLoading } = useApi<OrgWithBranding>('/organisations/me');
  const [name, setName] = useState('');
  const [brandingName, setBrandingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setBrandingName(org.brandingName ?? '');
    }
  }, [org]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.patch('/organisations/me', { name, brandingName });
      mutate(updated.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const plan = PLAN_META[org?.plan ?? 'trial'] ?? PLAN_META.trial;
  const PlanIcon = plan.icon;

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)', boxShadow: '0 4px 12px rgba(70,95,255,0.25)' }}
        >
          <Building2 className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Organisation Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your organisation profile and branding.</p>
        </div>
      </div>

      {/* Plan card — colourful hero */}
      <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm hover:shadow-md transition-all">
        <span className="absolute top-0 left-0 right-0 h-1.5" style={{ background: plan.gradient }} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: plan.gradient, boxShadow: `0 6px 16px -4px ${plan.glow}` }}
            >
              <PlanIcon className="w-6 h-6 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge variant={plan.variant}>{plan.label} Plan</Badge>
                {org?.trialEndsAt && (
                  <span className="text-sm text-gray-500">Trial expires {formatDate(org.trialEndsAt)}</span>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Organisation ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{org?.id}</code>
                {' · '}
                Slug: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{org?.slug}</code>
              </div>
            </div>
          </div>
          {(org?.plan === 'trial' || org?.plan === 'starter') && (
            <button className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors shrink-0">Upgrade →</button>
          )}
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm hover:shadow-md transition-all">
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
              <span className="text-gray-400 font-normal ml-1">(shown on reports as &ldquo;Assessment Partner&rdquo;)</span>
            </label>
            <input value={brandingName} onChange={e => setBrandingName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-300 transition-all text-gray-700"
              placeholder="e.g. Acme HR Consulting" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo</label>
            <div className="border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-blue-50/40 hover:border-blue-300 transition-colors rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-3 shadow-sm">
                <ImagePlus className="w-5 h-5 text-gray-400" strokeWidth={1.75} />
              </div>
              <p className="text-sm text-gray-400">Logo upload available in a future update.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors shadow-sm">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
