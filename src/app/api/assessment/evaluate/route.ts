import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { callGeminiJson } from '@/lib/ai';
import { Misconception } from '@/types';
import { SupportedLanguage } from '@/lib/i18n';

interface RemediationAiPayload {
  description: string;
  remediation_steps: {
    step_number: number;
    title: string;
    explanation: string;
    code_example?: string;
    verified_quote: string;
    source_ref: string;
  }[];
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();

    // =========================================================================
    // 1. BATCH ASSESSMENT EVALUATION (Step 5: Answer Evaluation)
    // =========================================================================
    if (body.assessmentId && body.answers) {
      const { assessmentId, courseId, answers = {} } = body;

      // Find the secure assessment record in DB
      let assessment = null;
      try {
        const assessments = await DB.getAssessments(auth.userId, courseId, auth.supabase);
        assessment = assessments.find((a) => a.id === assessmentId) || null;
      } catch (err) {
        console.warn('DB getAssessments error:', err);
      }

      let assessmentQuestions = assessment?.questions;

      // Fallback: look in saved course questions
      if (!assessmentQuestions || assessmentQuestions.length === 0) {
        try {
          const storedQuestions = await DB.getQuestions(auth.userId, courseId);
          const answerKeys = Object.keys(answers);
          assessmentQuestions = storedQuestions.filter((sq) => answerKeys.includes(sq.id));
        } catch (err) {
          console.warn('DB getQuestions fallback error:', err);
        }
      }

      if (!assessmentQuestions || assessmentQuestions.length === 0) {
        return NextResponse.json(
          { error: 'Assessment session not found. Please start a new assessment.' },
          { status: 404 }
        );
      }

      let totalScore = 0;
      const results = [];

      for (const q of assessmentQuestions) {
        const userSelection = String(answers[q.id] || '').trim();
        let isCorrect = false;
        let userAnswerText = userSelection;
        let correctText = q.correct_answer || '';

        if (q.question_type === 'mcq') {
          const correctOpt = (q.options || []).find((o) => o.is_correct);
          correctText = correctOpt?.text || q.correct_answer || '';
          const userOpt = (q.options || []).find(
            (o) => o.id === userSelection || o.text.trim().toLowerCase() === userSelection.toLowerCase()
          );
          userAnswerText = userOpt?.text || (userSelection ? userSelection : '(No option selected)');
          isCorrect = Boolean(userOpt?.is_correct);
        } else if (q.question_type === 'fill_in_the_blank') {
          const cleanUser = userSelection.toLowerCase().trim();
          const cleanTarget = correctText.toLowerCase().trim();
          isCorrect = cleanUser === cleanTarget || (cleanUser.length > 2 && cleanTarget.includes(cleanUser));
        } else if (q.question_type === 'numerical') {
          const userNum = parseFloat(userSelection.replace(/[^0-9.-]/g, ''));
          const targetNum = parseFloat(correctText.replace(/[^0-9.-]/g, ''));
          if (!isNaN(userNum) && !isNaN(targetNum)) {
            isCorrect = Math.abs(userNum - targetNum) <= Math.max(0.01, Math.abs(targetNum) * 0.03);
          } else {
            isCorrect = userSelection.toLowerCase() === correctText.toLowerCase();
          }
        } else if (q.question_type === 'short_answer') {
          const userTokens = userSelection.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const targetTokens = correctText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const matched = targetTokens.filter((t) => userTokens.includes(t));
          isCorrect = userSelection.length >= 8 && (matched.length >= 1 || userSelection.toLowerCase().includes(correctText.toLowerCase()));
        }

        if (isCorrect) totalScore++;

        // 1. Update Learning Twin BKT mastery in DB for tested concepts
        if (q.concept_id) {
          try {
            await DB.updateMasteryBKT(
              auth.userId,
              q.concept_id,
              isCorrect,
              courseId,
              q.concept_name,
              auth.supabase
            );
          } catch (e) {
            console.warn('Mastery BKT update error:', e);
          }
        }

        // 2. Record individual question attempt
        try {
          await DB.recordAttempt(
            auth.userId,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              user_id: auth.userId,
              question_id: q.id,
              course_id: courseId,
              concept_id: q.concept_id || 'concept-core',
              selected_option_id: userSelection,
              is_correct: isCorrect,
              time_spent_seconds: 15,
              attempted_at: new Date().toISOString(),
              misconception_detected: !isCorrect ? `Gap in ${q.concept_name || 'core topic'}` : undefined,
            },
            auth.supabase
          );
        } catch (e) {
          console.warn('Record attempt error:', e);
        }

        // 3. Record misconception if incorrect
        if (!isCorrect && q.concept_id) {
          try {
            const detectedMisconception: Misconception = {
              id: `misc-${Date.now()}-${q.concept_id}`,
              user_id: auth.userId,
              course_id: courseId,
              concept_id: q.concept_id,
              concept_name: q.concept_name || 'Core Topic',
              title: `Misconception in ${q.concept_name || q.topic || 'Subject'}`,
              description: `Incorrect response on assessment: "${userAnswerText}". Correct principle: "${correctText}".`,
              trigger_evidence: `Assessment question: "${q.question_text}". Selected: "${userAnswerText}".`,
              severity: 'medium',
              detected_at: new Date().toISOString(),
              status: 'active',
              remediation_steps: [
                {
                  step_number: 1,
                  title: 'Review Source Material',
                  explanation: q.explanation || 'Re-ground mental models in verified course definitions.',
                  verified_quote: q.source_citation?.quote || 'Fundamental invariants must hold.',
                  source_ref: q.source_citation ? `${q.source_citation.material_title} (${q.source_citation.reference})` : 'Course Materials',
                },
              ],
              verification_question_id: `retest-${Date.now()}`,
            };
            await DB.recordMisconception(auth.userId, detectedMisconception, auth.supabase);
          } catch (mErr) {
            console.warn('Misconception recording error:', mErr);
          }
        }

        results.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type || 'mcq',
          user_answer: userAnswerText || '(No answer provided)',
          correct_answer: correctText,
          is_correct: isCorrect,
          explanation: q.explanation || `Verified against course materials for ${q.concept_name}.`,
          source_citation: q.source_citation || {
            material_title: 'Course Syllabus',
            reference: 'Core Document',
            quote: 'Core invariants and principles.',
          },
        });
      }

      const total = assessmentQuestions.length;
      const percentage = Math.round((totalScore / Math.max(1, total)) * 100);

      // Update assessment record status in DB
      if (assessment) {
        assessment.status = 'completed';
        assessment.score_percentage = percentage;
        assessment.completed_questions = total;
        assessment.completed_at = new Date().toISOString();
        assessment.answers = answers;
        try {
          await DB.recordAssessment(auth.userId, assessment, auth.supabase);
        } catch (recErr) {
          console.warn('Record assessment completed error:', recErr);
        }
      }

      return NextResponse.json({
        success: true,
        score: totalScore,
        total,
        percentage,
        results,
      });
    }

    // =========================================================================
    // 2. SINGLE QUESTION EVALUATION (Fallback / Granular)
    // =========================================================================
    const {
      questionId,
      conceptId,
      conceptName,
      courseId,
      isCorrect: clientIsCorrect,
      selectedOptionText,
      questionType = 'mcq',
      correctAnswer,
      explanation: providedExplanation,
      sourceCitation,
      misconceptionTag: rawMisconceptionTag,
      timeSpentSeconds = 15,
      language,
    } = body;

    let targetCourseId = courseId;
    if (!targetCourseId) {
      const userCourses = await DB.getCourses(auth.userId, auth.supabase);
      targetCourseId = userCourses[0]?.id || 'unassigned';
    }

    const userProfile = await DB.getProfile(auth.userId, auth.supabase);
    const preferredLanguage: SupportedLanguage = (language || userProfile?.preferred_language || 'English') as SupportedLanguage;

    let isCorrect = Boolean(clientIsCorrect);

    if (questionType === 'numerical' && correctAnswer) {
      const userNum = parseFloat(String(selectedOptionText).replace(/[^0-9.-]/g, ''));
      const targetNum = parseFloat(String(correctAnswer).replace(/[^0-9.-]/g, ''));
      if (!isNaN(userNum) && !isNaN(targetNum)) {
        const diff = Math.abs(userNum - targetNum);
        const tolerance = Math.max(0.01, Math.abs(targetNum) * 0.03);
        isCorrect = diff <= tolerance;
      } else {
        isCorrect = String(selectedOptionText).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      }
    } else if (questionType === 'short_answer' && correctAnswer && clientIsCorrect === undefined) {
      const userStr = String(selectedOptionText).trim().toLowerCase();
      const targetStr = String(correctAnswer).trim().toLowerCase();
      const targetTokens = targetStr.split(/\s+/).filter((w) => w.length > 3);
      const matchedTokens = targetTokens.filter((tok) => userStr.includes(tok));
      isCorrect = userStr.length >= 10 && matchedTokens.length >= Math.ceil(targetTokens.length * 0.4);
    }

    await DB.recordAttempt(
      auth.userId,
      {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: auth.userId,
        question_id: questionId || `q-${Date.now()}`,
        course_id: targetCourseId,
        concept_id: conceptId || 'concept-core',
        selected_option_id: String(selectedOptionText || ''),
        is_correct: isCorrect,
        time_spent_seconds: timeSpentSeconds,
        attempted_at: new Date().toISOString(),
        misconception_detected: rawMisconceptionTag || (!isCorrect ? `Gap in ${conceptName || 'core concept'}` : undefined),
      },
      auth.supabase
    );

    const updatedMastery = await DB.updateMasteryBKT(
      auth.userId,
      conceptId || 'concept-core',
      isCorrect,
      targetCourseId,
      conceptName,
      auth.supabase
    );

    const whyCorrect = isCorrect
      ? `This answer satisfies the invariant rules of "${conceptName || 'the concept'}" verified in the course materials.`
      : `The expected answer is "${correctAnswer || 'the verified formulation'}" based on the course materials.`;

    return NextResponse.json({
      success: true,
      isCorrect,
      why_correct: whyCorrect,
      explanation: providedExplanation || `Verified conceptual formulation for ${conceptName}.`,
      source_citation: sourceCitation || null,
      relevant_concept: {
        id: conceptId || 'concept-core',
        name: conceptName || 'Subject Concept',
      },
      updated_mastery: updatedMastery,
    });
  } catch (err: any) {
    console.error('Answer evaluation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
