import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Primary heading text */
  title?: string;
  /** Secondary message — alias for description for backwards compat */
  message?: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  message,
  description,
  ctaLabel,
  onCta,
  icon,
  className,
}: EmptyStateProps) {
  // Support both `message` (short form) and `title`/`description` (long form)
  const heading = title ?? message ?? 'No data';
  const subtext = description ?? (title && message ? message : undefined);
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-gray-300 bg-white',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-gray-300">{icon}</div>
      ) : (
        <svg
          className="w-12 h-12 text-gray-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      )}
      <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
      {subtext && <p className="text-sm text-gray-500 mt-1 max-w-xs">{subtext}</p>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
