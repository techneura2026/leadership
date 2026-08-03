'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function DatePicker({
  value,
  onChange,
  min,
  placeholder = 'Select date',
}: {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getFullYear();
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getMonth();
    return new Date().getMonth();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const minDate = min ? new Date(min + 'T00:00:00') : null;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }

  function isDayDisabled(day: number) {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const m = new Date(minDate);
    m.setHours(0, 0, 0, 0);
    return d < m;
  }

  function isDaySelected(day: number) {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === day;
  }

  function isDayToday(day: number) {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day;
  }

  const displayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg border transition-all text-left',
          open
            ? 'bg-white border-blue-500 ring-2 ring-blue-500/20'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300',
          displayLabel ? 'text-gray-700' : 'text-gray-400',
        )}
      >
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="flex-1 truncate">{displayLabel || placeholder}</span>
        {displayLabel && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month / year nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900 select-none">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_ABBRS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1 select-none">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) =>
              day === null ? (
                <div key={`e-${idx}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDayDisabled(day) && selectDay(day)}
                  disabled={isDayDisabled(day)}
                  className={cn(
                    'w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-all select-none',
                    isDaySelected(day)
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : isDayDisabled(day)
                      ? 'text-gray-300 cursor-not-allowed'
                      : isDayToday(day)
                      ? 'text-blue-600 font-semibold hover:bg-blue-50 ring-1 ring-blue-200'
                      : 'text-gray-700 hover:bg-gray-100',
                  )}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
