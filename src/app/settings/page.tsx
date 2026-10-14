'use client';

import React, { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { SupportedLanguage } from '@/lib/i18n';
import {
  Settings as SettingsIcon,
  Globe2,
  Lock,
  Bell,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, updateProfile, updatePassword, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Language preference states
  const [savingLang, setSavingLang] = useState(false);
  const [langMsg, setLangMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preference switches
  const [tutorMode, setTutorMode] = useState('socratic');
  const [studyReminders, setStudyReminders] = useState(true);
  const [quizReminders, setQuizReminders] = useState(true);

  const handleLanguageSelect = async (newLang: SupportedLanguage) => {
    setLangMsg(null);
    setSavingLang(true);
    try {
      const res = await updateProfile({ preferred_language: newLang });
      if (res && res.error) {
        setLangMsg({ type: 'error', text: res.error });
      } else {
        setLangMsg({ type: 'success', text: `Explanation and AI language updated to ${newLang}.` });
        setTimeout(() => setLangMsg(null), 3500);
      }
    } catch (err: any) {
      setLangMsg({ type: 'error', text: err?.message || 'Failed to update language' });
    } finally {
      setSavingLang(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    const res = await updatePassword(newPassword);
    setLoading(false);
    if (res?.error) {
      setPasswordMsg({ type: 'error', text: res.error });
    } else {
      setPasswordMsg({ type: 'success', text: 'Password successfully updated.' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <AppShell
      headerTitle="Application Settings & Preferences"
      headerSubtitle="Configure your AI tutor pedagogical mode, language preferences, security credentials, and notifications."
    >
      <div className="space-y-8 max-w-4xl">
        {/* Language & Localization Configuration */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
            <div className="flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-[#B1A15A]" />
              <div>
                <h3 className="text-base font-bold text-[#26313D]">Language & Localization</h3>
                <p className="text-[11px] text-[#6F7782]">
                  Explanations, AI tutor responses, diagnostic assessments, and remediation will use this language.
                </p>
              </div>
            </div>
            {savingLang && (
              <span className="flex items-center gap-1.5 text-xs text-[#6F7782]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B1A15A]" />
                Saving...
              </span>
            )}
          </div>

          {langMsg && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
                langMsg.type === 'success'
                  ? 'border-[#6D9B73]/40 bg-[#6D9B73]/10 text-[#6D9B73]'
                  : 'border-[#B85C5C]/40 bg-[#B85C5C]/10 text-[#B85C5C]'
              }`}
            >
              {langMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6D9B73]" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-[#B85C5C]" />
              )}
              <span className="font-semibold">{langMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            {[
              { id: 'English', label: 'English', sub: 'Default' },
              { id: 'Tamil', label: 'தமிழ்', sub: 'Tamil' },
              { id: 'Hindi', label: 'हिन्दी', sub: 'Hindi' },
              { id: 'Spanish', label: 'Español', sub: 'Spanish' },
              { id: 'French', label: 'Français', sub: 'French' },
            ].map((l) => {
              const isSelected = (profile?.preferred_language || 'English') === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={savingLang}
                  onClick={() => handleLanguageSelect(l.id as SupportedLanguage)}
                  className={`rounded-xl border p-3.5 text-left transition-all relative ${
                    isSelected
                      ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                      : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#26313D]">{l.label}</span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-[#26313D]" />}
                  </div>
                  <p className="text-[10px] text-[#6F7782] mt-0.5">{l.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tutor Pedagogical Configuration */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[#DDD6C5] pb-3">
            <Sliders className="h-5 w-5 text-[#B1A15A]" />
            <h3 className="text-base font-bold text-[#26313D]">AI Tutor Pedagogical Mode</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              {
                id: 'socratic',
                title: 'Socratic Guiding',
                desc: 'Asks probing questions, exposes cognitive dissonance before giving direct answers.',
              },
              {
                id: 'direct',
                title: 'Direct Grounding',
                desc: 'Provides immediate explanations citing exact textbook and lecture excerpts.',
              },
              {
                id: 'exam',
                title: 'Exam Drilling',
                desc: 'Focuses on time-constrained problem solving and high-frequency test patterns.',
              },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTutorMode(mode.id)}
                className={`rounded-xl border p-4 text-left transition-all space-y-1.5 ${
                  tutorMode === mode.id
                    ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                    : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[#26313D]">{mode.title}</h4>
                  {tutorMode === mode.id && <CheckCircle2 className="h-4 w-4 text-[#26313D]" />}
                </div>
                <p className="text-[11px] text-[#6F7782] leading-snug">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Security & Password */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[#DDD6C5] pb-3">
            <Lock className="h-5 w-5 text-[#5E6A7A]" />
            <h3 className="text-base font-bold text-[#26313D]">Security & Password</h3>
          </div>

          {passwordMsg && (
            <div
              className={`rounded-xl border p-3.5 text-xs flex items-center gap-2 ${
                passwordMsg.type === 'success'
                  ? 'border-[#6D9B73]/40 bg-[#6D9B73]/10 text-[#6D9B73]'
                  : 'border-[#B85C5C]/40 bg-[#B85C5C]/10 text-[#B85C5C]'
              }`}
            >
              {passwordMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6D9B73]" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-[#B85C5C]" />
              )}
              <span className="font-semibold">{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#26313D]">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#26313D]">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-40 transition-all shadow-xs"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#26313D]" /> : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[#DDD6C5] pb-3">
            <Bell className="h-5 w-5 text-[#B1A15A]" />
            <h3 className="text-base font-bold text-[#26313D]">Notifications & Reminders</h3>
          </div>

          <div className="space-y-3 max-w-lg text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
              <div>
                <p className="font-bold text-[#26313D]">Daily Study Goal Reminder</p>
                <p className="text-[11px] text-[#6F7782]">Receive alert when daily study streak is at risk</p>
              </div>
              <input
                type="checkbox"
                checked={studyReminders}
                onChange={(e) => setStudyReminders(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B1A15A]"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
              <div>
                <p className="font-bold text-[#26313D]">Misconception Follow-up Alerts</p>
                <p className="text-[11px] text-[#6F7782]">Remind 24 hours after active learning gap diagnosis</p>
              </div>
              <input
                type="checkbox"
                checked={quizReminders}
                onChange={(e) => setQuizReminders(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B1A15A]"
              />
            </div>
          </div>
        </div>

        {/* Danger Zone / Account Management */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-[#DDD6C5] pb-3">
            <Trash2 className="h-5 w-5 text-[#B85C5C]" />
            <h3 className="text-base font-bold text-[#26313D]">Account Management</h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#26313D]">Sign Out or Clear Local Session</p>
              <p className="text-[11px] text-[#6F7782] mt-0.5">
                Signing out terminates your authenticated session and returns to the home page.
              </p>
            </div>
            <button
              onClick={signOut}
              className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/15 px-4 py-2 text-xs font-bold text-[#B85C5C] hover:bg-[#B85C5C]/25 transition-all shrink-0"
            >
              Sign Out of ADAPTIQ
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
