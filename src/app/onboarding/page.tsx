'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Brain,
  BookOpen,
  Globe2,
  Target,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const STUDY_FIELDS = [
  'Computer Science',
  'Engineering',
  'Mathematics',
  'Science',
  'Business',
  'Other',
];

const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Spanish', 'French'];

const GOALS = [
  'Exam preparation',
  'Understand concepts',
  'Improve problem solving',
  'General learning',
];

const TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2+ hours', value: 120 },
];

export default function OnboardingPage() {
  const { user, profile, completeOnboarding } = useAuth();
  const [field, setField] = useState('Computer Science');
  const [language, setLanguage] = useState<'English' | 'Tamil' | 'Hindi' | 'Spanish' | 'French'>('English');
  const [goal, setGoal] = useState('Exam preparation');
  const [minutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  // Load saved preferences if user returns to onboarding
  useEffect(() => {
    if (profile) {
      if (profile.preferred_language && LANGUAGES.includes(profile.preferred_language)) {
        setLanguage(profile.preferred_language as any);
      }
      if (profile.study_field) {
        setField(profile.study_field);
      }
      if (profile.learning_goal) {
        setGoal(profile.learning_goal);
      }
      if (profile.daily_study_time_minutes) {
        setMinutes(profile.daily_study_time_minutes);
      }
    }
  }, [profile]);

  const handleFinish = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await completeOnboarding({
        study_field: field,
        preferred_language: language,
        learning_goal: goal,
        daily_study_time_minutes: minutes,
      });
      if (res && res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save onboarding preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F2E3] text-[#26313D] flex flex-col justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFDF7] border border-[#DDD6C5] shadow-xs">
            <Brain className="h-6 w-6 text-[#B1A15A]" />
          </div>
          <h1 className="text-3xl font-black text-[#26313D] tracking-tight">
            Welcome to ADAPTIQ
          </h1>
          <p className="text-xs sm:text-sm text-[#6F7782]">
            Tell us how you learn to initialize your individualized student learning twin.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-10 space-y-7 shadow-xs">
          {/* Question 1: Field of Study */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#B1A15A]" />
              What are you studying?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STUDY_FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setField(f)}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all text-center ${
                    field === f
                      ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                      : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Question 2: Preferred Language */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-[#5E6A7A]" />
              Preferred language for explanations
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang as any)}
                    className={`rounded-xl border p-3 text-xs font-bold transition-all text-center relative ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span>{lang}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Goal */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#6D9B73]" />
              Your primary learning goal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`rounded-xl border p-3.5 text-xs font-bold transition-all text-left flex items-center justify-between ${
                    goal === g
                      ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                      : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                  }`}
                >
                  <span>{g}</span>
                  {goal === g && <CheckCircle2 className="w-4 h-4 text-[#26313D]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Question 4: Daily Time */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5E6A7A]" />
              How much time can you study daily?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setMinutes(t.value)}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all text-center ${
                    minutes === t.value
                      ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                      : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="rounded-xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-3 text-xs text-[#B85C5C] flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleFinish}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-3.5 text-xs sm:text-sm font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-50 transition-all shadow-xs"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#26313D]" />
            ) : (
              <>
                <span>Initialize Learning Twin & Enter Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
