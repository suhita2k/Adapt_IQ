'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  FileQuestion,
  HelpCircle,
  AlertTriangle,
  GitFork,
  Calendar,
  Layers,
  BarChart3,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    label: 'My Courses',
    href: '/courses',
    icon: BookOpen,
    badge: null,
  },
  {
    label: 'AI Course Tutor',
    href: '/tutor',
    icon: Bot,
    badge: 'RAG Grounded',
    badgeColor: 'bg-[#E8E0C9] text-[#26313D] border-[#DDD6C5]',
  },
  {
    label: 'Smart Question Bank',
    href: '/question-bank',
    icon: FileQuestion,
    badge: 'Exam Prep',
    badgeColor: 'bg-[#B1A15A]/15 text-[#8E7F3B] border-[#B1A15A]/30',
  },
  {
    label: 'Adaptive Assessment',
    href: '/assessment',
    icon: HelpCircle,
    badge: 'Diagnostic',
    badgeColor: 'bg-[#EFE8D6] text-[#5E6A7A] border-[#DDD6C5]',
  },
  {
    label: 'Misconception Repair',
    href: '/misconceptions',
    icon: AlertTriangle,
    badge: null,
  },
  {
    label: 'Learning Twin',
    href: '/learning-twin',
    icon: GitFork,
    badge: 'Live Graph',
    badgeColor: 'bg-[#6D9B73]/15 text-[#6D9B73] border-[#6D9B73]/30',
  },
  {
    label: 'Study Plan',
    href: '/study-plan',
    icon: Calendar,
    badge: null,
  },
  {
    label: 'Spaced Revision',
    href: '/revision',
    icon: Layers,
    badge: null,
  },
  {
    label: 'Evaluation & Benchmarks',
    href: '/evaluation',
    icon: BarChart3,
    badge: null,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    badge: null,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [avgMastery, setAvgMastery] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setAvgMastery(null);
      return;
    }
    api.getMastery()
      .then((mList) => {
        if (mList && mList.length > 0) {
          const avg = Math.round(
            (mList.reduce((acc, m) => acc + m.mastery_probability, 0) / mList.length) * 100
          );
          setAvgMastery(avg);
        } else {
          setAvgMastery(0);
        }
      })
      .catch(() => setAvgMastery(0));
  }, [user]);

  return (
    <aside className="w-64 shrink-0 border-r border-[#DDD6C5] bg-[#F4EEE0] hidden md:flex flex-col justify-between p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="space-y-6">
        {/* Navigation list */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-bold text-[#6F7782] uppercase tracking-wider mb-2">
            Learning Platform
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#E8E0C9] text-[#26313D] border border-[#DDD6C5] shadow-xs'
                    : 'text-[#5E6A7A] hover:bg-[#EFE8D6] hover:text-[#26313D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-[#B1A15A]' : 'text-[#5E6A7A] group-hover:text-[#26313D]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                      item.badgeColor || 'bg-[#EFE8D6] text-[#5E6A7A] border-[#DDD6C5]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Knowledge Twin Pill */}
      <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 text-xs shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#6F7782] font-semibold text-[11px]">Twin Synced</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6D9B73] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6D9B73] animate-pulse"></span>
            Real-time
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="text-[#26313D] font-medium">Cognitive Mastery</span>
          <span className="font-bold text-[#B1A15A]">
            {avgMastery !== null ? `${avgMastery}% Avg` : '0%'}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EFE8D6]">
          <div
            className="h-full bg-[#B1A15A] rounded-full transition-all duration-500"
            style={{ width: `${avgMastery ?? 0}%` }}
          ></div>
        </div>
      </div>
    </aside>
  );
}
