'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Brain, Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { updatePassword } = useAuth();
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F2E3] flex flex-col justify-center text-[#26313D] p-4">
      <div className="w-full max-w-md mx-auto rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 sm:p-10 space-y-6 shadow-xs">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFDF7] border border-[#DDD6C5] shadow-xs">
              <Brain className="h-5 w-5 text-[#B1A15A]" />
            </div>
            <span className="text-xl font-black tracking-tight text-[#26313D]">ADAPTIQ</span>
          </Link>
          <h2 className="text-2xl font-black text-[#26313D] tracking-tight">Set new password</h2>
          <p className="text-xs text-[#6F7782]">
            Please enter and confirm your new secure password.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-4 text-xs text-[#26313D] space-y-2">
              <CheckCircle2 className="h-6 w-6 text-[#6D9B73] mx-auto" />
              <p className="font-bold text-[#26313D]">Password Updated Successfully</p>
              <p className="text-[11px] text-[#6F7782]">
                Your credentials have been securely updated via Supabase Auth.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              Continue to Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/10 p-3 text-xs text-[#B85C5C] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#26313D]">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#6F7782]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#26313D]">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#6F7782]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-2.5 text-xs sm:text-sm font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-50 transition-all shadow-xs"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#26313D]" />
              ) : (
                'Save New Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
