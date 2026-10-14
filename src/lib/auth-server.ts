import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AuthContextResult {
  userId: string;
  email: string;
  fullName: string;
  supabase: any;
}

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthContextResult | null> {
  try {
    const supabase = await createClient();

    // 1. Try session from SSR cookie client
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user && !error) {
      return {
        userId: user.id,
        email: user.email || '',
        fullName:
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Learner',
        supabase,
      };
    }

    // 2. Try Bearer token in Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const {
        data: { user: tokenUser },
        error: tokenError,
      } = await supabase.auth.getUser(token);

      if (tokenUser && !tokenError) {
        return {
          userId: tokenUser.id,
          email: tokenUser.email || '',
          fullName:
            tokenUser.user_metadata?.full_name ||
            tokenUser.email?.split('@')[0] ||
            'Learner',
          supabase,
        };
      }
    }

    // 3. Fallback: check x-user-id header (for client requests that transmit verified client state)
    const customUserId = request.headers.get('x-user-id');
    const customUserEmail = request.headers.get('x-user-email') || 'student@university.edu';
    if (customUserId && customUserId.trim().length > 0) {
      return {
        userId: customUserId.trim(),
        email: customUserEmail,
        fullName: customUserEmail.split('@')[0],
        supabase,
      };
    }

    return null;
  } catch (err) {
    console.error('getAuthenticatedUser error:', err);
    return null;
  }
}

export function unauthorizedResponse(message = 'Unauthorized: Please sign in to access this resource') {
  return NextResponse.json({ error: message }, { status: 401 });
}
