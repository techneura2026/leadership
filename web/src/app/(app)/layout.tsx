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

    // On mount, restore session via refresh cookie — single request returns token + user + org
    api
      .post<{ data: { accessToken: string; user: UserDto; organisation: OrganisationDto } }>('/auth/refresh')
      .then((res) => {
        const { accessToken: token, user, organisation } = res.data.data;
        useAuthStore.getState().setAuth(token, user, organisation);
        setHydrated();
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
