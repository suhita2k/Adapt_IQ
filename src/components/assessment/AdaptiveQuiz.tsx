'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Award,
  Sparkles,
  HelpCircle,
  Clock,
  Loader2,
  FileQuestion,
  Edit3,
  Check,
  FolderOpen,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  Lightbulb,
  AlertCircle,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { Course, Question, QuestionOption } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

interface EvaluationResultItem {
  question_id: string;
  question_text: string;
  question_type: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  source_citation?: {
    material_title: string;
    reference: string;
    quote: string;
  };
}

const QUESTION_TYPES = [
  { id: 'mcq', label: 'MCQ (Multiple Choice)', desc: 'Standard 4-option questions with randomized distractors' },
  { id: 'fill_in_the_blank', label: 'Fill in the Blanks', desc: 'Exact recall of key terms and concepts' },
  { id: 'short_answer', label: 'Short Answer', desc: 'Conceptual explanations and reasoning' },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced combination of all question formats' },
];

const DIFFICULTY_LEVELS = [
  { id: 'easy', label: 'Easy', desc: 'Recall and foundational definitions' },
  { id: 'medium', label: 'Medium', desc: 'Concept application and problem-solving' },
  { id: 'hard', label: 'Hard', desc: 'Analysis, edge cases, and proofs' },
  { id: 'mixed', label: 'Mixed', desc: 'Even blend across all cognitive levels' },
];

const QUESTION_COUNTS = [5, 10, 20];

