'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Sun, Moon, ChevronDown, LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/components/ThemeProvider';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { theme, toggle } = useTheme();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
      router.replace('/login');
    }
  }

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 z-30" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg shrink-0"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
          style={{ color: 'var(--text-secondary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-all"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#f04438', boxShadow: '0 0 0 2px var(--bg-surface)' }}
            />
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 mt-2 w-72 rounded-2xl overflow-hidden z-40"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</p>
              </div>
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You&apos;re all caught up</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl transition-all"
            style={{ color: 'var(--text-primary)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--blue-500) 0%, var(--blue-700) 100%)' }}
            >
              {initials}
            </div>
            <div className="hidden md:block text-left leading-none">
              <p className="text-sm font-semibold leading-none">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs mt-1 capitalize leading-none" style={{ color: 'var(--text-muted)' }}>
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <ChevronDown className="hidden md:block w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden z-40 py-1.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{ color: '#f04438' }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
