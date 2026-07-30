'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Users, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

const SETTINGS_TABS = [
  {
    href: '/settings/organisation',
    label: 'Organisation',
    icon: Building2,
    gradient: 'linear-gradient(135deg, #465fff 0%, #2a31d8 100%)',
  },
  {
    href: '/settings/users',
    label: 'Users',
    icon: Users,
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
  },
  {
    href: '/settings/departments',
    label: 'Departments',
    icon: Network,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Settings sub-navigation */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {SETTINGS_TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-xl text-sm font-medium border transition-all',
                isActive
                  ? 'border-transparent bg-white shadow-sm'
                  : 'border-transparent text-gray-500 hover:bg-gray-100',
              )}
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isActive ? tab.gradient : 'var(--bg-subtle)' }}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-gray-400')} strokeWidth={2} />
              </span>
              <span className={isActive ? 'text-gray-900 font-semibold' : undefined}>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
