import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { Assessment } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') || undefined;

  const assessments = await DB.getAssessments(auth.userId, courseId, auth.supabase);
  return NextResponse.json(assessments);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const assessment: Assessment = {
      id: body.id || `as-${Date.now()}`,
      user_id: auth.userId,
      course_id: body.course_id || body.courseId || 'unassigned',
      title: body.title || 'Adaptive Diagnostic Assessment',
      status: body.status || 'completed',
      total_questions: body.total_questions || body.totalQuestions || 20,
      completed_questions: body.completed_questions || body.completedQuestions || 20,
      score_percentage: body.score_percentage ?? body.scorePercentage ?? 0,
      started_at: body.started_at || body.startedAt || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      questions: body.questions || [],
      current_index: body.current_index ?? body.currentIndex ?? 0,
      answers: body.answers || {},
    };

    const saved = await DB.recordAssessment(auth.userId, assessment, auth.supabase);

    // Completing an assessment updates the Study Plan diagnostic task
    await DB.markStudyTaskCompleted(auth.userId, { taskType: 'practice_quiz' }, auth.supabase);

    return NextResponse.json(saved);
  } catch (err: any) {
    console.error('Failed to record assessment:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
