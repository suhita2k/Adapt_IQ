import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { Flashcard } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  let courseId = searchParams.get('courseId') || undefined;

  const userCourses = await DB.getCourses(auth.userId, auth.supabase);
  if (!userCourses || userCourses.length === 0) {
    return NextResponse.json({
      flashcards: [],
      message: 'No courses found. Create a course and upload materials to begin spaced revision.',
    });
  }

  const targetCourseId = courseId || userCourses[0].id;
  const course = userCourses.find((c) => c.id === targetCourseId) || (await DB.getCourseById(auth.userId, targetCourseId, auth.supabase));

  let flashcards = await DB.getFlashcards(auth.userId, targetCourseId, auth.supabase);

  // If no flashcards exist yet, auto-generate from the course's real concepts and materials
  if (flashcards.length === 0 && course) {
    const concepts = await DB.getConcepts(auth.userId, targetCourseId);
    const materials = await DB.getMaterials(auth.userId, targetCourseId, auth.supabase);
    const sources = await DB.getSources(auth.userId, targetCourseId);

    if (concepts.length > 0) {
      const generatedCards: Flashcard[] = concepts.map((c, idx) => {
        const matchingSource = sources.find(
          (s) => s.snippet.toLowerCase().includes(c.name.toLowerCase()) || s.relevance_reason?.toLowerCase().includes(c.name.toLowerCase())
        );

        const sourceRef = matchingSource
          ? `${matchingSource.material_title} (${matchingSource.location_reference})`
          : materials[0]?.title || course.title;

        return {
          id: `fc-${targetCourseId}-${c.id || idx}`,
          user_id: auth.userId,
          course_id: targetCourseId,
          concept_id: c.id,
          concept_name: c.name,
          front: `What is the core definition and invariant of ${c.name}?`,
          back: `${c.description}\n\nVerified Grounding: "${matchingSource?.snippet || 'Foundational syllabus rule.'}"`,
          source_ref: sourceRef,
          next_review_date: new Date().toISOString().split('T')[0],
          interval_days: 1,
          repetitions: 0,
          ease_factor: 2.50,
        };
      });

      await DB.saveFlashcards(auth.userId, generatedCards, auth.supabase);
      flashcards = generatedCards;
    }
  }

  // Connect Learning Twin mastery to Spaced Revision queue:
  // Prioritize critical/high risk concepts and lowest mastery concepts first
  const masteryList = await DB.getMastery(auth.userId, targetCourseId, auth.supabase);
  const masteryMap = new Map(masteryList.map((m) => [m.concept_id, m]));

  flashcards.sort((a, b) => {
    const mA = masteryMap.get(a.concept_id);
    const mB = masteryMap.get(b.concept_id);
    const riskA = mA?.forgetting_risk === 'critical' ? 4 : mA?.forgetting_risk === 'high' ? 3 : mA?.forgetting_risk === 'medium' ? 2 : 1;
    const riskB = mB?.forgetting_risk === 'critical' ? 4 : mB?.forgetting_risk === 'high' ? 3 : mB?.forgetting_risk === 'medium' ? 2 : 1;
    if (riskA !== riskB) return riskB - riskA;

    const probA = mA?.mastery_probability ?? 0.5;
    const probB = mB?.mastery_probability ?? 0.5;
    return probA - probB;
  });

  return NextResponse.json({ flashcards, courseId: targetCourseId });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { cardId, rating } = await request.json();
    if (!cardId || rating === undefined) {
      return NextResponse.json({ error: 'cardId and rating (1-5) are required' }, { status: 400 });
    }

    const updatedCard = await DB.reviewFlashcard(auth.userId, cardId, Number(rating), auth.supabase);
    if (!updatedCard) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      flashcard: updatedCard,
      card: updatedCard,
      intervalDays: updatedCard.interval_days,
      nextReviewDate: updatedCard.next_review_date,
    });
  } catch (err: any) {
    console.error('Flashcard review error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
