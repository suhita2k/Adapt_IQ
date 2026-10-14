import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { id: courseId } = await params;
  const course = await DB.getCourseById(auth.userId, courseId, auth.supabase);
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const concepts = await DB.getConcepts(auth.userId, courseId);
  const relationships = await DB.getRelationships(auth.userId, courseId);
  let mastery = await DB.getMastery(auth.userId, courseId, auth.supabase);
  if (mastery.length === 0 && concepts.length > 0) {
    mastery = await DB.initializeCourseMastery(auth.userId, courseId, concepts);
  }

  return NextResponse.json({
    courseId,
    courseTitle: course.title,
    concepts,
    relationships,
    mastery,
  });
}
