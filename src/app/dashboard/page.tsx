'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import { Course, StudentMastery, Misconception, StudyPlan, Concept, Assessment } from '@/types';
import {
  Brain,
  Sparkles,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  Award,
  Layers,
  Bot,
  Calendar,
  ShieldCheck,
  GitFork,
  ArrowUpRight,
  RotateCw,
  Check,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseConcepts, setCourseConcepts] = useState<Concept[]>([]);
  const [masteryList, setMasteryList] = useState<StudentMastery[]>([]);
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [recentAssessments, setRecentAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.getCourses(),
      api.getMastery(),
      api.getMisconceptions(),
      api.getStudyPlan(),
      api.getAssessments(),
    ])
      .then(async ([uCourses, uMastery, uMisconceptions, uPlan, uAssessments]) => {
        setCourses(uCourses);
        setMasteryList(uMastery);
        setMisconceptions(uMisconceptions);
        setStudyPlan(uPlan);
        setRecentAssessments(uAssessments);

        if (uCourses.length > 0) {
          try {
            const mapRes = await api.getCourseMap(uCourses[0].id);
            setCourseConcepts(mapRes.concepts || []);
          } catch (err) {
            console.warn('Failed to load course map concepts:', err);
          }
        }
      })
      .catch((err) => {
        console.warn('Dashboard data fetch error:', err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleToggleTask = async (taskId: string) => {
    if (!user) return;
    try {
      const updated = await api.toggleStudyTask(taskId);
      setStudyPlan(updated);
    } catch (err) {
      console.warn('Task toggle error:', err);
    }
  };

  const activeMisconceptions = misconceptions.filter((m) => m.status === 'active');
  const avgMastery =
    masteryList.length > 0
      ? Math.round(
          (masteryList.reduce((acc, m) => acc + m.mastery_probability, 0) /
            masteryList.length) *
            100
        )
      : 0;

  // Weak (< 65%) and Strong (>= 80%) concepts
  const weakConcepts = masteryList.filter((m) => m.mastery_probability < 0.65);
  const strongConcepts = masteryList.filter((m) => m.mastery_probability >= 0.8);

  const urgentTasks = studyPlan?.tasks || [];
  const completedTasksCount = urgentTasks.filter((t) => t.completed).length;

  // Next Best Action logic strictly derived from real state
  const nextBestAction =
    courses.length === 0
      ? {
          title: 'Create Your First Course',
          desc: 'Upload lecture slides, syllabus, or textbooks to extract concepts and initialize your Student Learning Twin.',
          href: '/courses',
          btnText: 'Upload Course Materials',
          tag: 'Getting Started',
          isUrgent: true,
        }
      : activeMisconceptions.length > 0
      ? {
          title: `Repair Misconception: ${activeMisconceptions[0].title}`,
          desc: `Your Bayesian Learning Twin detected an invariant violation in ${activeMisconceptions[0].concept_name}. Work through the Socratic proof to restore equilibrium.`,
          href: '/misconceptions',
          btnText: 'Launch Repair Workshop',
          tag: 'High Priority Remediation',
          isUrgent: true,
        }
      : weakConcepts.length > 0
      ? {
          title: `Review Weak Concept: ${weakConcepts[0].concept_name}`,
          desc: `Current mastery is at ${Math.round(weakConcepts[0].mastery_probability * 100)}%. Ask the AI course tutor for textbook evidence and examples.`,
          href: `/tutor?concept=${weakConcepts[0].concept_id}`,
          btnText: 'Consult Course Tutor',
          tag: 'Mastery Reinforcement',
          isUrgent: false,
        }
      : {
          title: 'Complete Daily Diagnostic Assessment',
          desc: 'Keep your Ebbinghaus memory retention curve peaked by taking an adaptive quiz.',
          href: '/assessment',
          btnText: 'Start Adaptive Quiz',
          tag: 'Retention Maintenance',
          isUrgent: false,
        };

  return (
    <AppShell>
      <div className="space-y-7">
        {/* Welcome Academic Banner */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B1A15A] bg-[#E8E0C9] px-2.5 py-0.5 rounded-md border border-[#DDD6C5]">
                  {profile?.study_field || 'Academic Student'} • {profile?.preferred_language || 'English'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#26313D] tracking-tight">
                Academic Dashboard: {profile?.full_name?.split(' ')[0] || 'Learner'}
              </h1>
              <p className="text-xs sm:text-sm text-[#6F7782] max-w-2xl leading-relaxed">
                Your Bayesian Student Learning Twin is actively tracking prerequisite mastery, retention decay rates, and citation-backed course comprehension.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/tutor"
                className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
              >
                <Bot className="w-4 h-4 text-[#26313D]" />
                Ask Course Tutor
              </Link>
              <Link
                href="/assessment"
                className="inline-flex items-center gap-2 rounded-xl bg-[#5E6A7A] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#4F5A68] transition-all shadow-xs"
              >
                <Activity className="w-4 h-4 text-white" />
                Adaptive Quiz
              </Link>
            </div>
          </div>
        </div>

        {/* Next Best Action Card */}
        <div className="rounded-2xl border border-[#B1A15A]/60 bg-[#FAF5E8] p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8E0C9] border border-[#DDD6C5]">
                <Zap className="h-5 w-5 text-[#B1A15A]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#26313D] bg-[#E8E0C9] px-2 py-0.5 rounded border border-[#DDD6C5]">
                    {nextBestAction.tag}
                  </span>
                  <span className="text-xs text-[#6F7782]">AI Recommendation</span>
                </div>
                <h3 className="text-base font-bold text-[#26313D]">
                  {nextBestAction.title}
                </h3>
                <p className="text-xs text-[#6F7782] max-w-2xl leading-relaxed">
                  {nextBestAction.desc}
                </p>
              </div>
            </div>

            <Link
              href={nextBestAction.href}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shrink-0 shadow-xs"
            >
              <span>{nextBestAction.btnText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Overall Mastery */}
          <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6F7782] text-xs font-semibold">
              <span>Overall Mastery</span>
              <Award className="h-4 w-4 text-[#B1A15A]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#26313D]">{avgMastery}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
              <div
                className="h-full bg-[#B1A15A] rounded-full transition-all duration-500"
                style={{ width: `${avgMastery}%` }}
              />
            </div>
            <p className="text-[11px] text-[#6F7782]">Across {courses.length} enrolled subjects</p>
          </div>

          {/* 2. Student Learning Twin */}
          <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6F7782] text-xs font-semibold">
              <span>Student Learning Twin</span>
              <GitFork className="h-4 w-4 text-[#5E6A7A]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#26313D]">
                {masteryList.length} Nodes
              </span>
              <span className="text-xs text-[#6D9B73] font-bold">
                {masteryList.length > 0 ? 'Active' : 'Empty'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#6F7782]">
              <span>
                Bayesian Probability: {masteryList.length > 0 ? (avgMastery / 100).toFixed(2) : '0.00'}
              </span>
              <Link href="/learning-twin" className="text-[#B1A15A] font-bold hover:underline">
                View Graph →
              </Link>
            </div>
          </div>

          {/* 3. Misconceptions */}
          <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6F7782] text-xs font-semibold">
              <span>Misconceptions</span>
              <AlertTriangle className="h-4 w-4 text-[#B85C5C]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#B85C5C]">
                {activeMisconceptions.length}
              </span>
              <span className="text-xs text-[#6F7782]">Active Gaps</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#6F7782]">
                {activeMisconceptions.length > 0
                  ? activeMisconceptions[0].title
                  : 'All clear'}
              </span>
              <Link href="/misconceptions" className="text-[#B85C5C] font-bold hover:underline">
                Repair →
              </Link>
            </div>
          </div>

          {/* 4. Study Streak & Pace */}
          <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6F7782] text-xs font-semibold">
              <span>Study Streak</span>
              <Clock className="h-4 w-4 text-[#5E6A7A]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#26313D]">
                {studyPlan?.streak_days || 0} Days
              </span>
              <span className="text-xs text-[#6D9B73] font-bold">
                {studyPlan?.streak_days ? 'Active' : 'Unstarted'}
              </span>
            </div>
            <p className="text-[11px] text-[#6F7782]">
              Goal: {profile?.daily_study_time_minutes || 60}m daily pace
            </p>
          </div>
        </div>

        {/* Two-Column Section: Weak Concepts & Strong Concepts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Weak Concepts Card */}
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B85C5C]" />
                <h3 className="text-sm font-bold text-[#26313D]">Weak Concepts (Attention Required)</h3>
              </div>
              <span className="text-[11px] text-[#B85C5C] font-bold bg-[#B85C5C]/10 px-2 py-0.5 rounded border border-[#B85C5C]/20">
                {weakConcepts.length} Concepts &lt; 65%
              </span>
            </div>

            {weakConcepts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DDD6C5] p-6 text-center text-xs text-[#6F7782]">
                No weak concepts identified. All assessed topics meet mastery thresholds.
              </div>
            ) : (
              <div className="space-y-2.5">
                {weakConcepts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-[#26313D]">{item.concept_name}</span>
                      <div className="flex items-center gap-2 text-[10px] text-[#6F7782]">
                        <span>{item.category}</span>
                        <span>•</span>
                        <span className="text-[#B85C5C] font-bold">
                          Mastery: {Math.round(item.mastery_probability * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/tutor?concept=${item.concept_id}`}
                        className="rounded-lg bg-[#FFFDF7] border border-[#DDD6C5] px-2.5 py-1 text-[11px] font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
                      >
                        Ask Tutor
                      </Link>
                      <Link
                        href={`/assessment?concept=${item.concept_id}`}
                        className="rounded-lg bg-[#5E6A7A] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#4F5A68] transition-colors"
                      >
                        Practice
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strong Concepts Card */}
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#6D9B73]" />
                <h3 className="text-sm font-bold text-[#26313D]">Strong Concepts (High Retention)</h3>
              </div>
              <span className="text-[11px] text-[#6D9B73] font-bold bg-[#6D9B73]/10 px-2 py-0.5 rounded border border-[#6D9B73]/20">
                {strongConcepts.length} Concepts &ge; 80%
              </span>
            </div>

            {strongConcepts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DDD6C5] p-6 text-center text-xs text-[#6F7782]">
                No topics have reached high retention (&ge; 80%) yet. Take adaptive quizzes to build mastery.
              </div>
            ) : (
              <div className="space-y-2.5">
                {strongConcepts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-[#26313D]">{item.concept_name}</span>
                      <div className="flex items-center gap-2 text-[10px] text-[#6F7782]">
                        <span>{item.category}</span>
                        <span>•</span>
                        <span className="text-[#6D9B73] font-bold">
                          Mastery: {Math.round(item.mastery_probability * 100)}%
                        </span>
                      </div>
                    </div>

                    <Link
                      href="/revision"
                      className="rounded-lg bg-[#FFFDF7] border border-[#DDD6C5] px-2.5 py-1 text-[11px] font-bold text-[#5E6A7A] hover:bg-[#E8E0C9] transition-colors"
                    >
                      Spaced Recall
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Course Map & Course Learning Twin */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DDD6C5] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <GitFork className="w-5 h-5 text-[#B1A15A]" />
                <h3 className="text-base font-bold text-[#26313D]">
                  Course Map &amp; Curriculum Topology ({courses[0]?.title || 'No Enrolled Course'})
                </h3>
              </div>
              <p className="text-xs text-[#6F7782] mt-0.5">
                Visual progression from foundational prerequisites to advanced concepts extracted from your materials.
              </p>
            </div>

            <Link
              href="/learning-twin"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all shadow-xs"
            >
              <span>Explore Interactive Twin</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Real Concept Curriculum Visualizer or Empty State */}
          {courseConcepts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DDD6C5] p-8 text-center space-y-2">
              <p className="text-xs font-bold text-[#26313D]">No data available yet.</p>
              <p className="text-xs text-[#6F7782]">Upload your course materials to get started.</p>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#B1A15A] px-3.5 py-1.5 text-xs font-bold text-[#26313D] mt-2 shadow-xs"
              >
                <BookOpen className="w-4 h-4" /> Create or Upload Course Materials
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {courseConcepts.map((concept, idx) => {
                const mastery = masteryList.find((m) => m.concept_id === concept.id);
                const prob = mastery?.mastery_probability || 0.5;
                const isMastered = prob >= 0.8;
                const isWeak = prob < 0.65;

                return (
                  <div
                    key={concept.id}
                    className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                      isMastered
                        ? 'border-[#6D9B73]/50 bg-[#6D9B73]/10 text-[#26313D]'
                        : isWeak
                        ? 'border-[#B85C5C]/50 bg-[#B85C5C]/10 text-[#26313D]'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#26313D]'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#6F7782] block">
                        Step {idx + 1}
                      </span>
                      <h4 className="text-xs font-bold line-clamp-1">{concept.name}</h4>
                    </div>
                    <div className="mt-2 pt-1 border-t border-[#DDD6C5]/60 flex items-center justify-between text-[10px]">
                      <span className="font-bold">
                        {Math.round(prob * 100)}%
                      </span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isMastered
                            ? 'bg-[#6D9B73]'
                            : isWeak
                            ? 'bg-[#B85C5C]'
                            : 'bg-[#B1A15A]'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Grid: Study Plan Tasks & Recent Assessments */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Study Plan (Left 7 Cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#5E6A7A]" />
                <h3 className="text-sm font-bold text-[#26313D]">
                  Today&apos;s Adaptive Study Plan ({completedTasksCount}/{urgentTasks.length} Completed)
                </h3>
              </div>
              <Link
                href="/study-plan"
                className="text-xs font-bold text-[#B1A15A] hover:underline flex items-center gap-1"
              >
                Schedule <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DDD6C5] p-6 text-center space-y-2">
                <p className="text-xs text-[#6F7782]">No data available yet.</p>
                <p className="text-xs text-[#6F7782]">Upload your course materials to get started.</p>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B1A15A] hover:underline mt-1"
                >
                  Create Course →
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className={`cursor-pointer rounded-xl border p-3 flex items-start justify-between gap-3 text-xs transition-all ${
                      task.completed
                        ? 'border-[#DDD6C5] bg-[#FAF5E8]/60 opacity-60'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] hover:border-[#B1A15A]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          task.completed
                            ? 'bg-[#6D9B73] border-[#6D9B73] text-white'
                            : 'border-[#DDD6C5] bg-[#FFFDF7]'
                        }`}
                      >
                        {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                              task.priority === 'urgent'
                                ? 'bg-[#B85C5C]/15 text-[#B85C5C] border-[#B85C5C]/30'
                                : 'bg-[#B1A15A]/20 text-[#26313D] border-[#B1A15A]/40'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span className="text-[11px] text-[#6F7782] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {task.estimated_minutes} min
                          </span>
                        </div>
                        <h4
                          className={`font-bold text-[#26313D] ${
                            task.completed ? 'line-through text-[#6F7782]' : ''
                          }`}
                        >
                          {task.title}
                        </h4>
                        <p className="text-[11px] text-[#6F7782] line-clamp-1">{task.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Assessments (Right 5 Cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#5E6A7A]" />
                <h3 className="text-sm font-bold text-[#26313D]">Recent Assessments</h3>
              </div>
              <Link
                href="/assessment"
                className="text-xs font-bold text-[#B1A15A] hover:underline flex items-center gap-1"
              >
                New Quiz <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recentAssessments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DDD6C5] p-6 text-center space-y-2">
                <p className="text-xs text-[#6F7782]">No assessment attempts recorded yet.</p>
                <p className="text-xs text-[#6F7782]">Take an adaptive quiz to calibrate your Learning Twin.</p>
                <Link
                  href="/assessment"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#5E6A7A] px-3.5 py-1.5 text-xs font-bold text-white mt-1"
                >
                  Start Diagnostic Quiz
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAssessments.slice(0, 3).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#26313D]">{quiz.title}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          quiz.score_percentage >= 80
                            ? 'bg-[#6D9B73]/15 text-[#6D9B73] border-[#6D9B73]/30'
                            : 'bg-[#B85C5C]/15 text-[#B85C5C] border-[#B85C5C]/30'
                        }`}
                      >
                        {quiz.score_percentage}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#6F7782]">
                      <span>
                        {quiz.completed_questions}/{quiz.total_questions} Questions Completed
                      </span>
                      <span>{new Date(quiz.started_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                <Link
                  href="/assessment"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5E6A7A] py-2 text-xs font-bold text-white hover:bg-[#4F5A68] transition-all shadow-xs"
                >
                  <Activity className="w-3.5 h-3.5 text-white" />
                  Launch Full Diagnostic Quiz
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
