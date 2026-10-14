'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Loader2 } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  actionButton?: React.ReactNode;
}

export default function AppShell({
  children,
  headerTitle,
  headerSubtitle,
  actionButton,
}: AppShellProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8F2E3]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFDF7] border border-[#DDD6C5] shadow-xs">
            <Loader2 className="h-7 w-7 text-[#B1A15A] animate-spin" />
          </div>
          <p className="text-xs font-semibold text-[#6F7782]">Loading your learning twin...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F2E3] text-[#26313D] flex flex-col">
      <Navbar />
      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {(headerTitle || actionButton) && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DDD6C5] pb-5">
              <div>
                {headerTitle && (
                  <h1 className="text-2xl font-black tracking-tight text-[#26313D] flex items-center gap-3">
                    {headerTitle}
                  </h1>
                )}
                {headerSubtitle && (
                  <p className="mt-1 text-xs sm:text-sm text-[#6F7782] max-w-3xl leading-relaxed">
                    {headerSubtitle}
                  </p>
                )}
              </div>
              {actionButton && <div className="shrink-0">{actionButton}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
