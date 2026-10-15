'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  'Exam Preparation',
  'Understand Concepts',
  'Improve Problem Solving',
  'General Learning',
];

const TIME_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
];

export default function OnboardingPage() {
  const { user, profile, completeOnboarding } = useAuth();
  const router = useRouter();

  // All fields are unselected (null) by default for new users (no preselection, no hardcoded defaults)
  const [field, setField] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExistingCompletedUser, setIsExistingCompletedUser] = useState(false);

  const hasLoadedSavedPrefs = useRef(false);

  // Load saved preferences ONLY if the user has already completed onboarding
  useEffect(() => {
    if (profile?.onboarding_completed && !hasLoadedSavedPrefs.current) {
      hasLoadedSavedPrefs.current = true;
      if (profile.study_field) setField(profile.study_field);
      if (profile.preferred_language) setLanguage(profile.preferred_language);
      if (profile.learning_goal) {
        // match case-insensitively
        const match = GOALS.find((g) => g.toLowerCase() === profile.learning_goal?.toLowerCase());
        setGoal(match || profile.learning_goal);
      }
      if (profile.daily_study_time_minutes) setMinutes(profile.daily_study_time_minutes);
      setIsExistingCompletedUser(true);
    }
  }, [profile]);

  const handleFinish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    // Validate that all mandatory fields are selected
    const missing: string[] = [];
    if (!field) missing.push('Study subject');
    if (!language) missing.push('Preferred language');
    if (!goal) missing.push('Learning goal');
    if (!minutes) missing.push('Daily study time');

    if (missing.length > 0 || !field || !language || !goal || minutes === null) {
      setErrorMsg(`Please select all required fields before continuing: ${missing.join(', ')}.`);
      return;
    }

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
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save onboarding preferences');
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
          {/* Returning completed user banner */}
          {isExistingCompletedUser && (
            <div className="rounded-2xl border border-[#B1A15A]/40 bg-[#FAF5E8] p-4 text-xs sm:text-sm text-[#26313D] flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#B1A15A] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#26313D]">Previously Saved Preferences Loaded</p>
                  <p className="mt-0.5 text-[#5E6A7A]">
                    You have already completed onboarding. You can edit your preferences below and save your changes, or return to your dashboard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-[#E8E0C9] hover:bg-[#DDD6C5] text-[#26313D] text-xs font-bold transition-colors"
              >
                Dashboard
              </button>
            </div>
          )}

          {/* Question 1: Field of Study */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#B1A15A]" />
                What are you studying?
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Required</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STUDY_FIELDS.map((f) => {
                const isSelected = field === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setField(f);
                      setErrorMsg(null);
                    }}
                    className={`rounded-xl border p-3 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span>{f}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 2: Preferred Language */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#5E6A7A]" />
                Preferred language for explanations
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Required</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {LANGUAGES.map((lang) => {
                const isSelected = language?.toLowerCase() === lang.toLowerCase();
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setLanguage(lang);
                      setErrorMsg(null);
                    }}
                    className={`rounded-xl border p-3 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span>{lang}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Goal */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#6D9B73]" />
                Your primary learning goal
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Required</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GOALS.map((g) => {
                const isSelected = goal?.toLowerCase() === g.toLowerCase();
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGoal(g);
                      setErrorMsg(null);
                    }}
                    className={`rounded-xl border p-3.5 text-xs font-bold transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span>{g}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#26313D]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 4: Daily Time */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#5E6A7A]" />
                How much time can you study daily?
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Required</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {TIME_OPTIONS.map((t) => {
                const isSelected = minutes === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setMinutes(t.value);
                      setErrorMsg(null);
                    }}
                    className={`rounded-xl border p-3 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span>{t.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="rounded-xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-3 text-xs text-[#B85C5C] flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B85C5C]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit and action buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleFinish()}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-3.5 text-xs sm:text-sm font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-50 transition-all shadow-xs"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#26313D]" />
              ) : (
                <>
                  <span>
                    {isExistingCompletedUser
                      ? 'Update Preferences'
                      : 'Initialize Learning Twin & Enter Dashboard'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {isExistingCompletedUser && (
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] hover:bg-[#E8E0C9] text-[#5E6A7A] hover:text-[#26313D] text-xs font-bold transition-colors"
              >
                Cancel & Return to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

