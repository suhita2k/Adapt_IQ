'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Brain, Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setLoading(true);
    await resetPassword(email);
    setLoading(false);
    setSubmitted(true);
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
          <h2 className="text-2xl font-black text-[#26313D] tracking-tight">Reset your password</h2>
          <p className="text-xs text-[#6F7782]">
            Enter your account email to receive secure recovery instructions.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-4 text-xs text-[#26313D] space-y-2">
              <CheckCircle2 className="h-6 w-6 text-[#6D9B73] mx-auto" />
              <p className="font-bold text-[#26313D]">Password Reset Instructions Sent</p>
              <p className="text-[11px] text-[#6F7782]">
                If an account exists for {email}, we&apos;ve sent recovery instructions.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#5E6A7A] hover:text-[#26313D]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/10 p-3 text-xs text-[#B85C5C] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#26313D]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#6F7782]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
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
                'Send Reset Instructions'
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-xs font-bold text-[#5E6A7A] hover:text-[#26313D] hover:underline"
              >
                Return to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
