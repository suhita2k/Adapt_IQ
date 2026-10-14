'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import AdaptiveQuiz from '@/components/assessment/AdaptiveQuiz';

export default function AssessmentPage() {
  return (
    <AppShell
      headerTitle="Adaptive Diagnostic Assessment"
      headerSubtitle="Real-time multi-level evaluation targeting known misconceptions, prerequisite invariants, and concept mastery curves."
    >
      <AdaptiveQuiz />
    </AppShell>
  );
}
