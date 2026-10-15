'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Brain,
  BookOpen,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  Sparkles,
  BarChart2,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  Concept,
  ConceptRelationship,
  StudentMastery,
  LearningTwinMetrics,
  Misconception,
  Assessment,
  Course,
} from '@/types';

interface LearningTwinGraphProps {
  course?: Course;
  allCourses?: Course[];
  selectedCourseId?: string;
  onSelectCourse?: (courseId: string) => void;
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
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function LearningTwinGraph({
  course,
  allCourses = [],
  selectedCourseId,
  onSelectCourse,
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Graph Canvas View State (Zoom, Pan, Drag)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // --- Real Mastery Calculations ---
  const totalAttempts = masteryList.reduce((acc, m) => acc + (m.attempt_count || 0), 0);
  const totalCorrect = masteryList.reduce((acc, m) => acc + (m.correct_count || 0), 0);
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

  // --- Formatted Topics List with Exact Mastery Indicators ---
  // Green: Strong (80-100%), Gold: Improving (50-79%), Red: Needs Practice (0-49%), Grey: Not Assessed
  const formattedTopics = useMemo(() => {
    return concepts.map((concept) => {
      const mastery = masteryList.find(
        (m) =>
          m.concept_id === concept.id ||
          m.concept_name.toLowerCase().trim() === concept.name.toLowerCase().trim()
      );
      const attemptCount = mastery?.attempt_count || 0;
      const correctCount = mastery?.correct_count || 0;
      const prob = mastery ? mastery.mastery_probability : 0.5;
      const masteryPct = Math.round(prob * 100);

      let statusLabel: 'Strong' | 'Improving' | 'Needs Practice' | 'Not Assessed';
      let statusColor: {
        bg: string;
        text: string;
        border: string;
        dot: string;
        bar: string;
        stroke: string;
        pillBg: string;
      };

      if (attemptCount === 0) {
        statusLabel = 'Not Assessed';
        statusColor = {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-300',
          dot: 'bg-slate-400',
          bar: 'bg-slate-300',
          stroke: '#94A3B8',
          pillBg: '#F1F5F9',
        };
      } else if (masteryPct >= 80) {
        statusLabel = 'Strong';
        statusColor = {
          bg: 'bg-[#6D9B73]/15',
          text: 'text-[#6D9B73]',
          border: 'border-[#6D9B73]/30',
          dot: 'bg-[#6D9B73]',
          bar: 'bg-[#6D9B73]',
          stroke: '#6D9B73',
          pillBg: '#EBF4EC',
        };
      } else if (masteryPct >= 50) {
        statusLabel = 'Improving';
        statusColor = {
          bg: 'bg-[#B1A15A]/15',
          text: 'text-[#8E7F3B]',
          border: 'border-[#B1A15A]/30',
          dot: 'bg-[#B1A15A]',
          bar: 'bg-[#B1A15A]',
          stroke: '#B1A15A',
          pillBg: '#F9F6EA',
        };
      } else {
        statusLabel = 'Needs Practice';
        statusColor = {
          bg: 'bg-[#B85C5C]/15',
          text: 'text-[#B85C5C]',
          border: 'border-[#B85C5C]/30',
          dot: 'bg-[#B85C5C]',
          bar: 'bg-[#B85C5C]',
          stroke: '#B85C5C',
          pillBg: '#FDF2F2',
        };
      }

      return {
        id: concept.id,
        name: concept.name,
        category: concept.category || 'Core Concept',
        description: concept.description,
        prerequisites: concept.prerequisites || [],
        masteryPercentage: masteryPct,
        statusLabel,
        statusColor,
        attemptCount,
        correctCount,
        accuracy: attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0,
        lastPracticed: formatRelativeTime(mastery?.last_practiced),
        forgettingRisk: mastery?.forgetting_risk || 'medium',
      };
    });
  }, [concepts, masteryList]);

  // Topics needing improvement (< 50% or "Needs Practice")
  const topicsToImproveCount = formattedTopics.filter(
    (t) => t.statusLabel === 'Needs Practice'
  ).length;

  // Selected concept for inspector
  const activeSelectedId =
    selectedConceptId && concepts.some((c) => c.id === selectedConceptId)
      ? selectedConceptId
      : concepts.length > 0
      ? concepts[0].id
      : '';

  const selectedTopic = formattedTopics.find((t) => t.id === activeSelectedId);

  // --- Real Prerequisite Edges Matching (By ID and By Concept Name) ---
  const activeEdges = useMemo(() => {
    const list: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      sourceName: string;
      targetName: string;
    }> = [];

    const nameToId = new Map<string, string>();
    concepts.forEach((c) => {
      nameToId.set(c.id, c.id);
      nameToId.set(c.name.toLowerCase().trim(), c.id);
    });

    // 1. From relationships table
    relationships.forEach((rel, idx) => {
      if (rel.relationship_type === 'prerequisite' || !rel.relationship_type) {
        const srcId = nameToId.get(rel.source_concept_id) || nameToId.get(rel.source_concept_id.toLowerCase().trim());
        const tgtId = nameToId.get(rel.target_concept_id) || nameToId.get(rel.target_concept_id.toLowerCase().trim());
        if (srcId && tgtId && srcId !== tgtId) {
          list.push({
            id: rel.id || `rel-${idx}`,
            sourceId: srcId,
            targetId: tgtId,
            sourceName: rel.source_concept_id,
            targetName: rel.target_concept_id,
          });
        }
      }
    });

    // 2. From concept.prerequisites arrays
    concepts.forEach((concept) => {
      if (Array.isArray(concept.prerequisites)) {
        concept.prerequisites.forEach((pName, pIdx) => {
          const srcId = nameToId.get(pName) || nameToId.get(pName.toLowerCase().trim());
          if (srcId && srcId !== concept.id) {
            // Avoid duplicates
            if (!list.some((e) => e.sourceId === srcId && e.targetId === concept.id)) {
              list.push({
                id: `prereq-${concept.id}-${pIdx}`,
                sourceId: srcId,
                targetId: concept.id,
                sourceName: pName,
                targetName: concept.name,
              });
            }
          }
        });
      }
    });

    return list;
  }, [concepts, relationships]);

  // Selected Topic Prerequisites and Dependents
  const selectedPrereqs = useMemo(() => {
    if (!activeSelectedId) return [];
    const prereqIds = activeEdges
      .filter((e) => e.targetId === activeSelectedId)
      .map((e) => e.sourceId);
    return formattedTopics.filter((t) => prereqIds.includes(t.id));
  }, [activeSelectedId, activeEdges, formattedTopics]);

  const selectedDependents = useMemo(() => {
    if (!activeSelectedId) return [];
    const depIds = activeEdges
      .filter((e) => e.sourceId === activeSelectedId)
      .map((e) => e.targetId);
    return formattedTopics.filter((t) => depIds.includes(t.id));
  }, [activeSelectedId, activeEdges, formattedTopics]);

  // Misconception for selected topic
  const selectedTopicMisconception = misconceptions.find(
    (m) =>
      m.concept_id === activeSelectedId ||
      m.concept_name.toLowerCase().trim() === (selectedTopic?.name || '').toLowerCase().trim()
  );

  // --- Topological Level DAG Layout for Learning Graph ---
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 64;
  const COL_SPACING = 90;
  const ROW_SPACING = 28;

  const { nodePositions, totalWidth, totalHeight } = useMemo(() => {
    if (concepts.length === 0) {
      return { nodePositions: {}, totalWidth: 700, totalHeight: 400 };
    }

    // Calculate in-degree and adjacency
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    concepts.forEach((c) => {
      inDegree[c.id] = 0;
      adj[c.id] = [];
    });

    activeEdges.forEach((e) => {
      if (inDegree[e.targetId] !== undefined) {
        inDegree[e.targetId] += 1;
      }
      if (adj[e.sourceId]) {
        adj[e.sourceId].push(e.targetId);
      }
    });

    // Topological Levels calculation
    const levels: Record<string, number> = {};
    concepts.forEach((c) => {
      levels[c.id] = inDegree[c.id] === 0 ? 0 : 1;
    });

    // Propagate levels forward (Prerequisites -> Fundamentals Level 0 -> Level 1 -> Level 2)
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;
      activeEdges.forEach((e) => {
        const srcLevel = levels[e.sourceId] || 0;
        const tgtLevel = levels[e.targetId] || 0;
        if (tgtLevel <= srcLevel) {
          levels[e.targetId] = srcLevel + 1;
          changed = true;
        }
      });
    }

    // Group nodes by level
    const levelGroups: Record<number, string[]> = {};
    concepts.forEach((c) => {
      const lvl = levels[c.id] || 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(c.id);
    });

    const maxLevel = Math.max(0, ...Object.keys(levelGroups).map(Number));
    const maxNodesInAnyCol = Math.max(1, ...Object.values(levelGroups).map((g) => g.length));

    const canvasWidth = Math.max(760, (maxLevel + 1) * (NODE_WIDTH + COL_SPACING) + 80);
    const canvasHeight = Math.max(400, maxNodesInAnyCol * (NODE_HEIGHT + ROW_SPACING) + 80);

    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};

    Object.entries(levelGroups).forEach(([lvlStr, nodeIds]) => {
      const lvl = Number(lvlStr);
      const colHeight = nodeIds.length * NODE_HEIGHT + (nodeIds.length - 1) * ROW_SPACING;
      const startY = Math.max(40, (canvasHeight - colHeight) / 2);
      const x = 40 + lvl * (NODE_WIDTH + COL_SPACING);

      nodeIds.forEach((id, idx) => {
        const y = startY + idx * (NODE_HEIGHT + ROW_SPACING);
        positions[id] = {
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        };
      });
    });

    return {
      nodePositions: positions,
      totalWidth: canvasWidth,
      totalHeight: canvasHeight,
    };
  }, [concepts, activeEdges]);

  // --- Graph Controls: Fit to Screen, Zoom In, Zoom Out, Reset View ---
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || totalWidth === 0 || totalHeight === 0) return;
    const contW = containerRef.current.clientWidth || 700;
    const contH = containerRef.current.clientHeight || 400;

    const scaleX = (contW - 60) / totalWidth;
    const scaleY = (contH - 60) / totalHeight;
    const fitScale = Math.min(1.2, Math.max(0.45, Math.min(scaleX, scaleY)));

    setZoom(fitScale);
    setPan({
      x: Math.max(20, (contW - totalWidth * fitScale) / 2),
      y: Math.max(20, (contH - totalHeight * fitScale) / 2),
    });
  }, [totalWidth, totalHeight]);

  // Auto fit when course changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToScreen();
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedCourseId, concepts.length, fitToScreen]);

  const handleZoomIn = () => setZoom((prev) => Math.min(2.2, prev + 0.15));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.4, prev - 0.15));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 30, y: 30 });
  };

  // Mouse drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const targetTag = (e.target as HTMLElement).tagName;
    if (targetTag === 'svg' || targetTag === 'DIV' || targetTag === 'line' || targetTag === 'path') {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setZoom((prev) => Math.min(2.2, Math.max(0.4, prev + delta)));
  };

  // --- 7. Personalized Recommendation Computation ---
  const recommendation = useMemo(() => {
    const activeMisc = misconceptions.find(
      (m) => m.status === 'active' || (m.status as string) === 'Detected'
    );
    if (activeMisc) {
      return {
        topic: activeMisc.concept_name,
        conceptId: activeMisc.concept_id,
        reason: `Diagnosed misconception: "${activeMisc.title}". Resolving this cognitive conflict will eliminate repeated errors in assessments.`,
        badgeText: 'Diagnosed Misconception',
        actionText: 'Resolve Misconception',
        actionHref: `/misconceptions?id=${activeMisc.id}`,
        urgency: 'high' as const,
      };
    }

    const weakConceptIds = new Set(
      formattedTopics.filter((t) => t.statusLabel === 'Needs Practice').map((t) => t.id)
    );
    const blockingRel = activeEdges.find((e) => weakConceptIds.has(e.sourceId));
    if (blockingRel) {
      const prereq = formattedTopics.find((t) => t.id === blockingRel.sourceId);
      const target = formattedTopics.find((t) => t.id === blockingRel.targetId);
      if (prereq) {
        return {
          topic: prereq.name,
          conceptId: prereq.id,
          reason: `Foundational prerequisite for "${target ? target.name : 'advanced topics'}". Mastering this topic will unlock advanced concepts.`,
          badgeText: 'Prerequisite Gap',
          actionText: 'Practice Prerequisite',
          actionHref: `/assessment?concept=${prereq.id}&courseId=${course?.id || ''}`,
          urgency: 'high' as const,
        };
      }
    }

    const unassessed = formattedTopics.find((t) => t.statusLabel === 'Not Assessed');
    if (unassessed) {
      return {
        topic: unassessed.name,
        conceptId: unassessed.id,
        reason: `Not yet assessed. Take a quick diagnostic quiz to calibrate your initial concept mastery.`,
        badgeText: 'Baseline Assessment',
        actionText: 'Take Diagnostic',
        actionHref: `/assessment?concept=${unassessed.id}&courseId=${course?.id || ''}`,
        urgency: 'medium' as const,
      };
    }

    const lowest = [...formattedTopics].sort(
      (a, b) => a.masteryPercentage - b.masteryPercentage
    )[0];
    if (lowest && lowest.masteryPercentage < 80) {
      return {
        topic: lowest.name,
        conceptId: lowest.id,
        reason: `Current topic mastery is ${lowest.masteryPercentage}%. A targeted practice session will advance this concept into the Strong mastery bracket.`,
        badgeText: 'Skill Reinforcement',
        actionText: 'Practice Topic',
        actionHref: `/assessment?concept=${lowest.id}&courseId=${course?.id || ''}`,
        urgency: 'medium' as const,
      };
    }

    if (formattedTopics.length > 0) {
      const firstTopic = formattedTopics[0];
      return {
        topic: firstTopic.name,
        conceptId: firstTopic.id,
        reason: `Great mastery across all modules! Reinforce long-term retention with spaced practice.`,
        badgeText: 'Retention Review',
        actionText: 'Start Spaced Revision',
        actionHref: `/revision?courseId=${course?.id || ''}`,
        urgency: 'low' as const,
      };
    }

    return null;
  }, [misconceptions, formattedTopics, activeEdges, course?.id]);

  // --- Assessment History Processing ---
  const completedAssessments = useMemo(() => {
    return [...recentAssessments]
      .filter((a) => a.status === 'completed' || a.score_percentage !== undefined)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  }, [recentAssessments]);

  return (
    <div className="space-y-6">
      {/* 1. Course Selector Bar */}
      {allCourses.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-[#B1A15A]" />
            <span className="text-[#6F7782] font-semibold">Select Course:</span>
            <select
              id="twin-course-selector"
              value={selectedCourseId || course?.id}
              onChange={(e) => onSelectCourse?.(e.target.value)}
              className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 font-bold text-[#26313D] text-xs focus:outline-none focus:ring-1 focus:ring-[#B1A15A] transition-all cursor-pointer"
            >
              {allCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#6F7782]">
              <strong>{concepts.length}</strong> topics mapped from course materials
            </span>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Synchronize with latest assessment results"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#B1A15A] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Four Compact Progress Cards in One Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Overall Mastery */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overall Mastery</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF5E8] border border-[#DDD6C5]">
              <Award className="w-4 h-4 text-[#B1A15A]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#26313D]">{overallMasteryPercentage}%</span>
              <span className="text-[10px] font-semibold text-[#6F7782]">Bayesian Model</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#EFE8D6] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#B1A15A] transition-all duration-500"
                style={{ width: `${overallMasteryPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Questions Attempted */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Questions Attempted</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF5E8] border border-[#DDD6C5]">
              <Activity className="w-4 h-4 text-[#5E6A7A]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#26313D]">{totalAttempts}</span>
              <span className="text-[10px] font-semibold text-[#6F7782]">Total Questions</span>
            </div>
            <p className="mt-2 text-[11px] text-[#6F7782]">
              {recentAssessments.length} assessment session{recentAssessments.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Card 3: Correct Answers */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Correct Answers</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6D9B73]/15 border border-[#6D9B73]/30">
              <CheckCircle2 className="w-4 h-4 text-[#6D9B73]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#6D9B73]">{totalCorrect}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6D9B73]/15 text-[#6D9B73] border border-[#6D9B73]/30">
                {overallAccuracy}% Accuracy
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#6F7782]">
              {totalAttempts - totalCorrect} incorrect out of {totalAttempts}
            </p>
          </div>
        </div>

        {/* Card 4: Topics to Improve */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6F7782]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Topics to Improve</span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                topicsToImproveCount > 0
                  ? 'bg-[#B85C5C]/15 border border-[#B85C5C]/30'
                  : 'bg-[#6D9B73]/15 border border-[#6D9B73]/30'
              }`}
            >
              {topicsToImproveCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-[#B85C5C]" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#6D9B73]" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span
                className={`text-2xl font-black ${
                  topicsToImproveCount > 0 ? 'text-[#B85C5C]' : 'text-[#6D9B73]'
                }`}
              >
                {topicsToImproveCount}
              </span>
              <span className="text-[10px] font-semibold text-[#6F7782]">
                {topicsToImproveCount > 0 ? 'Needs Attention' : 'All On Track'}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#6F7782]">
              {topicsToImproveCount > 0
                ? `${topicsToImproveCount} topic${topicsToImproveCount === 1 ? '' : 's'} under 50% mastery`
                : 'All topics meet or exceed 50%'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Highlighted Personalized Recommendations ("What should I learn next?") */}
      {recommendation && (
        <div className="rounded-2xl border-2 border-[#B1A15A]/40 bg-gradient-to-r from-[#FFFDF7] to-[#FAF5E8] p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#B1A15A]/15 text-[#8E7F3B] border border-[#B1A15A]/30">
                  <Sparkles className="w-3 h-3 text-[#B1A15A]" />
                  What should I learn next?
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    recommendation.urgency === 'high'
                      ? 'bg-[#B85C5C]/15 text-[#B85C5C] border border-[#B85C5C]/30'
                      : 'bg-[#B1A15A]/10 text-[#8E7F3B]'
                  }`}
                >
                  {recommendation.badgeText}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#26313D] flex items-center gap-2">
                Recommended Focus: <span>{recommendation.topic}</span>
              </h3>
              <p className="text-xs text-[#6F7782] leading-relaxed max-w-2xl">
                {recommendation.reason}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={recommendation.actionHref}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
              >
                <span>{recommendation.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {recommendation.conceptId && (
                <Link
                  href={`/tutor?concept=${recommendation.conceptId}&courseId=${course?.id || ''}`}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#FFFDF7] border border-[#DDD6C5] px-3.5 py-2 text-xs font-bold text-[#26313D] hover:bg-[#FAF5E8] transition-all shadow-xs"
                >
                  <span>Ask Tutor</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Redesigned & Fixed Interactive Learning Graph Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Graph Canvas Card */}
        <div className="lg:col-span-8 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs flex flex-col justify-between">
          {/* Header with Title and Graph Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DDD6C5]">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#B1A15A]" />
              <h4 className="text-sm font-bold text-[#26313D]">Learning Graph</h4>
              <span className="text-[10px] font-bold text-[#6F7782] bg-[#FAF5E8] px-2 py-0.5 rounded border border-[#DDD6C5]">
                {concepts.length} Topics • {activeEdges.length} Prerequisite Links
              </span>
            </div>

            {/* Graph Controls Toolbar: Fit to Screen, Zoom In, Zoom Out, Reset View */}
            <div className="flex items-center gap-1 bg-[#FAF5E8] p-1 rounded-xl border border-[#DDD6C5]">
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                className="p-1.5 rounded-lg text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                className="p-1.5 rounded-lg text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-[#DDD6C5] mx-0.5" />
              <button
                type="button"
                onClick={fitToScreen}
                title="Fit to Screen"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
              >
                <Maximize2 className="w-3 h-3 text-[#B1A15A]" />
                <span>Fit</span>
              </button>
              <button
                type="button"
                onClick={handleResetView}
                title="Reset View"
                className="p-1.5 rounded-lg text-[#26313D] hover:bg-[#E8E0C9] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Graph Interactive Container */}
          {concepts.length === 0 ? (
            <div className="my-10 text-center py-12 rounded-xl bg-[#FAF5E8] border border-dashed border-[#DDD6C5] p-6 space-y-3">
              <Layers className="w-8 h-8 text-[#B1A15A] mx-auto opacity-60" />
              <h5 className="text-sm font-bold text-[#26313D]">No Topics Found for this Course</h5>
              <p className="text-xs text-[#6F7782] max-w-sm mx-auto">
                Upload your syllabus, PDF slides, or lecture materials in Courses to automatically extract prerequisite concepts and generate your interactive learning graph.
              </p>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Upload Materials</span>
              </Link>
            </div>
          ) : (
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              className="mt-3 relative w-full h-[400px] overflow-hidden bg-[#FAF5E8] rounded-xl border border-[#DDD6C5]/60 cursor-grab active:cursor-grabbing select-none"
            >
              <svg
                className="w-full h-full"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  {/* Arrowhead marker for prerequisite connections */}
                  <marker
                    id="graph-arrow"
                    markerWidth="9"
                    markerHeight="7"
                    refX="8"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 9 3.5, 0 7" fill="#C4B89F" />
                  </marker>
                  <marker
                    id="graph-arrow-active"
                    markerWidth="9"
                    markerHeight="7"
                    refX="8"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 9 3.5, 0 7" fill="#B1A15A" />
                  </marker>
                </defs>

                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Prerequisite Connection Curved Lines (Source Right -> Target Left) */}
                  {activeEdges.map((edge) => {
                    const srcPos = nodePositions[edge.sourceId];
                    const tgtPos = nodePositions[edge.targetId];
                    if (!srcPos || !tgtPos) return null;

                    const isConnected =
                      edge.sourceId === activeSelectedId || edge.targetId === activeSelectedId;

                    const startX = srcPos.x + srcPos.width;
                    const startY = srcPos.y + srcPos.height / 2;
                    const endX = tgtPos.x;
                    const endY = tgtPos.y + tgtPos.height / 2;
                    const dx = Math.max(35, Math.abs(endX - startX) / 2);

                    const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

                    return (
                      <g key={`edge-${edge.id}`}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isConnected ? '#B1A15A' : '#DDD6C5'}
                          strokeWidth={isConnected ? 2.5 : 1.75}
                          markerEnd={isConnected ? 'url(#graph-arrow-active)' : 'url(#graph-arrow)'}
                        />
                      </g>
                    );
                  })}

                  {/* Clean Formatted Card Nodes */}
                  {formattedTopics.map((topic) => {
                    const pos = nodePositions[topic.id];
                    if (!pos) return null;
                    const isSelected = topic.id === activeSelectedId;

                    return (
                      <g
                        key={`node-${topic.id}`}
                        className="cursor-pointer transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConceptId(topic.id);
                          onSelectConcept?.(topic.id);
                        }}
                      >
                        {/* Selected Outline Aura */}
                        {isSelected && (
                          <rect
                            x={pos.x - 4}
                            y={pos.y - 4}
                            width={pos.width + 8}
                            height={pos.height + 8}
                            rx="16"
                            ry="16"
                            fill="none"
                            stroke="#B1A15A"
                            strokeWidth="2.5"
                            strokeDasharray="4 4"
                          />
                        )}

                        {/* Main Topic Node Card */}
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width={pos.width}
                          height={pos.height}
                          rx="12"
                          ry="12"
                          fill="#FFFDF7"
                          stroke={topic.statusColor.stroke}
                          strokeWidth={isSelected ? 2.5 : 2}
                          className="drop-shadow-xs"
                        />

                        {/* Topic Name */}
                        <text
                          x={pos.x + 12}
                          y={pos.y + 24}
                          fill="#26313D"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {topic.name.length > 20 ? `${topic.name.slice(0, 18)}…` : topic.name}
                        </text>

                        {/* Category Label */}
                        <text
                          x={pos.x + 12}
                          y={pos.y + 46}
                          fill="#6F7782"
                          fontSize="9"
                          fontWeight="500"
                        >
                          {topic.category.length > 15 ? `${topic.category.slice(0, 13)}…` : topic.category}
                        </text>

                        {/* Mastery Percentage Pill on Node */}
                        <rect
                          x={pos.x + pos.width - 56}
                          y={pos.y + 32}
                          width="46"
                          height="18"
                          rx="9"
                          ry="9"
                          fill={topic.statusColor.pillBg}
                          stroke={topic.statusColor.stroke}
                          strokeWidth="1"
                        />
                        <text
                          x={pos.x + pos.width - 33}
                          y={pos.y + 45}
                          textAnchor="middle"
                          fill={topic.statusColor.stroke}
                          fontSize="10"
                          fontWeight="bold"
                        >
                          {topic.attemptCount === 0 ? '—' : `${topic.masteryPercentage}%`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}

          {/* Graph Legend (Strict Requirement 4 & 6) */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#DDD6C5] pt-3 text-[11px] text-[#6F7782]">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#6D9B73]" /> Strong (80–100%)
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B1A15A]" /> Improving (50–79%)
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B85C5C]" /> Needs Practice (0–49%)
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Not Assessed
              </span>
            </div>
            <span className="text-[10px] text-[#6F7782]">
              Drag to pan • Scroll to zoom • Arrows show prerequisite flow
            </span>
          </div>
        </div>

        {/* Selected Topic Inspector Drawer (Strict Requirement 5) */}
        <div className="lg:col-span-4 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs flex flex-col justify-between">
          {selectedTopic ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-[#DDD6C5]">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#26313D] bg-[#E8E0C9] px-2 py-0.5 rounded-md border border-[#DDD6C5]">
                    {selectedTopic.category}
                  </span>
                  <h4 className="text-base font-bold text-[#26313D] mt-1.5">{selectedTopic.name}</h4>
                </div>
                <div className="text-right">
                  <span className={`text-xl font-black ${selectedTopic.statusColor.text}`}>
                    {selectedTopic.attemptCount === 0 ? '—' : `${selectedTopic.masteryPercentage}%`}
                  </span>
                  <span
                    className={`block text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedTopic.statusColor.bg} ${selectedTopic.statusColor.text} mt-0.5`}
                  >
                    {selectedTopic.statusLabel}
                  </span>
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Questions Attempted</span>
                  <span className="text-sm font-bold text-[#26313D]">{selectedTopic.attemptCount}</span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Accuracy</span>
                  <span className="text-sm font-bold text-[#26313D]">
                    {selectedTopic.attemptCount > 0 ? `${selectedTopic.accuracy}%` : 'Unassessed'}
                  </span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Correct Answers</span>
                  <span className="text-sm font-bold text-[#6D9B73]">{selectedTopic.correctCount}</span>
                </div>
                <div className="rounded-xl bg-[#FAF5E8] p-2.5 border border-[#DDD6C5]">
                  <span className="text-[10px] text-[#6F7782] block font-semibold">Last Practiced</span>
                  <span className="text-xs font-bold text-[#26313D] truncate block">
                    {selectedTopic.lastPracticed}
                  </span>
                </div>
              </div>

              {/* Prerequisites Connected */}
              {selectedPrereqs.length > 0 && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wider">
                    Required Prerequisites:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {selectedPrereqs.map((pr, idx) => (
                      <button
                        key={`prereq-${pr.id}-${idx}`}
                        type="button"
                        onClick={() => setSelectedConceptId(pr.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF5E8] border border-[#DDD6C5] text-[11px] font-semibold text-[#26313D] hover:border-[#B1A15A]"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${pr.statusColor.dot}`} />
                        {pr.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependent Topics Unlocked */}
              {selectedDependents.length > 0 && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wider">
                    Unlocks Downstream Topics:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {selectedDependents.map((dep, idx) => (
                      <button
                        key={`dep-${dep.id}-${idx}`}
                        type="button"
                        onClick={() => setSelectedConceptId(dep.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF5E8] border border-[#DDD6C5] text-[11px] font-semibold text-[#26313D] hover:border-[#B1A15A]"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dep.statusColor.dot}`} />
                        {dep.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Next Action */}
              <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B1A15A] block">
                  Recommended Next Action
                </span>
                <p className="text-[11px] text-[#26313D] leading-relaxed">
                  {selectedTopic.attemptCount === 0
                    ? 'Establish your initial baseline by taking a diagnostic assessment for this topic.'
                    : selectedTopic.masteryPercentage < 50
                    ? 'Targeted priority gap: Review core principles with AI Tutor and practice remedial questions.'
                    : selectedTopic.masteryPercentage < 80
                    ? 'Competency developing: Complete adaptive practice drills to reinforce topic mastery.'
                    : 'High mastery consolidated: Schedule periodic spaced repetition to maintain memory retention.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Link
                  href={`/assessment?concept=${selectedTopic.id}&courseId=${course?.id || ''}`}
                  className="flex-1 rounded-xl bg-[#B1A15A] py-2 text-center text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                >
                  Practice Topic
                </Link>
                <Link
                  href={`/tutor?concept=${selectedTopic.id}&courseId=${course?.id || ''}`}
                  className="rounded-xl bg-[#FAF5E8] border border-[#DDD6C5] px-3.5 py-2 text-center text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all shadow-xs"
                >
                  Ask Tutor
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-[#6F7782] space-y-2">
              <Brain className="w-8 h-8 text-[#B1A15A] mx-auto opacity-60" />
              <p>Select any concept node in the graph to view details.</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Topic Mastery Section (Clean List with Progress Bar and Status Label) */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#DDD6C5]">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#B1A15A]" />
            <h4 className="text-sm font-bold text-[#26313D]">Topic Mastery</h4>
          </div>
          <span className="text-xs font-semibold text-[#6F7782]">
            {formattedTopics.length} Curriculum Topics
          </span>
        </div>

        {formattedTopics.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#6F7782]">
            No topics available for this course syllabus.
          </div>
        ) : (
          <div className="space-y-3">
            {formattedTopics.map((topic) => (
              <div
                key={topic.id}
                onClick={() => setSelectedConceptId(topic.id)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  topic.id === activeSelectedId
                    ? 'border-[#B1A15A] bg-[#FAF5E8]'
                    : 'border-[#DDD6C5] bg-[#FFFDF7] hover:border-[#B1A15A]/60'
                }`}
              >
                <div className="sm:w-1/3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#26313D]">{topic.name}</span>
                    <span className="text-[10px] text-[#6F7782] bg-[#FAF5E8] px-1.5 py-0.5 rounded border border-[#DDD6C5]">
                      {topic.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#6F7782] block mt-0.5">
                    {topic.attemptCount > 0
                      ? `${topic.correctCount} of ${topic.attemptCount} correct (${topic.accuracy}%)`
                      : 'Not yet assessed'}
                  </span>
                </div>

                <div className="flex-1 max-w-md flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-[#EFE8D6] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${topic.statusColor.bar} transition-all duration-300`}
                      style={{ width: `${topic.attemptCount === 0 ? 0 : topic.masteryPercentage}%` }}
                    />
                  </div>
                  <span className="font-bold text-xs text-[#26313D] w-12 text-right">
                    {topic.attemptCount === 0 ? '—' : `${topic.masteryPercentage}%`}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-48">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${topic.statusColor.bg} ${topic.statusColor.text} ${topic.statusColor.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${topic.statusColor.dot}`} />
                    {topic.statusLabel}
                  </span>
                  <Link
                    href={`/assessment?concept=${topic.id}&courseId=${course?.id || ''}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B1A15A] hover:underline"
                  >
                    Practice <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Progress History Section (Simple Chart Showing Actual Mastery Changes After Assessments) */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#DDD6C5]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#B1A15A]" />
            <h4 className="text-sm font-bold text-[#26313D]">Progress History</h4>
          </div>
          <span className="text-xs font-semibold text-[#6F7782]">
            {completedAssessments.length} Completed Session{completedAssessments.length === 1 ? '' : 's'}
          </span>
        </div>

        {completedAssessments.length === 0 ? (
          <div className="text-center py-10 rounded-xl bg-[#FAF5E8] border border-dashed border-[#DDD6C5] p-6 space-y-3">
            <Activity className="w-7 h-7 text-[#B1A15A] mx-auto opacity-60" />
            <h5 className="text-xs font-bold text-[#26313D]">No Assessment History Recorded Yet</h5>
            <p className="text-[11px] text-[#6F7782] max-w-md mx-auto">
              Take your first adaptive diagnostic or practice assessment to generate your cognitive progress curve.
            </p>
            <Link
              href="/assessment"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-1"
            >
              Start First Assessment <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SVG Trend Line Chart */}
            <div className="rounded-xl bg-[#FAF5E8] border border-[#DDD6C5] p-4">
              <div className="flex items-center justify-between text-xs text-[#6F7782] mb-3">
                <span className="font-semibold text-[#26313D]">Assessment Score Trajectory</span>
                <span>Chronological Session Performance</span>
              </div>

              <div className="relative w-full h-[140px] flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="history-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#B1A15A" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#B1A15A" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guidelines at 50% and 80% */}
                  <line x1="20" y1="60" x2="580" y2="60" stroke="#DDD6C5" strokeDasharray="3 3" />
                  <line x1="20" y1="28" x2="580" y2="28" stroke="#DDD6C5" strokeDasharray="3 3" />

                  {/* Points Calculation */}
                  {(() => {
                    const count = completedAssessments.length;
                    const stepX = count > 1 ? 540 / (count - 1) : 0;
                    const points = completedAssessments.map((a, i) => {
                      const score = a.score_percentage ?? 0;
                      // Y ranges from 100 at 0% to 20 at 100%
                      const y = 100 - (score / 100) * 80;
                      const x = count === 1 ? 300 : 30 + i * stepX;
                      return { x, y, score, title: a.title, date: a.started_at };
                    });

                    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
                    const areaPoints = `${points[0].x},110 ${polylinePoints} ${points[points.length - 1].x},110`;

                    return (
                      <>
                        {/* Shaded Area */}
                        {count > 1 && (
                          <polygon points={areaPoints} fill="url(#history-grad)" />
                        )}

                        {/* Connecting Line */}
                        {count > 1 && (
                          <polyline
                            points={polylinePoints}
                            fill="none"
                            stroke="#B1A15A"
                            strokeWidth="2.5"
                          />
                        )}

                        {/* Individual Points and Badges */}
                        {points.map((pt, idx) => (
                          <g key={`pt-${idx}`}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="5"
                              fill="#FFFDF7"
                              stroke={pt.score >= 80 ? '#6D9B73' : pt.score >= 50 ? '#B1A15A' : '#B85C5C'}
                              strokeWidth="2.5"
                            />
                            <text
                              x={pt.x}
                              y={pt.y - 10}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="bold"
                              fill="#26313D"
                            >
                              {pt.score}%
                            </text>
                            <text
                              x={pt.x}
                              y="118"
                              textAnchor="middle"
                              fontSize="9"
                              fill="#6F7782"
                            >
                              {formatRelativeTime(pt.date)}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Recent Sessions List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {completedAssessments.slice(-3).reverse().map((session, idx) => (
                <div
                  key={`session-${session.id || 'item'}-${idx}`}
                  className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#26313D] truncate">{session.title}</span>
                    <span
                      className={`font-black text-xs ${
                        (session.score_percentage ?? 0) >= 80
                          ? 'text-[#6D9B73]'
                          : (session.score_percentage ?? 0) >= 50
                          ? 'text-[#8E7F3B]'
                          : 'text-[#B85C5C]'
                      }`}
                    >
                      {session.score_percentage ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#6F7782]">
                    <span>{session.completed_questions || session.total_questions || 0} questions</span>
                    <span>{formatRelativeTime(session.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
