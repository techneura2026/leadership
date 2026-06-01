'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import type { AuthResponseDto, UserDto, OrganisationDto } from '@leaderprism/shared';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { setAuth, setHydrated, isHydrated, accessToken } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (accessToken) {
      setHydrated();
      return;
    }

    // On mount, try to restore session via refresh cookie
    api
      .post<{ data: { accessToken: string } }>('/auth/refresh')
      .then(async (res) => {
        const token = res.data.data.accessToken;
        useAuthStore.getState().setAccessToken(token);

        try {
          // Re-fetch user info with the new token
          const resMe = await api.post<{ data: { user: UserDto; organisation: OrganisationDto } }>('/auth/me');
          const { user, organisation } = resMe.data.data;
          useAuthStore.getState().setAuth(token, user, organisation);
          setHydrated();
        } catch (err) {
          router.replace('/login');
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, []);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
