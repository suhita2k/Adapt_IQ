'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  BookOpen,
  ArrowRight,
  Flame,
  Award,
  Check,
  FolderOpen,
} from 'lucide-react';
import { StudyPlan, StudyTask, Course } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

export default function StudyPlanView() {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.getCourses()
      .then(async (userCourses) => {
        setCourses(userCourses);
        if (userCourses.length > 0) {
          const firstId = userCourses[0].id;
          setSelectedCourseId(firstId);
          const studyPlan = await api.getStudyPlan(firstId);
          setPlan(studyPlan);
        } else {
          setPlan(null);
        }
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [user]);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoading(true);
    try {
      const studyPlan = await api.getStudyPlan(courseId);
      setPlan(studyPlan);
    } catch (err) {
      console.warn('Error loading plan for course:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (taskId: string) => {
    if (!user) return;
    try {
      const updated = await api.toggleStudyTask(taskId);
      setPlan(updated);
    } catch (err) {
      console.warn('Error toggling task:', err);
    }
  };

  const handlePostpone = async (taskId: string) => {
    if (!user) return;
    try {
      const updated = await api.updateStudyTask(taskId, 'postpone');
      setPlan(updated);
    } catch (err) {
      console.warn('Error postponing task:', err);
    }
  };

  const handleRegenerate = async () => {
    if (!user) return;
    try {
      setIsGenerating(true);
      const updated = await api.generateStudyPlan({
        courseId: selectedCourseId,
        language: profile?.preferred_language || 'English',
      });
      setPlan(updated);
    } catch (err) {
      console.warn('Error regenerating plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3">
        <Clock className="w-6 h-6 animate-spin text-[#B1A15A] mx-auto" />
        <p className="text-xs text-[#6F7782]">Calculating Bayesian forgetting rates, weak mastery, and adaptive pacing...</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 max-w-lg mx-auto shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5] mx-auto">
          <FolderOpen className="h-6 w-6 text-[#B1A15A]" />
        </div>
        <h4 className="text-base font-bold text-[#26313D]">No Subjects Found</h4>
        <p className="text-xs text-[#6F7782] max-w-sm mx-auto leading-relaxed">
          Create a course and upload learning materials to generate your personalized adaptive study plan.
        </p>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
        >
          <BookOpen className="w-4 h-4" /> Go to Courses
        </Link>
      </div>
    );
  }

  if (!plan || plan.tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#B1A15A]" />
            <span className="text-[#6F7782] font-semibold">Active Subject:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 font-bold text-[#26313D] text-xs focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 max-w-lg mx-auto shadow-xs">
          <Calendar className="w-8 h-8 text-[#B1A15A] mx-auto" />
          <h4 className="text-base font-bold text-[#26313D]">No Study Tasks Scheduled</h4>
          <p className="text-xs text-[#6F7782] max-w-md mx-auto leading-relaxed">
            Upload course materials for &ldquo;{activeCourse?.title}&rdquo; to automatically synthesize targeted tasks based on forgetting risk and concept mastery.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
          >
            <Zap className="w-4 h-4" /> {isGenerating ? 'Synthesizing...' : 'Generate Study Plan'}
          </button>
        </div>
      </div>
    );
  }

  const completedCount = plan.tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / plan.tasks.length) * 100);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-[#B85C5C]/15 text-[#B85C5C] border-[#B85C5C]/30';
      case 'high':
        return 'bg-[#D4A359]/20 text-[#26313D] border-[#D4A359]/40';
      case 'medium':
        return 'bg-[#E8E0C9] text-[#26313D] border-[#DDD6C5]';
      default:
        return 'bg-[#FAF5E8] text-[#5E6A7A] border-[#DDD6C5]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Subject Selector Header */}
      {courses.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#B1A15A]" />
            <span className="text-[#6F7782] font-semibold">Active Subject Plan:</span>
            <select
              id="study-plan-subject-selector"
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 font-bold text-[#26313D] text-xs focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] text-[#6F7782]">
            Target Pace: <strong className="text-[#26313D]">{plan.daily_goal_minutes} mins / day</strong>
          </span>
        </div>
      )}

      {/* Top Meta Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 flex items-center gap-4 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8E0C9] border border-[#DDD6C5]">
            <Flame className="h-6 w-6 text-[#B1A15A]" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#26313D]">{plan.streak_days} Days</span>
            <p className="text-xs text-[#6F7782] font-semibold">Study Streak</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 flex items-center gap-4 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF5E8] border border-[#DDD6C5]">
            <Clock className="h-6 w-6 text-[#5E6A7A]" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#26313D]">{plan.daily_goal_minutes}m / day</span>
            <p className="text-xs text-[#6F7782] font-semibold">Daily Study Budget</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 flex items-center gap-4 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6D9B73]/15 border border-[#6D9B73]/30">
            <Award className="h-6 w-6 text-[#6D9B73]" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#6D9B73]">{progressPercent}%</span>
            <p className="text-xs text-[#6F7782] font-semibold">Tasks Completed Today</p>
          </div>
        </div>
      </div>

      {/* Dynamic Task List */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#DDD6C5] pb-4 gap-3">
          <div>
            <h3 className="text-base font-bold text-[#26313D] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#B1A15A]" />
              Prioritized Daily Learning Tasks
            </h3>
            <p className="text-xs text-[#6F7782] mt-0.5">
              Generated adaptively based on forgetting risk, misconceptions, and available study budget.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#FAF5E8] shadow-xs disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-[#B1A15A]" />
              {isGenerating ? 'Recalculating...' : 'Recalculate Pacing'}
            </button>
            <span className="text-xs font-bold text-[#26313D] bg-[#E8E0C9] px-2.5 py-1.5 rounded-md border border-[#DDD6C5]">
              {completedCount} of {plan.tasks.length} done
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {plan.tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                task.completed
                  ? 'border-[#DDD6C5]/60 bg-[#FAF5E8]/40 opacity-60'
                  : 'border-[#DDD6C5] bg-[#FAF5E8] hover:border-[#B1A15A]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <button
                  onClick={() => handleToggle(task.id)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    task.completed
                      ? 'bg-[#6D9B73] border-[#6D9B73] text-white'
                      : 'border-[#DDD6C5] bg-[#FFFDF7] hover:border-[#B1A15A]'
                  }`}
                >
                  {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                    {task.concept_name && (
                      <span className="text-xs font-bold text-[#26313D] bg-[#FFFDF7] px-2 py-0.5 rounded border border-[#DDD6C5]">
                        {task.concept_name}
                      </span>
                    )}
                    <span className="text-[11px] text-[#6F7782]">Due: {task.due_date}</span>
                    {!task.completed && (
                      <button
                        type="button"
                        onClick={() => handlePostpone(task.id)}
                        className="text-[10px] text-[#8C7A3E] hover:text-[#26313D] font-bold hover:underline transition-all"
                        title="Postpone due date by 1 day"
                      >
                        Postpone +1d
                      </button>
                    )}
                  </div>
                  <h4
                    className={`text-sm font-bold ${
                      task.completed ? 'line-through text-[#6F7782]' : 'text-[#26313D]'
                    }`}
                  >
                    {task.title}
                  </h4>
                  <p className="text-xs text-[#6F7782]">{task.reason}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="text-xs text-[#6F7782] flex items-center gap-1 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {task.estimated_minutes}m
                </span>

                {task.task_type === 'remediation' && !task.completed && (
                  <Link
                    href="/misconceptions"
                    className="inline-flex items-center gap-1 rounded-xl bg-[#B85C5C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#a24d4d] transition-all shadow-xs"
                  >
                    Repair <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}

                {task.task_type === 'practice_quiz' && !task.completed && (
                  <Link
                    href={task.title.toLowerCase().includes('flashcard') ? '/revision' : `/assessment?course=${task.course_id}&concept=${task.concept_id}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#B1A15A] px-3.5 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                  >
                    {task.title.toLowerCase().includes('flashcard') ? 'Review' : 'Assessment'} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}

                {task.task_type === 'concept_review' && !task.completed && (
                  <Link
                    href={`/learning-twin`}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#5E6A7A] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#4a5563] transition-all shadow-xs"
                  >
                    Inspect Twin <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
