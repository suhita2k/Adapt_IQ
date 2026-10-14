'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Brain,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle();
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F2E3] flex flex-col justify-center text-[#26313D] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] overflow-hidden shadow-xs">
          {/* Left Branded Panel */}
          <div className="lg:col-span-6 p-8 sm:p-12 bg-[#FAF5E8] border-b lg:border-b-0 lg:border-r border-[#DDD6C5] flex flex-col justify-between relative">
            <div className="space-y-6">
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFDF7] border border-[#DDD6C5] shadow-xs">
                  <Brain className="h-5 w-5 text-[#B1A15A]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tight text-[#26313D]">ADAPTIQ</span>
                  <span className="text-[10px] text-[#6F7782] font-semibold uppercase -mt-0.5">
                    Adaptive Intelligence
                  </span>
                </div>
              </Link>

              <div className="space-y-3 pt-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#26313D] leading-tight">
                  Adaptive Intelligence for Personalized Learning.
                </h1>
                <p className="text-xs sm:text-sm text-[#6F7782] leading-relaxed">
                  Turn your uploaded course materials into an individualized Bayesian learning twin with verified source citations.
                </p>
              </div>

              <div className="space-y-3 pt-4 text-xs text-[#26313D] font-medium">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#6D9B73] shrink-0" />
                  <span>Strict multi-tenant Row Level Security (RLS)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#5E6A7A] shrink-0" />
                  <span>Private Course RAG (Textbooks, Slides, Lectures)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#B1A15A] shrink-0" />
                  <span>Real-time misconception diagnosis & remediation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Login Form */}
          <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center space-y-6 bg-[#FFFDF7]">
            <div>
              <h2 className="text-2xl font-black text-[#26313D] tracking-tight">Welcome back</h2>
              <p className="text-xs sm:text-sm text-[#6F7782] mt-1">
                Enter your credentials to access your personal learning twin.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/10 p-3.5 text-xs text-[#B85C5C] flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#26313D]">Password</label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[#5E6A7A] hover:text-[#26313D] hover:underline font-medium"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#6F7782]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-2.5 text-xs sm:text-sm font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-50 transition-all shadow-xs"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#26313D]" /> : 'Sign In'}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-[#DDD6C5]" />
              <span className="absolute bg-[#FFFDF7] px-3 text-[11px] font-bold text-[#6F7782] uppercase">
                OR
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] py-2.5 text-xs sm:text-sm font-semibold text-[#26313D] hover:bg-[#FAF5E8] transition-all shadow-xs"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.7 0 3 .6 3.9 1.5l2.9-2.9C17 1.8 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z"
                />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-xs text-[#6F7782]">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-bold text-[#5E6A7A] hover:text-[#26313D] hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
