'use client';

import { useState } from 'react';
import { Webhook, Plus, Copy, Check } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

/** Mirrors WEBHOOK_EVENTS in api/src/integrations/webhooks/webhooks.service.ts. */
const EVENTS: { value: string; help: string }[] = [
  { value: 'assessment.launched', help: 'An HRIS cycle assessment started' },
  { value: 'assessment.closed', help: 'An assessment closed — results are final' },
  { value: 'results.ready', help: 'A manager submitted competency ratings' },
  { value: 'report.ready', help: 'A PDF report finished generating' },
  { value: 'readiness.computed', help: 'A readiness score was calculated' },
];

interface EndpointDto {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

interface DeliveryDto {
  id: string;
  event: string;
  status: 'pending' | 'succeeded' | 'failed';
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
}

const STATUS_VARIANT = { pending: 'warning', succeeded: 'success', failed: 'error' } as const;

export function WebhooksSection() {
  const { data: endpoints, isLoading, mutate } = useApi<EndpointDto[]>('/integrations/webhooks');
  const { data: deliveries, mutate: mutateDeliveries } = useApi<DeliveryDto[]>('/integrations/webhooks/deliveries?limit=50', {
    refreshInterval: 5000,
  });
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setUrl('');
    setEvents([]);
    setError(null);
  }

  async function save() {
    if (!url.trim() || events.length === 0) {
      setError('Enter a URL and choose at least one event.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/integrations/webhooks', { url: url.trim(), events });
      setSecret(res.data.data.secret);
      setOpen(false);
      reset();
      await mutate();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not save the endpoint.');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(id: string) {
    await api.post(`/integrations/webhooks/${id}/test`);
    await mutateDeliveries();
  }

  async function remove(ep: EndpointDto) {
    if (!window.confirm(`Delete the webhook endpoint ${ep.url}?`)) return;
    await api.delete(`/integrations/webhooks/${ep.id}`);
    await mutate();
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Webhooks</h2>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add endpoint
        </button>
      </div>

      {secret && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Signing secret</p>
          <div className="mt-2 flex items-center gap-2">
            <code data-testid="new-webhook-secret" className="flex-1 break-all rounded-md bg-white px-3 py-2 text-xs text-gray-800 border border-amber-200">
              {secret}
            </code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(secret).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            Use it to verify the X-LeaderPrism-Signature header. This secret will not be shown again.
          </p>
        </div>
      )}

      <div className="px-6 py-4 overflow-x-auto">
        {isLoading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : !endpoints || endpoints.length === 0 ? (
          <p className="py-6 text-sm text-gray-500">No endpoints yet. Add one so your HRIS is told when results are ready.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4 font-medium">URL</th>
                <th className="py-2 pr-4 font-medium">Events</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id} className="border-t border-gray-100 align-top">
                  <td className="py-3 pr-4 break-all text-gray-900">{ep.url}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">{ep.events.map((e) => <Badge key={e} variant="info">{e}</Badge>)}</div>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => sendTest(ep.id)} className="mr-3 text-sm font-medium text-blue-600 hover:text-blue-700">
                      Send test
                    </button>
                    <button onClick={() => remove(ep)} className="text-sm font-medium text-red-600 hover:text-red-700">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-6 pb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent deliveries</h3>
        {!deliveries || deliveries.length === 0 ? (
          <p className="text-sm text-gray-500">No deliveries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid="deliveries" className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Attempts</th>
                  <th className="py-2 font-medium">Last response</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-500">{formatDate(d.createdAt)}</td>
                    <td className="py-2 pr-4"><code className="text-xs">{d.event}</code></td>
                    <td className="py-2 pr-4"><Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge></td>
                    <td className="py-2 pr-4 text-gray-500">{d.attempts}</td>
                    <td className="py-2 text-gray-500">{d.lastStatusCode ?? d.lastError ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); reset(); }} title="Add webhook endpoint">
        <div className="space-y-4">
          <div>
            <label htmlFor="webhook-url" className="block text-xs font-medium text-gray-600 mb-1">Endpoint URL</label>
            <input
              id="webhook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hris.example.lk/webhooks/leaderprism"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <fieldset>
            <legend className="block text-xs font-medium text-gray-600 mb-2">Events</legend>
            <div className="space-y-2">
              {EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={ev.value}
                    className="mt-0.5"
                    checked={events.includes(ev.value)}
                    onChange={(e) => setEvents((prev) => (e.target.checked ? [...prev, ev.value] : prev.filter((x) => x !== ev.value)))}
                  />
                  <span>
                    <code className="text-xs text-gray-800">{ev.value}</code>
                    <span className="block text-xs text-gray-500">{ev.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setOpen(false); reset(); }} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save endpoint'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
