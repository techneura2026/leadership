'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrganisationDto, UserDto } from '@leaderprism/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface ExchangeResponse {
  accessToken: string;
  user: UserDto;
  organisation: OrganisationDto;
  redirectPath: string;
}

/** Same-site paths only — never follow an absolute or protocol-relative URL. */
const safePath = (p: string | undefined) => (p && /^\/(?![/\\])/.test(p) ? p : '/my-assessments');

/**
 * Landing page for links issued by the HRIS (POST /integrations/hris/sso-tickets). Exchanges the
 * one-time ticket for a session; the access token lives in memory only (Zustand), the refresh
 * token in the HttpOnly cookie set by the API.
 */
export default function HrisSsoPage() {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Tickets are single-use: guard against the effect running twice (React strict mode).
    if (started.current) return;
    started.current = true;

    const ticket = new URLSearchParams(window.location.search).get('ticket');
    window.history.replaceState(null, '', window.location.pathname); // keep the ticket out of history
    if (!ticket) {
      setFailed(true);
      return;
    }

    api
      .post<{ data: ExchangeResponse }>('/auth/sso/hris/exchange', { ticket })
      .then((res) => {
        const { accessToken, user, organisation, redirectPath } = res.data.data;
        useAuthStore.getState().setAuth(accessToken, user, organisation);
        router.replace(safePath(redirectPath));
      })
      .catch(() => setFailed(true));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      {failed ? (
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-gray-900">Sign-in link not valid</h1>
          <p className="mt-2 text-sm text-gray-600">
            This sign-in link has expired or was already used. Please open LeaderPrism again from your HRIS.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
            Sign in with email and password
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Signing you in…
        </div>
      )}
    </div>
  );
}
