'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  BookOpen,
  Award,
  Sparkles,
  HelpCircle,
  Clock,
  ShieldCheck,
  Loader2,
  FileQuestion,
  Edit3,
  Check,
  FolderOpen,
  Calculator,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Lightbulb,
} from 'lucide-react';
import { Question, QuestionOption, Course, Concept, AssessmentType } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

interface AdaptiveQuizProps {
  courseId?: string;
  conceptId?: string;
}

export default function AdaptiveQuiz({ courseId, conceptId }: AdaptiveQuizProps) {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || '');

  // Filter & Selection Controls
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('diagnostic');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedConceptId, setSelectedConceptId] = useState<string>(conceptId || 'all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [questionCount, setQuestionCount] = useState<number>(20);

  const [availableConcepts, setAvailableConcepts] = useState<Concept[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  // Assessment Questions & Execution State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [emptyMessage, setEmptyMessage] = useState<string>('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<QuestionOption | null>(null);
  const [userTextInput, setUserTextInput] = useState('');
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);

  // Cited feedback from server
  const [serverFeedback, setServerFeedback] = useState<{
    why_correct?: string;
    explanation?: string;
    source_citation?: any;
    relevant_concept?: { id: string; name: string };
  } | null>(null);

  // Scores
  const [score, setScore] = useState(0);
  const [mcqScore, setMcqScore] = useState(0);
  const [fitbScore, setFitbScore] = useState(0);
  const [shortAnswerScore, setShortAnswerScore] = useState(0);
  const [numericalScore, setNumericalScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  // Misconceptions & Summary
  const [detectedMisconceptionsList, setDetectedMisconceptionsList] = useState<any[]>([]);
  const [currentMisconception, setCurrentMisconception] = useState<any | null>(null);
  const [topicResults, setTopicResults] = useState<Record<string, { total: number; correct: number }>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);

  // 1. Fetch user's courses from Supabase/DB (no hardcoded subjects)
  useEffect(() => {
    if (!user) return;
    setIsLoadingCourses(true);
    api.getCourses()
      .then((userCourses) => {
        setCourses(userCourses);
        if (userCourses.length > 0) {
          const matched = courseId && userCourses.some((c) => c.id === courseId)
            ? courseId
            : userCourses[0].id;
          setSelectedCourseId(matched);
        }
      })
      .catch((err) => {
        console.warn('Failed to load courses:', err);
      })
      .finally(() => {
        setIsLoadingCourses(false);
      });
  }, [user, courseId]);

  // 2. Fetch topics and concepts for the active course
  useEffect(() => {
    if (!user || !selectedCourseId) return;

    api.getCourseDetails(selectedCourseId)
      .then((data) => {
        const concepts = data.concepts || [];
        setAvailableConcepts(concepts);
        const distinctTopics = Array.from(
          new Set(
            concepts
              .map((c) => c.category)
              .filter((cat): cat is string => Boolean(cat) && cat !== 'Core' && cat !== 'General')
          )
        );
        setAvailableTopics(distinctTopics);
      })
      .catch(() => {
        setAvailableConcepts([]);
        setAvailableTopics([]);
      });
  }, [user, selectedCourseId]);

  // 3. Load or Regenerate Assessment Questions
  const loadAssessment = () => {
    if (!user || !selectedCourseId) return;

    setIsLoadingQuestions(true);
    setEmptyMessage('');
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setUserTextInput('');
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setServerFeedback(null);
    setScore(0);
    setMcqScore(0);
    setFitbScore(0);
    setShortAnswerScore(0);
    setNumericalScore(0);
    setAnsweredCount(0);
    setCurrentMisconception(null);
    setDetectedMisconceptionsList([]);
    setTopicResults({});
    setIsQuizCompleted(false);

    api.generateAssessmentDetailed({
      courseId: selectedCourseId,
      topic: selectedTopic !== 'all' ? selectedTopic : undefined,
      conceptId: selectedConceptId !== 'all' ? selectedConceptId : undefined,
      difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
      assessmentType,
      count: questionCount,
      language: profile?.preferred_language || 'English',
    })
      .then((res) => {
        if (res.questions && res.questions.length > 0) {
          setQuestions(res.questions);
        } else {
          setEmptyMessage(
            res.message ||
              'No uploaded learning materials found for this subject. Upload textbooks, slides, or videos in Courses to generate questions.'
          );
        }
      })
      .catch((err) => {
        console.error('Error generating questions:', err);
        setEmptyMessage('Failed to generate diagnostic assessment. Please ensure course materials are uploaded.');
      })
      .finally(() => {
        setIsLoadingQuestions(false);
      });
  };

  useEffect(() => {
    if (selectedCourseId) {
      loadAssessment();
    }
  }, [selectedCourseId, assessmentType, questionCount]);

  const activeCourse = courses.find((c) => c.id === selectedCourseId);
  const currentQ = questions[currentIndex];
  const qType = currentQ?.question_type || 'mcq';
  const isMcq = qType === 'mcq';
  const isFitb = qType === 'fill_in_the_blank';
  const isNumerical = qType === 'numerical';
  const isShortAnswer = qType === 'short_answer';

  // Format source citation icons
  const getSourceIcon = (reference?: string) => {
    if (!reference) return '📄';
    const lower = reference.toLowerCase();
    if (lower.includes('slide') || lower.includes('ppt')) return '📊';
    if (lower.includes(':') || lower.includes('video') || lower.includes('min')) return '🎥';
    if (lower.includes('fig') || lower.includes('image')) return '🖼️';
    return '📄';
  };

  // Submit Answer
  const handleSubmitAnswer = async () => {
    if (!currentQ || !user || isAnswerSubmitted) return;

    let isCorrect = false;
    let selectedText = '';
    let misconceptionTag: string | undefined = undefined;

    if (isMcq) {
      if (!selectedOption) return;
      isCorrect = Boolean(selectedOption.is_correct);
      selectedText = selectedOption.text;
      misconceptionTag = selectedOption.misconception_tag;
    } else if (isFitb) {
      if (!userTextInput.trim()) return;
      selectedText = userTextInput.trim();

      const normalizedInput = selectedText.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedTarget = (currentQ.correct_answer || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      isCorrect =
        normalizedInput === normalizedTarget ||
        (normalizedTarget.length > 3 && normalizedInput.includes(normalizedTarget)) ||
        (normalizedInput.length > 3 && normalizedTarget.includes(normalizedInput));

      if (!isCorrect) {
        misconceptionTag = `Terminology omission in ${currentQ.concept_name}`;
      }
    } else if (isNumerical) {
      if (!userTextInput.trim()) return;
      selectedText = userTextInput.trim();

      const userNum = parseFloat(selectedText.replace(/[^0-9.-]/g, ''));
      const targetNum = parseFloat(String(currentQ.correct_answer || '').replace(/[^0-9.-]/g, ''));

      if (!isNaN(userNum) && !isNaN(targetNum)) {
        const diff = Math.abs(userNum - targetNum);
        const tolerance = Math.max(0.01, Math.abs(targetNum) * 0.03);
        isCorrect = diff <= tolerance;
      } else {
        isCorrect = selectedText.toLowerCase().trim() === String(currentQ.correct_answer || '').toLowerCase().trim();
      }

      if (!isCorrect) {
        misconceptionTag = `Calculation / Formula invariant error in ${currentQ.concept_name}`;
      }
    } else {
      // Short answer
      if (!userTextInput.trim()) return;
      selectedText = userTextInput.trim();

      const targetWords = (currentQ.correct_answer || currentQ.explanation || '')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const userWords = selectedText.toLowerCase();
      const matchCount = targetWords.filter((tw) => userWords.includes(tw)).length;

      isCorrect = selectedText.length >= 15 && matchCount >= Math.max(1, Math.floor(targetWords.length * 0.3));

      if (!isCorrect) {
        misconceptionTag = `Conceptual gap in formulating ${currentQ.concept_name}`;
      }
    }

    setIsCorrectAnswer(isCorrect);
    setIsAnswerSubmitted(true);
    setIsEvaluating(true);
    setAnsweredCount((prev) => prev + 1);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      if (isMcq) setMcqScore((prev) => prev + 1);
      if (isFitb) setFitbScore((prev) => prev + 1);
      if (isNumerical) setNumericalScore((prev) => prev + 1);
      if (isShortAnswer) setShortAnswerScore((prev) => prev + 1);
    }

    // Update topic stats
    const topicKey = currentQ.topic || currentQ.concept_name || 'General';
    setTopicResults((prev) => {
      const cur = prev[topicKey] || { total: 0, correct: 0 };
      return {
        ...prev,
        [topicKey]: {
          total: cur.total + 1,
          correct: cur.correct + (isCorrect ? 1 : 0),
        },
      };
    });

    try {
      const res = await api.evaluateAttempt({
        questionId: currentQ.id,
        conceptId: currentQ.concept_id,
        conceptName: currentQ.concept_name,
        courseId: currentQ.course_id || selectedCourseId,
        isCorrect,
        selectedOptionText: selectedText,
        questionType: qType,
        correctAnswer: currentQ.correct_answer,
        explanation: currentQ.explanation,
        sourceCitation: currentQ.source_citation,
        misconceptionTag,
        timeSpentSeconds: 15,
        language: profile?.preferred_language || 'English',
      });

      setServerFeedback({
        why_correct: res.why_correct,
        explanation: res.explanation || currentQ.explanation,
        source_citation: res.source_citation || currentQ.source_citation,
        relevant_concept: res.relevant_concept || { id: currentQ.concept_id, name: currentQ.concept_name },
      });

      if (res.misconception) {
        setCurrentMisconception(res.misconception);
        setDetectedMisconceptionsList((prev) => {
          if (!prev.some((m) => m.id === res.misconception?.id)) {
            return [...prev, res.misconception];
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Evaluation submission error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Next Question
  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setUserTextInput('');
      setIsAnswerSubmitted(false);
      setIsCorrectAnswer(null);
      setCurrentMisconception(null);
      setServerFeedback(null);
    } else {
      setIsQuizCompleted(true);
      const percentage = Math.round((score / questions.length) * 100);

      api.recordAssessment({
        course_id: selectedCourseId,
        title: activeCourse ? `${activeCourse.title} ${assessmentType.toUpperCase()}` : 'Adaptive Assessment',
        total_questions: questions.length,
        completed_questions: questions.length,
        score_percentage: percentage,
      }).catch(console.warn);

      if (score >= Math.ceil(questions.length * 0.7)) {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
        });
      }
    }
  };

  // Restart Quiz
  const handleRestart = () => {
    loadAssessment();
  };

  // --- LOADING STATE ---
  if (isLoadingCourses || isLoadingQuestions) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-[#B1A15A] mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#26313D]">
              Generating Verified Adaptive Assessment...
            </h4>
            <p className="text-xs text-[#6F7782] max-w-md mx-auto">
              Running verification pipeline (Generate → Solve Independently → Verify Source → Validate Difficulty → Deduplicate) for{' '}
              <span className="font-semibold text-[#26313D]">{activeCourse?.title || 'the selected subject'}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-[11px] font-medium text-[#5E6A7A] pt-2">
            <span className="flex items-center gap-1 rounded-lg bg-[#FAF5E8] px-2.5 py-1 border border-[#DDD6C5]">
              <FileQuestion className="w-3.5 h-3.5 text-[#B1A15A]" /> MCQ
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-[#FAF5E8] px-2.5 py-1 border border-[#DDD6C5]">
              <Edit3 className="w-3.5 h-3.5 text-[#5E6A7A]" /> Fill in Blank
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-[#FAF5E8] px-2.5 py-1 border border-[#DDD6C5]">
              <Calculator className="w-3.5 h-3.5 text-[#B1A15A]" /> Numerical
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-[#FAF5E8] px-2.5 py-1 border border-[#DDD6C5]">
              <FileText className="w-3.5 h-3.5 text-[#5E6A7A]" /> Short Answer
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-[#FAF5E8] px-2.5 py-1 border border-[#DDD6C5]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#6D9B73]" /> Verified Grounding
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- EMPTY STATE 1: NO COURSES ---
  if (courses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[#FAF5E8] border border-[#DDD6C5]">
          <FolderOpen className="w-7 h-7 text-[#B1A15A]" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-[#26313D]">No Subjects Found</h4>
          <p className="text-xs text-[#6F7782] max-w-sm mx-auto leading-relaxed">
            You have not created any courses yet. Create a course and upload learning materials to start an adaptive assessment.
          </p>
        </div>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
        >
          <BookOpen className="w-4 h-4" /> Go to Courses
        </Link>
      </div>
    );
  }

  // --- EMPTY STATE 2: NO MATERIALS ---
  if (questions.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#6F7782] font-semibold">Subject:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 font-bold text-[#26313D] text-xs focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[#FAF5E8] border border-[#DDD6C5]">
            <HelpCircle className="w-7 h-7 text-[#B1A15A]" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base font-bold text-[#26313D]">No Uploaded Learning Materials</h4>
            <p className="text-xs text-[#6F7782] max-w-md mx-auto leading-relaxed">
              {emptyMessage ||
                `No uploaded learning content found for "${activeCourse?.title || 'this course'}". Upload course textbooks, slides, or videos to generate grounded questions.`}
            </p>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
          >
            <BookOpen className="w-4 h-4" /> Upload Course Materials
          </Link>
        </div>
      </div>
    );
  }

  // --- QUIZ COMPLETED SCREEN WITH WEAK/STRONG TOPICS & MISCONCEPTIONS ---
  if (isQuizCompleted) {
    const percentage = Math.round((score / questions.length) * 100);

    const weakTopics = Object.entries(topicResults)
      .filter(([_, stats]) => stats.total > 0 && Math.round((stats.correct / stats.total) * 100) < 65)
      .map(([topic, stats]) => ({
        topic,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        total: stats.total,
      }));

    const strongTopics = Object.entries(topicResults)
      .filter(([_, stats]) => stats.total > 0 && Math.round((stats.correct / stats.total) * 100) >= 75)
      .map(([topic, stats]) => ({
        topic,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        total: stats.total,
      }));

    return (
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-10 space-y-6 max-w-3xl mx-auto shadow-xs">
        <div className="text-center space-y-2">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[#E8E0C9] border border-[#DDD6C5]">
            <Award className="h-8 w-8 text-[#B1A15A]" />
          </div>
          <h3 className="text-2xl font-black text-[#26313D] tracking-tight">
            Assessment Completed
          </h3>
          <p className="text-xs sm:text-sm text-[#6F7782]">
            Subject: <span className="font-semibold text-[#26313D]">{activeCourse?.title}</span> • All answers calibrated directly into your Student Learning Twin.
          </p>
        </div>

        {/* Overall Score Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5] text-center">
            <span className="text-[11px] text-[#6F7782] font-semibold">Total Score</span>
            <p className="text-xl font-black text-[#26313D] mt-1">{score} / {questions.length}</p>
          </div>
          <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5] text-center">
            <span className="text-[11px] text-[#6F7782] font-semibold">Accuracy</span>
            <p className="text-xl font-black text-[#B1A15A] mt-1">{percentage}%</p>
          </div>
          <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5] text-center">
            <span className="text-[11px] text-[#6F7782] font-semibold">MCQ / Blank</span>
            <p className="text-xl font-black text-[#26313D] mt-1">{mcqScore + fitbScore}</p>
          </div>
          <div className="rounded-xl bg-[#FAF5E8] p-3.5 border border-[#DDD6C5] text-center">
            <span className="text-[11px] text-[#6F7782] font-semibold">Num / Short Ans</span>
            <p className="text-xl font-black text-[#26313D] mt-1">{numericalScore + shortAnswerScore}</p>
          </div>
        </div>

        {/* Weak Topics & Strong Topics Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Weak Topics */}
          <div className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#873434]">
              <AlertTriangle className="w-4 h-4 text-[#B85C5C]" />
              <span>Weak Topics (&lt; 65% Accuracy)</span>
            </div>
            {weakTopics.length > 0 ? (
              <div className="space-y-1.5">
                {weakTopics.map((wt) => (
                  <div key={wt.topic} className="flex items-center justify-between text-xs bg-[#FFFDF7] p-2 rounded-lg border border-[#DDD6C5]">
                    <span className="font-semibold text-[#26313D]">{wt.topic}</span>
                    <span className="font-bold text-[#B85C5C]">{wt.accuracy}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6F7782] italic">No major weak topics detected in this assessment.</p>
            )}
          </div>

          {/* Strong Topics */}
          <div className="rounded-xl border border-[#6D9B73]/30 bg-[#6D9B73]/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2e6935]">
              <CheckCircle2 className="w-4 h-4 text-[#6D9B73]" />
              <span>Strong Topics (&ge; 75% Accuracy)</span>
            </div>
            {strongTopics.length > 0 ? (
              <div className="space-y-1.5">
                {strongTopics.map((st) => (
                  <div key={st.topic} className="flex items-center justify-between text-xs bg-[#FFFDF7] p-2 rounded-lg border border-[#DDD6C5]">
                    <span className="font-semibold text-[#26313D]">{st.topic}</span>
                    <span className="font-bold text-[#2e6935]">{st.accuracy}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6F7782] italic">Continue practicing to solidify high-confidence topics.</p>
            )}
          </div>
        </div>

        {/* Likely Misconceptions Diagnosed */}
        {detectedMisconceptionsList.length > 0 && (
          <div className="rounded-xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#B85C5C]">
                <AlertTriangle className="w-4 h-4" />
                <span>Diagnosed Misconceptions ({detectedMisconceptionsList.length})</span>
              </div>
              <Link
                href="/misconceptions"
                className="text-[11px] font-bold text-[#B85C5C] hover:underline flex items-center gap-1"
              >
                Go to Repair Workshop <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-1.5">
              {detectedMisconceptionsList.map((m) => (
                <div key={m.id} className="text-xs bg-[#FFFDF7] p-2.5 rounded-lg border border-[#DDD6C5] space-y-1">
                  <div className="font-bold text-[#26313D]">{m.title}</div>
                  <p className="text-[11px] text-[#6F7782]">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Next Actions */}
        <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 space-y-3">
          <h4 className="text-xs font-bold text-[#26313D] flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-[#B1A15A]" /> Recommended Next Actions:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <Link
              href="/learning-twin"
              className="flex items-center justify-between rounded-lg bg-[#FFFDF7] p-3 border border-[#DDD6C5] font-semibold text-[#26313D] hover:border-[#B1A15A] transition-all"
            >
              <span>Inspect Learning Twin</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#B1A15A]" />
            </Link>
            <Link
              href="/revision"
              className="flex items-center justify-between rounded-lg bg-[#FFFDF7] p-3 border border-[#DDD6C5] font-semibold text-[#26313D] hover:border-[#B1A15A] transition-all"
            >
              <span>Spaced Repetition Cards</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#B1A15A]" />
            </Link>
            <Link
              href="/tutor"
              className="flex items-center justify-between rounded-lg bg-[#FFFDF7] p-3 border border-[#DDD6C5] font-semibold text-[#26313D] hover:border-[#B1A15A] transition-all"
            >
              <span>Ask AI Tutor Questions</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#B1A15A]" />
            </Link>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRestart}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] px-6 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-[#26313D]" /> Retake or New Calibrated Assessment
          </button>
        </div>
      </div>
    );
  }

  // --- ACTIVE ASSESSMENT QUESTION VIEW ---
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Student Assessment Selector Bar */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Course Selector */}
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#B1A15A] shrink-0" />
            <span className="text-[#6F7782] font-semibold">Subject:</span>
            <select
              id="assessment-subject-selector"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1 font-bold text-[#26313D] text-xs focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#6F7782] font-semibold">Type:</span>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
              className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-2.5 py-1 font-bold text-[#26313D] text-xs focus:outline-none"
            >
              <option value="diagnostic">Diagnostic Calibration</option>
              <option value="practice">Practice Quiz</option>
              <option value="mock_exam">Mock Exam</option>
              <option value="numerical_drill">Numerical Drill</option>
              <option value="short_answer">Short Answer Workshop</option>
              <option value="mixed">Mixed Adaptive</option>
            </select>
          </div>

          {/* Question Count Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#6F7782] font-semibold">Questions:</span>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-2.5 py-1 font-bold text-[#26313D] text-xs focus:outline-none"
            >
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions</option>
              <option value={20}>20 Questions</option>
            </select>
          </div>
        </div>

        {/* Optional Secondary Topic & Difficulty Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DDD6C5]/60 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            {availableTopics.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[#6F7782]">Topic:</span>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="rounded-md border border-[#DDD6C5] bg-[#FAF5E8] px-2 py-0.5 font-medium text-[#26313D] text-[11px]"
                >
                  <option value="all">All Topics</option>
                  {availableTopics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[#6F7782]">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                className="rounded-md border border-[#DDD6C5] bg-[#FAF5E8] px-2 py-0.5 font-medium text-[#26313D] text-[11px]"
              >
                <option value="all">All Levels</option>
                <option value="easy">Easy (Foundations)</option>
                <option value="medium">Medium (Application)</option>
                <option value="hard">Hard (Analysis)</option>
              </select>
            </div>
          </div>

          <button
            onClick={loadAssessment}
            className="inline-flex items-center gap-1 rounded-md bg-[#FAF5E8] px-2.5 py-1 border border-[#DDD6C5] font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all"
          >
            <RefreshCw className="w-3 h-3 text-[#B1A15A]" /> Apply Filters
          </button>
        </div>
      </div>

      {/* 2. Progress Header */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-[#E8E0C9] px-2.5 py-1 font-black text-[#26313D] border border-[#DDD6C5]">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="rounded-lg px-2.5 py-1 font-bold text-[11px] border bg-[#FAF5E8] text-[#26313D] border-[#DDD6C5]">
              {isMcq ? 'Multiple Choice (MCQ)' : isFitb ? 'Fill in the Blank' : isNumerical ? 'Numerical Problem' : 'Short Answer'}
            </span>
            {currentQ.topic && (
              <span className="text-[#6F7782] font-medium hidden sm:inline">
                Topic: <strong className="text-[#26313D]">{currentQ.topic}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#FAF5E8] px-2 py-0.5 text-[10px] font-bold text-[#5E6A7A] border border-[#DDD6C5] capitalize">
              {currentQ.difficulty}
            </span>
            <span className="text-[#B1A15A] font-bold uppercase text-[10px] tracking-wider hidden sm:inline">
              Bloom: {currentQ.bloom_level}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#FAF5E8] h-1.5 rounded-full overflow-hidden border border-[#DDD6C5]/50">
          <div
            className="bg-[#B1A15A] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3. Main Question Card */}
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#6F7782] uppercase tracking-wider">
          <div>
            Concept: <span className="text-[#26313D]">{currentQ.concept_name}</span>
          </div>
          {currentQ.verification_status && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6D9B73]">
              <ShieldCheck className="w-3 h-3" /> Question Verified
            </span>
          )}
        </div>

        {/* Question Text */}
        <h3 className="text-base sm:text-lg font-bold text-[#26313D] leading-snug">
          {currentQ.question_text}
        </h3>

        {/* Code or formula snippet */}
        {currentQ.code_snippet && (
          <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 overflow-x-auto font-mono text-xs text-[#26313D]">
            <pre>{currentQ.code_snippet}</pre>
          </div>
        )}

        {/* --- 1. MCQ MODE --- */}
        {isMcq && (
          <div className="space-y-3">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption?.id === opt.id;
              let styling = 'border-[#DDD6C5] bg-[#FAF5E8] text-[#26313D] hover:border-[#B1A15A]';

              if (isAnswerSubmitted) {
                if (opt.is_correct) {
                  styling = 'border-[#6D9B73] bg-[#6D9B73]/15 text-[#26313D]';
                } else if (isSelected && !opt.is_correct) {
                  styling = 'border-[#B85C5C] bg-[#B85C5C]/15 text-[#26313D]';
                } else {
                  styling = 'border-[#DDD6C5]/50 bg-[#FAF5E8]/40 text-[#6F7782] opacity-60';
                }
              } else if (isSelected) {
                styling = 'border-2 border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs';
              }

              return (
                <button
                  key={opt.id}
                  disabled={isAnswerSubmitted}
                  onClick={() => setSelectedOption(opt)}
                  className={`w-full text-left rounded-xl border p-4 text-xs sm:text-sm font-medium transition-all flex items-start gap-3.5 ${styling}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isAnswerSubmitted ? (
                      opt.is_correct ? (
                        <CheckCircle2 className="h-4 w-4 text-[#6D9B73]" />
                      ) : isSelected ? (
                        <XCircle className="h-4 w-4 text-[#B85C5C]" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-[#DDD6C5]" />
                      )
                    ) : (
                      <div
                        className={`h-4 w-4 rounded-full border ${
                          isSelected ? 'border-[#B1A15A] bg-[#B1A15A]' : 'border-[#DDD6C5] bg-[#FFFDF7]'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-[#26313D]">{opt.text}</span>
                    {isAnswerSubmitted && isSelected && (
                      <p
                        className={`mt-2 text-xs leading-relaxed font-normal ${
                          opt.is_correct ? 'text-[#2e6935]' : 'text-[#873434]'
                        }`}
                      >
                        {opt.explanation}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* --- 2. FILL IN THE BLANK MODE --- */}
        {isFitb && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#26313D] flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#B1A15A]" /> Your Answer for the blank:
              </label>
              <input
                type="text"
                value={userTextInput}
                disabled={isAnswerSubmitted}
                onChange={(e) => setUserTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAnswerSubmitted && userTextInput.trim()) {
                    handleSubmitAnswer();
                  }
                }}
                placeholder="Type the exact missing term or phrase..."
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-4 py-3 text-xs sm:text-sm font-semibold text-[#26313D] placeholder-[#6F7782]/60 focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
              />
            </div>
          </div>
        )}

        {/* --- 3. NUMERICAL MODE --- */}
        {isNumerical && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#26313D] flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-[#B1A15A]" /> Calculated Numerical Value:
              </label>
              <input
                type="text"
                value={userTextInput}
                disabled={isAnswerSubmitted}
                onChange={(e) => setUserTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAnswerSubmitted && userTextInput.trim()) {
                    handleSubmitAnswer();
                  }
                }}
                placeholder="Enter exact calculated number (e.g. 12 or 4.5)..."
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-4 py-3 text-xs sm:text-sm font-semibold text-[#26313D] placeholder-[#6F7782]/60 focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
              />
            </div>
          </div>
        )}

        {/* --- 4. SHORT ANSWER MODE --- */}
        {isShortAnswer && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#26313D] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#B1A15A]" /> Concise Explanation:
                </label>
                <span className="text-[11px] text-[#6F7782]">{userTextInput.length} characters</span>
              </div>
              <textarea
                rows={4}
                value={userTextInput}
                disabled={isAnswerSubmitted}
                onChange={(e) => setUserTextInput(e.target.value)}
                placeholder="Articulate the key principles, invariants, or criteria..."
                className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-4 py-3 text-xs sm:text-sm font-medium text-[#26313D] placeholder-[#6F7782]/60 focus:outline-none focus:ring-2 focus:ring-[#B1A15A]"
              />
            </div>
          </div>
        )}

        {/* --- CITED FEEDBACK BANNER (AFTER ANSWER SUBMISSION) --- */}
        {isAnswerSubmitted && (
          <div className="space-y-3 pt-2 animate-in fade-in">
            {/* Status & Why Correct Card */}
            <div
              className={`rounded-xl border p-4 space-y-2 ${
                isCorrectAnswer
                  ? 'border-[#6D9B73] bg-[#6D9B73]/15'
                  : 'border-[#B85C5C] bg-[#B85C5C]/15'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                {isCorrectAnswer ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-[#6D9B73]" />
                    <span className="text-[#2e6935]">Correct!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-[#B85C5C]" />
                    <span className="text-[#873434]">
                      Incorrect.{currentQ.correct_answer ? ` Expected: "${currentQ.correct_answer}"` : ''}
                    </span>
                  </>
                )}
              </div>

              {serverFeedback?.why_correct && (
                <p className="text-xs font-semibold text-[#26313D] leading-relaxed">
                  {serverFeedback.why_correct}
                </p>
              )}

              <p className="text-xs text-[#26313D] leading-relaxed">
                {serverFeedback?.explanation || currentQ.explanation}
              </p>
            </div>

            {/* Source Grounding Citation */}
            {currentQ.source_citation && (
              <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 text-xs text-[#26313D] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[#26313D]">
                    <span className="text-base">{getSourceIcon(currentQ.source_citation.reference)}</span>
                    <span>
                      Course Citation: {currentQ.source_citation.material_title} ({currentQ.source_citation.reference})
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6D9B73]">
                    <ShieldCheck className="w-3 h-3" /> Grounded In Material
                  </span>
                </div>
                <p className="text-[11px] text-[#6F7782] italic leading-relaxed pl-6">
                  &ldquo;{currentQ.source_citation.quote}&rdquo;
                </p>
              </div>
            )}

            {/* Diagnosed Misconception Alert (if any) */}
            {currentMisconception && (
              <div className="rounded-xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#B85C5C] font-bold text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Misconception Diagnosed: {currentMisconception.title}</span>
                  </div>
                  <Link
                    href="/misconceptions"
                    className="text-[11px] font-bold text-[#B85C5C] hover:underline"
                  >
                    Open Repair Workshop →
                  </Link>
                </div>
                <p className="text-xs text-[#26313D] leading-relaxed">
                  {currentMisconception.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#DDD6C5] pt-4">
          <span className="text-xs text-[#6F7782]">
            {isAnswerSubmitted
              ? 'Results calibrated in Student Learning Twin'
              : isMcq
              ? 'Select an option to evaluate comprehension'
              : 'Enter response to evaluate comprehension'}
          </span>

          {!isAnswerSubmitted ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={isMcq ? !selectedOption : !userTextInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-40 transition-all shadow-xs"
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-5 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              {currentIndex + 1 < questions.length ? 'Next Question' : 'View Assessment Summary'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
