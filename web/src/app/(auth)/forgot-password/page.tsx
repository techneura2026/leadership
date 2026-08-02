'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    // Always show the same confirmation regardless of outcome — the backend never reveals
    // whether the email matched an account, so the UI shouldn't either.
    try {
      await api.post('/auth/forgot-password', data);
    } catch {
      // ignore — still show the generic confirmation below
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">Check your email</h2>
        <p className="text-sm text-gray-500">
          If an account exists for that email, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
        </p>
        <Link href="/login" className="inline-block mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Forgot your password?</h2>
        <p className="text-sm text-gray-500 mt-1">Enter your email and we&apos;ll send you a reset link.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 text-sm transition-all mt-2"
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
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
