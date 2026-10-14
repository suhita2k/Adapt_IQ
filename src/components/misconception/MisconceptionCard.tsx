'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code2,
  RotateCcw,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Misconception, Question } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

interface MisconceptionCardProps {
  misconception: Misconception;
  onResolved?: () => void;
}

export default function MisconceptionCard({ misconception, onResolved }: MisconceptionCardProps) {
  const { user, profile } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [isRetesting, setIsRetesting] = useState(false);
  const [verificationQ, setVerificationQ] = useState<Question | null>(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [retestSubmitted, setRetestSubmitted] = useState(false);
  const [retestPassed, setRetestPassed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartRetest = async () => {
    setIsRetesting(true);
    setRetestSubmitted(false);
    setSelectedOptionId(null);
    setLoadingQ(true);

    try {
      const questions = await api.generateAssessment({
        courseId: misconception.course_id,
        conceptId: misconception.concept_id,
        count: 1,
        language: profile?.preferred_language || 'English',
      });
      if (questions && questions.length > 0) {
        setVerificationQ(questions[0]);
      } else {
        // Fallback dynamic question based on the misconception
        setVerificationQ({
          id: `retest-${misconception.id}`,
          course_id: misconception.course_id,
          concept_id: misconception.concept_id,
          concept_name: misconception.concept_name,
          question_type: 'mcq',
          explanation: 'Ensures the execution stack preserves correctness and terminates in finite time.',
          difficulty: 'medium',
          bloom_level: 'Apply',
          question_text: `To prevent the invariant failure "${misconception.title}" in ${misconception.concept_name}, which condition must be strictly guaranteed?`,
          options: [
            {
              id: 'opt-corr',
              text: 'The base terminating guard must execute and return before any subsequent recursive calls or state mutations occur.',
              is_correct: true,
              explanation: 'Ensures the execution stack preserves correctness and terminates in finite time.',
            },
            {
              id: 'opt-wr-1',
              text: 'The function should execute indefinitely until memory allocation halts.',
              is_correct: false,
              explanation: 'Omitting a termination condition triggers stack overflow.',
            },
            {
              id: 'opt-wr-2',
              text: 'Intermediate states should be discarded without checking boundaries.',
              is_correct: false,
              explanation: 'Boundary verification is required for induction invariants.',
            },
          ],
          source_citation: {
            material_title: misconception.concept_name,
            reference: 'Core Invariant',
            quote: 'A valid invariant must be preserved across each transition.',
          },
        });
      }
    } catch (err) {
      console.warn('Error loading verification question:', err);
    } finally {
      setLoadingQ(false);
    }
  };

  const handleRetestSubmit = async () => {
    if (!selectedOptionId || !user || !verificationQ) return;
    setIsSubmitting(true);
    setRetestSubmitted(true);
    const selected = verificationQ.options.find((o) => o.id === selectedOptionId);
    const passed = !!selected?.is_correct;
    setRetestPassed(passed);

    try {
      await api.submitRetest(misconception.id, passed);
      if (passed) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
        onResolved?.();
      }
    } catch (err) {
      console.warn('Retest submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolved = misconception.status === 'retested_pass' || retestPassed;

  return (
    <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isResolved
                ? 'bg-[#6D9B73]/15 border border-[#6D9B73]/30'
                : 'bg-[#B85C5C]/15 border border-[#B85C5C]/30'
            }`}
          >
            {isResolved ? (
              <CheckCircle2 className="h-5 w-5 text-[#6D9B73]" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#B85C5C]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#26313D] bg-[#E8E0C9] px-2 py-0.5 rounded border border-[#DDD6C5]">
                Concept: {misconception.concept_name}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isResolved
                    ? 'bg-[#6D9B73]/15 text-[#6D9B73] border-[#6D9B73]/30'
                    : 'bg-[#B85C5C]/15 text-[#B85C5C] border-[#B85C5C]/30'
                }`}
              >
                {isResolved ? 'Resolved & Verified' : 'Active Learning Gap'}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#26313D] mt-1.5">{misconception.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isResolved && !isRetesting && (
            <button
              onClick={handleStartRetest}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              Retest Knowledge
            </button>
          )}
        </div>
      </div>

      {/* Description & Trigger Evidence */}
      <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 space-y-2 text-xs">
        <p className="text-[#26313D] leading-relaxed">{misconception.description}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-[#6F7782] pt-1 border-t border-[#DDD6C5]/70">
          <span className="font-semibold text-[#B85C5C]">Trigger Evidence:</span>
          <span>{misconception.trigger_evidence}</span>
        </div>
      </div>

      {/* Remediation Steps (Socratic Proof) */}
      {!isRetesting ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6F7782]">
              Socratic Invariant Proof (3 Steps)
            </h4>
            <span className="text-xs text-[#6F7782]">
              Step {activeStep + 1} of {misconception.remediation_steps.length}
            </span>
          </div>

          {/* Step Pill Indicators */}
          <div className="flex items-center gap-2">
            {misconception.remediation_steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition-all border ${
                  activeStep === idx
                    ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs'
                    : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:bg-[#EFE8D6]'
                }`}
              >
                Step {step.step_number}: {step.title.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Active Step Content */}
          {misconception.remediation_steps[activeStep] && (
            <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 space-y-4 shadow-xs">
              <h5 className="font-bold text-sm text-[#26313D]">
                {misconception.remediation_steps[activeStep].title}
              </h5>

              <p className="text-xs sm:text-sm text-[#26313D] leading-relaxed">
                {misconception.remediation_steps[activeStep].explanation}
              </p>

              {/* Code Example if present */}
              {misconception.remediation_steps[activeStep].code_example && (
                <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 font-mono text-xs text-[#26313D] overflow-x-auto">
                  <pre>{misconception.remediation_steps[activeStep].code_example}</pre>
                </div>
              )}

              {/* Verified Textbook Quote */}
              <div className="rounded-xl border border-[#B1A15A]/40 bg-[#FAF5E8] p-3 text-xs text-[#26313D] flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-[#B1A15A] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-[11px] text-[#B1A15A] uppercase tracking-wider block">
                    Verified Citation: {misconception.remediation_steps[activeStep].source_ref}
                  </span>
                  <p className="italic text-[#6F7782]">
                    &ldquo;{misconception.remediation_steps[activeStep].verified_quote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Navigation Between Steps */}
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((prev) => prev - 1)}
                  className="rounded-lg border border-[#DDD6C5] px-3 py-1.5 text-xs font-bold text-[#5E6A7A] hover:bg-[#FAF5E8] disabled:opacity-40"
                >
                  Previous Step
                </button>

                {activeStep < misconception.remediation_steps.length - 1 ? (
                  <button
                    onClick={() => setActiveStep((prev) => prev + 1)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#5E6A7A] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#4F5A68]"
                  >
                    Next Step <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartRetest}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#B1A15A] px-4 py-1.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5" /> Start Retest Verification
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Retest Verification Section */
        <div className="rounded-xl border border-[#B1A15A]/60 bg-[#FAF5E8] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#26313D] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#B1A15A]" />
              Verification Retest Challenge
            </span>
            <button
              onClick={() => setIsRetesting(false)}
              className="text-xs font-bold text-[#5E6A7A] hover:text-[#26313D]"
            >
              Back to Remediation
            </button>
          </div>

          {loadingQ ? (
            <div className="p-8 text-center space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#B1A15A] mx-auto" />
              <p className="text-xs text-[#6F7782]">Generating verification challenge for {misconception.concept_name}...</p>
            </div>
          ) : verificationQ ? (
            <>
              <h4 className="text-sm font-bold text-[#26313D]">{verificationQ.question_text}</h4>

              {verificationQ.code_snippet && (
                <div className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-3 font-mono text-xs text-[#26313D]">
                  <pre>{verificationQ.code_snippet}</pre>
                </div>
              )}

              <div className="space-y-2">
                {verificationQ.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  let styling = 'border-[#DDD6C5] bg-[#FFFDF7] text-[#26313D] hover:border-[#B1A15A]';

                  if (retestSubmitted) {
                    if (opt.is_correct) styling = 'border-[#6D9B73] bg-[#6D9B73]/15 text-[#26313D]';
                    else if (isSelected) styling = 'border-[#B85C5C] bg-[#B85C5C]/15 text-[#26313D]';
                  } else if (isSelected) {
                    styling = 'border-2 border-[#B1A15A] bg-[#E8E0C9] text-[#26313D] shadow-xs';
                  }

                  return (
                    <button
                      key={opt.id}
                      disabled={retestSubmitted}
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`w-full text-left rounded-xl border p-3 text-xs font-medium transition-all ${styling}`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              {!retestSubmitted ? (
                <button
                  onClick={handleRetestSubmit}
                  disabled={!selectedOptionId || isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#B1A15A] py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-40 shadow-xs"
                >
                  {isSubmitting ? 'Evaluating...' : 'Submit Retest Answer'}
                </button>
              ) : (
                <div className="pt-2 space-y-3 text-center">
                  {retestPassed ? (
                    <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-4 space-y-1">
                      <p className="text-xs font-bold text-[#6D9B73]">
                        🎉 Retest Passed! Misconception Cleared & Mastery Updated
                      </p>
                      <p className="text-[11px] text-[#6F7782]">
                        Your {misconception.concept_name} mastery in the Student Learning Twin has been updated.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#B85C5C]/40 bg-[#B85C5C]/10 p-4 space-y-2">
                      <p className="text-xs font-bold text-[#B85C5C]">
                        Retest was not yet successful. Review the {misconception.concept_name} invariants again.
                      </p>
                      <button
                        onClick={() => {
                          setRetestSubmitted(false);
                          setSelectedOptionId(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#5E6A7A] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4F5A68]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Try Retest Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
