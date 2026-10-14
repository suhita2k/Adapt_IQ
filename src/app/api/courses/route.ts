import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const courses = await DB.getCourses(auth.userId, auth.supabase);
  return NextResponse.json({ courses });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Course title is required' }, { status: 400 });
    }

    const course = await DB.createCourse(
      auth.userId,
      {
        title: body.title.trim(),
        code: body.code?.trim(),
        description: body.description?.trim() || '',
        category: body.category || 'Computer Science',
        color: body.color || '#B1A15A',
        icon: body.icon || 'BookOpen',
      },
      auth.supabase
    );

    return NextResponse.json({ course }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
