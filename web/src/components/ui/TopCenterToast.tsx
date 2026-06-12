'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface TopCenterToastProps {
  message: string | null;
  type?: ToastType;
  onClose: () => void;
}

export function TopCenterToast({ message, type = 'info', onClose }: TopCenterToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const tone = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-900 text-white',
  }[type];

  return (
    <div className="fixed inset-x-0 top-4 z-[70] flex justify-center px-4 pointer-events-none">
      <div className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${tone}`}>
        {message}
      </div>
    </div>
  );
}
