import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  const course = await DB.getCourseById(auth.userId, id, auth.supabase);
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const materials = await DB.getMaterials(auth.userId, id, auth.supabase);
  const concepts = await DB.getConcepts(auth.userId, id);
  const mastery = await DB.getMastery(auth.userId, id, auth.supabase);

  return NextResponse.json({
    course,
    materials,
    concepts,
    mastery,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  await DB.deleteCourse(auth.userId, id, auth.supabase);
  return NextResponse.json({ success: true });
}
