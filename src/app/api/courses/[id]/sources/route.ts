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
  const materials = await DB.getMaterials(auth.userId, courseId, auth.supabase);
  const sources = await DB.getSources(auth.userId, courseId);

  return NextResponse.json({
    courseId,
    materials,
    sources,
  });
}
