'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  BookOpen,
  Network,
  Settings as SettingsIcon,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@leaderprism/shared';

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; roles: UserRole[] | null }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, roles: null },
  { href: '/assessments', label: 'Assessments', icon: ClipboardList, roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN] },
  { href: '/my-assessments', label: 'My Assessments', icon: ClipboardCheck, roles: [UserRole.PARTICIPANT, UserRole.MANAGER] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN] },
  { href: '/competency-library', label: 'Competency Library', icon: BookOpen, roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN] },
  { href: '/succession', label: 'Succession', icon: Network, roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN] },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, roles: [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN] },
];

function SidebarContent({
  visibleItems,
  pathname,
  onNavigate,
}: {
  visibleItems: typeof NAV_ITEMS;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Brand header */}
      <div
        className="h-16 px-5 flex items-center gap-3 shrink-0"
        style={{ background: 'var(--sidebar-header-bg)', borderBottom: '1px solid var(--sidebar-header-border)' }}
      >
        <Image
          src="/logo-techneura.png"
          alt="LeaderPrism"
          width={34}
          height={34}
          className="object-contain shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-none" style={{ color: 'var(--sidebar-header-text)' }}>
            LeaderPrism
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <p
          className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--sidebar-text)', opacity: 0.75 }}
        >
          Menu
        </p>
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 font-medium',
                )}
                style={
                  isActive
                    ? { background: 'var(--sidebar-active-from)', color: 'var(--sidebar-text-active)' }
                    : { color: 'var(--sidebar-text)' }
                }
                onClick={onNavigate}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 flex flex-col -translate-x-full transition-transform duration-300 md:hidden',
        )}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
      >
        <button
          onClick={onCloseMobile}
          className="absolute top-4 right-4 p-1.5 rounded-lg"
          style={{ color: 'var(--sidebar-text)' }}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent visibleItems={visibleItems} pathname={pathname} onNavigate={onCloseMobile} />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0"
        style={{ backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        <SidebarContent visibleItems={visibleItems} pathname={pathname} />
      </aside>
    </>
  );
}
