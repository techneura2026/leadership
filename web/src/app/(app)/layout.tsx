'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Outfit } from 'next/font/google';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import type { AuthResponseDto, UserDto, OrganisationDto } from '@leaderprism/shared';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { setAuth, setHydrated, isHydrated, accessToken, user } = useAuthStore();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  useEffect(() => {
    // Safety net beyond the login page's own redirect — catches direct navigation/refresh
    // for an account that still has a forced password change pending.
    if (isHydrated && user?.mustChangePassword) {
      router.replace('/change-password');
    }
  }, [isHydrated, user?.mustChangePassword]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-gray-50 ${outfit.className}`}>
      <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
