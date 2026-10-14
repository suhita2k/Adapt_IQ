'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import { Misconception } from '@/types';
import MisconceptionCard from '@/components/misconception/MisconceptionCard';
import { AlertTriangle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';

export default function MisconceptionsPage() {
  const { user } = useAuth();
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMisconceptions = async () => {
    try {
      setLoading(true);
      const list = await api.getMisconceptions();
      setMisconceptions(list);
    } catch (err) {
      console.warn('Error loading misconceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMisconceptions();
    }
  }, [user]);

  const activeCount = misconceptions.filter((m) => m.status === 'active').length;
  const resolvedCount = misconceptions.filter((m) => m.status === 'retested_pass').length;

  return (
    <AppShell
      headerTitle="Misconception Diagnosis & Socratic Repair"
      headerSubtitle="Targeted conceptual gaps identified by the Bayesian assessment engine. Walk through structured proofs, inspect textbook citations, and re-test to verify understanding."
    >
      <div className="space-y-6">
        {/* Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B85C5C]/15 border border-[#B85C5C]/30">
                <AlertTriangle className="h-5 w-5 text-[#B85C5C]" />
              </div>
              <div>
                <span className="text-xl font-black text-[#B85C5C]">{activeCount} Active</span>
                <p className="text-xs text-[#6F7782]">High-priority cognitive gaps</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#B85C5C] bg-[#B85C5C]/10 px-2.5 py-1 rounded-md border border-[#B85C5C]/20">
              Requires Repair
            </span>
          </div>

          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6D9B73]/15 border border-[#6D9B73]/30">
                <CheckCircle2 className="h-5 w-5 text-[#6D9B73]" />
              </div>
              <div>
                <span className="text-xl font-black text-[#6D9B73]">{resolvedCount} Repaired</span>
                <p className="text-xs text-[#6F7782]">Verified via follow-up re-test</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#6D9B73] bg-[#6D9B73]/10 px-2.5 py-1 rounded-md border border-[#6D9B73]/20 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Twin Verified
            </span>
          </div>
        </div>

        {/* Misconceptions List */}
        {loading ? (
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#B1A15A] mx-auto" />
            <p className="text-xs text-[#6F7782]">Scanning learning twin for conceptual gaps...</p>
          </div>
        ) : misconceptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-[#6D9B73] mx-auto" />
            <h4 className="text-sm font-bold text-[#26313D]">No data available yet.</h4>
            <p className="text-xs text-[#6F7782]">
              Upload your course materials to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {misconceptions.map((misc) => (
              <MisconceptionCard key={misc.id} misconception={misc} onResolved={loadMisconceptions} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
