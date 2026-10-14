'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  Layers,
  RotateCw,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Zap,
  Loader2,
  FolderOpen,
  Brain,
  ShieldCheck,
} from 'lucide-react';
import { Flashcard, Course } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

export default function FlashcardDeck() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [lastReviewFeedback, setLastReviewFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.getCourses()
      .then(async (userCourses) => {
        setCourses(userCourses);
        if (userCourses.length > 0) {
          const firstId = userCourses[0].id;
          setSelectedCourseId(firstId);
          const flashcards = await api.getFlashcards(firstId);
          setCards(flashcards);
        } else {
          setCards([]);
        }
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [user]);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoading(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setLastReviewFeedback(null);
    try {
      const flashcards = await api.getFlashcards(courseId);
      setCards(flashcards);
    } catch (err) {
      console.warn('Error loading flashcards for course:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentCard = cards[currentIndex];
  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  const handleRate = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;

    const ratingMap = {
      again: 1,
      hard: 2,
      good: 4,
      easy: 5,
    };

    try {
      const res = await api.reviewFlashcard(currentCard.id, ratingMap[rating]);
      const nextInterval = res?.interval_days ?? (rating === 'easy' ? 6 : rating === 'good' ? 4 : 1);
      setLastReviewFeedback(
        `Next review in ${nextInterval} day${nextInterval === 1 ? '' : 's'}. Student Learning Twin updated.`
      );
    } catch (err) {
      console.warn('Failed to record review:', err);
    }

    setIsFlipped(false);
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionCompleted(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setLastReviewFeedback(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 max-w-lg mx-auto shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin text-[#B1A15A] mx-auto" />
        <p className="text-xs text-[#6F7782]">Loading due flashcards based on SM-2 intervals...</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 max-w-lg mx-auto shadow-xs">
        <FolderOpen className="w-8 h-8 text-[#B1A15A] mx-auto" />
        <h4 className="text-base font-bold text-[#26313D]">No Subjects Found</h4>
        <p className="text-xs text-[#6F7782]">
          Create a course and upload learning materials to begin spaced revision.
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

  if (cards.length === 0) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#B1A15A]" />
            <span className="text-[#6F7782] font-semibold">Subject:</span>
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

        <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 shadow-xs">
          <Layers className="w-8 h-8 text-[#B1A15A] mx-auto" />
          <h4 className="text-base font-bold text-[#26313D]">No Flashcards Available Yet</h4>
          <p className="text-xs text-[#6F7782]">
            Upload course materials in Courses to generate concept revision cards for &ldquo;{activeCourse?.title}&rdquo;.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
          >
            <BookOpen className="w-4 h-4" /> Go to Courses
          </Link>
        </div>
      </div>
    );
  }

  if (sessionCompleted) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Subject switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#B1A15A]" />
            <span className="text-[#6F7782] font-semibold">Subject:</span>
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

        <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 text-center space-y-5 shadow-xs">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[#6D9B73]/15 border border-[#6D9B73]/30">
            <CheckCircle2 className="h-8 w-8 text-[#6D9B73]" />
          </div>
          <h3 className="text-xl font-black text-[#26313D]">Spaced Revision Complete</h3>
          <p className="text-xs text-[#6F7782] leading-relaxed">
            All {cards.length} flashcards reviewed for <span className="font-semibold text-[#26313D]">{activeCourse?.title}</span>. Your SM-2 memory intervals and Bayesian Student Learning Twin have been synchronized.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/learning-twin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              <Brain className="w-4 h-4" /> Inspect Learning Twin
            </Link>
            <Link
              href="/study-plan"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5E6A7A] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#4a5563] transition-all shadow-xs"
            >
              View Study Plan
            </Link>
            <button
              onClick={handleRestart}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-4 py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#FAF5E8] transition-all shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" /> Review Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Subject Switcher & Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#B1A15A]" />
          <span className="text-[#6F7782] font-semibold">Subject:</span>
          <select
            id="flashcard-subject-selector"
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
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#E8E0C9] px-2.5 py-1 font-bold text-[#26313D] border border-[#DDD6C5]">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <span className="rounded-md bg-[#FAF5E8] px-2 py-0.5 text-[10px] font-bold text-[#5E6A7A] border border-[#DDD6C5]">
            SM-2 Ease: {currentCard.ease_factor || 2.5}
          </span>
        </div>
      </div>

      {/* Main Flashcard with flip */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="group relative min-h-[300px] cursor-pointer rounded-3xl border border-[#DDD6C5] bg-[#FFFDF7] p-8 sm:p-10 transition-all hover:border-[#B1A15A] hover:shadow-md flex flex-col justify-between shadow-xs select-none"
      >
        <div className="flex items-center justify-between text-xs text-[#6F7782]">
          <span className="font-semibold text-[#B1A15A] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {isFlipped ? 'Answer & Invariant Proof' : 'Prompt / Concept Question'}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#6F7782]">
            <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
            Click to Flip
          </span>
        </div>

        <div className="py-6 text-center space-y-4">
          {!isFlipped ? (
            <h3 className="text-lg sm:text-xl font-bold text-[#26313D] leading-snug">
              {currentCard.front}
            </h3>
          ) : (
            <div className="space-y-3">
              <p className="text-sm sm:text-base font-medium text-[#26313D] leading-relaxed whitespace-pre-line">
                {currentCard.back}
              </p>
              {currentCard.source_ref && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF5E8] px-3 py-1 text-[11px] font-semibold text-[#5E6A7A] border border-[#DDD6C5]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#6D9B73]" />
                  Grounding: {currentCard.source_ref}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#DDD6C5]/50 pt-3 flex items-center justify-between text-[11px] text-[#6F7782]">
          <span>Concept: <strong className="text-[#26313D]">{currentCard.concept_name || activeCourse?.title}</strong></span>
          <span>Repetitions: {currentCard.repetitions || 0}</span>
        </div>
      </div>

      {/* Real-time feedback toast */}
      {lastReviewFeedback && (
        <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-3 text-center text-xs font-semibold text-[#2e6935]">
          {lastReviewFeedback}
        </div>
      )}

      {/* SM-2 Rating Controls (visible when flipped) */}
      {isFlipped ? (
        <div className="space-y-2 animate-in fade-in">
          <p className="text-center text-xs font-semibold text-[#6F7782]">
            Rate your recall to update SM-2 interval and Bayesian Learning Twin:
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            <button
              onClick={() => handleRate('again')}
              className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/10 p-3 text-center transition-all hover:bg-[#B85C5C]/20"
            >
              <span className="block text-xs font-black text-[#B85C5C]">Again</span>
              <span className="text-[10px] text-[#6F7782]">&lt;1 min</span>
            </button>
            <button
              onClick={() => handleRate('hard')}
              className="rounded-xl border border-[#D4A359]/30 bg-[#D4A359]/10 p-3 text-center transition-all hover:bg-[#D4A359]/20"
            >
              <span className="block text-xs font-black text-[#855B14]">Hard</span>
              <span className="text-[10px] text-[#6F7782]">1 day</span>
            </button>
            <button
              onClick={() => handleRate('good')}
              className="rounded-xl border border-[#B1A15A]/30 bg-[#B1A15A]/15 p-3 text-center transition-all hover:bg-[#B1A15A]/25"
            >
              <span className="block text-xs font-black text-[#635520]">Good</span>
              <span className="text-[10px] text-[#6F7782]">3-6 days</span>
            </button>
            <button
              onClick={() => handleRate('easy')}
              className="rounded-xl border border-[#6D9B73]/30 bg-[#6D9B73]/15 p-3 text-center transition-all hover:bg-[#6D9B73]/25"
            >
              <span className="block text-xs font-black text-[#2e6935]">Easy</span>
              <span className="text-[10px] text-[#6F7782]">7+ days</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-[#6F7782]">
          Click card to reveal definition, code, and SM-2 feedback controls.
        </p>
      )}
    </div>
  );
}
