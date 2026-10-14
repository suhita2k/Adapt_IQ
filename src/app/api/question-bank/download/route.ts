import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { generateQuestionBankPdfBuffer } from '@/lib/pdfGenerator';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const bankId = searchParams.get('bankId');
  const paperType = (searchParams.get('type') || '2_mark') as '2_mark' | '16_mark';
  const courseId = searchParams.get('courseId');

  try {
    let pdfBuffer: Buffer | null = null;
    let filename = `${paperType === '2_mark' ? '2_Mark' : '16_Mark'}_Questions_and_Answers.pdf`;

    // 1. Try to read from saved user PDF cache by bankId
    if (bankId) {
      const cached = DB.getUserPdf(auth.userId, `${bankId}.pdf`);
      if (cached) {
        pdfBuffer = cached;
      }
    }

    // 2. If not found in cache or courseId provided, regenerate dynamically from verified DB bank
    if (!pdfBuffer && bankId) {
      const bank = await DB.getQuestionBankById(auth.userId, bankId, auth.supabase);
      if (bank && bank.questions && bank.questions.length > 0) {
        const userProfile = await DB.getProfile(auth.userId, auth.supabase);
        const course = await DB.getCourseById(auth.userId, bank.course_id, auth.supabase);

        pdfBuffer = await generateQuestionBankPdfBuffer({
          courseTitle: bank.course_title || course?.title || 'Course',
          courseCode: course?.code,
          category: course?.category,
          paperType,
          questions: bank.questions,
          userFullName: userProfile?.full_name || 'ADAPTIQ Learner',
        });

        // Cache for subsequent clicks
        DB.saveUserPdf(auth.userId, `${bankId}.pdf`, pdfBuffer);
        const safeCourseTitle = (bank.course_title || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
        filename = `${safeCourseTitle}_${paperType === '2_mark' ? '2_Mark' : '16_Mark'}_Questions_and_Answers.pdf`;
      }
    }

    // 3. Fallback: if courseId provided without bankId, find latest saved questions for this course & paperType
    if (!pdfBuffer && courseId) {
      const course = await DB.getCourseById(auth.userId, courseId, auth.supabase);
      const savedQuestions = await DB.getSavedQuestions(auth.userId, courseId, auth.supabase);
      const filtered = savedQuestions.filter((q) => q.question_type === paperType);

      if (filtered.length > 0 && course) {
        const userProfile = await DB.getProfile(auth.userId, auth.supabase);
        pdfBuffer = await generateQuestionBankPdfBuffer({
          courseTitle: course.title,
          courseCode: course.code,
          category: course.category,
          paperType,
          questions: filtered,
          userFullName: userProfile?.full_name || 'ADAPTIQ Learner',
        });
        const safeCourseTitle = course.title.replace(/[^a-zA-Z0-9_-]/g, '_');
        filename = `${safeCourseTitle}_${paperType === '2_mark' ? '2_Mark' : '16_Mark'}_Questions_and_Answers.pdf`;
      }
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        {
          error: 'PDF file not found. Please click "Analyse Course & Generate Questions" to generate the papers first.',
        },
        { status: 404 }
      );
    }

    // Convert Buffer to Uint8Array for Next.js Response body
    const uint8Array = new Uint8Array(pdfBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(uint8Array.byteLength),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    console.error('PDF download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
