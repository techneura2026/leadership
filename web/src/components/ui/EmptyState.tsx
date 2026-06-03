import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
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
  const heading = title ?? message ?? 'No data';
  const subtext = description ?? (title && message ? message : undefined);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-dashed border-gray-200 bg-white',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-gray-50 border border-gray-100">
        {icon ?? (
          <svg
            className="w-7 h-7 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{heading}</h3>
      {subtext && <p className="text-sm text-gray-400 max-w-xs leading-relaxed">{subtext}</p>}

      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
