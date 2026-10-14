import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { id: bankId } = await params;

  try {
    const bank = await DB.getQuestionBankById(auth.userId, bankId, auth.supabase);
    if (!bank) {
      return NextResponse.json({ error: 'Question Bank not found' }, { status: 404 });
    }

    return NextResponse.json({ bank });
  } catch (err: any) {
    console.error('Error fetching question bank:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { id: targetId } = await params;
  const { searchParams } = new URL(request.url);
  const isQuestion = searchParams.get('type') === 'question';

  try {
    if (isQuestion) {
      await DB.deleteSavedQuestion(auth.userId, targetId, auth.supabase);
      return NextResponse.json({ success: true, message: 'Saved question deleted' });
    }

    await DB.deleteQuestionBank(auth.userId, targetId, auth.supabase);
    return NextResponse.json({ success: true, message: 'Question bank deleted' });
  } catch (err: any) {
    console.error('Error deleting question bank:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
