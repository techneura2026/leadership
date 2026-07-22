import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function getLandingUrl(): string {
  if (process.env.NEXT_PUBLIC_LANDING_URL) {
    return process.env.NEXT_PUBLIC_LANDING_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://gentle-sea-03bfac610.7.azurestaticapps.net';
  }
  return 'http://localhost:3002';
}

