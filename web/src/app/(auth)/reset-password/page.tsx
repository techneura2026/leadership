'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

const schema = z
  .object({
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError('');
    if (!token) {
      setServerError('This reset link is missing its token. Please request a new one.');
      return;
    }
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setDone(true);
      setTimeout(() => router.replace('/login'), 2000);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message ?? 'Reset link is invalid or has expired.';
      setServerError(msg);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Password updated</h2>
        <p className="text-sm text-gray-500">Redirecting you to login…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Set a new password</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            {...register('newPassword')}
          />
          {errors.newPassword && <p className="text-xs text-red-500 mt-1.5">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Confirm new password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <p className="text-xs text-red-500 mt-1.5">{errors.confirmPassword.message}</p>}
        </div>

        {serverError && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{serverError}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-sm transition-all mt-2"
        >
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100 text-center">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
          Back to login
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="h-64 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
