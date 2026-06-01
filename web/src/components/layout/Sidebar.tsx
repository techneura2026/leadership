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
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="text-sm font-bold text-blue-700 truncate">{org?.name ?? 'LeaderPrism'}</p>
        <p className="text-xs text-gray-400 capitalize mt-0.5">{org?.plan} plan</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center px-3 py-2 text-sm rounded-lg transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 truncate">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
      </div>
    </aside>
  );
}
