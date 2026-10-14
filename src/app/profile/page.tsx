'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  Mail,
  BookOpen,
  Globe2,
  Clock,
  Award,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Edit2,
  Save,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [goal, setGoal] = useState(profile?.learning_goal || '');
  const [language, setLanguage] = useState(profile?.preferred_language || 'English');
  const [minutes, setMinutes] = useState(profile?.daily_study_time_minutes || 60);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setGoal(profile.learning_goal || '');
      setLanguage(profile.preferred_language || 'English');
      setMinutes(profile.daily_study_time_minutes || 60);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      full_name: fullName,
      learning_goal: goal,
      preferred_language: language as any,
      daily_study_time_minutes: minutes,
    });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <AppShell
      headerTitle="Student Profile & Cognitive Metrics"
      headerSubtitle="Manage your identity, learning objectives, preferred explanation language, and view your verified mastery statistics."
    >
      <div className="space-y-8 max-w-4xl">
        {/* Profile Card */}
        <div className="rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#DDD6C5]">
            <div className="flex items-center gap-5">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-[#DDD6C5] shadow-xs"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#E8E0C9] text-2xl font-black text-[#26313D] border border-[#DDD6C5] shadow-xs">
                  {profile?.full_name?.charAt(0) || 'A'}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-[#26313D]">{profile?.full_name}</h2>
                  <span className="rounded-md bg-[#6D9B73]/15 px-2 py-0.5 text-[10px] font-bold text-[#6D9B73] border border-[#6D9B73]/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verified Student
                  </span>
                </div>
                <p className="text-xs text-[#6F7782] flex items-center gap-1.5 font-medium">
                  <Mail className="w-3.5 h-3.5 text-[#6F7782]" />
                  {profile?.email}
                </p>
                <p className="text-xs text-[#B1A15A] font-bold pt-1">
                  Field: {profile?.study_field || 'Computer Science'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all self-start sm:self-center shadow-xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#B1A15A]" />
              {isEditing ? 'Cancel Editing' : 'Edit Profile'}
            </button>
          </div>

          {saveSuccess && (
            <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-3.5 text-xs text-[#6D9B73] flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-bold">Profile updated successfully.</span>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Preferred Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  >
                    <option value="English">English</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Primary Goal</label>
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Daily Study Minutes</label>
                  <input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div className="rounded-xl bg-[#FAF5E8] p-4 border border-[#DDD6C5] space-y-1 shadow-xs">
                <span className="text-[#6F7782] font-semibold text-[11px] flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-[#5E6A7A]" /> Preferred Language
                </span>
                <p className="text-sm font-bold text-[#26313D]">{profile?.preferred_language}</p>
              </div>

              <div className="rounded-xl bg-[#FAF5E8] p-4 border border-[#DDD6C5] space-y-1 shadow-xs">
                <span className="text-[#6F7782] font-semibold text-[11px] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#B1A15A]" /> Learning Objective
                </span>
                <p className="text-sm font-bold text-[#26313D]">{profile?.learning_goal}</p>
              </div>

              <div className="rounded-xl bg-[#FAF5E8] p-4 border border-[#DDD6C5] space-y-1 shadow-xs">
                <span className="text-[#6F7782] font-semibold text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5E6A7A]" /> Daily Target
                </span>
                <p className="text-sm font-bold text-[#26313D]">{profile?.daily_study_time_minutes} minutes / day</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
