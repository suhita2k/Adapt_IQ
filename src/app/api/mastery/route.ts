import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') || undefined;

  const [mastery, metrics] = await Promise.all([
    DB.getMastery(auth.userId, courseId, auth.supabase),
    DB.getLearningTwinMetrics(auth.userId, courseId, auth.supabase),
  ]);

  return NextResponse.json({ mastery, metrics });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { conceptId, isCorrect, courseId } = await request.json();
    if (!conceptId) {
      return NextResponse.json({ error: 'conceptId is required' }, { status: 400 });
    }

    const updated = await DB.updateMasteryBKT(
      auth.userId,
      conceptId,
      Boolean(isCorrect),
      courseId,
      undefined,
      auth.supabase
    );

    return NextResponse.json({ mastery: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
