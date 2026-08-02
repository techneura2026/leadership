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

interface AvatarProps {
  /** Name/id/email used for the initials fallback and as alt/title text. */
  seed: string;
  /** Real profile photo URL, if the person has one on file. Falls back to initials when absent or on load failure. */
  src?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  ring?: boolean;
}

export function Avatar({ seed, src, size = 'md', className, ring }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = seed
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  if (!src || failed) {
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
      src={src}
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
