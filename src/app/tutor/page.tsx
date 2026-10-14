'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import TutorChat from '@/components/tutor/TutorChat';

export default function TutorPage() {
  return (
    <AppShell
      headerTitle="AI Course Evidence Tutor"
      headerSubtitle="Conversational AI tutor strictly grounded in your uploaded course materials with exact textbook page, slide, and lecture citations."
    >
      <TutorChat />
    </AppShell>
  );
}
