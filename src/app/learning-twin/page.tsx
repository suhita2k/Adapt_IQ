'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import {
  Course,
  Concept,
  ConceptRelationship,
  StudentMastery,
  LearningTwinMetrics,
  Misconception,
  Assessment,
} from '@/types';
import LearningTwinGraph from '@/components/twin/LearningTwinGraph';
import { Brain, BookOpen, Loader2 } from 'lucide-react';

export default function LearningTwinPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [relationships, setRelationships] = useState<ConceptRelationship[]>([]);
  const [masteryList, setMasteryList] = useState<StudentMastery[]>([]);
  const [metrics, setMetrics] = useState<LearningTwinMetrics | undefined>(undefined);
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [recentAssessments, setRecentAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCourseData = useCallback(
    async (courseId: string, showLoadingSpinner = true) => {
      if (showLoadingSpinner) setLoading(true);
      try {
        const [mapData, masteryRes, miscData, assessmentData] = await Promise.all([
          api.getCourseMap(courseId),
          api.getMasteryWithMetrics(courseId),
          api.getMisconceptions(courseId),
          api.getAssessments(courseId),
        ]);

        setConcepts(mapData.concepts || []);
        setRelationships(mapData.relationships || []);
        setMasteryList(masteryRes.mastery || []);
        setMetrics(masteryRes.metrics);
        setMisconceptions(miscData || []);
        setRecentAssessments(assessmentData || []);
      } catch (err) {
        console.warn('Failed to load Learning Twin data:', err);
      } finally {
        if (showLoadingSpinner) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.getCourses()
      .then(async (userCourses) => {
        setCourses(userCourses);

        if (userCourses.length > 0) {
          const firstId = userCourses[0].id;
          setSelectedCourseId(firstId);
          await loadCourseData(firstId, false);
        }
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [user, loadCourseData]);

  // Window focus listener: when student takes an assessment in another tab/window or navigates back,
  // the Learning Twin automatically re-syncs without manual hard-refresh!
  useEffect(() => {
    const handleFocus = () => {
      if (selectedCourseId) {
        loadCourseData(selectedCourseId, false);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedCourseId, loadCourseData]);

  const handleSelectCourse = async (courseId: string) => {
    setSelectedCourseId(courseId);
    await loadCourseData(courseId, true);
  };

  const handleManualRefresh = async () => {
    if (selectedCourseId) {
      await loadCourseData(selectedCourseId, false);
    }
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <AppShell
      headerTitle="Your Learning Twin"
      headerSubtitle="See your progress, discover weak topics, and know what to learn next."
    >
      <div className="space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#B1A15A] mx-auto" />
            <p className="text-xs text-[#6F7782]">Synchronizing Learning Twin data from Supabase...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 max-w-lg mx-auto shadow-xs">
            <Brain className="w-8 h-8 text-[#B1A15A] mx-auto" />
            <h4 className="text-base font-bold text-[#26313D]">No Courses Found</h4>
            <p className="text-xs text-[#6F7782]">
              Create a course and upload learning materials to initialize your Learning Twin.
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
            >
              <BookOpen className="w-4 h-4" /> Go to Courses
            </Link>
          </div>
        ) : concepts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 max-w-lg mx-auto shadow-xs">
            <Brain className="w-8 h-8 text-[#B1A15A] mx-auto" />
            <h4 className="text-base font-bold text-[#26313D]">No Topics Indexed Yet</h4>
            <p className="text-xs text-[#6F7782]">
              Upload course materials in Courses to extract topics and visualize your Learning Twin for {activeCourse?.title || 'this course'}.
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
            >
              <BookOpen className="w-4 h-4" /> Go to Courses
            </Link>
          </div>
        ) : (
          <LearningTwinGraph
            course={activeCourse}
            allCourses={courses}
            selectedCourseId={selectedCourseId}
            onSelectCourse={handleSelectCourse}
            concepts={concepts}
            relationships={relationships}
            masteryList={masteryList}
            metrics={metrics}
            misconceptions={misconceptions}
            recentAssessments={recentAssessments}
            onRefresh={handleManualRefresh}
          />
        )}
      </div>
    </AppShell>
  );
}
