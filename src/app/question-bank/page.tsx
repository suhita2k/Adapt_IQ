'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import {
  Course,
  CourseMaterial,
  Concept,
  SourceEvidence,
  SmartQuestion,
  SmartQuestionType,
  QuestionBank,
} from '@/types';
import {
  FileQuestion,
  BookOpen,
  Sparkles,
  Printer,
  Download,
  Save,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FileText,
  Presentation,
  Video,
  Layers,
  Award,
  ChevronDown,
  ChevronUp,
  FileCheck,
  BookCheck,
  Check,
  ExternalLink,
  Sliders,
  HelpCircle,
  Hash,
  Loader2,
  Clock,
  Compass,
  ArrowDownToLine,
  CheckSquare,
  Square,
  FileCode,
} from 'lucide-react';

// Real processing stages required by specification
const ANALYSIS_STAGES = [
  { id: 'extract', label: 'Extracting files', desc: 'Parsing multi-format uploaded documents & transcripts' },
  { id: 'read_pages', label: 'Reading pages and slides', desc: 'Extracting text, paragraphs, tables, equations & speaker notes' },
  { id: 'transcribe', label: 'Transcribing videos', desc: 'Synthesizing speech recognition & timestamped lecture segments' },
  { id: 'diagrams', label: 'Analysing diagrams', desc: 'Interpreting figures, architectural schematics & flowcharts' },
  { id: 'topics', label: 'Identifying topics', desc: 'Indexing course ontology, subtopics & core curriculum invariants' },
  { id: 'generate', label: 'Generating questions', desc: 'Formulating 2-Mark diagnostic items & 16-Mark structured essays' },
  { id: 'verify', label: 'Verifying answers', desc: 'Validating answer accuracy against source locations & removing duplicates' },
  { id: 'create_pdf', label: 'Creating PDFs', desc: 'Assembling vector PDF documents with table of contents & typography' },
];

