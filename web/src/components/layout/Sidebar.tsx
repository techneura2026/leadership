'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@leaderprism/shared';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', roles: null },
  { href: '/assessments', label: 'Assessments', roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER] },
  { href: '/my-assessments', label: 'My Assessments', roles: [UserRole.PARTICIPANT, UserRole.MANAGER] },
  { href: '/reports', label: 'Reports', roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER] },
  { href: '/competency-library', label: 'Competency Library', roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER] },
  { href: '/succession', label: 'Succession', roles: [UserRole.ORG_ADMIN, UserRole.HR_MANAGER] },
  { href: '/settings', label: 'Settings', roles: [UserRole.ORG_ADMIN] },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.organisation);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 shrink-0">
      <div className="h-14 px-6 border-b border-gray-200 flex flex-col justify-center shrink-0">
        <p className="text-sm font-bold text-gray-900 truncate leading-none">{org?.name ?? 'LeaderPrism'}</p>
        <p className="text-xs text-gray-500 capitalize mt-1.5 leading-none">{org?.plan} plan</p>
      </div>

      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
              pathname.startsWith(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.firstName?.[0] || ''}{user?.lastName?.[0] || ''}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate leading-none">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 capitalize mt-1.5 leading-none">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
