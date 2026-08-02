'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { accessToken, user } = useAuthStore();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (user) {
        useAuthStore.getState().setAuth(accessToken!, { ...user, mustChangePassword: false }, useAuthStore.getState().organisation!);
      }
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error?.message ?? 'Failed to change password.';
      setServerError(msg);
    }
  }

  return (
    <>
      <div className="mb-7">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Set your password</h2>
        <p className="text-sm text-gray-500 mt-1">
          {user?.mustChangePassword
            ? 'Your account was created with a temporary password. Please set your own before continuing.'
            : 'Choose a new password for your account.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Current (temporary) password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            {...register('currentPassword')}
          />
          {errors.currentPassword && <p className="text-xs text-red-500 mt-1.5">{errors.currentPassword.message}</p>}
        </div>

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
          {isSubmitting ? 'Updating…' : 'Set password'}
        </button>
      </form>
    </>
  );
}
