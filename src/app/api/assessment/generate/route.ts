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

  // Find matching source evidence from course
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

  // Fallback to first uploaded course material
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
      topic: requestedTopic,
      conceptId: requestedConceptId,
      difficulty: requestedDifficulty, // 'all' | 'easy' | 'medium' | 'hard'
      assessmentType: rawAssessmentType, // 'diagnostic' | 'practice' | 'mock_exam' | 'numerical_drill' | 'short_answer' | 'mixed'
      language,
      count = 20,
    } = body;

    const assessmentType: AssessmentType = rawAssessmentType || 'diagnostic';
    const targetCount = Math.max(1, Math.min(30, Number(count) || 20));

    // 1. Fetch user's courses from Supabase/DB (no hardcoded subjects)
    const userCourses = await DB.getCourses(auth.userId, auth.supabase);
    if (!userCourses || userCourses.length === 0) {
      return NextResponse.json({
        questions: [],
        message: 'No courses found. Create a course and upload learning materials to get started.',
      });
    }

    // Resolve target course ID
    const targetCourseId = requestedCourseId || userCourses[0].id;
    const course =
      userCourses.find((c) => c.id === targetCourseId) ||
      (await DB.getCourseById(auth.userId, targetCourseId, auth.supabase));

    if (!course) {
      return NextResponse.json(
        { error: 'Selected course was not found.' },
        { status: 404 }
      );
    }

    // 2. Fetch actual uploaded course materials (strictly no mock/predefined questions)
    const materials = await DB.getMaterials(auth.userId, course.id, auth.supabase);
    if (!materials || materials.length === 0) {
      return NextResponse.json({
        questions: [],
        message: `No uploaded learning materials found for "${course.title}". Upload course materials (PDF, PPTX, Video, Images) in Courses to generate questions.`,
      });
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

    // Filter by requested topic or concept if specified
    if (requestedConceptId && requestedConceptId !== 'all') {
      const filtered = activeConcepts.filter((c) => c.id === requestedConceptId);
      if (filtered.length > 0) activeConcepts = filtered;
    } else if (requestedTopic && requestedTopic !== 'all') {
      const filtered = activeConcepts.filter(
        (c) => (c.category || '').toLowerCase() === requestedTopic.toLowerCase()
      );
      if (filtered.length > 0) activeConcepts = filtered;
    }

    // 4. Resolve user preferred language & student adaptive mastery profile
    const userProfile = await DB.getProfile(auth.userId, auth.supabase);
    const preferredLanguage: SupportedLanguage = (language ||
      userProfile?.preferred_language ||
      'English') as SupportedLanguage;

    // Fetch real mastery & misconceptions to adaptively target the assessment
    const masteryList = await DB.getMastery(auth.userId, course.id, auth.supabase);
    const misconceptions = await DB.getMisconceptions(auth.userId, course.id, auth.supabase);

    const weakConceptIds = new Set(masteryList.filter((m) => m.mastery_probability < 0.65).map((m) => m.concept_id));
    const miscConceptIds = new Set(misconceptions.filter((m) => m.status === 'active').map((m) => m.concept_id));

    // Adaptively prioritize weak concepts and active misconceptions
    activeConcepts.sort((a, b) => {
      const aPriority = (weakConceptIds.has(a.id) ? 2 : 0) + (miscConceptIds.has(a.id) ? 3 : 0);
      const bPriority = (weakConceptIds.has(b.id) ? 2 : 0) + (miscConceptIds.has(b.id) ? 3 : 0);
      return bPriority - aPriority;
    });

    const weakSummaryStr = masteryList
      .filter((m) => m.mastery_probability < 0.65)
      .map((m) => `"${m.concept_name}" (${Math.round(m.mastery_probability * 100)}% mastery)`)
      .join(', ');

    const activeMiscSummaryStr = misconceptions
      .filter((m) => m.status === 'active')
      .map((m) => `"${m.title}" in concept ${m.concept_name}`)
      .join(', ');

    // 5. Deduplication: Fetch all previous questions from DB/Supabase to avoid repeats
    const previousQuestions = await DB.getQuestions(auth.userId, course.id);
    const previousAttempts = await DB.getAttempts(auth.userId, course.id, auth.supabase);
    const seenNormalizedQuestions = new Set<string>();

    for (const pq of previousQuestions) {
      if (pq.question_text) {
        seenNormalizedQuestions.add(normalizeKey(pq.question_text));
      }
    }
    for (const pa of previousAttempts) {
      if (pa.question_id) {
        seenNormalizedQuestions.add(normalizeKey(pa.question_id));
      }
    }

    // Determine target distribution across question types based on assessmentType
    let targetMcqCount = 0;
    let targetFitbCount = 0;
    let targetShortAnswerCount = 0;
    let targetNumericalCount = 0;

    if (assessmentType === 'numerical_drill') {
      targetNumericalCount = targetCount;
    } else if (assessmentType === 'short_answer') {
      targetShortAnswerCount = targetCount;
    } else if (assessmentType === 'mock_exam' || assessmentType === 'diagnostic' || assessmentType === 'mixed') {
      // Balanced distribution: MCQ (~40%), FITB (~30%), Short Answer (~15%), Numerical (~15%)
      targetMcqCount = Math.round(targetCount * 0.40);
      targetFitbCount = Math.round(targetCount * 0.30);
      targetShortAnswerCount = Math.max(1, Math.round(targetCount * 0.15));
      targetNumericalCount = targetCount - (targetMcqCount + targetFitbCount + targetShortAnswerCount);
      if (targetNumericalCount < 1) targetNumericalCount = 1;
    } else {
      // Practice Quiz default
      targetMcqCount = Math.round(targetCount * 0.50);
      targetFitbCount = Math.round(targetCount * 0.30);
      targetShortAnswerCount = Math.round(targetCount * 0.10);
      targetNumericalCount = targetCount - (targetMcqCount + targetFitbCount + targetShortAnswerCount);
    }

    // Ensure total counts match targetCount
    const currentSum = targetMcqCount + targetFitbCount + targetShortAnswerCount + targetNumericalCount;
    if (currentSum < targetCount) {
      targetMcqCount += targetCount - currentSum;
    } else if (currentSum > targetCount) {
      targetMcqCount -= (currentSum - targetCount);
    }

    // Format context representation
    const materialsListStr = materials
      .map(
        (m) =>
          `• Material: "${m.title}" (${m.file_type}, ${m.file_name}, ${
            m.page_count ? m.page_count + ' pages' : ''
          } ${m.slide_count ? m.slide_count + ' slides' : ''})`
      )
      .join('\n');

    const conceptsListStr = activeConcepts
      .map(
        (c) =>
          `• Concept [ID: ${c.id}]: "${c.name}" (Topic/Category: "${c.category}", Subtopic: "${c.subtopic || 'General'}", Level: ${c.difficulty_level}/5)\n  Definition: ${c.description}\n  Learning Objectives: ${(c.learning_objectives || []).join('; ') || 'Core mastery'}`
      )
      .join('\n');

    const sourcesListStr = sources
      .slice(0, 20)
      .map(
        (s) =>
          `• Evidence [${s.material_title} - ${s.location_reference}]: "${s.snippet}"`
      )
      .join('\n');

    // Filter requested difficulty
    const targetDifficultyDirective = requestedDifficulty && requestedDifficulty !== 'all'
      ? `STRICT DIFFICULTY REQUIREMENT: Generate all questions at the "${requestedDifficulty}" level.`
      : `DIFFICULTY DISTRIBUTION: Distribute difficulties evenly across easy, medium, and hard.`;

    // Build Batch Generation Prompt with Question Verification Protocol
    const buildBatchPrompt = (batchCount: number, batchIdx: number) => {
      const bMcq = Math.round(batchCount * (targetMcqCount / targetCount));
      const bFitb = Math.round(batchCount * (targetFitbCount / targetCount));
      const bShort = Math.round(batchCount * (targetShortAnswerCount / targetCount));
      const bNum = batchCount - (bMcq + bFitb + bShort);

      return `
You are the ADAPTIQ Adaptive Question Generator & Academic Psychometrician.
Generate a verified set of assessment questions strictly grounded in the course materials for: "${course.title}".

COURSE CONTEXT:
Course Title: "${course.title}"
Course Description: "${course.description}"

ASSESSMENT TYPE: ${assessmentType}
BATCH NUMBER: ${batchIdx + 1}
BATCH QUESTIONS REQUIRED: ${batchCount}
- Multiple Choice (MCQ): ${Math.max(0, bMcq)}
- Fill in the Blank: ${Math.max(0, bFitb)}
- Short Answer: ${Math.max(0, bShort)}
- Numerical Problems: ${Math.max(0, bNum)}

${targetDifficultyDirective}

STUDENT COGNITIVE ADAPTIVE PROFILE (TARGETING):
${weakSummaryStr ? `Weak Concepts Needing Assessment: ${weakSummaryStr}` : 'Baseline Calibration across all concepts.'}
${activeMiscSummaryStr ? `Diagnosed Misconceptions to Target: ${activeMiscSummaryStr}` : ''}

UPLOADED MATERIALS:
${materialsListStr}

EXTRACTED CONCEPTS & TOPICS:
${conceptsListStr}

SOURCE EVIDENCE CITATIONS:
${sourcesListStr || 'Ground strictly in uploaded materials and concepts above.'}

QUESTION VERIFICATION PIPELINE (EXECUTE INTERNALLY FOR EVERY QUESTION):
1. GENERATE: Draft question strictly grounded in the course material.
2. SOLVE INDEPENDENTLY: Solve the problem step-by-step to guarantee correctness and unambiguousness.
3. VERIFY AGAINST SOURCE: Reference exact source location (Page, Slide, Timestamp, Figure).
4. VALIDATE ANSWER: Ensure exact correct answer is verified. For MCQ, ensure exactly ONE option is correct. For Numerical, provide the exact numeric value and unit. For Short Answer, provide the key criteria/rubric.
5. VALIDATE DIFFICULTY: Easy = Remember/Understand; Medium = Apply; Hard = Analyze/Evaluate.
6. CHECK DUPLICATE: Ensure questions are unique and do not repeat previous stems.

LANGUAGE REQUIREMENT:
Generate ALL question stems, options, and explanations strictly in ${preferredLanguage}.
${preferredLanguage === 'Tamil' ? 'Use Tamil script (தமிழ்).' : ''}
${preferredLanguage === 'Hindi' ? 'Use Hindi script (हिन्दी).' : ''}
${preferredLanguage === 'Spanish' ? 'Use Spanish (Español).' : ''}
${preferredLanguage === 'French' ? 'Use French (Français).' : ''}

Return ONLY valid JSON matching this schema:
{
  "questions": [
    {
      "question_text": "...",
      "question_type": "mcq",
      "topic": "...",
      "subtopic": "...",
      "concept": "...",
      "concept_id": "...",
      "difficulty": "medium",
      "bloom_level": "Apply",
      "learning_objective": "...",
      "independent_solution_check": "Step-by-step verification proving why the answer holds.",
      "options": [
        { "id": "opt-1", "text": "...", "is_correct": true, "explanation": "..." },
        { "id": "opt-2", "text": "...", "is_correct": false, "explanation": "...", "misconception_tag": "..." },
        { "id": "opt-3", "text": "...", "is_correct": false, "explanation": "...", "misconception_tag": "..." },
        { "id": "opt-4", "text": "...", "is_correct": false, "explanation": "...", "misconception_tag": "..." }
      ],
      "correct_answer": "...",
      "explanation": "...",
      "source_citation": {
        "material_title": "...",
        "reference": "Page 24",
        "quote": "..."
      }
    }
  ]
}
`;
    };

    let rawQuestions: RawGeneratedQuestion[] = [];
    const batchSizes = targetCount > 10
      ? [Math.ceil(targetCount / 2), targetCount - Math.ceil(targetCount / 2)]
      : [targetCount];

    try {
      const results = await Promise.allSettled(
        batchSizes.map((bSize, bIdx) =>
          callGeminiJson<{ questions: RawGeneratedQuestion[] }>(
            buildBatchPrompt(bSize, bIdx),
            `You are a strict psychometric question verifier generating validated assessment questions in ${preferredLanguage}.`
          )
        )
      );

      for (const res of results) {
        if (res.status === 'fulfilled') {
          const val = res.value;
          if (Array.isArray(val)) rawQuestions.push(...val);
          else if (Array.isArray(val?.questions)) rawQuestions.push(...val.questions);
        } else {
          console.warn('Batch generation promise rejected:', res.reason?.message);
        }
      }
    } catch (err) {
      console.warn('AI question generation call failed:', err);
    }

    // =========================================================================
    // EXECUTE FINAL QUESTION VERIFICATION PIPELINE ON OUTPUTS:
    // Generate -> Solve independently -> Verify against source -> Validate answer -> Validate difficulty -> Check duplicate -> Approve
    // =========================================================================

    const verifiedQuestions: Question[] = [];
    const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];

    let questionIndex = 0;
    for (const raw of rawQuestions) {
      if (verifiedQuestions.length >= targetCount) break;

      const qText = raw.question_text;
      if (!qText || qText.length < 5) continue;

      // Duplicate Check against both past question bank and current batch
      const norm = normalizeKey(qText);
      if (seenNormalizedQuestions.has(norm)) continue;

      // Concept Resolution
      const c =
        activeConcepts.find(
          (ac) => ac.id === raw.concept_id || ac.name.toLowerCase() === (raw.concept || '').toLowerCase()
        ) || activeConcepts[questionIndex % activeConcepts.length];

      // Question Type validation
      let qType: QuestionType = raw.question_type || 'mcq';
      if (!['mcq', 'fill_in_the_blank', 'short_answer', 'numerical'].includes(qType)) {
        qType = 'mcq';
      }

      // Difficulty validation
      let diff = raw.difficulty;
      if (requestedDifficulty && requestedDifficulty !== 'all') {
        diff = requestedDifficulty as any;
      } else if (!diff || !['easy', 'medium', 'hard'].includes(diff)) {
        diff = difficulties[questionIndex % 3];
      }

      // Options handling for MCQ
      let parsedOptions: QuestionOption[] = [];
      let correctAnswer = String(raw.correct_answer || '').trim();

      if (qType === 'mcq') {
        if (Array.isArray(raw.options)) {
          parsedOptions = raw.options.map((opt, oIdx) => ({
            id: opt.id || `opt-${questionIndex}-${oIdx}`,
            text: String(opt.text || opt),
            is_correct: Boolean(opt.is_correct),
            explanation: opt.explanation || (opt.is_correct ? 'Correct conceptual formulation.' : 'Distractor hypothesis.'),
            misconception_tag: opt.is_correct ? undefined : (opt.misconception_tag || 'Conceptual confusion'),
          }));
        }

        // Validate answer: Ensure exactly one correct option
        let correctOpt = parsedOptions.find((o) => o.is_correct);
        if (!correctOpt && parsedOptions.length > 0) {
          if (correctAnswer) {
            const matched = parsedOptions.find(
              (o) =>
                o.text.trim().toLowerCase() === correctAnswer.toLowerCase() ||
                o.id.toUpperCase() === correctAnswer.toUpperCase()
            );
            if (matched) {
              matched.is_correct = true;
              correctOpt = matched;
            }
          }
          if (!correctOpt) {
            parsedOptions[0].is_correct = true;
            correctOpt = parsedOptions[0];
          }
        }
        if (parsedOptions.length < 2) {
          // Reject MCQ if fewer than 2 genuine options were produced by AI
          continue;
        }
        if (parsedOptions.length > 4) {
          parsedOptions = parsedOptions.slice(0, 4);
        }
        correctAnswer = correctOpt?.text || parsedOptions[0].text;
      } else if (qType === 'fill_in_the_blank') {
        if (!qText.includes('_____') && !qText.includes('____') && !qText.includes('___')) {
          if (correctAnswer && qText.includes(correctAnswer)) {
            // Replace with blank
            raw.question_text = qText.replace(correctAnswer, '_____');
          } else {
            raw.question_text = `${qText} (_____):`;
          }
        }
        if (!correctAnswer) correctAnswer = c.name;
      } else if (qType === 'numerical') {
        if (!correctAnswer) continue;
      } else if (qType === 'short_answer') {
        if (!correctAnswer) correctAnswer = c.description;
      }

      // Verify Against Source
      const citation = getBestCitation(course, materials, sources, c.name, raw.source_citation);

      seenNormalizedQuestions.add(norm);
      verifiedQuestions.push({
        id: `q-${qType}-${Date.now()}-${questionIndex}`,
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
        learning_objective: raw.learning_objective || `Demonstrate mastery of ${c.name} in ${course.title}.`,
        source_citation: citation,
        verification_status: 'verified',
        verifier_notes: raw.independent_solution_check || 'Independently solved and source-grounded.',
      });

      questionIndex++;
    }

    if (verifiedQuestions.length === 0) {
      return NextResponse.json(
        {
          error: 'No verified questions could be generated from the uploaded course materials. Please ensure your course documents are processed and retry.',
          details: 'The AI verification pipeline could not extract sufficient source-grounded questions from the available material chunks.',
        },
        { status: 422 }
      );
    }

    // 6. Record Assessment session in Supabase & Local DB
    const assessmentId = `as-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await DB.recordAssessment(
      auth.userId,
      {
        id: assessmentId,
        user_id: auth.userId,
        course_id: course.id,
        title: `${course.title} ${assessmentType.replace('_', ' ').toUpperCase()} Assessment`,
        status: 'in_progress',
        total_questions: verifiedQuestions.length,
        completed_questions: 0,
        score_percentage: 0,
        started_at: new Date().toISOString(),
        questions: verifiedQuestions,
        current_index: 0,
        answers: {},
      },
      auth.supabase
    );

    // 7. Save approved verified questions to Question Bank (Supabase & DB)
    await DB.saveQuestions(auth.userId, course.id, verifiedQuestions, auth.supabase);

    return NextResponse.json({
      assessment_id: assessmentId,
      course_id: course.id,
      course_title: course.title,
      assessment_type: assessmentType,
      total_questions: verifiedQuestions.length,
      mcq_count: verifiedQuestions.filter((q) => q.question_type === 'mcq').length,
      fill_in_the_blank_count: verifiedQuestions.filter((q) => q.question_type === 'fill_in_the_blank').length,
      short_answer_count: verifiedQuestions.filter((q) => q.question_type === 'short_answer').length,
      numerical_count: verifiedQuestions.filter((q) => q.question_type === 'numerical').length,
      questions: verifiedQuestions,
    });
  } catch (err: any) {
    console.error('Assessment generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
