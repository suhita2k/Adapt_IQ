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
    const { stepNumber, notes } = await request.json();

    const misconceptions = await DB.getMisconceptions(auth.userId);
    const item = misconceptions.find((m) => m.id === id);
    if (!item) {
      return NextResponse.json({ error: 'Misconception not found' }, { status: 404 });
    }

    // If student has worked through all steps, mark as remediated
    if (stepNumber >= item.remediation_steps.length) {
      item.status = 'remediated';
      await DB.recordMisconception(auth.userId, item);
    }

    return NextResponse.json({
      success: true,
      currentStep: stepNumber,
      status: item.status,
      misconception: item,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
