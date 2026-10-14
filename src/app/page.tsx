'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import {
  Brain,
  Sparkles,
  ShieldCheck,
  Zap,
  BookOpen,
  ArrowRight,
  GitFork,
  Bot,
  AlertTriangle,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8F2E3] text-[#26313D] flex flex-col selection:bg-[#B1A15A]/30 selection:text-[#26313D]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-14 sm:pt-24 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DDD6C5] bg-[#FFFDF7] px-4 py-1.5 text-xs font-bold text-[#26313D] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#B1A15A]" />
            <span>Autonomous Bayesian Learning Twin Engine</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[#26313D] leading-[1.08]">
              ADAPTIQ
            </h1>
            <h2 className="text-xl sm:text-3xl font-bold text-[#B1A15A]">
              Adaptive Intelligence for Personalized Learning
            </h2>
          </div>

          <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-[#6F7782] leading-relaxed font-normal">
            Turn your course materials into a personalized AI learning system that understands what you study, what you know, and what you should learn next.
          </p>

          {/* Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] px-7 py-3.5 text-sm font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              <Zap className="w-4 h-4 text-[#26313D]" />
              Get Started Free
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-6 py-3.5 text-sm font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all shadow-xs"
            >
              Sign In
            </Link>
          </div>

          {/* Verification Badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-[#6F7782] border-t border-[#DDD6C5] max-w-3xl mx-auto">
            <span className="flex items-center gap-2 text-[#26313D]">
              <ShieldCheck className="w-4 h-4 text-[#6D9B73]" />
              Supabase Row Level Security
            </span>
            <span className="flex items-center gap-2 text-[#26313D]">
              <BookOpen className="w-4 h-4 text-[#B1A15A]" />
              Verifiable Page & Slide Citations
            </span>
            <span className="flex items-center gap-2 text-[#26313D]">
              <GitFork className="w-4 h-4 text-[#5E6A7A]" />
              Persistent Bayesian Twin
            </span>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-[#DDD6C5] bg-[#FAF5E8]/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#B1A15A]">
              Complete Learning Loop
            </h3>
            <h2 className="text-2xl sm:text-4xl font-black text-[#26313D] tracking-tight">
              Engineered for Cognitive Mastery, Not Surface Q&amp;A
            </h2>
            <p className="text-xs sm:text-sm text-[#6F7782] leading-relaxed">
              Unlike generic chatbots, ADAPTIQ constructs a living knowledge graph from your uploaded materials and guides you through verified repair cycles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-7 space-y-4 hover:border-[#B1A15A] transition-all shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
                <Bot className="h-6 w-6 text-[#B1A15A]" />
              </div>
              <h3 className="text-lg font-bold text-[#26313D]">Strict Course RAG Tutor</h3>
              <p className="text-xs text-[#6F7782] leading-relaxed">
                Answers are grounded strictly in your textbooks, lecture slides, and video recordings. Off-material queries are safely rejected.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-bold text-[#B1A15A]">
                <span>Page 73 • Slide 18 Citations</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-7 space-y-4 hover:border-[#5E6A7A] transition-all shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
                <GitFork className="h-6 w-6 text-[#5E6A7A]" />
              </div>
              <h3 className="text-lg font-bold text-[#26313D]">Student Learning Twin</h3>
              <p className="text-xs text-[#6F7782] leading-relaxed">
                Tracks individual concept mastery probabilities (BKT), forgetting decay curves, prerequisite dependencies, and confidence intervals in real-time.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-bold text-[#5E6A7A]">
                <span>Dynamic Knowledge Graph</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-7 space-y-4 hover:border-[#B85C5C] transition-all shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
                <AlertTriangle className="h-6 w-6 text-[#B85C5C]" />
              </div>
              <h3 className="text-lg font-bold text-[#26313D]">Misconception Diagnosis &amp; Retest</h3>
              <p className="text-xs text-[#6F7782] leading-relaxed">
                Detects fundamental conceptual gaps behind wrong answers, delivers Socratic remediation, and re-tests before upgrading student mastery.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-bold text-[#B85C5C]">
                <span>Automated Socratic Repair</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & RLS Banner */}
      <section id="security" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-[#DDD6C5]">
        <div className="max-w-5xl mx-auto rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 sm:p-12 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#6D9B73]/15 px-3 py-1 text-xs font-bold text-[#6D9B73] border border-[#6D9B73]/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero-Trust Multi-Tenant Architecture
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#26313D] tracking-tight">
                PostgreSQL Row Level Security (RLS) Enforced
              </h2>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shrink-0 shadow-xs"
            >
              Create Secure Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-xs sm:text-sm text-[#6F7782] leading-relaxed">
            Every query, vector similarity scan, mastery lookup, and material upload is authenticated via Supabase session tokens and scoped strictly to <code className="text-[#26313D] bg-[#FAF5E8] border border-[#DDD6C5] px-1.5 py-0.5 rounded font-mono">auth.uid() = user_id</code>. User A can never access User B&apos;s courses or mastery.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5]">
              <span className="font-bold text-[#26313D]">Private Storage Buckets</span>
              <p className="text-[#6F7782] text-[11px] mt-1">courses/&#123;user_id&#125;/&#123;course_id&#125; isolation</p>
            </div>
            <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5]">
              <span className="font-bold text-[#26313D]">API Token Authentication</span>
              <p className="text-[#6F7782] text-[11px] mt-1">Verified user identity on every request</p>
            </div>
            <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5]">
              <span className="font-bold text-[#26313D]">Zero Key Exposure</span>
              <p className="text-[#6F7782] text-[11px] mt-1">Client restricted exclusively to public Anon keys</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#DDD6C5] py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-[#6F7782] bg-[#FAF5E8]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#B1A15A]" />
            <span className="font-bold text-[#26313D]">ADAPTIQ</span>
            <span>— Adaptive Intelligence for Personalized Learning</span>
          </div>
          <p>© 2026 ADAPTIQ Systems. Built for Production AI Education.</p>
        </div>
      </footer>
    </div>
  );
}