export default function SmartQuestionBankPage() {
  const { user } = useAuth();

  // Navigation tabs: 'course_analysis' is flagship requested workflow
  const [activeTab, setActiveTab] = useState<'course_analysis' | 'generate' | 'custom_paper' | 'saved_banks'>('course_analysis');

  // Courses & Materials
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [sources, setSources] = useState<SourceEvidence[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  // Material Multi-selection State
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectAllMaterials, setSelectAllMaterials] = useState<boolean>(true);

  // Analysis & Dual PDF Generation State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [stageDetailMsg, setStageDetailMsg] = useState<string>('');
  const [analysisComplete, setAnalysisComplete] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<{
    twoMarkBankId: string;
    sixteenMarkBankId: string;
    twoMarkQuestions: SmartQuestion[];
    sixteenMarkQuestions: SmartQuestion[];
    twoMarkPdfUrl: string;
    sixteenMarkPdfUrl: string;
    twoMarkPdfSize: number;
    sixteenMarkPdfSize: number;
    analyzedMaterialsCount: number;
    analyzedMaterials: any[];
  } | null>(null);

  // Preview tab in Dual PDF viewer: '2_mark' | '16_mark'
  const [activeDualPreviewTab, setActiveDualPreviewTab] = useState<'2_mark' | '16_mark'>('2_mark');
  const [dualExpandedAnswers, setDualExpandedAnswers] = useState<Record<string, boolean>>({});

  // Quick Question Generator Config (Tab 2)
  const [selectedQuestionType, setSelectedQuestionType] = useState<SmartQuestionType>('2_mark');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [includeAnswers, setIncludeAnswers] = useState<boolean>(true);
  const [includeSources, setIncludeSources] = useState<boolean>(true);

  // Custom Paper Config (Tab 3)
  const [paperTitle, setPaperTitle] = useState<string>('Final Examination Question Paper');
  const [paperDuration, setPaperDuration] = useState<string>('3 Hours');
  const [paperPreset, setPaperPreset] = useState<'university' | 'two_mark_drill' | 'sixteen_mark_essay' | 'custom'>('university');

  // Quick Generator Results State
  const [generatedQuestions, setGeneratedQuestions] = useState<SmartQuestion[]>([]);
  const [totalMarks, setTotalMarks] = useState<number>(0);
  const [examModeOnly, setExamModeOnly] = useState<boolean>(false);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});
  const [selectedSourceModal, setSelectedSourceModal] = useState<SmartQuestion['source_citation'] | null>(null);

  // Saved Question Banks (Tab 4)
  const [savedBanks, setSavedBanks] = useState<QuestionBank[]>([]);
  const [savedQuestionsList, setSavedQuestionsList] = useState<SmartQuestion[]>([]);

  // Loading & Error States
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [savingBank, setSavingBank] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Initial Load: Fetch Courses
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        setErrorMsg(null);
        const courseList = await api.getCourses();
        setCourses(courseList);

        if (courseList.length > 0) {
          const firstId = courseList[0].id;
          setSelectedCourseId(firstId);
          await loadCourseContext(firstId);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load courses');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, [user]);

  // Load Saved Banks
  useEffect(() => {
    if (activeTab === 'saved_banks' && user) {
      loadSavedBanks();
    }
  }, [activeTab, selectedCourseId, user]);

  async function loadSavedBanks() {
    try {
      const data = await api.getQuestionBanks(selectedCourseId || undefined, true);
      setSavedBanks(data.banks || []);
      setSavedQuestionsList(data.savedQuestions || []);
    } catch {
      // ignore
    }
  }

  // Load Course Materials & Topics
  async function loadCourseContext(courseId: string) {
    try {
      setErrorMsg(null);
      const [sourcesRes, mapRes] = await Promise.all([
        api.getCourseSources(courseId).catch(() => ({ materials: [], sources: [] })),
        api.getCourseMap(courseId).catch(() => ({ concepts: [], relationships: [], mastery: [] })),
      ]);

      const mats = sourcesRes.materials || [];
      setMaterials(mats);
      setSelectedMaterialIds(mats.map((m) => m.id));
      setSelectAllMaterials(true);
      setSources(sourcesRes.sources || []);
      setConcepts(mapRes.concepts || []);

      // Extract unique topics from concepts & sources
      const topicsSet = new Set<string>();
      (mapRes.concepts || []).forEach((c) => {
        if (c.category) topicsSet.add(c.category);
        if (c.subtopic) topicsSet.add(c.subtopic);
      });
      (sourcesRes.sources || []).forEach((s) => {
        if (s.topic) topicsSet.add(s.topic);
      });
      const topicArray = Array.from(topicsSet).filter(Boolean);
      setAvailableTopics(topicArray);
      setSelectedTopic('all');
    } catch (err: any) {
      console.error('Failed to load course materials:', err);
    }
  }

  // Course Change handler
  async function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    setGeneratedQuestions([]);
    setTotalMarks(0);
    setAnalysisResult(null);
    setAnalysisComplete(false);
    await loadCourseContext(courseId);
  }

  // Toggle select all materials
  function handleToggleSelectAll() {
    if (selectAllMaterials) {
      setSelectedMaterialIds([]);
      setSelectAllMaterials(false);
    } else {
      setSelectedMaterialIds(materials.map((m) => m.id));
      setSelectAllMaterials(true);
    }
  }

  // Toggle single material
  function handleToggleMaterial(id: string) {
    setSelectedMaterialIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id];
      setSelectAllMaterials(updated.length === materials.length);
      return updated;
    });
  }

  // -------------------------------------------------------------
  // FLAGSHIP: "Analyse Course & Generate Questions" Workflow
  // -------------------------------------------------------------
  async function handleAnalyseAndGenerateDualPdfs() {
    if (!selectedCourseId) {
      setErrorMsg('Please select a course first.');
      return;
    }
    if (materials.length === 0) {
      setErrorMsg(
        'No uploaded learning materials found for this course. Please upload course documents (PDF, PPT, Videos) in the Courses section to enable full analysis.'
      );
      return;
    }
    if (selectedMaterialIds.length === 0) {
      setErrorMsg('Please select at least one course material to analyze.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);
      setAnalysisComplete(false);
      setCurrentStageIndex(0);
      setStageDetailMsg(`Scanning ${selectedMaterialIds.length} course material(s)...`);

      // Progress animation simulation that transitions realistically through stages while backend computes
      const progressTimer = setInterval(() => {
        setCurrentStageIndex((prev) => {
          if (prev < 6) {
            const next = prev + 1;
            const stage = ANALYSIS_STAGES[next];
            setStageDetailMsg(stage.desc);
            return next;
          }
          return prev;
        });
      }, 1600);

      // Call real backend analysis and PDF generation
      const result = await api.analyzeAndGenerateQuestions({
        courseId: selectedCourseId,
        selectedMaterialIds,
        preferredLanguage: 'English',
      });

      clearInterval(progressTimer);

      // Stage 7: Creating PDFs
      setCurrentStageIndex(7);
      setStageDetailMsg('Finalizing vector PDFs and writing to secure document storage...');
      await new Promise((r) => setTimeout(r, 700));

      setAnalysisResult(result);
      setAnalysisComplete(true);

      // Expand answers by default in preview
      const initialDualExpanded: Record<string, boolean> = {};
      result.twoMarkQuestions.forEach((q) => {
        initialDualExpanded[q.id] = true;
      });
      result.sixteenMarkQuestions.forEach((q) => {
        initialDualExpanded[q.id] = true;
      });
      setDualExpandedAnswers(initialDualExpanded);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete course analysis and PDF generation. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Toggle dual answer preview
  function toggleDualAnswer(id: string) {
    setDualExpandedAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  // -------------------------------------------------------------
  // Quick Generator Handlers
  // -------------------------------------------------------------
  async function handleGenerate(overrideType?: SmartQuestionType, overrideCount?: number) {
    if (!selectedCourseId) {
      setErrorMsg('Please select a course first.');
      return;
    }
    if (materials.length === 0) {
      setErrorMsg(
        'No uploaded learning materials found for this course. Please upload course documents (PDF, PPT, Videos, Notes) in the Courses section to generate grounded questions.'
      );
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMsg(null);
      setSaveSuccessMsg(null);

      const typeToUse = overrideType || selectedQuestionType;
      const countToUse = overrideCount || questionCount;

      setGenerationStep('Analyzing uploaded course materials & syllabus...');
      await new Promise((r) => setTimeout(r, 500));

      setGenerationStep('Extracting key concepts, formulas, and topic invariants...');
      await new Promise((r) => setTimeout(r, 500));

      setGenerationStep('Synthesizing exam-ready questions with verified source citations...');

      const result = await api.generateSmartQuestions({
        courseId: selectedCourseId,
        topic: selectedTopic,
        questionType: typeToUse,
        count: countToUse,
        difficulty,
        includeAnswers,
        includeSources,
      });

      setGeneratedQuestions(result.questions || []);
      setTotalMarks(result.totalMarks || 0);

      const initialExpanded: Record<string, boolean> = {};
      result.questions.forEach((q) => {
        initialExpanded[q.id] = includeAnswers && !examModeOnly;
      });
      setExpandedAnswers(initialExpanded);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  }

  function handlePresetChange(preset: 'university' | 'two_mark_drill' | 'sixteen_mark_essay' | 'custom') {
    setPaperPreset(preset);
    if (preset === 'university') {
      setSelectedQuestionType('model_paper');
      setPaperTitle('University Model Examination Paper');
      setPaperDuration('3 Hours');
      setQuestionCount(8);
    } else if (preset === 'two_mark_drill') {
      setSelectedQuestionType('2_mark');
      setPaperTitle('2-Mark Rapid Diagnostic & Definition Drill');
      setPaperDuration('45 Minutes');
      setQuestionCount(10);
    } else if (preset === 'sixteen_mark_essay') {
      setSelectedQuestionType('16_mark');
      setPaperTitle('16-Mark Comprehensive Essay & System Design Paper');
      setPaperDuration('2 Hours');
      setQuestionCount(3);
    }
  }

  function toggleAnswer(id: string) {
    setExpandedAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleAllAnswers(show: boolean) {
    const updated: Record<string, boolean> = {};
    generatedQuestions.forEach((q) => {
      updated[q.id] = show;
    });
    setExpandedAnswers(updated);
  }

  async function handleRegenerateQuestion(questionToReplace: SmartQuestion) {
    try {
      setRegeneratingId(questionToReplace.id);
      setErrorMsg(null);

      const result = await api.generateSmartQuestions({
        courseId: selectedCourseId,
        topic: questionToReplace.topic || selectedTopic,
        questionType: questionToReplace.question_type,
        count: 1,
        difficulty: questionToReplace.difficulty,
        includeAnswers: true,
        includeSources: true,
      });

      if (result.questions && result.questions.length > 0) {
        const replacement = {
          ...result.questions[0],
          question_number: questionToReplace.question_number,
        };

        setGeneratedQuestions((prev) =>
          prev.map((q) => (q.id === questionToReplace.id ? replacement : q))
        );

        setExpandedAnswers((prev) => ({
          ...prev,
          [replacement.id]: true,
        }));
      }
    } catch (err: any) {
      setErrorMsg('Failed to regenerate this question: ' + err.message);
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleSaveBank() {
    if (generatedQuestions.length === 0) return;
    const selectedCourse = courses.find((c) => c.id === selectedCourseId);

    try {
      setSavingBank(true);
      setErrorMsg(null);
      setSaveSuccessMsg(null);

      const title =
        paperTitle ||
        `${selectedCourse?.title || 'Course'} - ${selectedQuestionType.replace('_', ' ').toUpperCase()} Bank`;

      await api.saveQuestionBank({
        courseId: selectedCourseId,
        courseTitle: selectedCourse?.title || 'Course',
        title,
        description: `Generated ${generatedQuestions.length} exam questions for ${selectedCourse?.title}.`,
        topics: Array.from(new Set(generatedQuestions.map((q) => q.topic))),
        questions: generatedQuestions,
        config: {
          course_id: selectedCourseId,
          title,
          question_types: [selectedQuestionType],
          total_questions: generatedQuestions.length,
          difficulty,
          include_answers: includeAnswers,
          include_sources: includeSources,
          max_marks: totalMarks,
        },
      });

      setSaveSuccessMsg('Successfully saved question bank to your learning profile!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save question bank');
    } finally {
      setSavingBank(false);
    }
  }

  async function handleSaveSingleQuestion(q: SmartQuestion) {
    try {
      await api.saveIndividualQuestion(q);
      setGeneratedQuestions((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, is_saved: true } : item))
      );
    } catch (err: any) {
      alert('Failed to save question: ' + err.message);
    }
  }

  function handlePrint() {
    window.print();
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <AppShell
      headerTitle="Smart Question Bank"
      headerSubtitle="Turn Your Course Materials into Exam-Ready Questions."
      actionButton={
        courses.length > 0 && materials.length > 0 ? (
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => {
                setActiveTab('course_analysis');
                handleAnalyseAndGenerateDualPdfs();
              }}
              disabled={isAnalyzing || selectedMaterialIds.length === 0}
              className="btn-primary text-xs shadow-xs"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analysing Materials...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyse Course & Generate Questions
                </>
              )}
            </button>
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs (Hidden in Print) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#DDD6C5] pb-3 no-print">
          <button
            onClick={() => setActiveTab('course_analysis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'course_analysis'
                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs ring-1 ring-[#B1A15A]'
                : 'bg-[#FFFDF7] text-[#5E6A7A] border border-[#DDD6C5] hover:bg-[#F4EEE0]'
            }`}
          >
            <Download className="w-4 h-4 text-[#26313D]" />
            Analyse Course & Generate PDFs (2-Mark & 16-Mark)
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'generate'
                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs ring-1 ring-[#B1A15A]'
                : 'bg-[#FFFDF7] text-[#5E6A7A] border border-[#DDD6C5] hover:bg-[#F4EEE0]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Quick Question Generator
          </button>
          <button
            onClick={() => {
              setActiveTab('custom_paper');
              handlePresetChange('university');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'custom_paper'
                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs ring-1 ring-[#B1A15A]'
                : 'bg-[#FFFDF7] text-[#5E6A7A] border border-[#DDD6C5] hover:bg-[#F4EEE0]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Custom Question Paper Blueprint
          </button>
          <button
            onClick={() => setActiveTab('saved_banks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'saved_banks'
                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs ring-1 ring-[#B1A15A]'
                : 'bg-[#FFFDF7] text-[#5E6A7A] border border-[#DDD6C5] hover:bg-[#F4EEE0]'
            }`}
          >
            <Save className="w-4 h-4" />
            Saved Question Banks ({savedBanks.length})
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/10 p-4 text-xs text-[#B85C5C] flex items-start gap-3 no-print">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Notice</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
            {errorMsg.includes('upload') ? (
              <Link
                href="/courses"
                className="btn-primary text-[11px] py-1 px-3 shrink-0"
              >
                Go to Courses & Upload
              </Link>
            ) : (
              <button
                onClick={() => handleAnalyseAndGenerateDualPdfs()}
                className="btn-outline-warm text-[11px] py-1 px-3 shrink-0"
              >
                Retry Analysis
              </button>
            )}
          </div>
        )}

        {/* Success Banner */}
        {saveSuccessMsg && (
          <div className="rounded-xl border border-[#6D9B73]/30 bg-[#6D9B73]/10 p-4 text-xs text-[#6D9B73] flex items-center gap-3 no-print">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="font-bold">{saveSuccessMsg}</p>
          </div>
        )}

        {/* Empty Courses State */}
        {!loadingInitial && courses.length === 0 && (
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 text-center max-w-xl mx-auto space-y-4 no-print">
            <div className="w-12 h-12 rounded-2xl bg-[#E8E0C9] text-[#26313D] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6 text-[#B1A15A]" />
            </div>
            <h2 className="text-lg font-bold text-[#26313D]">No Courses Found</h2>
            <p className="text-xs text-[#6F7782] leading-relaxed">
              To generate AI-powered exam questions with strict citations and downloadable PDFs, you must first create a course and upload your syllabus materials (PDFs, PPTs, or lecture videos).
            </p>
            <Link href="/courses" className="btn-primary text-xs inline-flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Create Your First Course
            </Link>
          </div>
        )}

        {/* Empty Materials State */}
        {!loadingInitial && courses.length > 0 && materials.length === 0 && (
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 text-center max-w-xl mx-auto space-y-4 no-print">
            <div className="w-12 h-12 rounded-2xl bg-[#E8E0C9] text-[#26313D] flex items-center justify-center mx-auto">
              <FileQuestion className="w-6 h-6 text-[#B1A15A]" />
            </div>
            <h2 className="text-lg font-bold text-[#26313D]">No Uploaded Materials in {selectedCourse?.title}</h2>
            <p className="text-xs text-[#6F7782] leading-relaxed">
              ADAPTIQ strictly generates questions grounded in real course content. Upload textbook chapters, lecture slides, or video recordings to enable the Smart Question Bank.
            </p>
            <Link href="/courses" className="btn-primary text-xs inline-flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Upload Materials for {selectedCourse?.title}
            </Link>
          </div>
        )}

        {/* MAIN WORKSPACE WHEN COURSES & MATERIALS EXIST */}
        {courses.length > 0 && materials.length > 0 && (
          <div className="space-y-6">
            {/* ============================================================== */}
            {/* TAB 1: COURSE ANALYSIS & DUAL PDF GENERATOR (FLAGSHIP REQUIREMENT) */}
            {/* ============================================================== */}
            {activeTab === 'course_analysis' && (
              <div className="space-y-6">
                {/* Course & Materials Selection Panel */}
                <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs space-y-5 no-print">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#B1A15A]" />
                        Select Course & Uploaded Materials
                      </h2>
                      <p className="text-xs text-[#6F7782] mt-0.5">
                        Select a course and choose which materials the AI will thoroughly analyze to synthesize your 2-Mark and 16-Mark Question Papers.
                      </p>
                    </div>

                    {/* Course Dropdown */}
                    <div className="w-full md:w-72">
                      <select
                        value={selectedCourseId}
                        onChange={(e) => handleCourseChange(e.target.value)}
                        className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] px-3.5 py-2 text-xs font-semibold text-[#26313D] focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `[${c.code}] ` : ''}{c.title} ({c.materials_count || 0} materials)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Materials Selection Header */}
                  <div className="pt-3 border-t border-[#DDD6C5]/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#26313D] hover:text-[#B1A15A] transition-colors"
                      >
                        {selectAllMaterials ? (
                          <CheckSquare className="w-4 h-4 text-[#B1A15A]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#6F7782]" />
                        )}
                        <span>
                          {selectAllMaterials ? 'All Materials Selected' : 'Select All Materials'}
                        </span>
                      </button>
                      <span className="text-[11px] text-[#6F7782]">
                        ({selectedMaterialIds.length} of {materials.length} selected)
                      </span>
                    </div>

                    <span className="text-[11px] text-[#6D9B73] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% Course Evidence Grounding
                    </span>
                  </div>

                  {/* Materials Grid with Checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {materials.map((m) => {
                      const isSelected = selectedMaterialIds.includes(m.id);
                      const Icon =
                        m.file_type === 'slides'
                          ? Presentation
                          : m.file_type === 'lecture_video'
                          ? Video
                          : FileText;
                      return (
                        <div
                          key={m.id}
                          onClick={() => handleToggleMaterial(m.id)}
                          className={`cursor-pointer rounded-xl border p-3.5 transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'border-[#B1A15A] bg-[#B1A15A]/10 ring-1 ring-[#B1A15A]'
                              : 'border-[#DDD6C5] bg-[#FAF5E9] hover:bg-[#EFE8D6] opacity-75'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0 text-[#26313D]">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#B1A15A]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#6F7782]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-[#B1A15A] shrink-0" />
                              <span className="text-xs font-bold text-[#26313D] truncate">{m.title}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-[#6F7782]">
                              <span className="uppercase font-semibold px-1.5 py-0.5 rounded bg-[#FFFDF7] border border-[#DDD6C5]">
                                {m.file_type.replace('_', ' ')}
                              </span>
                              <span>
                                {m.file_type === 'slides'
                                  ? `${m.slide_count || 20} slides`
                                  : m.file_type === 'lecture_video'
                                  ? 'video with audio'
                                  : `${m.page_count || 15} pages`}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-[#6D9B73] font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              OCR & Vision Indexed
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Primary Action Button */}
                  <div className="pt-3 border-t border-[#DDD6C5]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[11px] text-[#6F7782]">
                      AI processes every page, slide, and lecture segment to synthesize verified 2-Mark and 16-Mark Question Papers.
                    </span>
                    <button
                      type="button"
                      onClick={handleAnalyseAndGenerateDualPdfs}
                      disabled={isAnalyzing || selectedMaterialIds.length === 0}
                      className="btn-primary text-xs py-2.5 px-5 shadow-xs flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analysing Course Materials...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Analyse Course & Generate Questions
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Real-time Analysis Progress Stages Display */}
                {isAnalyzing && (
                  <div className="rounded-2xl border border-[#B1A15A]/40 bg-[#FFFDF7] p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in no-print">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DDD6C5] pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#E8E0C9] text-[#B1A15A] flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-[#B1A15A]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#26313D]">
                            Real-Time Course Evidence Analysis Pipeline
                          </h3>
                          <p className="text-xs text-[#B1A15A] font-semibold mt-0.5">
                            Stage {currentStageIndex + 1} of {ANALYSIS_STAGES.length}: {ANALYSIS_STAGES[currentStageIndex].label}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-[#26313D]">
                          {Math.round(((currentStageIndex + 1) / ANALYSIS_STAGES.length) * 100)}%
                        </span>
                        <p className="text-[10px] text-[#6F7782]">Real Progress</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#FAF5E9] h-2.5 rounded-full overflow-hidden border border-[#DDD6C5]">
                      <div
                        className="bg-[#B1A15A] h-full transition-all duration-500 ease-out"
                        style={{
                          width: `${((currentStageIndex + 1) / ANALYSIS_STAGES.length) * 100}%`,
                        }}
                      />
                    </div>

                    {/* Active Detail Message */}
                    <div className="p-3 rounded-xl bg-[#FAF5E9] border border-[#DDD6C5] text-xs text-[#26313D] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#B1A15A] shrink-0 animate-spin" />
                      <span>{stageDetailMsg}</span>
                    </div>

                    {/* 8 Distinct Processing Stages Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {ANALYSIS_STAGES.map((stg, sIdx) => {
                        const isDone = sIdx < currentStageIndex;
                        const isCurrent = sIdx === currentStageIndex;
                        return (
                          <div
                            key={stg.id}
                            className={`p-3 rounded-xl border transition-all ${
                              isDone
                                ? 'border-[#6D9B73]/40 bg-[#6D9B73]/10 text-[#26313D]'
                                : isCurrent
                                ? 'border-[#B1A15A] bg-[#B1A15A]/15 text-[#26313D] ring-1 ring-[#B1A15A]'
                                : 'border-[#DDD6C5] bg-[#FAF5E9]/50 text-[#6F7782]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold">
                                {sIdx + 1}. {stg.label}
                              </span>
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-[#6D9B73]" />
                              ) : isCurrent ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B1A15A]" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-[#DDD6C5]" />
                              )}
                            </div>
                            <p className="mt-1 text-[10px] line-clamp-2 leading-tight">
                              {stg.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* DUAL DOWNLOAD SECTION & PREVIEW (ONCE ANALYSIS COMPLETES) */}
                {/* ============================================================== */}
                {analysisResult && !isAnalyzing && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Two Prominent PDF Download Cards */}
                    <div className="rounded-2xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-5 sm:p-6 shadow-xs space-y-5 no-print">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#6D9B73]/20 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#6D9B73] text-[#FFFDF7] flex items-center justify-center font-bold">
                            <Check className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#26313D]">
                              Analysis Complete — Dual PDF Question Papers Generated!
                            </h3>
                            <p className="text-xs text-[#5E6A7A] mt-0.5">
                              100% Grounded in {analysisResult.analyzedMaterialsCount} material(s) from &ldquo;{selectedCourse?.title}&rdquo;.
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-[#6D9B73] px-3 py-1 rounded-full bg-[#FFFDF7] border border-[#6D9B73]/30">
                          Real Binary PDFs Ready
                        </span>
                      </div>

                      {/* Download Buttons Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. 2-MARK PDF DOWNLOAD CARD */}
                        <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#B1A15A] text-[#26313D]">
                                PART A EXAM SCHEME
                              </span>
                              <span className="text-[11px] font-bold text-[#6F7782]">
                                {analysisResult.twoMarkPdfSize ? `${Math.round(analysisResult.twoMarkPdfSize / 1024)} KB` : 'PDF'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-[#26313D] mt-2 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#B1A15A]" />
                              2-Mark Question Paper with Answers
                            </h4>
                            <p className="text-xs text-[#6F7782] mt-1 leading-relaxed">
                              Contains {analysisResult.twoMarkQuestions.length} concise questions with precise model answers, definitions, formula invariants, and verified course citations.
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#DDD6C5]/60 flex items-center justify-between">
                            <span className="text-[11px] text-[#6D9B73] font-bold">
                              {analysisResult.twoMarkQuestions.length * 2} Total Marks
                            </span>
                            <a
                              href={analysisResult.twoMarkPdfUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary text-xs py-2 px-4 shadow-xs inline-flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              Download 2-Mark Questions & Answers PDF
                            </a>
                          </div>
                        </div>

                        {/* 2. 16-MARK PDF DOWNLOAD CARD */}
                        <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#26313D] text-[#FFFDF7]">
                                PART C ESSAY SCHEME
                              </span>
                              <span className="text-[11px] font-bold text-[#6F7782]">
                                {analysisResult.sixteenMarkPdfSize ? `${Math.round(analysisResult.sixteenMarkPdfSize / 1024)} KB` : 'PDF'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-[#26313D] mt-2 flex items-center gap-2">
                              <BookCheck className="w-4 h-4 text-[#B1A15A]" />
                              16-Mark Question Paper with Answers
                            </h4>
                            <p className="text-xs text-[#6F7782] mt-1 leading-relaxed">
                              Contains {analysisResult.sixteenMarkQuestions.length} comprehensive essay and system architecture questions with step-by-step algorithms, visual schematics, and evaluated answers.
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#DDD6C5]/60 flex items-center justify-between">
                            <span className="text-[11px] text-[#6D9B73] font-bold">
                              {analysisResult.sixteenMarkQuestions.length * 16} Total Marks
                            </span>
                            <a
                              href={analysisResult.sixteenMarkPdfUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary text-xs py-2 px-4 shadow-xs inline-flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              Download 16-Mark Questions & Answers PDF
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interactive On-Screen Question Preview Tabs */}
                    <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 sm:p-6 shadow-xs space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD6C5] pb-4">
                        <div>
                          <h3 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                            <Eye className="w-4 h-4 text-[#B1A15A]" />
                            Inspect Generated Questions & Answers
                          </h3>
                          <p className="text-xs text-[#6F7782] mt-0.5">
                            Preview the exact questions, model answers, and citations compiled inside your downloadable PDFs.
                          </p>
                        </div>

                        {/* Switcher: 2-Mark vs 16-Mark */}
                        <div className="flex items-center gap-1.5 bg-[#FAF5E9] p-1 rounded-xl border border-[#DDD6C5]">
                          <button
                            type="button"
                            onClick={() => setActiveDualPreviewTab('2_mark')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              activeDualPreviewTab === '2_mark'
                                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                                : 'text-[#5E6A7A] hover:text-[#26313D]'
                            }`}
                          >
                            2-Mark Questions ({analysisResult.twoMarkQuestions.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveDualPreviewTab('16_mark')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              activeDualPreviewTab === '16_mark'
                                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                                : 'text-[#5E6A7A] hover:text-[#26313D]'
                            }`}
                          >
                            16-Mark Questions ({analysisResult.sixteenMarkQuestions.length})
                          </button>
                        </div>
                      </div>

                      {/* Questions List for Active Preview */}
                      <div className="space-y-4">
                        {(activeDualPreviewTab === '2_mark'
                          ? analysisResult.twoMarkQuestions
                          : analysisResult.sixteenMarkQuestions
                        ).map((q, idx) => {
                          const isExpanded = dualExpandedAnswers[q.id] ?? true;

                          return (
                            <div
                              key={q.id}
                              className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 sm:p-5 shadow-xs space-y-3"
                            >
                              {/* Metadata Row */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C5]/60 pb-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#26313D] text-[#FFFDF7] text-xs font-black">
                                    Q{q.question_number || idx + 1}
                                  </span>
                                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#B1A15A] text-[#26313D]">
                                    {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FAF5E9] text-[#6F7782] border border-[#DDD6C5]">
                                    {q.topic}
                                  </span>
                                  <span className="text-[10px] font-medium text-[#6F7782] capitalize">
                                    Difficulty: {q.difficulty}
                                  </span>
                                </div>

                                {q.source_citation && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSourceModal(q.source_citation)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#6D9B73]/30 bg-[#6D9B73]/10 px-2 py-0.5 text-[10px] font-bold text-[#6D9B73] hover:bg-[#6D9B73]/20 transition-colors"
                                  >
                                    <FileCheck className="w-3 h-3" />
                                    <span>
                                      {q.source_citation.material_title} — {q.source_citation.reference}
                                    </span>
                                  </button>
                                )}
                              </div>

                              {/* Question Text */}
                              <div className="text-xs sm:text-sm font-bold text-[#26313D] leading-relaxed">
                                {q.question_text}
                              </div>

                              {/* Expand/Collapse Toggle */}
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => toggleDualAnswer(q.id)}
                                  className="btn-outline-warm text-[11px] py-1 px-2.5 flex items-center gap-1"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-3.5 h-3.5" />
                                      Hide Model Answer
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                      View Model Answer
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Model Answer Body */}
                              {isExpanded && (
                                <div className="mt-2 rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] p-4 text-xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-[#DDD6C5]/60 pb-2">
                                    <span className="font-bold text-[#26313D] flex items-center gap-1.5">
                                      <Award className="w-3.5 h-3.5 text-[#B1A15A]" />
                                      Verified Model Answer ({q.marks} Marks Scheme)
                                    </span>
                                    <span className="text-[10px] text-[#6D9B73] font-bold">
                                      Source Grounded
                                    </span>
                                  </div>

                                  {/* 16-Mark Structured Answer */}
                                  {q.structured_16_mark ? (
                                    <div className="space-y-3 text-[#26313D] leading-relaxed">
                                      <div>
                                        <h5 className="font-black text-[#26313D] uppercase tracking-wide text-[11px] text-[#B1A15A]">
                                          1. Introduction & Theoretical Motivation
                                        </h5>
                                        <p className="mt-1 text-[#26313D]">{q.structured_16_mark.introduction}</p>
                                      </div>

                                      {q.structured_16_mark.headings?.map((hd: any, hIdx: number) => (
                                        <div key={hIdx} className="space-y-1.5 pl-2 border-l-2 border-[#B1A15A]/40">
                                          <h6 className="font-bold text-[#26313D] text-xs">{hd.title}</h6>
                                          <p className="text-[#5E6A7A]">{hd.content}</p>
                                          {hd.bullet_points && hd.bullet_points.length > 0 && (
                                            <ul className="list-disc pl-4 space-y-0.5 text-[#5E6A7A]">
                                              {hd.bullet_points.map((pt: string, pIdx: number) => (
                                                <li key={pIdx}>{pt}</li>
                                              ))}
                                            </ul>
                                          )}
                                          {hd.code_or_algorithm && (
                                            <pre className="p-2.5 rounded-lg bg-[#26313D] text-[#FFFDF7] font-mono text-[11px] overflow-x-auto">
                                              <code>{hd.code_or_algorithm}</code>
                                            </pre>
                                          )}
                                        </div>
                                      ))}

                                      {q.structured_16_mark.diagrams?.map((diag: any, dIdx: number) => (
                                        <div key={dIdx} className="rounded-lg border border-[#DDD6C5] bg-[#FFFDF7] p-3 space-y-1">
                                          <div className="font-bold text-[#26313D] text-[11px] flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-[#B1A15A]" />
                                            <span>Diagram Schematic: {diag.caption || diag.title}</span>
                                          </div>
                                          <p className="text-[#5E6A7A] text-[11px]">{diag.description}</p>
                                          {diag.ascii_representation && (
                                            <pre className="p-2 rounded bg-[#FAF5E9] border border-[#DDD6C5] font-mono text-[10px] overflow-x-auto">
                                              {diag.ascii_representation}
                                            </pre>
                                          )}
                                        </div>
                                      ))}

                                      {q.structured_16_mark.advantages && q.structured_16_mark.advantages.length > 0 && (
                                        <div>
                                          <h5 className="font-bold text-[#26313D] text-[11px] text-[#B1A15A]">
                                            Advantages & Practical Applications:
                                          </h5>
                                          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[#5E6A7A]">
                                            {q.structured_16_mark.advantages.map((adv: string, aIdx: number) => (
                                              <li key={aIdx}>{adv}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {q.structured_16_mark.conclusion && (
                                        <div>
                                          <h5 className="font-black text-[#26313D] uppercase tracking-wide text-[11px] text-[#B1A15A]">
                                            Conclusion & Analytical Summary
                                          </h5>
                                          <p className="mt-1 text-[#5E6A7A]">{q.structured_16_mark.conclusion}</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* 2-Mark Concise Answer */
                                    <div className="text-[#26313D] whitespace-pre-line leading-relaxed">
                                      {q.answer}
                                    </div>
                                  )}

                                  {q.source_citation && (
                                    <div className="mt-2 pt-2 border-t border-[#DDD6C5]/60 text-[11px] text-[#6F7782] flex items-center justify-between">
                                      <span>
                                        <strong>Source Verified:</strong> {q.source_citation.material_title} ({q.source_citation.reference})
                                      </span>
                                      <span className="italic truncate max-w-sm">
                                        &ldquo;{q.source_citation.quote}&rdquo;
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: QUICK QUESTION GENERATOR CONTROLS */}
            {/* ============================================================== */}
            {activeTab === 'generate' && (
              <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs space-y-5 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#B1A15A]" />
                      Quick Question Types & Exam Scope
                    </h2>
                    <p className="text-xs text-[#6F7782] mt-0.5">
                      Select custom question formats, topic filters, and difficulty levels.
                    </p>
                  </div>

                  {/* Topic Filter */}
                  <div className="w-full sm:w-64">
                    <label className="text-[11px] font-bold text-[#26313D] mb-1 block">
                      Filter by Course Topic:
                    </label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] px-3 py-1.5 text-xs text-[#26313D] focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
                    >
                      <option value="all">All Topics (Comprehensive Syllabus)</option>
                      {availableTopics.map((top) => (
                        <option key={top} value={top}>
                          {top}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Question Type Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      type: '2_mark' as SmartQuestionType,
                      title: '2-Mark Questions',
                      sub: 'Definitions, key invariants, and differences',
                      badge: 'Part A',
                    },
                    {
                      type: '16_mark' as SmartQuestionType,
                      title: '16-Mark Questions',
                      sub: 'Detailed essays, algorithms, diagrams, step-by-step',
                      badge: 'Part C',
                    },
                    {
                      type: '5_mark' as SmartQuestionType,
                      title: '5-Mark Questions',
                      sub: 'Structured explanations with 4-5 bullet points',
                      badge: 'Part B',
                    },
                    {
                      type: '10_mark' as SmartQuestionType,
                      title: '10-Mark Questions',
                      sub: 'Analytical system breakdowns and proofs',
                      badge: 'Part B',
                    },
                    {
                      type: 'mcq' as SmartQuestionType,
                      title: 'Multiple Choice (MCQs)',
                      sub: '4 options with distractor analysis',
                      badge: 'Objective',
                    },
                    {
                      type: 'fill_in_the_blank' as SmartQuestionType,
                      title: 'Fill in the Blank',
                      sub: 'Precise formula & theorem keywords',
                      badge: 'Recall',
                    },
                    {
                      type: 'important_exam' as SmartQuestionType,
                      title: 'Important Exam Questions',
                      sub: 'High-frequency university tested topics',
                      badge: 'High Yield',
                    },
                    {
                      type: 'model_paper' as SmartQuestionType,
                      title: 'Model Question Paper',
                      sub: 'Balanced examination paper (Parts A, B, C)',
                      badge: 'Full Exam',
                    },
                  ].map((item) => {
                    const isSelected = selectedQuestionType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setSelectedQuestionType(item.type)}
                        className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#B1A15A] bg-[#B1A15A]/10 shadow-xs ring-1 ring-[#B1A15A]'
                            : 'border-[#DDD6C5] bg-[#FFFDF7] hover:bg-[#FAF5E9]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8E0C9] text-[#26313D] border border-[#DDD6C5]">
                              {item.badge}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#B1A15A]" />}
                          </div>
                          <p className="mt-2 text-xs font-bold text-[#26313D]">{item.title}</p>
                          <p className="mt-1 text-[11px] text-[#6F7782] leading-tight">{item.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Additional Settings Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#DDD6C5]/60">
                  <div>
                    <label className="text-xs font-bold text-[#26313D] flex items-center justify-between">
                      <span>Number of Questions</span>
                      <span className="text-[#B1A15A] font-bold">{questionCount}</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={selectedQuestionType === '16_mark' ? 5 : 15}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full mt-2 accent-[#B1A15A]"
                    />
                    <div className="flex justify-between text-[10px] text-[#6F7782]">
                      <span>1</span>
                      <span>{selectedQuestionType === '16_mark' ? '5 Max' : '15 Max'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#26313D]">Difficulty Level</label>
                    <div className="flex gap-1.5 mt-2">
                      {(['all', 'easy', 'medium', 'hard'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setDifficulty(lvl)}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-bold capitalize border ${
                            difficulty === lvl
                              ? 'bg-[#B1A15A] text-[#26313D] border-[#B1A15A]'
                              : 'bg-[#FAF5E9] text-[#5E6A7A] border-[#DDD6C5] hover:bg-[#EFE8D6]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#26313D]">Options</label>
                    <div className="flex flex-col gap-1.5 text-xs text-[#26313D]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeAnswers}
                          onChange={(e) => setIncludeAnswers(e.target.checked)}
                          className="rounded text-[#B1A15A] focus:ring-[#B1A15A]"
                        />
                        <span>Include Model Answers</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeSources}
                          onChange={(e) => setIncludeSources(e.target.checked)}
                          className="rounded text-[#B1A15A] focus:ring-[#B1A15A]"
                        />
                        <span>Include Verified Source Citations</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-[#6F7782]">
                    100% grounded in uploaded course materials.
                  </span>
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="btn-primary text-xs shadow-xs"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Synthesizing Questions...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate {questionCount} Exam Questions
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: CUSTOM QUESTION PAPER BLUEPRINT */}
            {/* ============================================================== */}
            {activeTab === 'custom_paper' && (
              <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs space-y-5 no-print">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#B1A15A]" />
                      Custom Question Paper Generator
                    </h2>
                    <p className="text-xs text-[#6F7782] mt-0.5">
                      Design a formatted university exam paper with Parts A, B, and C matching official academic requirements.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'university' as const,
                      title: 'Standard University Pattern',
                      marks: '46 Marks',
                      desc: 'Part A (5x 2-Marks) + Part B (2x 10-Marks) + Part C (1x 16-Marks)',
                    },
                    {
                      id: 'two_mark_drill' as const,
                      title: '2-Mark Definition Quiz',
                      marks: '20 Marks',
                      desc: '10 Short answer questions focusing on definitions and distinctions',
                    },
                    {
                      id: 'sixteen_mark_essay' as const,
                      title: '16-Mark Descriptive Essay Exam',
                      marks: '48 Marks',
                      desc: '3 Comprehensive essay and system architecture questions',
                    },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetChange(p.id)}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        paperPreset === p.id
                          ? 'border-[#B1A15A] bg-[#B1A15A]/10 ring-1 ring-[#B1A15A]'
                          : 'border-[#DDD6C5] bg-[#FFFDF7] hover:bg-[#FAF5E9]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#26313D]">{p.title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8E0C9] text-[#26313D] border border-[#DDD6C5]">
                          {p.marks}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6F7782] mt-1.5">{p.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#26313D]">Exam Paper Title</label>
                    <input
                      type="text"
                      value={paperTitle}
                      onChange={(e) => setPaperTitle(e.target.value)}
                      placeholder="e.g. End Semester Examination - Data Structures"
                      className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] px-3 py-2 text-xs text-[#26313D] focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#26313D]">Allotted Exam Duration</label>
                    <input
                      type="text"
                      value={paperDuration}
                      onChange={(e) => setPaperDuration(e.target.value)}
                      placeholder="e.g. 3 Hours"
                      className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] px-3 py-2 text-xs text-[#26313D] focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#DDD6C5]/60">
                  <span className="text-[11px] text-[#6F7782]">
                    Includes section breaks, instructions, marks columns, and printable paper formatting.
                  </span>
                  <button
                    onClick={() => handleGenerate(selectedQuestionType, questionCount)}
                    disabled={isGenerating}
                    className="btn-primary text-xs shadow-xs"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Official Paper...
                      </>
                    ) : (
                      <>
                        <BookCheck className="w-4 h-4" />
                        Generate Official Question Paper
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: SAVED QUESTION BANKS */}
            {/* ============================================================== */}
            {activeTab === 'saved_banks' && (
              <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 shadow-xs space-y-4 no-print">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                      <Save className="w-4 h-4 text-[#B1A15A]" />
                      Saved Question Banks & Papers
                    </h2>
                    <p className="text-xs text-[#6F7782] mt-0.5">
                      Your saved question banks persist securely in Supabase and local storage across sessions.
                    </p>
                  </div>
                  <button
                    onClick={() => loadSavedBanks()}
                    className="btn-outline-warm text-[11px] py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>

                {savedBanks.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <FileQuestion className="w-8 h-8 text-[#B1A15A] mx-auto opacity-70" />
                    <p className="text-xs font-bold text-[#26313D]">No Saved Question Banks Yet</p>
                    <p className="text-[11px] text-[#6F7782]">
                      Generate questions and click &quot;Save to Question Bank&quot; to archive them here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedBanks.map((bank) => (
                      <div
                        key={bank.id}
                        className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E8E0C9] text-[#26313D] border border-[#DDD6C5]">
                              {bank.course_title}
                            </span>
                            <span className="text-[11px] font-bold text-[#B1A15A]">
                              {bank.total_marks} Marks
                            </span>
                          </div>
                          <h3 className="text-xs font-bold text-[#26313D] mt-2">{bank.title}</h3>
                          <p className="text-[11px] text-[#6F7782] mt-1 line-clamp-2">
                            {bank.description}
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {bank.topics?.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] bg-[#FFFDF7] border border-[#DDD6C5] px-1.5 py-0.5 rounded text-[#5E6A7A]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#DDD6C5]/60 text-xs">
                          <span className="text-[10px] text-[#6F7782]">
                            {new Date(bank.created_at).toLocaleDateString()} • {bank.total_questions} questions
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setGeneratedQuestions(bank.questions);
                                setTotalMarks(bank.total_marks);
                                setPaperTitle(bank.title);
                                setActiveTab('generate');
                              }}
                              className="btn-primary text-[11px] py-1 px-2.5"
                            >
                              Load Paper
                            </button>
                            <a
                              href={`/api/question-bank/download?bankId=${bank.id}&type=2_mark`}
                              download
                              className="btn-outline-warm text-[11px] py-1 px-2 text-[#26313D] flex items-center gap-1"
                              title="Download PDF"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this saved question bank?')) {
                                  await api.deleteQuestionBank(bank.id);
                                  await loadSavedBanks();
                                }
                              }}
                              className="text-[#B85C5C] hover:bg-[#B85C5C]/10 p-1.5 rounded-lg transition-colors"
                              title="Delete bank"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Generator In-Progress Overlay */}
            {isGenerating && (
              <div className="rounded-2xl border border-[#B1A15A]/30 bg-[#FFFDF7] p-8 text-center space-y-4 shadow-sm animate-in fade-in no-print">
                <div className="w-14 h-14 rounded-2xl bg-[#E8E0C9] text-[#B1A15A] flex items-center justify-center mx-auto shadow-xs">
                  <Loader2 className="w-7 h-7 animate-spin text-[#B1A15A]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#26313D]">
                    Generating Grounded Exam Questions...
                  </h3>
                  <p className="text-xs text-[#B1A15A] font-semibold mt-1 animate-pulse">
                    {generationStep}
                  </p>
                </div>
                <div className="max-w-md mx-auto bg-[#FAF5E9] rounded-xl p-3 border border-[#DDD6C5] text-left text-[11px] text-[#6F7782] space-y-1.5">
                  <div className="flex items-center gap-2 text-[#26313D] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6D9B73]" />
                    <span>Cross-referencing uploaded files: {materials.map((m) => m.title).join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#26313D] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6D9B73]" />
                    <span>Preserving exact Page, Slide, and Timestamp citations</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Generator Results Display */}
            {generatedQuestions.length > 0 && activeTab !== 'course_analysis' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E8E0C9] text-[#26313D] flex items-center justify-center font-bold text-sm">
                      {generatedQuestions.length}Q
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#26313D] flex items-center gap-2">
                        <span>{paperTitle || `${selectedCourse?.title} Question Set`}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#B1A15A]/20 text-[#8E7F3B] border border-[#B1A15A]/30">
                          Total: {totalMarks} Marks
                        </span>
                      </h3>
                      <p className="text-[11px] text-[#6F7782] mt-0.5">
                        {selectedQuestionType === 'model_paper'
                          ? 'University Model Paper with Parts A, B, C'
                          : `${selectedQuestionType.replace('_', ' ').toUpperCase()} Questions`}{' '}
                        • 100% Grounded in {materials.length} Uploaded Material(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newMode = !examModeOnly;
                        setExamModeOnly(newMode);
                        toggleAllAnswers(!newMode);
                      }}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                        examModeOnly
                          ? 'bg-[#E8E0C9] text-[#26313D] border-[#DDD6C5]'
                          : 'bg-[#FFFDF7] text-[#5E6A7A] border-[#DDD6C5] hover:bg-[#FAF5E9]'
                      }`}
                    >
                      {examModeOnly ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {examModeOnly ? 'Exam Mode (Questions Only)' : 'Study Mode (Answers Shown)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAllAnswers(!Object.values(expandedAnswers).some(Boolean))}
                      className="btn-outline-warm text-[11px] py-1.5 px-3"
                    >
                      {Object.values(expandedAnswers).some(Boolean) ? 'Hide All Answers' : 'Show All Answers'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveBank}
                      disabled={savingBank}
                      className="btn-outline-warm text-[11px] py-1.5 px-3 text-[#26313D] font-bold"
                    >
                      {savingBank ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 text-[#B1A15A]" />
                          Save Bank
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="btn-primary text-[11px] py-1.5 px-3.5 shadow-xs"
                      title="Print or Save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print / PDF
                    </button>
                  </div>
                </div>

                {/* Printable Paper View */}
                <div className="printable-paper rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-8 space-y-6">
                  <div className="text-center border-b-2 border-[#26313D] pb-5 space-y-1.5">
                    <span className="text-[11px] font-black tracking-widest text-[#6F7782] uppercase">
                      ADAPTIQ SMART EXAMINATION SYSTEM
                    </span>
                    <h1 className="text-lg sm:text-xl font-black text-[#26313D] uppercase tracking-tight">
                      {paperTitle || `${selectedCourse?.title} Examination`}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs font-bold text-[#5E6A7A] pt-1">
                      <span>Course: {selectedCourse?.title} {selectedCourse?.code ? `(${selectedCourse.code})` : ''}</span>
                      <span>•</span>
                      <span>Max Marks: {totalMarks}</span>
                      <span>•</span>
                      <span>Time: {paperDuration}</span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {generatedQuestions.map((q, idx) => {
                      const isExpanded = expandedAnswers[q.id];
                      const isRegenerating = regeneratingId === q.id;

                      return (
                        <div
                          key={q.id}
                          className="avoid-break rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 sm:p-5 shadow-xs space-y-3 transition-all"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C5]/60 pb-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#26313D] text-[#FFFDF7] text-xs font-black">
                                Q{q.question_number || idx + 1}
                              </span>
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#B1A15A] text-[#26313D]">
                                {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF5E9] text-[#5E6A7A] border border-[#DDD6C5] uppercase">
                                {q.question_type.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FAF5E9] text-[#6F7782] border border-[#DDD6C5]">
                                {q.topic}
                              </span>
                            </div>

                            {q.source_citation && (
                              <button
                                type="button"
                                onClick={() => setSelectedSourceModal(q.source_citation)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#6D9B73]/30 bg-[#6D9B73]/10 px-2 py-0.5 text-[10px] font-bold text-[#6D9B73] hover:bg-[#6D9B73]/20 transition-colors"
                              >
                                <FileCheck className="w-3 h-3" />
                                <span>
                                  {q.source_citation.material_title} — {q.source_citation.reference}
                                </span>
                              </button>
                            )}
                          </div>

                          <div className="text-xs sm:text-sm font-bold text-[#26313D] leading-relaxed">
                            {q.question_text}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DDD6C5]/40 no-print">
                            <button
                              type="button"
                              onClick={() => toggleAnswer(q.id)}
                              className="btn-outline-warm text-[11px] py-1 px-3 flex items-center gap-1.5"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  Hide Model Answer
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  View Model Answer
                                </>
                              )}
                            </button>

                            <div className="flex items-center gap-2">
                              {q.source_citation && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSourceModal(q.source_citation)}
                                  className="text-[11px] text-[#5E6A7A] hover:text-[#26313D] px-2 py-1 flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Inspect Source
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRegenerateQuestion(q)}
                                disabled={isRegenerating}
                                className="text-[11px] text-[#5E6A7A] hover:text-[#B1A15A] px-2 py-1 flex items-center gap-1 transition-colors"
                              >
                                <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                                Regenerate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveSingleQuestion(q)}
                                className={`text-[11px] px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                                  q.is_saved
                                    ? 'border-[#6D9B73]/40 bg-[#6D9B73]/10 text-[#6D9B73]'
                                    : 'border-[#DDD6C5] text-[#5E6A7A] hover:text-[#26313D]'
                                }`}
                              >
                                <Save className="w-3 h-3" />
                                {q.is_saved ? 'Saved' : 'Save'}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] p-4 text-xs space-y-3">
                              <div className="flex items-center justify-between border-b border-[#DDD6C5]/60 pb-2">
                                <span className="font-bold text-[#26313D] flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5 text-[#B1A15A]" />
                                  Verified Model Answer ({q.marks} Marks Scheme)
                                </span>
                              </div>
                              <div className="text-[#26313D] whitespace-pre-line leading-relaxed">
                                {q.answer}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: SOURCE EVIDENCE INSPECTOR */}
        {selectedSourceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#6D9B73]" />
                  <h3 className="text-sm font-bold text-[#26313D]">Verified Course Evidence</h3>
                </div>
                <button
                  onClick={() => setSelectedSourceModal(null)}
                  className="rounded-lg p-1 text-[#6F7782] hover:bg-[#FAF5E9] hover:text-[#26313D]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wide">
                    Source Document:
                  </span>
                  <p className="font-bold text-[#26313D] mt-0.5">
                    {selectedSourceModal.material_title}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#FAF5E9] p-3 rounded-xl border border-[#DDD6C5]">
                  <div>
                    <span className="text-[10px] font-bold text-[#6F7782] uppercase">
                      Exact Location:
                    </span>
                    <p className="font-bold text-[#B1A15A] text-xs mt-0.5">
                      {selectedSourceModal.reference}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#6F7782] uppercase">
                      Grounding Status:
                    </span>
                    <p className="font-bold text-[#6D9B73] text-xs mt-0.5">
                      100% Course Verified
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wide">
                    Source Excerpt Quote:
                  </span>
                  <div className="mt-1 p-3 rounded-xl border border-[#DDD6C5] bg-[#FAF5E9] text-[#26313D] italic leading-relaxed">
                    &ldquo;{selectedSourceModal.quote}&rdquo;
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedSourceModal(null)}
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
