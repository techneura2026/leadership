'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
} as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic mock profile-photo URL for a given seed (name/id) — same seed always resolves to the same face. */
export function avatarUrl(seed: string): string {
  const n = (hashSeed(seed) % 70) + 1;
  return `https://i.pravatar.cc/150?img=${n}`;
}

interface AvatarProps {
  seed: string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  ring?: boolean;
}

export function Avatar({ seed, size = 'md', className, ring }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = seed
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  if (failed) {
    return (
      <div
        title={seed}
        className={cn(
          SIZE_MAP[size],
          'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
          ring && 'ring-2 ring-[var(--bg-surface)]',
          className,
        )}
        style={{ background: 'linear-gradient(135deg, var(--blue-500), var(--blue-700))' }}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl(seed)}
      alt={seed}
      title={seed}
      onError={() => setFailed(true)}
      className={cn(
        SIZE_MAP[size],
        'rounded-full object-cover shrink-0 bg-[var(--bg-subtle)]',
        ring && 'ring-2 ring-[var(--bg-surface)]',
        className,
      )}
    />
  );
}
