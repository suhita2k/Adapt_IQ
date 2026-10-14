'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import FlashcardDeck from '@/components/revision/FlashcardDeck';
import {
  Layers,
  FileText,
  Presentation,
  Volume2,
  VolumeX,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { Course, WeakTopicRevisionPackage } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

export default function RevisionPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'spaced_cards' | 'weak_topic_hub'>('spaced_cards');

  // Weak topic hub state
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedConceptId, setSelectedConceptId] = useState<string>('auto');
  const [allConcepts, setAllConcepts] = useState<any[]>([]);
  const [revisionPkg, setRevisionPkg] = useState<WeakTopicRevisionPackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(false);

  // Mini slides pagination
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  // Audio brief playback state (SpeechSynthesis)
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Practice question reveal state
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!user) return;
    api.getCourses()
      .then((userCourses) => {
        setCourses(userCourses);
        if (userCourses.length > 0) {
          setSelectedCourseId(userCourses[0].id);
        }
      })
      .catch(console.warn);
  }, [user]);

  const fetchRevisionPackage = (cId: string, conceptId = 'auto') => {
    if (!cId) return;
    setLoadingPkg(true);
    fetch(`/api/revision/package?courseId=${cId}&conceptId=${conceptId}&language=${profile?.preferred_language || 'English'}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.package) {
          setRevisionPkg(data.package);
          setActiveSlideIdx(0);
          setRevealedQuestions({});
        }
        if (data.all_weak_concepts) {
          setAllConcepts(data.all_weak_concepts);
        }
      })
      .catch(console.warn)
      .finally(() => setLoadingPkg(false));
  };

  useEffect(() => {
    if (activeTab === 'weak_topic_hub' && selectedCourseId) {
      fetchRevisionPackage(selectedCourseId, selectedConceptId);
    }
  }, [activeTab, selectedCourseId, selectedConceptId]);

  // Audio brief TTS
  const handleToggleAudio = () => {
    if (!window.speechSynthesis || !revisionPkg?.audio_brief_script) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(revisionPkg.audio_brief_script);

    // Language matching
    const pref = profile?.preferred_language || 'English';
    const langCodeMap: Record<string, string> = {
      Tamil: 'ta-IN',
      Hindi: 'hi-IN',
      Spanish: 'es-ES',
      French: 'fr-FR',
      English: 'en-US',
    };
    utterance.lang = langCodeMap[pref] || 'en-US';
    utterance.rate = 0.95;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const toggleQuestionReveal = (idx: number) => {
    setRevealedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <AppShell
      headerTitle="Multimodal Revision & Spaced Repetition Hub"
      headerSubtitle="Review critical invariants, definitions, and code structures before cognitive decay causes memory lapses. Grounded in your uploaded course materials."
    >
      <div className="space-y-6">
        {/* Navigation Mode Switcher */}
        <div className="flex items-center gap-2 border-b border-[#DDD6C5] pb-2 text-xs font-bold">
          <button
            onClick={() => {
              if (isSpeaking) window.speechSynthesis.cancel();
              setActiveTab('spaced_cards');
            }}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'spaced_cards'
                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                : 'text-[#6F7782] hover:text-[#26313D] hover:bg-[#FAF5E8]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Spaced Repetition Flashcards (SM-2)
          </button>
          <button
            onClick={() => setActiveTab('weak_topic_hub')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'weak_topic_hub'
                ? 'bg-[#B1A15A] text-[#26313D] shadow-xs'
                : 'text-[#6F7782] hover:text-[#26313D] hover:bg-[#FAF5E8]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Weak-Topic Revision Material Hub
          </button>
        </div>

        {/* Tab 1: Existing Flashcard Deck (Preserved) */}
        {activeTab === 'spaced_cards' && <FlashcardDeck />}

        {/* Tab 2: Weak-Topic Revision Material Hub */}
        {activeTab === 'weak_topic_hub' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Subject & Weak Concept Selector Bar */}
            <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#B1A15A]" />
                  <span className="text-[#6F7782] font-semibold">Course:</span>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1 font-bold text-[#26313D] text-xs focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {allConcepts.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#6F7782] font-semibold">Target Concept:</span>
                    <select
                      value={selectedConceptId}
                      onChange={(e) => setSelectedConceptId(e.target.value)}
                      className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1 font-bold text-[#26313D] text-xs focus:outline-none"
                    >
                      <option value="auto">Auto (Lowest Mastery First)</option>
                      {allConcepts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.mastery_percentage}% mastery) {c.is_weak ? '⚠️' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={() => fetchRevisionPackage(selectedCourseId, selectedConceptId)}
                className="inline-flex items-center gap-1 rounded-md bg-[#FAF5E8] px-3 py-1 border border-[#DDD6C5] font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all"
              >
                <RefreshCw className="w-3 h-3 text-[#B1A15A]" /> Regenerate Material
              </button>
            </div>

            {loadingPkg ? (
              <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#B1A15A] mx-auto" />
                <h4 className="text-sm font-bold text-[#26313D]">
                  Synthesizing Grounded Revision Package...
                </h4>
                <p className="text-xs text-[#6F7782]">
                  Extracting mini-slides, audio briefs, revision notes, and practice questions from course materials.
                </p>
              </div>
            ) : !revisionPkg ? (
              <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3">
                <FolderOpen className="w-8 h-8 text-[#B1A15A] mx-auto" />
                <h4 className="text-sm font-bold text-[#26313D]">No Revision Package Available</h4>
                <p className="text-xs text-[#6F7782]">
                  Upload course materials and complete a diagnostic assessment to identify weak concepts.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Header Card with Concept & Mastery */}
                <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#B85C5C] bg-[#B85C5C]/10 px-2 py-0.5 rounded border border-[#B85C5C]/30">
                      Weak Concept Remediation
                    </span>
                    <h3 className="text-xl font-black text-[#26313D]">{revisionPkg.concept_name}</h3>
                    <p className="text-xs text-[#6F7782]">
                      Current Student Mastery: <strong className="text-[#26313D]">{revisionPkg.mastery_percentage}%</strong> (Below 65% benchmark threshold)
                    </p>
                  </div>

                  {/* Audio Brief Play Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleAudio}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs ${
                        isSpeaking
                          ? 'bg-[#B85C5C] text-white hover:bg-[#9E4B4B]'
                          : 'bg-[#B1A15A] text-[#26313D] hover:bg-[#9E8F4B]'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-4 h-4 animate-pulse" /> Stop Audio Brief
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" /> Listen to Audio Brief (60s)
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Spoken Audio Brief Script Section */}
                <div className="rounded-2xl border border-[#DDD6C5] bg-[#FAF5E8] p-5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-[#26313D]">
                    <span className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-[#B1A15A]" /> Audio Tutoring Brief Script
                    </span>
                    <span className="text-[10px] text-[#6F7782] font-semibold">
                      Speech-to-Text &amp; TTS Aligned
                    </span>
                  </div>
                  <p className="text-xs text-[#26313D] leading-relaxed italic pl-6 border-l-2 border-[#B1A15A]">
                    &ldquo;{revisionPkg.audio_brief_script}&rdquo;
                  </p>
                </div>

                {/* 3. Mini Slides Deck Viewer */}
                {revisionPkg.mini_slides.length > 0 && (
                  <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
                      <h4 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                        <Presentation className="w-4 h-4 text-[#B1A15A]" />
                        Mini Slide Deck ({activeSlideIdx + 1} of {revisionPkg.mini_slides.length})
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveSlideIdx((prev) => Math.max(0, prev - 1))}
                          disabled={activeSlideIdx === 0}
                          className="p-1 rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] text-[#26313D] disabled:opacity-40"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setActiveSlideIdx((prev) => Math.min(revisionPkg.mini_slides.length - 1, prev + 1))
                          }
                          disabled={activeSlideIdx === revisionPkg.mini_slides.length - 1}
                          className="p-1 rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] text-[#26313D] disabled:opacity-40"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Active Slide Presentation View */}
                    <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-6 space-y-4 min-h-[180px] flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-base font-bold text-[#26313D]">
                            {revisionPkg.mini_slides[activeSlideIdx]?.title}
                          </h5>
                          <span className="text-[11px] font-bold text-[#6F7782]">
                            Slide {revisionPkg.mini_slides[activeSlideIdx]?.slide_number}
                          </span>
                        </div>

                        <ul className="space-y-2 text-xs text-[#26313D]">
                          {(revisionPkg.mini_slides[activeSlideIdx]?.bullet_points || revisionPkg.mini_slides[activeSlideIdx]?.bullets || []).map((pt: string, pIdx: number) => (
                            <li key={pIdx} className="flex items-start gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#B1A15A] mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Source Citation */}
                      <div className="pt-2 border-t border-[#DDD6C5]/60 flex items-center justify-between text-[11px] text-[#6F7782]">
                        <span className="font-semibold flex items-center gap-1 text-[#26313D]">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#6D9B73]" />
                          Origin: {revisionPkg.mini_slides[activeSlideIdx]?.source_location || revisionPkg.mini_slides[activeSlideIdx]?.citation || 'Course Materials'}
                        </span>
                        <span>Ground truth verified</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Quick Summary & Structured Revision Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quick Summary */}
                  <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-3 shadow-xs">
                    <h4 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#B1A15A]" /> Quick Summary
                    </h4>
                    <p className="text-xs text-[#26313D] leading-relaxed whitespace-pre-line">
                      {revisionPkg.quick_summary}
                    </p>
                  </div>

                  {/* Revision Notes */}
                  <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-3 shadow-xs">
                    <h4 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#B1A15A]" /> Revision Notes
                    </h4>
                    <div className="text-xs text-[#26313D] leading-relaxed whitespace-pre-line font-mono bg-[#FAF5E8] p-3 rounded-xl border border-[#DDD6C5]">
                      {revisionPkg.revision_notes}
                    </div>
                  </div>
                </div>

                {/* 5. Targeted Practice Questions */}
                {revisionPkg.practice_questions.length > 0 && (
                  <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-xs">
                    <h4 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#B1A15A]" /> Grounded Practice Questions
                    </h4>

                    <div className="space-y-3">
                      {revisionPkg.practice_questions.map((pq, pqIdx) => {
                        const isRevealed = revealedQuestions[pqIdx];
                        return (
                          <div
                            key={pqIdx}
                            className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 space-y-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-bold text-[#26313D] leading-relaxed">
                                {pqIdx + 1}. {pq.question}
                              </p>
                              <button
                                onClick={() => toggleQuestionReveal(pqIdx)}
                                className="shrink-0 inline-flex items-center gap-1 rounded-md bg-[#FFFDF7] px-2.5 py-1 text-[11px] font-bold border border-[#DDD6C5] text-[#26313D] hover:bg-[#E8E0C9]"
                              >
                                {isRevealed ? (
                                  <>
                                    <EyeOff className="w-3 h-3" /> Hide Answer
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3" /> Reveal Answer
                                  </>
                                )}
                              </button>
                            </div>

                            {isRevealed && (
                              <div className="pt-2 border-t border-[#DDD6C5] space-y-1.5 animate-in fade-in">
                                <p className="font-semibold text-[#2e6935]">
                                  Answer: {pq.correct_answer || pq.answer}
                                </p>
                                <p className="text-[#6F7782]">{pq.explanation || pq.hint}</p>
                                <span className="inline-block text-[10px] font-bold text-[#B1A15A] bg-[#FFFDF7] px-2 py-0.5 rounded border border-[#DDD6C5]">
                                  Citation: {pq.source_citation || 'Verified Course Materials'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
