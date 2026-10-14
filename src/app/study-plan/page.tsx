'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import StudyPlanView from '@/components/study/StudyPlanView';

export default function StudyPlanPage() {
  return (
    <AppShell
      headerTitle="Personalized Dynamic Study Plan"
      headerSubtitle="Algorithmic schedule balancing upcoming exam deadlines, forgetting risks, daily study budget, and urgent misconception repairs."
    >
      <StudyPlanView />
    </AppShell>
  );
}