export default function AdaptiveQuiz({ courseId }: { courseId?: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();

  // Workflow State: 'config' | 'loading' | 'active' | 'results'
  const [assessmentState, setAssessmentState] = useState<'config' | 'loading' | 'active' | 'results'>('config');

  // Step 1: Configuration Form State (All fields empty and unselected by default)
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedCountOption, setSelectedCountOption] = useState<number | 'custom' | null>(null);
  const [customCountValue, setCustomCountValue] = useState<string>('');

  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [configValidationError, setConfigValidationError] = useState<string | null>(null);

  // Step 2 & 3: Assessment Execution State
  const [assessmentId, setAssessmentId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Step 5: Evaluation & Results State
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResultItem[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalPercentage, setFinalPercentage] = useState(0);

  // 1. Fetch user's actual courses on mount
  useEffect(() => {
    if (!user) return;
    setIsLoadingCourses(true);
    api.getCourses()
      .then((userCourses) => {
        setCourses(userCourses || []);
        // Note: Do NOT preselect any course!
      })
      .catch((err) => {
        console.warn('Failed to load courses:', err);
      })
      .finally(() => {
        setIsLoadingCourses(false);
      });
  }, [user]);

  // 2. Fetch topics when user manually chooses a course
  useEffect(() => {
    if (!user || !selectedCourseId) {
      setAvailableTopics([]);
      setSelectedTopic(null);
      return;
    }

    setIsLoadingTopics(true);
    api.getCourseDetails(selectedCourseId)
      .then((data) => {
        const concepts = data.concepts || [];
        const distinct = Array.from(
          new Set(
            concepts
              .map((c) => c.category)
              .filter((cat): cat is string => Boolean(cat) && cat !== 'Core' && cat !== 'General')
          )
        );
        setAvailableTopics(distinct);
      })
      .catch(() => {
        setAvailableTopics([]);
      })
      .finally(() => {
        setIsLoadingTopics(false);
      });
  }, [user, selectedCourseId]);

  // Handle Start Assessment (Step 1 -> Step 2)
  const handleStartAssessment = async () => {
    setConfigValidationError(null);

    // Validate all mandatory fields
    const missing: string[] = [];
    if (!selectedCourseId) missing.push('Course/Subject');
    if (!selectedQuestionType) missing.push('Question Type');
    if (!selectedTopic) missing.push('Topic');
    if (!selectedDifficulty) missing.push('Difficulty');
    if (!selectedCountOption) {
      missing.push('Number of Questions');
    } else if (selectedCountOption === 'custom') {
      const parsed = parseInt(customCountValue, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        missing.push('Valid custom question count (between 1 and 50)');
      }
    }

    if (missing.length > 0) {
      setConfigValidationError(`Please select all mandatory fields before starting: ${missing.join(', ')}.`);
      return;
    }

    const questionCountNumber =
      selectedCountOption === 'custom' ? parseInt(customCountValue, 10) : Number(selectedCountOption);

    // Transition to loading state
    setAssessmentState('loading');
    setGenerationError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers({});
    setEvaluationResults([]);

    try {
      const res = await api.generateAssessmentDetailed({
        courseId: selectedCourseId!,
        questionType: selectedQuestionType!,
        topic: selectedTopic === 'All Topics' ? undefined : selectedTopic!,
        difficulty: selectedDifficulty!,
        count: questionCountNumber,
        language: profile?.preferred_language || 'English',
      } as any);

      if (res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
        setAssessmentId(res.assessment_id || `as-${Date.now()}`);
        setAssessmentState('active');
      } else {
        setGenerationError(
          res.message ||
            'No learning content could be extracted from this course. Please verify that course documents have readable text and retry.'
        );
      }
    } catch (err: any) {
      console.error('Question generation failed:', err);
      setGenerationError(
        err?.message ||
          'Failed to generate questions dynamically. Please ensure course materials (PDF, PPT, video) are uploaded and processed.'
      );
    }
  };

  // Submit Answer to Whole Assessment (Step 5)
  const handleSubmitAssessment = async () => {
    if (!selectedCourseId || !assessmentId || isSubmittingAssessment) return;

    setIsSubmittingAssessment(true);
    try {
      const evalResponse = await api.evaluateAssessment({
        assessmentId,
        courseId: selectedCourseId,
        answers: userAnswers,
      });

      setFinalScore(evalResponse.score);
      setFinalTotal(evalResponse.total);
      setFinalPercentage(evalResponse.percentage);
      setEvaluationResults(evalResponse.results || []);
      setAssessmentState('results');

      if (evalResponse.percentage >= 70) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    } catch (err: any) {
      console.error('Assessment evaluation error:', err);
      alert(err?.message || 'Failed to evaluate assessment. Please try again.');
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleResetToConfig = () => {
    setAssessmentState('config');
    setSelectedCourseId(null);
    setSelectedQuestionType(null);
    setSelectedTopic(null);
    setSelectedDifficulty(null);
    setSelectedCountOption(null);
    setCustomCountValue('');
    setConfigValidationError(null);
    setGenerationError(null);
    setQuestions([]);
    setUserAnswers({});
    setEvaluationResults([]);
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  // ===========================================================================
  // RENDER: STEP 1 — ASK USER PREFERENCES FIRST (CONFIGURATION FORM)
  // ===========================================================================
  if (assessmentState === 'config') {
    return (
      <div className="space-y-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFDF7] border border-[#DDD6C5] shadow-xs">
            <SlidersHorizontal className="h-6 w-6 text-[#B1A15A]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#26313D] tracking-tight">
            Configure Adaptive Assessment
          </h2>
          <p className="text-xs sm:text-sm text-[#6F7782] max-w-md mx-auto">
            Choose your assessment parameters. Questions will be verified and generated directly from your uploaded course content.
          </p>
        </div>

        {/* Configuration Card */}
        <div className="rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-10 space-y-8 shadow-xs">
          {/* Section 1: Course / Subject */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#B1A15A]" />
                1. Select Course / Subject
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Mandatory</span>
            </label>

            {isLoadingCourses ? (
              <div className="flex items-center gap-2 p-4 text-xs text-[#5E6A7A]">
                <Loader2 className="w-4 h-4 animate-spin text-[#B1A15A]" />
                <span>Loading your created courses...</span>
              </div>
            ) : courses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FAF5E8] p-6 text-center space-y-3">
                <FolderOpen className="w-8 h-8 text-[#B1A15A] mx-auto" />
                <p className="text-xs font-semibold text-[#26313D]">No courses created yet.</p>
                <p className="text-[11px] text-[#6F7782]">Please create a course and upload learning materials first.</p>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Go to Courses
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {courses.map((course) => {
                  const isSelected = selectedCourseId === course.id;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setConfigValidationError(null);
                      }}
                      className={`rounded-xl border p-3.5 text-left transition-all flex items-start justify-between ${
                        isSelected
                          ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                          : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-[#26313D]">{course.title}</p>
                        <p className="text-[11px] text-[#6F7782] line-clamp-1 mt-0.5">
                          {course.description || course.code || 'Uploaded course syllabus'}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#26313D] shrink-0 mt-0.5 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Question Type */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-[#B1A15A]" />
                2. Select Question Type
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Mandatory</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUESTION_TYPES.map((type) => {
                const isSelected = selectedQuestionType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedQuestionType(type.id);
                      setConfigValidationError(null);
                    }}
                    className={`rounded-xl border p-3.5 text-left transition-all flex items-start justify-between ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-[#26313D]">{type.label}</p>
                      <p className="text-[11px] text-[#6F7782] mt-0.5">{type.desc}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#26313D] shrink-0 mt-0.5 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Topic */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#B1A15A]" />
                3. Select Topic
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Mandatory</span>
            </label>

            {!selectedCourseId ? (
              <p className="text-xs text-[#6F7782] italic">Please select a course first to view its topics.</p>
            ) : isLoadingTopics ? (
              <div className="flex items-center gap-2 p-3 text-xs text-[#5E6A7A]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B1A15A]" />
                <span>Extracting topics from course materials...</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* All Topics option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopic('All Topics');
                    setConfigValidationError(null);
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedTopic === 'All Topics'
                      ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                      : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                  }`}
                >
                  <span>All Topics</span>
                  {selectedTopic === 'All Topics' && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
                </button>

                {availableTopics.map((topic) => {
                  const isSelected = selectedTopic === topic;
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(topic);
                        setConfigValidationError(null);
                      }}
                      className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                          : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                      }`}
                    >
                      <span>{topic}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Difficulty */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#B1A15A]" />
                4. Select Difficulty
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Mandatory</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DIFFICULTY_LEVELS.map((diff) => {
                const isSelected = selectedDifficulty === diff.id;
                return (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => {
                      setSelectedDifficulty(diff.id);
                      setConfigValidationError(null);
                    }}
                    className={`rounded-xl border p-3 text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span className="font-bold text-xs">{diff.label}</span>
                    <span className="text-[10px] text-[#6F7782] line-clamp-1">{diff.desc}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D] mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Number of Questions */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#26313D] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#B1A15A]" />
                5. Number of Questions
              </span>
              <span className="text-xs font-normal text-[#6F7782]">Mandatory</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {QUESTION_COUNTS.map((count) => {
                const isSelected = selectedCountOption === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setSelectedCountOption(count);
                      setConfigValidationError(null);
                    }}
                    className={`rounded-xl border p-3 text-center transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                    }`}
                  >
                    <span className="font-bold text-xs">{count} Questions</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
                  </button>
                );
              })}

              {/* Custom Number Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCountOption('custom');
                  setConfigValidationError(null);
                }}
                className={`rounded-xl border p-3 text-center transition-all flex items-center justify-center gap-1.5 ${
                  selectedCountOption === 'custom'
                    ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs ring-2 ring-[#B1A15A]'
                    : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A] hover:text-[#26313D]'
                }`}
              >
                <span className="font-bold text-xs">Custom</span>
                {selectedCountOption === 'custom' && <CheckCircle2 className="w-3.5 h-3.5 text-[#26313D]" />}
              </button>
            </div>

            {selectedCountOption === 'custom' && (
              <div className="pt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={customCountValue}
                  onChange={(e) => setCustomCountValue(e.target.value)}
                  placeholder="Enter number (1 - 50)..."
                  className="w-48 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-3.5 py-2 text-xs font-bold text-[#26313D] placeholder-[#6F7782] focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
                />
                <span className="text-xs text-[#6F7782]">Max 50 questions</span>
              </div>
            )}
          </div>

          {/* Validation Alert */}
          {configValidationError && (
            <div
              role="alert"
              className="rounded-2xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-4 text-xs text-[#B85C5C] flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B85C5C] mt-0.5" />
              <div>
                <p className="font-bold">Required Preferences Missing</p>
                <p className="mt-0.5 opacity-90">{configValidationError}</p>
              </div>
            </div>
          )}

          {/* Action Button: Start Assessment */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartAssessment}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-3.5 text-xs sm:text-sm font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              <span>Start Assessment</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: STEP 2 — GENERATING QUESTIONS
  // ===========================================================================
  if (assessmentState === 'loading') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-4 shadow-xs">
          {generationError ? (
            <>
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[#B85C5C]/10 border border-[#B85C5C]/30">
                <AlertCircle className="w-7 h-7 text-[#B85C5C]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-[#26313D]">Unable to Generate Questions</h4>
                <p className="text-xs text-[#6F7782] max-w-md mx-auto leading-relaxed">{generationError}</p>
              </div>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetToConfig}
                  className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] hover:bg-[#E8E0C9] px-4 py-2 text-xs font-bold text-[#26313D] transition-colors"
                >
                  Back to Configuration
                </button>
                <Link
                  href="/courses"
                  className="rounded-xl bg-[#B1A15A] hover:bg-[#9E8F4B] px-4 py-2 text-xs font-bold text-[#26313D] transition-colors"
                >
                  Upload Course Materials
                </Link>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-[#B1A15A] mx-auto" />
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-[#26313D]">
                  Analyzing Course Content & Generating Questions...
                </h4>
                <p className="text-xs text-[#6F7782] max-w-md mx-auto leading-relaxed">
                  Extracting grounded questions from{' '}
                  <strong className="text-[#26313D]">{activeCourse?.title || 'the selected course'}</strong> materials.
                  Every question and distractor is being verified against source citations.
                </p>
              </div>
              <div className="pt-2 text-[11px] text-[#5E6A7A] font-medium">
                <span>Shuffling options independently • Securing answer key</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: STEP 3 — CLEAN ASSESSMENT SCREEN (NO EXTRA CARDS OR CITATIONS WHILE ANSWERING)
  // ===========================================================================
  if (assessmentState === 'active') {
    const currentQ = questions[currentIndex];
    const totalQ = questions.length;
    const progressPercent = Math.round(((currentIndex + 1) / totalQ) * 100);
    const selectedAnswerVal = userAnswers[currentQ?.id] || '';
    const isLastQuestion = currentIndex === totalQ - 1;

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Progress & Question Counter Header */}
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#26313D]">
            <span className="rounded-lg bg-[#E8E0C9] px-3 py-1 border border-[#DDD6C5]">
              Question {currentIndex + 1} of {totalQ}
            </span>
            <span className="text-xs text-[#6F7782] font-semibold">
              {Object.keys(userAnswers).length} of {totalQ} answered
            </span>
          </div>

          {/* Clean Progress Bar */}
          <div className="w-full bg-[#FAF5E8] h-1.5 rounded-full overflow-hidden border border-[#DDD6C5]/50">
            <div
              className="bg-[#B1A15A] h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Clean Question Card: Question text and answer inputs ONLY */}
        <div className="rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-10 space-y-6 shadow-xs">
          {/* Question Text */}
          <h3 className="text-base sm:text-xl font-bold text-[#26313D] leading-snug">
            {currentQ.question_text}
          </h3>

          {/* Code Snippet (if question contains code) */}
          {currentQ.code_snippet && (
            <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 overflow-x-auto font-mono text-xs text-[#26313D]">
              <pre>{currentQ.code_snippet}</pre>
            </div>
          )}

          {/* MCQ Option Choices */}
          {(!currentQ.question_type || currentQ.question_type === 'mcq') && (
            <div className="space-y-3 pt-2">
              {currentQ.options.map((opt, optIndex) => {
                const optLetter = String.fromCharCode(65 + optIndex);
                const isSelected = selectedAnswerVal === opt.id || selectedAnswerVal === opt.text;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setUserAnswers((prev) => ({
                        ...prev,
                        [currentQ.id]: opt.id,
                      }));
                    }}
                    className={`w-full text-left rounded-xl border p-4 text-xs sm:text-sm font-medium transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'border-2 border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                        : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#26313D] hover:border-[#B1A15A]'
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                        isSelected
                          ? 'border-[#B1A15A] bg-[#B1A15A] text-[#26313D]'
                          : 'border-[#DDD6C5] bg-[#FFFDF7] text-[#5E6A7A]'
                      }`}
                    >
                      {optLetter}
                    </div>
                    <div className="flex-1 font-semibold text-[#26313D] leading-relaxed">
                      {opt.text}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill in the Blank Input */}
          {currentQ.question_type === 'fill_in_the_blank' && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-[#26313D]">Type your answer for the blank:</label>
              <input
                type="text"
                value={selectedAnswerVal}
                onChange={(e) =>
                  setUserAnswers((prev) => ({
                    ...prev,
                    [currentQ.id]: e.target.value,
                  }))
                }
                placeholder="Type the exact term or expression..."
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-4 py-3 text-xs sm:text-sm font-semibold text-[#26313D] placeholder-[#6F7782]/60 focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
              />
            </div>
          )}

          {/* Short Answer Input */}
          {currentQ.question_type === 'short_answer' && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-[#26313D]">Provide your explanation / solution:</label>
              <textarea
                rows={4}
                value={selectedAnswerVal}
                onChange={(e) =>
                  setUserAnswers((prev) => ({
                    ...prev,
                    [currentQ.id]: e.target.value,
                  }))
                }
                placeholder="Write your explanation..."
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 text-xs sm:text-sm font-medium text-[#26313D] placeholder-[#6F7782]/60 focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
              />
            </div>
          )}
        </div>

        {/* Question Quick Jump Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 p-2">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(userAnswers[q.id]);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? 'border-2 border-[#B1A15A] bg-[#E8E0C9] text-[#26313D]'
                    : isAnswered
                    ? 'border border-[#B1A15A]/60 bg-[#FAF5E8] text-[#26313D]'
                    : 'border border-[#DDD6C5] bg-[#FFFDF7] text-[#6F7782] hover:border-[#B1A15A]'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Existing Assessment Navigation & Submit Button */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] hover:bg-[#E8E0C9] px-4 py-2.5 text-xs font-bold text-[#26313D] disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          {!isLastQuestion ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(totalQ - 1, prev + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] hover:bg-[#9E8F4B] px-5 py-2.5 text-xs font-bold text-[#26313D] transition-colors shadow-xs"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmittingAssessment}
              onClick={handleSubmitAssessment}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] hover:bg-[#9E8F4B] px-6 py-2.5 text-xs sm:text-sm font-bold text-[#26313D] disabled:opacity-50 transition-all shadow-xs"
            >
              {isSubmittingAssessment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Answers...</span>
                </>
              ) : (
                <>
                  <span>Submit Assessment</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: STEP 5 — ANSWER EVALUATION & RESULTS SCREEN
  // ===========================================================================
  if (assessmentState === 'results') {
    return (
      <div className="space-y-8 max-w-3xl mx-auto">
        {/* Score Summary Card */}
        <div className="rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 text-center space-y-4 shadow-xs">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8E0C9] border border-[#DDD6C5]">
            <Award className="h-8 w-8 text-[#B1A15A]" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-[#26313D] tracking-tight">
              Assessment Results
            </h2>
            <p className="text-xs sm:text-sm text-[#6F7782]">
              Evaluated against verified answer key and course source references.
            </p>
          </div>

          {/* Score Badge */}
          <div className="inline-flex flex-col items-center justify-center p-4 rounded-2xl bg-[#FAF5E8] border border-[#DDD6C5]">
            <span className="text-3xl sm:text-4xl font-black text-[#26313D]">
              {finalScore} / {finalTotal}
            </span>
            <span className="text-xs font-bold text-[#B1A15A] mt-1">
              Score: {finalPercentage}%
            </span>
          </div>

          <p className="text-xs text-[#5E6A7A] max-w-md mx-auto">
            Your Student Learning Twin mastery scores and misconception tracking records have been updated automatically.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetToConfig}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] hover:bg-[#9E8F4B] px-5 py-2.5 text-xs font-bold text-[#26313D] transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Configure New Assessment</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] hover:bg-[#E8E0C9] px-5 py-2.5 text-xs font-bold text-[#26313D] transition-colors"
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>

        {/* Detailed Question-by-Question Evaluation */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#26313D] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#B1A15A]" />
            Detailed Question Review ({evaluationResults.length} Questions)
          </h3>

          <div className="space-y-4">
            {evaluationResults.map((item, idx) => (
              <div
                key={item.question_id || idx}
                className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#26313D]">Question {idx + 1}</span>
                  {item.is_correct ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#6D9B73]/15 border border-[#6D9B73]/30 px-2.5 py-0.5 text-xs font-bold text-[#6D9B73]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#B85C5C]/15 border border-[#B85C5C]/30 px-2.5 py-0.5 text-xs font-bold text-[#B85C5C]">
                      <XCircle className="w-3.5 h-3.5" /> Incorrect
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <p className="text-sm font-bold text-[#26313D] leading-snug">
                  {item.question_text}
                </p>

                {/* Answers Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div
                    className={`rounded-xl border p-3 ${
                      item.is_correct
                        ? 'border-[#6D9B73]/40 bg-[#6D9B73]/10 text-[#26313D]'
                        : 'border-[#B85C5C]/40 bg-[#B85C5C]/10 text-[#26313D]'
                    }`}
                  >
                    <span className="block text-[11px] font-bold text-[#6F7782] mb-1">Your Answer:</span>
                    <span className="font-semibold">{item.user_answer}</span>
                  </div>

                  <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-3 text-[#26313D]">
                    <span className="block text-[11px] font-bold text-[#6D9B73] mb-1">Verified Correct Answer:</span>
                    <span className="font-semibold">{item.correct_answer}</span>
                  </div>
                </div>

                {/* Pedagogical Explanation */}
                <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 text-xs space-y-1">
                  <span className="font-bold text-[#26313D] flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-[#B1A15A]" />
                    Explanation:
                  </span>
                  <p className="text-[#5E6A7A] leading-relaxed">{item.explanation}</p>
                </div>

                {/* Verified Source Citation Reference */}
                {item.source_citation && (
                  <div className="rounded-xl border border-[#DDD6C5]/70 bg-[#FAF5E8]/60 p-3 text-[11px] text-[#6F7782] space-y-1">
                    <div className="font-semibold text-[#26313D] flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-[#B1A15A]" />
                      <span>Source: {item.source_citation.material_title} ({item.source_citation.reference})</span>
                    </div>
                    {item.source_citation.quote && (
                      <p className="italic line-clamp-2">"{item.source_citation.quote}"</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
