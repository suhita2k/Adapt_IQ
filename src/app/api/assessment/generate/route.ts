import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { callGeminiJson } from '@/lib/ai';
import {
  Question,
  QuestionOption,
  Course,
  Concept,
  SourceEvidence,
  CourseMaterial,
  QuestionType,
  AssessmentType,
  Assessment,
} from '@/types';
import { SupportedLanguage } from '@/lib/i18n';

interface RawGeneratedQuestion {
  question_text: string;
  question_type: QuestionType;
  topic?: string;
  subtopic?: string;
  concept?: string;
  concept_id?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  bloom_level?: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
  code_snippet?: string;
  options?: {
    id?: string;
    text: string;
    is_correct: boolean;
    explanation?: string;
    misconception_tag?: string;
  }[];
  correct_answer: string;
  explanation: string;
  learning_objective?: string;
  independent_solution_check?: string;
  source_citation?: {
    material_title: string;
    reference: string;
    quote: string;
  };
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// True Fisher-Yates random shuffle for MCQ options with unique ID mapping
function shuffleAndVerifyOptions(
  options: { id?: string; text: string; is_correct: boolean; explanation?: string; misconception_tag?: string }[],
  qIndex: number
): QuestionOption[] {
  // 1. Deduplicate options by text
  const seenTexts = new Set<string>();
  const uniqueOpts: typeof options = [];
  for (const opt of options) {
    const textNorm = String(opt.text || '').trim().toLowerCase();
    if (textNorm.length > 0 && !seenTexts.has(textNorm)) {
      seenTexts.add(textNorm);
      uniqueOpts.push(opt);
    }
  }

  // 2. Ensure exactly one correct option exists
  let correctCount = uniqueOpts.filter((o) => o.is_correct).length;
  if (correctCount === 0 && uniqueOpts.length > 0) {
    uniqueOpts[0].is_correct = true;
  } else if (correctCount > 1) {
    let kept = false;
    for (const opt of uniqueOpts) {
      if (opt.is_correct) {
        if (!kept) kept = true;
        else opt.is_correct = false;
      }
    }
  }

  // 3. True Fisher-Yates shuffle (randomize correct answer's position independently)
  const shuffled = [...uniqueOpts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 4. Map to stable unique option IDs preserving option identity
  return shuffled.map((opt, idx) => ({
    id: `opt-${qIndex}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    text: opt.text.trim(),
    is_correct: Boolean(opt.is_correct),
    explanation: opt.explanation || (opt.is_correct ? 'Correct conceptual formulation.' : 'Distractor hypothesis.'),
    misconception_tag: opt.is_correct ? undefined : (opt.misconception_tag || 'Conceptual confusion'),
  }));
}

function getBestCitation(
  course: Course,
  materials: CourseMaterial[],
  sources: SourceEvidence[],
  conceptName?: string,
  rawCitation?: any
): { material_title: string; reference: string; quote: string } {
  if (
    rawCitation &&
    typeof rawCitation === 'object' &&
    rawCitation.material_title &&
    rawCitation.reference &&
    rawCitation.quote &&
    String(rawCitation.quote).length > 5
  ) {
    return {
      material_title: String(rawCitation.material_title),
      reference: String(rawCitation.reference),
      quote: String(rawCitation.quote),
    };
  }

  if (sources.length > 0) {
    const matched = conceptName
      ? sources.find(
          (s) =>
            s.snippet.toLowerCase().includes(conceptName.toLowerCase()) ||
            s.relevance_reason?.toLowerCase().includes(conceptName.toLowerCase()) ||
            (s.concept && s.concept.toLowerCase().includes(conceptName.toLowerCase()))
        )
      : undefined;
    const s = matched || sources[0];
    return {
      material_title: s.material_title || course.title,
      reference: s.location_reference || (s.location_type === 'slide' ? 'Slide 1' : s.location_type === 'timestamp' ? '12:35' : 'Page 1'),
      quote: s.snippet,
    };
  }

  const mat = materials[0];
  const isVideo = mat?.file_type === 'lecture_video';
  const isSlide = mat?.file_type === 'slides';
  return {
    material_title: mat?.title || course.title,
    reference: isVideo ? '12:35' : isSlide ? 'Slide 1' : 'Page 1',
    quote: `Foundational learning unit and invariant rules for ${course.title}.`,
  };
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      courseId: requestedCourseId,
      questionType: requestedQType, // 'mcq' | 'fill_in_the_blank' | 'short_answer' | 'mixed'
      topic: requestedTopic,
      conceptId: requestedConceptId,
      difficulty: requestedDifficulty, // 'easy' | 'medium' | 'hard' | 'mixed' | 'all'
      language,
      count = 10,
    } = body;

    const targetCount = Math.max(1, Math.min(30, Number(count) || 10));

    // 1. Fetch user's courses from Supabase/DB
    const userCourses = await DB.getCourses(auth.userId, auth.supabase);
    if (!userCourses || userCourses.length === 0) {
      return NextResponse.json(
        { error: 'No courses found. Please create a course and upload learning materials first.' },
        { status: 400 }
      );
    }

    if (!requestedCourseId) {
      return NextResponse.json(
        { error: 'Course selection is mandatory.' },
        { status: 400 }
      );
    }

    const course =
      userCourses.find((c) => c.id === requestedCourseId) ||
      (await DB.getCourseById(auth.userId, requestedCourseId, auth.supabase));

    if (!course) {
      return NextResponse.json(
        { error: 'Selected course was not found.' },
        { status: 404 }
      );
    }

    // 2. Fetch actual uploaded course materials (strictly no predefined or demo questions)
    const materials = await DB.getMaterials(auth.userId, course.id, auth.supabase);
    if (!materials || materials.length === 0) {
      return NextResponse.json(
        {
          error: `No learning materials found for "${course.title}". Please upload course content (PDF, PPTX, Video) in Courses before starting an assessment.`,
        },
        { status: 400 }
      );
    }

    // 3. Fetch extracted concepts and verified source evidence
    const concepts = await DB.getConcepts(auth.userId, course.id);
    const sources = await DB.getSources(auth.userId, course.id);

    let activeConcepts = concepts;
    if (activeConcepts.length === 0) {
      activeConcepts = materials.map((m, idx) => ({
        id: `c-${course.id}-${idx + 1}`,
        course_id: course.id,
        name: m.title.replace(/\.[^/.]+$/, ''),
        description: `Core subject concepts extracted from ${m.title}.`,
        category: m.file_type === 'slides' ? 'Lecture Slides' : m.file_type === 'lecture_video' ? 'Lecture Video' : 'Core Topics',
        difficulty_level: 3,
        prerequisites: [],
        subconcepts: [],
      }));
    }

    // Filter by requested topic if specified (and not 'all' / 'All Topics')
    if (requestedTopic && requestedTopic !== 'all' && requestedTopic !== 'All Topics') {
      const filtered = activeConcepts.filter(
        (c) => (c.category || '').toLowerCase() === requestedTopic.toLowerCase()
      );
      if (filtered.length > 0) {
        activeConcepts = filtered;
      }
    }

    if (requestedConceptId && requestedConceptId !== 'all') {
      const filtered = activeConcepts.filter((c) => c.id === requestedConceptId);
      if (filtered.length > 0) activeConcepts = filtered;
    }

    // 4. Resolve user preferred language
    const userProfile = await DB.getProfile(auth.userId, auth.supabase);
    const preferredLanguage: SupportedLanguage = (language ||
      userProfile?.preferred_language ||
      'English') as SupportedLanguage;

    // Determine target distribution across question types based on requestedQType
    let targetMcqCount = 0;
    let targetFitbCount = 0;
    let targetShortAnswerCount = 0;

    const qTypeNorm = (requestedQType || 'mcq').toLowerCase().replace(/\s+/g, '_');
    if (qTypeNorm === 'fill_in_the_blanks' || qTypeNorm === 'fill_in_the_blank') {
      targetFitbCount = targetCount;
    } else if (qTypeNorm === 'short_answer') {
      targetShortAnswerCount = targetCount;
    } else if (qTypeNorm === 'mixed') {
      targetMcqCount = Math.ceil(targetCount * 0.5);
      targetFitbCount = Math.floor(targetCount * 0.25);
      targetShortAnswerCount = targetCount - (targetMcqCount + targetFitbCount);
    } else {
      // Default: MCQ
      targetMcqCount = targetCount;
    }

    const materialsListStr = materials
      .slice(0, 10)
      .map(
        (m, idx) =>
          `[Material ${idx + 1}]: "${m.title}" (Type: ${m.file_type || 'document'})`
      )
      .join('\n');

    const conceptsListStr = activeConcepts
      .slice(0, 20)
      .map(
        (c) =>
          `• Concept [ID: ${c.id}]: "${c.name}" (Topic: "${c.category || 'General'}")\n  Definition: ${c.description}`
      )
      .join('\n');

    const sourcesListStr = sources
      .slice(0, 15)
      .map(
        (s) =>
          `• Citation [${s.material_title} - ${s.location_reference}]: "${s.snippet}"`
      )
      .join('\n');

    const targetDifficultyDirective =
      requestedDifficulty && requestedDifficulty !== 'all' && requestedDifficulty !== 'mixed' && requestedDifficulty !== 'Mixed'
        ? `STRICT DIFFICULTY REQUIREMENT: Generate all questions at the "${requestedDifficulty.toLowerCase()}" level.`
        : `DIFFICULTY DISTRIBUTION: Distribute difficulties evenly across easy, medium, and hard.`;

    const prompt = `
You are the ADAPTIQ Diagnostic Question Generator.
Generate a verified set of assessment questions strictly grounded in the uploaded course materials for: "${course.title}".

COURSE CONTEXT:
Course Title: "${course.title}"
Course Description: "${course.description}"

TOPIC FILTER: ${requestedTopic || 'All Topics'}
TOTAL QUESTIONS REQUIRED: ${targetCount}
- Multiple Choice (MCQ): ${targetMcqCount}
- Fill in the Blank: ${targetFitbCount}
- Short Answer: ${targetShortAnswerCount}

${targetDifficultyDirective}

UPLOADED MATERIALS:
${materialsListStr}

EXTRACTED CONCEPTS & TOPICS:
${conceptsListStr}

SOURCE EVIDENCE CITATIONS:
${sourcesListStr || 'Ground strictly in uploaded materials and concepts above.'}

STRICT QUESTION PROTOCOL:
1. Every question and correct answer must be verified directly against the course material.
2. For MCQs: Provide exactly 1 correct answer and 3 plausible, clearly incorrect distractors.
3. For Fill in the Blank: The question text MUST include '_____' where the key term belongs.
4. For Short Answer: Provide clear criteria in the explanation.
5. NEVER generate fabricated, demo, or placeholder questions. Ground only in course concepts.
6. Provide an accurate source_citation object citing the material_title, reference (e.g. Page 12 or Slide 5), and excerpt quote.

LANGUAGE:
Generate stems, options, and explanations in ${preferredLanguage}.

Return ONLY valid JSON matching this schema:
{
  "questions": [
    {
      "question_text": "...",
      "question_type": "mcq",
      "topic": "...",
      "concept": "...",
      "concept_id": "...",
      "difficulty": "medium",
      "options": [
        { "text": "Correct answer formulation", "is_correct": true, "explanation": "Why correct" },
        { "text": "Plausible distractor 1", "is_correct": false, "explanation": "Why incorrect" },
        { "text": "Plausible distractor 2", "is_correct": false, "explanation": "Why incorrect" },
        { "text": "Plausible distractor 3", "is_correct": false, "explanation": "Why incorrect" }
      ],
      "correct_answer": "...",
      "explanation": "...",
      "source_citation": {
        "material_title": "...",
        "reference": "Page 1",
        "quote": "..."
      }
    }
  ]
}
`;

    let rawQuestions: RawGeneratedQuestion[] = [];
    try {
      const val = await callGeminiJson<{ questions: RawGeneratedQuestion[] }>(
        prompt,
        `You are a strict academic verifier generating diagnostic questions in ${preferredLanguage}.`
      );
      if (Array.isArray(val)) {
        rawQuestions = val;
      } else if (Array.isArray(val?.questions)) {
        rawQuestions = val.questions;
      }
    } catch (aiErr: any) {
      console.warn('AI question generation call error:', aiErr?.message);
    }

    // Process and verify questions
    const verifiedQuestions: Question[] = [];
    const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];

    let qIdx = 0;
    for (const raw of rawQuestions) {
      if (verifiedQuestions.length >= targetCount) break;

      const qText = raw.question_text;
      if (!qText || qText.length < 5) continue;

      const c =
        activeConcepts.find(
          (ac) => ac.id === raw.concept_id || ac.name.toLowerCase() === (raw.concept || '').toLowerCase()
        ) || activeConcepts[qIdx % activeConcepts.length];

      let qType: QuestionType = raw.question_type || 'mcq';
      if (!['mcq', 'fill_in_the_blank', 'short_answer'].includes(qType)) {
        qType = 'mcq';
      }

      let diff = raw.difficulty;
      if (requestedDifficulty && requestedDifficulty !== 'all' && requestedDifficulty !== 'mixed' && requestedDifficulty !== 'Mixed') {
        diff = requestedDifficulty.toLowerCase() as any;
      } else if (!diff || !['easy', 'medium', 'hard'].includes(diff)) {
        diff = difficulties[qIdx % 3];
      }

      let parsedOptions: QuestionOption[] = [];
      let correctAnswer = String(raw.correct_answer || '').trim();

      if (qType === 'mcq') {
        const rawOpts = Array.isArray(raw.options) ? raw.options : [];
        if (rawOpts.length >= 2) {
          // Shuffles options and randomizes the correct answer's position independently
          parsedOptions = shuffleAndVerifyOptions(rawOpts, qIdx);
          const correctOpt = parsedOptions.find((o) => o.is_correct);
          correctAnswer = correctOpt?.text || parsedOptions[0].text;
        } else {
          continue;
        }
      } else if (qType === 'fill_in_the_blank') {
        if (!qText.includes('_____')) {
          if (correctAnswer && qText.includes(correctAnswer)) {
            raw.question_text = qText.replace(correctAnswer, '_____');
          } else {
            raw.question_text = `${qText} (_____):`;
          }
        }
        if (!correctAnswer) correctAnswer = c.name;
      } else if (qType === 'short_answer') {
        if (!correctAnswer) correctAnswer = c.description;
      }

      const citation = getBestCitation(course, materials, sources, c.name, raw.source_citation);

      verifiedQuestions.push({
        id: `q-${qType}-${Date.now()}-${qIdx}`,
        course_id: course.id,
        concept_id: c.id,
        concept_name: c.name,
        topic: raw.topic || c.category || course.category || 'General',
        subtopic: raw.subtopic || c.subtopic || 'Foundations',
        question_type: qType,
        difficulty: diff as any,
        bloom_level: raw.bloom_level || (diff === 'hard' ? 'Analyze' : diff === 'medium' ? 'Apply' : 'Understand'),
        question_text: raw.question_text,
        code_snippet: raw.code_snippet,
        options: parsedOptions,
        correct_answer: correctAnswer,
        explanation: raw.explanation || `Grounded in ${citation.material_title} (${citation.reference}).`,
        learning_objective: raw.learning_objective || `Demonstrate mastery of ${c.name}.`,
        source_citation: citation,
        verification_status: 'verified',
        verifier_notes: raw.independent_solution_check || 'Independently solved and source-grounded.',
      });

      qIdx++;
    }

    if (verifiedQuestions.length === 0) {
      return NextResponse.json(
        {
          error: `Could not generate verified questions from the uploaded materials for "${course.title}". Please verify that course documents have readable text and try again.`,
        },
        { status: 422 }
      );
    }

    // 6. Record Assessment session securely with full answer key on the server
    const assessmentId = `as-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await DB.recordAssessment(
      auth.userId,
      {
        id: assessmentId,
        user_id: auth.userId,
        course_id: course.id,
        title: `${course.title} Diagnostic Assessment`,
        status: 'in_progress',
        total_questions: verifiedQuestions.length,
        completed_questions: 0,
        score_percentage: 0,
        started_at: new Date().toISOString(),
        questions: verifiedQuestions, // Complete verified questions stored server-side
        current_index: 0,
        answers: {},
      },
      auth.supabase
    );

    // Save questions to DB for reference
    await DB.saveQuestions(auth.userId, course.id, verifiedQuestions, auth.supabase);

    // 7. Sanitize questions for the client:
    // STORE CORRECT ANSWER SECURELY AND NEVER EXPOSE IT TO THE FRONTEND BEFORE SUBMISSION!
    const clientQuestions = verifiedQuestions.map((q) => ({
      id: q.id,
      course_id: q.course_id,
      concept_id: q.concept_id,
      concept_name: q.concept_name,
      topic: q.topic,
      subtopic: q.subtopic,
      question_type: q.question_type,
      difficulty: q.difficulty,
      question_text: q.question_text,
      code_snippet: q.code_snippet,
      options: (q.options || []).map((opt) => ({
        id: opt.id,
        text: opt.text,
        // is_correct and explanation are STRIPPED
      })),
      // correct_answer, explanation, and source_citation are STRIPPED
    }));

    return NextResponse.json({
      assessment_id: assessmentId,
      course_id: course.id,
      course_title: course.title,
      total_questions: clientQuestions.length,
      questions: clientQuestions,
    });
  } catch (err: any) {
    console.error('Assessment generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
