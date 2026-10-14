import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { QuestionBank, SmartQuestion } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') || undefined;
  const includeQuestions = searchParams.get('includeQuestions') === 'true';

  try {
    const banks = await DB.getQuestionBanks(auth.userId, courseId, auth.supabase);
    let savedQuestions: SmartQuestion[] = [];
    if (includeQuestions) {
      savedQuestions = await DB.getSavedQuestions(auth.userId, courseId, auth.supabase);
    }

    return NextResponse.json({
      banks,
      savedQuestions,
    });
  } catch (err: any) {
    console.error('Error fetching question banks:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { action } = body;

    // Action 1: Save individual question
    if (action === 'save_question') {
      const { question } = body;
      if (!question || !question.question_text) {
        return NextResponse.json({ error: 'Question data is required' }, { status: 400 });
      }

      const qToSave: SmartQuestion = {
        ...question,
        id: question.id || `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: auth.userId,
        is_saved: true,
        created_at: question.created_at || new Date().toISOString(),
      };

      const saved = await DB.saveQuestion(auth.userId, qToSave, auth.supabase);
      return NextResponse.json({ success: true, question: saved }, { status: 201 });
    }

    // Action 2: Save full Question Bank / Question Paper
    const {
      courseId,
      courseTitle,
      title,
      description,
      topics = [],
      questions = [],
      config,
    } = body;

    if (!courseId || !title || !questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'Course, title, and questions are required to save a question bank' },
        { status: 400 }
      );
    }

    const totalMarks = questions.reduce((sum: number, q: SmartQuestion) => sum + (q.marks || 2), 0);

    const bank: QuestionBank = {
      id: `qb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: auth.userId,
      course_id: courseId,
      course_title: courseTitle || 'Course',
      title: title.trim(),
      description: description || `Exam question bank containing ${questions.length} questions.`,
      topics: topics.length > 0 ? topics : Array.from(new Set(questions.map((q: SmartQuestion) => q.topic))),
      total_questions: questions.length,
      total_marks: totalMarks,
      config: config || {
        course_id: courseId,
        title,
        question_types: ['2_mark'],
        total_questions: questions.length,
        difficulty: 'all',
        include_answers: true,
        include_sources: true,
        max_marks: totalMarks,
      },
      questions: questions.map((q: SmartQuestion, idx: number) => ({
        ...q,
        question_number: idx + 1,
        is_saved: true,
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = await DB.saveQuestionBank(auth.userId, bank, auth.supabase);

    // Also persist each individual question into saved_questions
    for (const q of bank.questions) {
      await DB.saveQuestion(auth.userId, { ...q, bank_id: saved.id }, auth.supabase);
    }

    return NextResponse.json({ success: true, bank: saved }, { status: 201 });
  } catch (err: any) {
    console.error('Error saving question bank:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
