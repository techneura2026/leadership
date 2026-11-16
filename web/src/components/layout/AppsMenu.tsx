'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LayoutGrid } from 'lucide-react';
import { api } from '@/lib/api';

interface SuiteLink { key: string; name: string; url: string }
interface Suite { v: 1; home: SuiteLink; apps: SuiteLink[] }

/**
 * BizOS Suite Sign-in plan 2.4: the suite's Apps menu, drawn from what BizOS sent with this person's last sign-in link (BizOS first,
 * then the other apps they open from it). Every entry opens BizOS's /launch in a new tab. Hidden for people who never came from BizOS.
 */
export function AppsMenu() {
  const [suite, setSuite] = useState<Suite | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api.get<{ data: { suite: Suite | null } }>('/auth/suite')
      .then((r) => { if (live) setSuite(r.data.data?.suite ?? null); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!suite) return null;
  const entries = [{ ...suite.home, name: `Back to ${suite.home.name}` }, ...suite.apps.filter((a) => a.key !== 'leaderprism')];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
        style={{ color: 'var(--navbar-text-secondary)' }}
        aria-label="Apps"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Apps"
      >
        <LayoutGrid className="w-[18px] h-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden z-40 py-1.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        >
          {entries.map((a) => (
            <a
              key={a.key}
              role="menuitem"
              href={a.url}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--text-primary)' }}
            >
              <span className="truncate">{a.name}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
