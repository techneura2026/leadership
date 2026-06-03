'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // Added for Portal
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder = 'Select…', className, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, width: 0 });

  // Handle clicking outside of both the button AND the portal dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate the exact position of the dropdown when opened
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + window.scrollY, // Accounts for page scroll
        left: rect.left + window.scrollX,
        width: rect.width, // Matches the width of the trigger button
      });
    }
  }, [open]);

  // Close the dropdown on scroll or resize to prevent the portal from floating away
  useEffect(() => {
    const handleScrollOrResize = () => setOpen(false);
    if (open) {
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
    }
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  // The dropdown content that will be portaled
  const dropdownMenu = open ? (
    <div
      ref={dropdownRef}
      className="absolute z-[9999] mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1.5"
      style={{
        top: `${dropdownStyle.top}px`,
        left: `${dropdownStyle.left}px`,
        width: `${dropdownStyle.width}px`,
        animation: 'slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
          className={cn(
            'w-full text-left px-3.5 py-2.5 text-sm transition-colors flex items-center justify-between outline-none',
            value === opt.value
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium'
          )}
        >
          <span className="truncate block pr-2">{opt.label}</span>
          {value === opt.value && (
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
      {options.length === 0 && (
        <div className="px-3.5 py-4 text-sm text-gray-500 text-center font-medium">No options available</div>
      )}
    </div>
  ) : null;

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          ' w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm',
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-blue-400 hover:shadow-md',
          open && 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
        )}
      >
        <span className={cn('block truncate font-medium', !selectedOption && 'text-gray-400 font-normal')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={cn('w-4 h-4 text-gray-400 transition-transform duration-300 ease-out', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Render the portal only on the client side */}
      {typeof document !== 'undefined' && createPortal(dropdownMenu, document.body)}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}