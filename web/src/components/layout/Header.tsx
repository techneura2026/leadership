'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function Header() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
      router.replace('/login');
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden sm:block">
          {user?.firstName} {user?.lastName}
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
