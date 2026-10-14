import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  try {
    const body = await request.json();
    const isCorrect = body.isCorrect ?? body.passed ?? false;

    const misconceptions = await DB.getMisconceptions(auth.userId, undefined, auth.supabase);
    const item = misconceptions.find((m) => m.id === id);
    if (!item) {
      return NextResponse.json({ error: 'Misconception not found' }, { status: 404 });
    }

    if (isCorrect) {
      item.status = 'retested_pass';
      await DB.recordMisconception(auth.userId, item, auth.supabase);

      // 1. Reward concept mastery in BKT model (updates Student Learning Twin)
      const updatedMastery = await DB.updateMasteryBKT(
        auth.userId,
        item.concept_id,
        true,
        item.course_id,
        item.concept_name,
        auth.supabase
      );

      // 2. Mark remediation task as completed in Study Plan
      await DB.markStudyTaskCompleted(
        auth.userId,
        { taskType: 'remediation', conceptId: item.concept_id },
        auth.supabase
      );

      return NextResponse.json({
        success: true,
        passed: true,
        status: item.status,
        misconception: item,
        mastery: updatedMastery,
      });
    } else {
      // Invariant still violated: maintain active status
      item.status = 'active';
      await DB.recordMisconception(auth.userId, item, auth.supabase);

      const updatedMastery = await DB.updateMasteryBKT(
        auth.userId,
        item.concept_id,
        false,
        item.course_id,
        item.concept_name,
        auth.supabase
      );

      return NextResponse.json({
        success: true,
        passed: false,
        status: item.status,
        misconception: item,
        mastery: updatedMastery,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
