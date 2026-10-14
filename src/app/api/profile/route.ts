import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { UserProfile } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  let profile = await DB.getProfile(auth.userId, auth.supabase);
  if (!profile) {
    profile = {
      id: `profile-${auth.userId}`,
      user_id: auth.userId,
      full_name: auth.fullName,
      email: auth.email,
      preferred_language: 'English',
      learning_goal: 'Exam preparation & concept mastery',
      study_field: 'Computer Science',
      daily_study_time_minutes: 60,
      onboarding_completed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await DB.saveProfile(profile, auth.supabase);
  }

  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    let profile = await DB.getProfile(auth.userId, auth.supabase);

    const updatedProfile: UserProfile = {
      id: profile?.id || `profile-${auth.userId}`,
      user_id: auth.userId,
      full_name: body.full_name ?? profile?.full_name ?? auth.fullName,
      email: profile?.email ?? auth.email,
      avatar_url: body.avatar_url ?? profile?.avatar_url,
      preferred_language: body.preferred_language ?? profile?.preferred_language ?? 'English',
      learning_goal: body.learning_goal ?? profile?.learning_goal ?? 'Exam preparation & concept mastery',
      study_field: body.study_field ?? profile?.study_field ?? 'Computer Science',
      daily_study_time_minutes: body.daily_study_time_minutes ?? profile?.daily_study_time_minutes ?? 60,
      onboarding_completed: body.onboarding_completed ?? profile?.onboarding_completed ?? true,
      created_at: profile?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = await DB.saveProfile(updatedProfile, auth.supabase);
    return NextResponse.json({ profile: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}

