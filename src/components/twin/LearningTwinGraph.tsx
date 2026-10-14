'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Activity,
  Zap,
  Sparkles,
  BookOpen,
  Target,
  BarChart2,
  RefreshCw,
  Award,
  Layers,
  ShieldAlert,
  HelpCircle,
  FolderOpen,
} from 'lucide-react';
import {
  Concept,
  ConceptRelationship,
  StudentMastery,
  TopicMastery,
  LearningTwinMetrics,
  Misconception,
  Assessment,
  Course,
} from '@/types';

interface LearningTwinGraphProps {
  course?: Course;
  allCourses?: Course[];
  concepts?: Concept[];
  relationships?: ConceptRelationship[];
  masteryList: StudentMastery[];
  metrics?: LearningTwinMetrics;
  misconceptions?: Misconception[];
  recentAssessments?: Assessment[];
  onSelectConcept?: (conceptId: string) => void;
  onRefresh?: () => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr || dateStr === 'Not yet practiced') return 'Not yet practiced';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function LearningTwinGraph({
  course,
  allCourses = [],
  concepts = [],
  relationships = [],
  masteryList = [],
  metrics,
  misconceptions = [],
  recentAssessments = [],
  onSelectConcept,
  onRefresh,
}: LearningTwinGraphProps) {
  const [selectedConceptId, setSelectedConceptId] = useState<string>(
    concepts.length > 0 ? concepts[0].id : ''
  );
  const [viewMode, setViewMode] = useState<'graph' | 'matrix' | 'retention' | 'topics'>('graph');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  if (concepts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5] mx-auto">
          <Brain className="h-6 w-6 text-[#B1A15A]" />
        </div>
        <h3 className="text-base font-bold text-[#26313D]">No data available yet.</h3>
        <p className="text-xs text-[#6F7782] max-w-sm mx-auto">
          Upload your course materials to get started.
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

  // --- Dynamic Layout Calculation for Graph View ---
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(concepts.length))));
  const spacingX = Math.floor(640 / Math.max(1, cols - 1));
  const spacingY = 120;

  concepts.forEach((concept, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    nodePositions[concept.id] = {
      x: 70 + col * spacingX,
      y: 70 + row * spacingY,
    };
  });

  const activeSelectedId =
    selectedConceptId && concepts.some((c) => c.id === selectedConceptId)
      ? selectedConceptId
      : concepts[0].id;

  const selectedConcept = concepts.find((c) => c.id === activeSelectedId);
  const selectedMastery = masteryList.find((m) => m.concept_id === activeSelectedId);

  // --- Metrics Computation (Direct from live mastery data & attempts) ---
  const totalAttempts = masteryList.reduce((acc, m) => acc + (m.attempt_count || 0), 0);
  const totalCorrect = masteryList.reduce((acc, m) => acc + (m.correct_count || 0), 0);
  const totalIncorrect = masteryList.reduce((acc, m) => acc + (m.incorrect_count || 0), 0);
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const courseMasteryPercentage =
    masteryList.length > 0
      ? Math.round(
          (masteryList.reduce((acc, m) => acc + (m.mastery_probability || 0), 0) /
            masteryList.length) *
            100
        )
      : 0;

  const overallMasteryPercentage =
    metrics?.overall_mastery !== undefined
      ? metrics.overall_mastery
      : courseMasteryPercentage;

  const averageConfidence =
    masteryList.length > 0
      ? Math.round(
          (masteryList.reduce((acc, m) => acc + (m.confidence || 0.5), 0) /
            masteryList.length) *
            100
        )
      : 50;

  // --- Topic-Wise Grouping & Mastery Calculation ---
  const distinctCategories = new Set(
    masteryList.map((m) => m.category).filter((c) => c && c !== 'Core' && c !== 'General')
  );
  const useCategory = distinctCategories.size > 1;

  const topicGroups: Record<
    string,
    {
      topic: string;
      mastery_sum: number;
      concept_count: number;
      attempt_count: number;
      correct_count: number;
      incorrect_count: number;
    }
  > = {};

  masteryList.forEach((m) => {
    const topicName = (useCategory && m.category && m.category !== 'Core' && m.category !== 'General')
      ? m.category
      : (m.concept_name || m.category || 'Core Topics');

    if (!topicGroups[topicName]) {
      topicGroups[topicName] = {
        topic: topicName,
        mastery_sum: 0,
        concept_count: 0,
        attempt_count: 0,
        correct_count: 0,
        incorrect_count: 0,
      };
    }
    topicGroups[topicName].mastery_sum += m.mastery_probability || 0;
    topicGroups[topicName].concept_count += 1;
    topicGroups[topicName].attempt_count += m.attempt_count || 0;
    topicGroups[topicName].correct_count += m.correct_count || 0;
    topicGroups[topicName].incorrect_count += m.incorrect_count || 0;
  });

  const topicMasteryList: TopicMastery[] = Object.values(topicGroups).map((t) => {
    const masteryPct =
      t.concept_count > 0 ? Math.round((t.mastery_sum / t.concept_count) * 100) : 50;
    const acc =
      t.attempt_count > 0 ? Math.round((t.correct_count / t.attempt_count) * 100) : 0;
    return {
      topic: t.topic,
      course_id: course?.id || '',
      mastery_percentage: masteryPct,
      attempt_count: t.attempt_count,
      correct_count: t.correct_count,
      incorrect_count: t.incorrect_count,
      accuracy: acc,
      concept_count: t.concept_count,
      status:
        masteryPct >= 75 ? 'mastered' : masteryPct >= 50 ? 'developing' : 'weak',
    };
  });

  // Weak (< 65%) vs Strong (>= 75%) concepts
  const weakConcepts = masteryList
    .filter((m) => (m.mastery_probability || 0) < 0.65)
    .sort((a, b) => a.mastery_probability - b.mastery_probability);

  const strongConcepts = masteryList
    .filter((m) => (m.mastery_probability || 0) >= 0.75)
    .sort((a, b) => b.mastery_probability - a.mastery_probability);

  // Selected concept metrics
  const selectedAttempts = selectedMastery?.attempt_count || 0;
  const selectedCorrect = selectedMastery?.correct_count || 0;
  const selectedIncorrect = selectedMastery?.incorrect_count || 0;
  const selectedAccuracy =
    selectedAttempts > 0 ? Math.round((selectedCorrect / selectedAttempts) * 100) : 0;
  const selectedConfidence = Math.round((selectedMastery?.confidence || 0.5) * 100);
  const selectedRisk = selectedMastery?.forgetting_risk || 'medium';
  const selectedLastPracticedStr = formatRelativeTime(selectedMastery?.last_practiced);

  const selectedConceptMisconceptions = misconceptions.filter(
    (m) =>
      m.concept_id === activeSelectedId ||
      m.concept_name.toLowerCase() === (selectedConcept?.name || '').toLowerCase()
  );

  const getMasteryColor = (prob: number) => {
    if (prob >= 0.85)
      return {
        bg: 'bg-[#6D9B73]/15',
        border: 'border-[#6D9B73]',
        text: 'text-[#6D9B73]',
        stroke: '#6D9B73',
      };
    if (prob >= 0.65)
      return {
        bg: 'bg-[#B1A15A]/15',
        border: 'border-[#B1A15A]',
        text: 'text-[#B1A15A]',
        stroke: '#B1A15A',
      };
    if (prob >= 0.45)
      return {
        bg: 'bg-[#D4A359]/15',
        border: 'border-[#D4A359]',
        text: 'text-[#D4A359]',
        stroke: '#D4A359',
      };
    return {
      bg: 'bg-[#B85C5C]/15',
      border: 'border-[#B85C5C]',
      text: 'text-[#B85C5C]',
      stroke: '#B85C5C',
    };
  };

  const svgHeight = Math.max(440, (Math.ceil(concepts.length / cols) + 1) * spacingY);

  return (
    <div className="space-y-6">
      {/* 1. TOP OVERVIEW METRICS PANEL (Real Live Assessment Mastery Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Overall Mastery */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overall Mastery</span>
            <Brain className="w-3.5 h-3.5 text-[#B1A15A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#26313D]">{overallMasteryPercentage}%</span>
            <span className="text-[10px] font-semibold text-[#6F7782]">All Subjects</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#B1A15A] transition-all"
              style={{ width: `${overallMasteryPercentage}%` }}
            />
          </div>
        </div>

        {/* Card 2: Course-wise Mastery */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Course Mastery</span>
            <BookOpen className="w-3.5 h-3.5 text-[#B1A15A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#B1A15A]">{courseMasteryPercentage}%</span>
            <span className="text-[10px] font-semibold text-[#6F7782] truncate max-w-[80px]">
              {course?.title || 'Active'}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#B1A15A] transition-all"
              style={{ width: `${courseMasteryPercentage}%` }}
            />
          </div>
        </div>

        {/* Card 3: Total Attempts */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Attempts</span>
            <Activity className="w-3.5 h-3.5 text-[#5E6A7A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#26313D]">{totalAttempts}</span>
            <span className="text-[10px] font-semibold text-[#6F7782]">Answered</span>
          </div>
          <p className="mt-1 text-[10px] text-[#6F7782]">
            {recentAssessments.length} assessment session{recentAssessments.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Card 4: Correct / Incorrect */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Correct / Wrong</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#6D9B73]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-[#6D9B73]">{totalCorrect}</span>
            <span className="text-xs text-[#6F7782]">/</span>
            <span className="text-lg font-black text-[#B85C5C]">{totalIncorrect}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-[#6F7782]">
            <span>{totalCorrect} correct</span>
            <span>{totalIncorrect} wrong</span>
          </div>
        </div>

        {/* Card 5: Accuracy */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Accuracy</span>
            <Target className="w-3.5 h-3.5 text-[#B1A15A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#26313D]">{overallAccuracy}%</span>
            <span className="text-[10px] font-semibold text-[#6F7782]">Empirical</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                overallAccuracy >= 75 ? 'bg-[#6D9B73]' : overallAccuracy >= 50 ? 'bg-[#B1A15A]' : 'bg-[#B85C5C]'
              }`}
              style={{ width: `${overallAccuracy}%` }}
            />
          </div>
        </div>

        {/* Card 6: Confidence */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Confidence</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#B1A15A]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#26313D]">{averageConfidence}%</span>
            <span className="text-[10px] font-semibold text-[#6F7782]">Cognitive</span>
          </div>
          <p className="mt-1 text-[10px] text-[#6F7782] truncate">
            {weakConcepts.length} weak concept{weakConcepts.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* 2. Top Controls & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
            <Brain className="h-5 w-5 text-[#B1A15A]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
              Neural Concept Knowledge Graph
              <span className="rounded-md bg-[#E8E0C9] px-2 py-0.5 text-[10px] font-bold text-[#26313D] border border-[#DDD6C5]">
                Live Supabase Bayesian Twin
              </span>
            </h3>
            <p className="text-xs text-[#6F7782]">
              Real-time prerequisite topology, empirical diagnostic accuracy, and cognitive decay rates.
            </p>
          </div>
        </div>

        {/* View Switcher & Live Refresh Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Synchronize with latest assessment results"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#B1A15A] ${isRefreshing ? 'animate-spin' : ''}`} />
              Sync Results
            </button>
          )}

          <div className="flex items-center gap-1 rounded-xl bg-[#FAF5E8] p-1 border border-[#DDD6C5]">
            <button
              onClick={() => setViewMode('graph')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'graph'
                  ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                  : 'text-[#5E6A7A] hover:text-[#26313D]'
              }`}
            >
              Graph View
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'matrix'
                  ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                  : 'text-[#5E6A7A] hover:text-[#26313D]'
              }`}
            >
              Mastery Matrix
            </button>
            <button
              onClick={() => setViewMode('retention')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'retention'
                  ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                  : 'text-[#5E6A7A] hover:text-[#26313D]'
              }`}
            >
              Forgetting Curves
            </button>
            <button
              onClick={() => setViewMode('topics')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'topics'
                  ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                  : 'text-[#5E6A7A] hover:text-[#26313D]'
              }`}
            >
              Topic Breakdown
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Grid: Graph / Matrix / Topics + Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual Graph Canvas / Matrix / Retention / Topics */}
        <div className="lg:col-span-8 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 relative overflow-hidden min-h-[460px] flex flex-col justify-between shadow-xs">
          {/* VIEW A: GRAPH VIEW */}
          {viewMode === 'graph' && (
            <div className="relative w-full h-[440px] flex items-center justify-center overflow-x-auto bg-[#FAF5E8] rounded-xl border border-[#DDD6C5]/60">
              <svg className="w-[780px]" height={svgHeight} viewBox={`0 0 780 ${svgHeight}`}>
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#DDD6C5" />
                  </marker>
                  <marker
                    id="arrowhead-active"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#B1A15A" />
                  </marker>
                </defs>

                {/* Prerequisite Edges */}
                {relationships.map((rel) => {
                  const source = nodePositions[rel.source_concept_id];
                  const target = nodePositions[rel.target_concept_id];
                  if (!source || !target) return null;

                  const isConnectedToSelected =
                    rel.source_concept_id === activeSelectedId ||
                    rel.target_concept_id === activeSelectedId;

                  return (
                    <g key={rel.id}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isConnectedToSelected ? '#B1A15A' : '#DDD6C5'}
                        strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                        strokeDasharray={rel.relationship_type === 'prerequisite' ? 'none' : '4 4'}
                        markerEnd={
                          isConnectedToSelected
                            ? 'url(#arrowhead-active)'
                            : 'url(#arrowhead)'
                        }
                      />
                    </g>
                  );
                })}

                {/* Interactive Concept Nodes */}
                {concepts.map((concept) => {
                  const pos = nodePositions[concept.id];
                  if (!pos) return null;
                  const mastery = masteryList.find((m) => m.concept_id === concept.id);
                  const prob = mastery ? mastery.mastery_probability : 0.5;
                  const styling = getMasteryColor(prob);
                  const isSelected = concept.id === activeSelectedId;
                  const isCritical = mastery?.forgetting_risk === 'critical';

                  return (
                    <g
                      key={concept.id}
                      className="cursor-pointer transition-transform hover:scale-105"
                      onClick={() => {
                        setSelectedConceptId(concept.id);
                        onSelectConcept?.(concept.id);
                      }}
                    >
                      {/* Critical Misconception Pulse Aura */}
                      {isCritical && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="36"
                          fill="none"
                          stroke="#B85C5C"
                          strokeWidth="2"
                          className="animate-ping opacity-75"
                        />
                      )}

                      {/* Selection Glow */}
                      {isSelected && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="34"
                          fill="none"
                          stroke="#B1A15A"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="26"
                        fill="#FFFDF7"
                        stroke={styling.stroke}
                        strokeWidth="3.5"
                      />

                      {/* Mastery percentage text inside node */}
                      <text
                        x={pos.x}
                        y={pos.y + 4}
                        textAnchor="middle"
                        fill="#26313D"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {Math.round(prob * 100)}%
                      </text>

                      {/* Node Title Label */}
                      <text
                        x={pos.x}
                        y={pos.y + 42}
                        textAnchor="middle"
                        fill={isSelected ? '#B1A15A' : '#26313D'}
                        fontSize="11"
                        fontWeight={isSelected ? 'bold' : '600'}
                      >
                        {concept.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* VIEW B: MASTERY MATRIX */}
          {viewMode === 'matrix' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              {concepts.map((concept) => {
                const mastery = masteryList.find((m) => m.concept_id === concept.id);
                const prob = mastery?.mastery_probability || 0.5;
                const styling = getMasteryColor(prob);
                const isSelected = concept.id === activeSelectedId;
                const attempts = mastery?.attempt_count || 0;
                const correct = mastery?.correct_count || 0;

                return (
                  <div
                    key={concept.id}
                    onClick={() => setSelectedConceptId(concept.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9]/40'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] hover:border-[#B1A15A]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#26313D]">{concept.name}</span>
                      <span className={`text-xs font-bold ${styling.text}`}>
                        {Math.round(prob * 100)}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-[#EFE8D6]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(prob * 100)}%`,
                          backgroundColor: styling.stroke,
                        }}
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#6F7782]">
                      <span className="font-medium">
                        {attempts > 0 ? `${correct}/${attempts} correct (${Math.round((correct / attempts) * 100)}%)` : 'Unassessed'}
                      </span>
                      <span className="capitalize font-semibold">{mastery?.forgetting_risk || 'medium'} risk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW C: RETENTION CURVES */}
          {viewMode === 'retention' && (
            <div className="space-y-4 py-3">
              <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 text-xs text-[#26313D]">
                <p className="font-bold text-[#26313D]">Ebbinghaus Forgetting Curve Simulation</p>
                <p className="text-[11px] text-[#6F7782] mt-1 leading-relaxed">
                  Memory retention decays logarithmically over time. ADAPTIQ calculates review intervals to intercept forgetting before recall drops below 60%.
                </p>
              </div>

              <div className="space-y-2.5">
                {masteryList.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedConceptId(m.concept_id)}
                    className={`cursor-pointer flex items-center justify-between rounded-xl p-3 border text-xs transition-all ${
                      m.concept_id === activeSelectedId
                        ? 'border-[#B1A15A] bg-[#E8E0C9]/40'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] hover:border-[#B1A15A]'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-[#26313D]">{m.concept_name}</p>
                      <p className="text-[11px] text-[#6F7782]">
                        Last practiced: {formatRelativeTime(m.last_practiced)} • {m.attempt_count} attempts
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          m.forgetting_risk === 'critical'
                            ? 'text-[#B85C5C]'
                            : m.forgetting_risk === 'high'
                            ? 'text-[#D4A359]'
                            : 'text-[#6D9B73]'
                        }`}
                      >
                        Retention: {Math.round(m.retention_strength * 100)}%
                      </p>
                      <span className="text-[10px] uppercase font-bold text-[#6F7782]">
                        {m.forgetting_risk} risk
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW D: TOPIC BREAKDOWN VIEW */}
          {viewMode === 'topics' && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 text-xs text-[#26313D]">
                <p className="font-bold">Topic-Level Diagnostic Breakdown</p>
                <p className="text-[11px] text-[#6F7782] mt-0.5">
                  Aggregated mastery and empirical accuracy calculated across all questions in each topic area.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topicMasteryList.map((topic) => {
                  const styling = getMasteryColor(topic.mastery_percentage / 100);
                  return (
                    <div
                      key={topic.topic}
                      className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#26313D]">{topic.topic}</span>
                        <span className={`text-xs font-black ${styling.text}`}>
                          {topic.mastery_percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${topic.mastery_percentage}%`,
                            backgroundColor: styling.stroke,
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[10px]">
                        <div className="rounded-md bg-[#FFFDF7] p-1 border border-[#DDD6C5]/50">
                          <span className="text-[#6F7782] block">Attempts</span>
                          <strong className="text-[#26313D] font-bold">{topic.attempt_count}</strong>
                        </div>
                        <div className="rounded-md bg-[#FFFDF7] p-1 border border-[#DDD6C5]/50">
                          <span className="text-[#6F7782] block">Correct</span>
                          <strong className="text-[#6D9B73] font-bold">
                            {topic.correct_count}/{topic.attempt_count}
                          </strong>
                        </div>
                        <div className="rounded-md bg-[#FFFDF7] p-1 border border-[#DDD6C5]/50">
                          <span className="text-[#6F7782] block">Accuracy</span>
                          <strong className="text-[#26313D] font-bold">{topic.accuracy}%</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Canvas Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#DDD6C5] pt-3 text-[11px] text-[#6F7782]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#6D9B73]" /> &gt;85% Mastered
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B1A15A]" /> 65-84% Competent
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D4A359]" /> 45-64% Developing
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B85C5C]" /> &lt;45% Critical Gap
              </span>
            </div>
            <span className="font-medium">Click any node to inspect</span>
          </div>
        </div>

        {/* 4. Selected Concept Deep Inspector Drawer */}
        <div className="lg:col-span-4 space-y-4">
          {selectedConcept ? (
            <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#26313D] bg-[#E8E0C9] px-2 py-0.5 rounded-md border border-[#DDD6C5]">
                    {selectedConcept.category || 'Core Concept'}
                  </span>
                  <h4 className="text-base font-bold text-[#26313D] mt-1.5">{selectedConcept.name}</h4>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#B1A15A]">
                    {Math.round((selectedMastery?.mastery_probability || 0.5) * 100)}%
                  </span>
                  <p className="text-[10px] text-[#6F7782] font-semibold">Concept Mastery</p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Attempts</span>
                  <span className="text-sm font-bold text-[#26313D]">{selectedAttempts}</span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Correct / Wrong</span>
                  <span className="text-sm font-bold text-[#26313D]">
                    <span className="text-[#6D9B73]">{selectedCorrect}</span> / <span className="text-[#B85C5C]">{selectedIncorrect}</span>
                  </span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Empirical Accuracy</span>
                  <span className="text-sm font-bold text-[#B1A15A]">{selectedAccuracy}%</span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Confidence</span>
                  <span className="text-sm font-bold text-[#26313D]">{selectedConfidence}%</span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Forgetting Risk</span>
                  <span className={`text-xs font-bold capitalize ${
                    selectedRisk === 'critical' ? 'text-[#B85C5C]' : selectedRisk === 'high' ? 'text-[#D4A359]' : 'text-[#6D9B73]'
                  }`}>
                    {selectedRisk} risk
                  </span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Last Practiced</span>
                  <span className="text-xs font-bold text-[#26313D] truncate block">
                    {selectedLastPracticedStr}
                  </span>
                </div>
              </div>

              {/* Misconception Alert if active for this concept */}
              {selectedConceptMisconceptions.length > 0 && (
                <div className="rounded-xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#B85C5C]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Diagnosed Misconception ({selectedConceptMisconceptions[0].status})</span>
                  </div>
                  <p className="text-[11px] text-[#26313D]">
                    {selectedConceptMisconceptions[0].title}
                  </p>
                  <Link
                    href="/misconceptions"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B85C5C] hover:underline pt-1"
                  >
                    Open Repair Workshop <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              <p className="text-xs text-[#6F7782] leading-relaxed">{selectedConcept.description}</p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/assessment?concept=${selectedConcept.id}&courseId=${selectedConcept.course_id || course?.id}`}
                  className="flex-1 rounded-xl bg-[#B1A15A] py-2 text-center text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                >
                  Practice Quiz
                </Link>
                <Link
                  href={`/revision?courseId=${selectedConcept.course_id || course?.id}`}
                  className="flex-1 rounded-xl bg-[#5E6A7A] py-2 text-center text-xs font-bold text-white hover:bg-[#4F5A68] transition-all shadow-xs"
                >
                  Spaced Revision
                </Link>
                <Link
                  href={`/tutor?concept=${selectedConcept.id}&courseId=${selectedConcept.course_id || course?.id}`}
                  className="rounded-xl bg-[#FAF5E8] border border-[#DDD6C5] px-3 py-2 text-center text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all shadow-xs"
                  title="Ask AI Tutor"
                >
                  Tutor
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-8 text-center text-xs text-[#6F7782]">
              Select a concept node to view cognitive metrics.
            </div>
          )}
        </div>
      </div>

      {/* 5. TOPIC-WISE MASTERY SECTION (Example: Data Structures 10/10, Trees 3/10, Recursion 4/10) */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4 h-4 text-[#B1A15A]" />
            <div>
              <h4 className="text-sm font-bold text-[#26313D]">Topic-Wise Adaptive Mastery</h4>
              <p className="text-xs text-[#6F7782]">
                Actual performance and mastery calculated per curriculum topic area.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#6F7782]">
            {topicMasteryList.length} Topic Areas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {topicMasteryList.map((t) => {
            const styling = getMasteryColor(t.mastery_percentage / 100);
            return (
              <div
                key={t.topic}
                className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#26313D] truncate">{t.topic}</span>
                  <span className={`text-xs font-bold ${styling.text}`}>
                    {t.mastery_percentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${t.mastery_percentage}%`,
                      backgroundColor: styling.stroke,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#6F7782]">
                  <span>
                    {t.attempt_count > 0 ? (
                      <strong>{t.correct_count}/{t.attempt_count} correct</strong>
                    ) : (
                      '0 attempts'
                    )}
                  </span>
                  <span className={`font-bold capitalize ${
                    t.status === 'mastered' ? 'text-[#6D9B73]' : t.status === 'developing' ? 'text-[#B1A15A]' : 'text-[#B85C5C]'
                  }`}>
                    {t.status === 'mastered' ? 'High Mastery' : t.status === 'developing' ? 'Competent' : 'Low Mastery'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. WEAK CONCEPTS vs STRONG CONCEPTS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weak Concepts / Priority Gaps */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B85C5C]" />
              <h4 className="text-sm font-bold text-[#26313D]">Weak Concepts & Gaps</h4>
            </div>
            <span className="rounded-md bg-[#B85C5C]/15 px-2 py-0.5 text-[10px] font-bold text-[#B85C5C] border border-[#B85C5C]/30">
              {weakConcepts.length} Priority
            </span>
          </div>
          <p className="text-xs text-[#6F7782]">
            Concepts below 65% mastery or with repeated mistakes requiring immediate diagnostic review.
          </p>

          {weakConcepts.length === 0 ? (
            <div className="rounded-xl bg-[#FAF5E8] p-4 text-center text-xs text-[#6D9B73] font-semibold border border-[#DDD6C5]">
              No critical gaps identified! All assessed concepts meet competency standards.
            </div>
          ) : (
            <div className="space-y-2">
              {weakConcepts.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConceptId(c.concept_id)}
                  className="cursor-pointer flex items-center justify-between rounded-xl bg-[#FAF5E8] p-3 border border-[#DDD6C5] text-xs hover:border-[#B1A15A] transition-all"
                >
                  <div>
                    <span className="font-bold text-[#26313D] block">{c.concept_name}</span>
                    <span className="text-[10px] text-[#6F7782]">
                      {c.attempt_count > 0 ? `${c.correct_count}/${c.attempt_count} correct (${Math.round((c.correct_count / c.attempt_count) * 100)}%)` : 'Not yet tested'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-[#B85C5C]">
                      {Math.round(c.mastery_probability * 100)}%
                    </span>
                    <span className="text-[10px] text-[#B85C5C] block capitalize font-semibold">
                      {c.forgetting_risk} risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strong Concepts / Mastered */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#6D9B73]" />
              <h4 className="text-sm font-bold text-[#26313D]">Strong Concepts (Mastered)</h4>
            </div>
            <span className="rounded-md bg-[#6D9B73]/15 px-2 py-0.5 text-[10px] font-bold text-[#6D9B73] border border-[#6D9B73]/30">
              {strongConcepts.length} Mastered
            </span>
          </div>
          <p className="text-xs text-[#6F7782]">
            Concepts with 75%+ mastery, high accuracy, and strong retention characteristics.
          </p>

          {strongConcepts.length === 0 ? (
            <div className="rounded-xl bg-[#FAF5E8] p-4 text-center text-xs text-[#6F7782] border border-[#DDD6C5]">
              Take adaptive assessments to calibrate and demonstrate concept mastery.
            </div>
          ) : (
            <div className="space-y-2">
              {strongConcepts.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConceptId(c.concept_id)}
                  className="cursor-pointer flex items-center justify-between rounded-xl bg-[#FAF5E8] p-3 border border-[#DDD6C5] text-xs hover:border-[#6D9B73] transition-all"
                >
                  <div>
                    <span className="font-bold text-[#26313D] block">{c.concept_name}</span>
                    <span className="text-[10px] text-[#6F7782]">
                      {c.attempt_count > 0 ? `${c.correct_count}/${c.attempt_count} correct (${Math.round((c.correct_count / c.attempt_count) * 100)}%)` : 'Consolidated'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-[#6D9B73]">
                      {Math.round(c.mastery_probability * 100)}%
                    </span>
                    <span className="text-[10px] text-[#6D9B73] block font-semibold">
                      {Math.round((c.retention_strength || 0.85) * 100)}% retention
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
