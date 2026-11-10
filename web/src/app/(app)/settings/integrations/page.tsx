'use client';

import { UserRole } from '@leaderprism/shared';
import { useAuthStore } from '@/store/auth.store';
import { ApiKeysSection } from './_components/ApiKeysSection';
import { WebhooksSection } from './_components/WebhooksSection';

export default function IntegrationsSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  if (user && !isAdmin) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600">
        Only organisation admins can manage integrations.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your HRIS to LeaderPrism. API keys let the HRIS sync employees, start assessments and read results.
        </p>
      </div>
      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}
