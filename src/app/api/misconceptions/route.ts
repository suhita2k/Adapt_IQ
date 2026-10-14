import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') || undefined;

  const misconceptions = await DB.getMisconceptions(auth.userId, courseId, auth.supabase);
  return NextResponse.json({ misconceptions });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const misconception = await DB.recordMisconception(auth.userId, {
      ...body,
      user_id: auth.userId,
    });
    return NextResponse.json({ misconception });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
