'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Brain,
  LogOut,
  User,
  Settings,
  BookOpen,
  ChevronDown,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPublicPage = pathname === '/';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#DDD6C5] bg-[#F8F2E3]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFDF7] border border-[#DDD6C5] shadow-xs group-hover:border-[#B1A15A] transition-colors">
            <Brain className="h-5 w-5 text-[#B1A15A]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-[#26313D]">
                ADAPTIQ
              </span>
              <span className="inline-flex items-center rounded-md bg-[#E8E0C9] px-1.5 py-0.5 text-[10px] font-semibold text-[#26313D] border border-[#DDD6C5]">
                v2.0
              </span>
            </div>
            <span className="text-[10px] text-[#6F7782] font-medium tracking-wide uppercase -mt-0.5 hidden sm:block">
              Adaptive Intelligence for Personalized Learning
            </span>
          </div>
        </Link>

        {/* Public Navigation */}
        {!user && isPublicPage && (
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#5E6A7A]">
            <a href="#features" className="hover:text-[#26313D] transition-colors">Features</a>
            <a href="#twin" className="hover:text-[#26313D] transition-colors">Learning Twin</a>
            <a href="#rag" className="hover:text-[#26313D] transition-colors">Private RAG</a>
            <a href="#security" className="hover:text-[#26313D] transition-colors flex items-center gap-1.5 text-[#5E6A7A]">
              <ShieldCheck className="w-4 h-4 text-[#6D9B73]" />
              Security & RLS
            </a>
          </nav>
        )}

        {/* Right CTA / User controls */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] py-1.5 pl-2 pr-3 text-xs hover:bg-[#F4EEE0] transition-all shadow-xs"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || 'User Avatar'}
                    className="h-7 w-7 rounded-lg object-cover border border-[#DDD6C5]"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E8E0C9] text-xs font-bold text-[#26313D] border border-[#DDD6C5]">
                    {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-[#26313D] leading-tight">
                    {profile?.full_name || user.email.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-[#6F7782] leading-tight truncate max-w-[130px]">
                    {user.email}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-[#6F7782]" />
              </button>

              {/* Profile Dropdown Menu */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-2 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2.5 border-b border-[#DDD6C5]/80 mb-1">
                    <p className="text-xs font-bold text-[#26313D]">{profile?.full_name || 'Learner'}</p>
                    <p className="text-[11px] text-[#6F7782] truncate">{user.email}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#26313D] font-medium bg-[#F3ECE0] px-2 py-1 rounded-lg border border-[#DDD6C5]">
                      <span>Field: {profile?.study_field || 'Computer Science'}</span>
                      <span>{profile?.preferred_language || 'English'}</span>
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
                  >
                    <User className="h-4 w-4 text-[#5E6A7A]" />
                    Profile & Mastery Stats
                  </Link>

                  <Link
                    href="/courses"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
                  >
                    <BookOpen className="h-4 w-4 text-[#5E6A7A]" />
                    My Courses
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
                  >
                    <Settings className="h-4 w-4 text-[#5E6A7A]" />
                    Learning Preferences & Security
                  </Link>

                  <div className="my-1 border-t border-[#DDD6C5]" />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#B85C5C] hover:bg-[#B85C5C]/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[#5E6A7A] hover:text-[#26313D] hover:bg-[#EFE8D6] transition-all"
              >
                Sign In
              </Link>

              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
