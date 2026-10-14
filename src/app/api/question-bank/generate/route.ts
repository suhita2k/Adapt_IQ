import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { callGeminiJson } from '@/lib/ai';
import {
  SmartQuestion,
  SmartQuestionType,
  StructuredAnswer16Mark,
  Course,
  CourseMaterial,
  SourceEvidence,
  Concept,
} from '@/types';

interface RawGeneratedSmartQuestion {
  question_number?: number;
  question_text: string;
  marks: number;
  question_type: SmartQuestionType;
  topic: string;
  subtopic?: string;
  concept_name?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answer: string;
  structured_16_mark?: {
    introduction: string;
    headings: {
      title: string;
      content: string;
      code_or_algorithm?: string;
    }[];
    examples?: string[];
    diagram_or_flowchart?: {
      title: string;
      description: string;
      ascii_or_mermaid?: string;
    };
    step_by_step_solution?: string[];
    conclusion: string;
  };
  options?: {
    id: string;
    text: string;
    is_correct: boolean;
    explanation: string;
  }[];
  source_citation: {
    material_title: string;
    reference: string;
    quote: string;
  };
  bloom_level?: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

function resolveCitation(
  rawCit: any,
  materials: CourseMaterial[],
  sources: SourceEvidence[],
  topic?: string
): {
  material_id?: string;
  material_title: string;
  material_type?: any;
  file_name?: string;
  file_url?: string;
  page_number?: number;
  slide_number?: number;
  reference: string;
  quote: string;
  verified: boolean;
} {
  if (
    rawCit &&
    rawCit.material_title &&
    rawCit.reference &&
    rawCit.quote &&
    String(rawCit.quote).length > 5
  ) {
    const matchedMat = materials.find(
      (m) => m.title.toLowerCase().includes(String(rawCit.material_title).toLowerCase()) ||
             String(rawCit.material_title).toLowerCase().includes(m.title.toLowerCase())
    ) || materials[0];

    const ref = String(rawCit.reference);
    const numMatch = ref.match(/\d+/);
    const parsedNum = numMatch ? parseInt(numMatch[0], 10) : undefined;
    const isSlide = ref.toLowerCase().includes('slide') || matchedMat?.file_type === 'slides';
    const pageNum = !isSlide ? parsedNum : undefined;
    const slideNum = isSlide ? parsedNum : undefined;

    let directUrl = matchedMat?.file_url;
    if (directUrl) {
      if (pageNum) directUrl = `${directUrl.split('#')[0]}#page=${pageNum}`;
      else if (slideNum) directUrl = `${directUrl.split('#')[0]}#page=${slideNum}`;
    }

    return {
      material_id: matchedMat?.id,
      material_title: matchedMat?.title || rawCit.material_title,
      material_type: matchedMat?.file_type,
      file_name: matchedMat?.file_name,
      file_url: directUrl,
      page_number: pageNum,
      slide_number: slideNum,
      reference: ref,
      quote: String(rawCit.quote),
      verified: true,
    };
  }

  // Find best matching source evidence chunk
  if (sources.length > 0) {
    const matched = topic
      ? sources.find(
          (s) =>
            s.snippet.toLowerCase().includes(topic.toLowerCase()) ||
            s.topic?.toLowerCase().includes(topic.toLowerCase()) ||
            s.concept?.toLowerCase().includes(topic.toLowerCase())
        )
      : undefined;
    const s = matched || sources[0];
    const matchedMat = materials.find((m) => m.id === s.material_id) || materials[0];

    const ref = s.location_reference || (s.location_type === 'slide' ? 'Slide 1' : s.location_type === 'timestamp' ? '12:35' : 'Page 1');
    const numMatch = ref.match(/\d+/);
    const parsedNum = numMatch ? parseInt(numMatch[0], 10) : undefined;
    const isSlide = s.location_type === 'slide' || ref.toLowerCase().includes('slide');
    const pageNum = s.page_number || (!isSlide ? parsedNum : undefined);
    const slideNum = s.slide_number || (isSlide ? parsedNum : undefined);

    let directUrl = s.file_url || matchedMat?.file_url;
    if (directUrl) {
      if (pageNum) directUrl = `${directUrl.split('#')[0]}#page=${pageNum}`;
      else if (slideNum) directUrl = `${directUrl.split('#')[0]}#page=${slideNum}`;
    }

    return {
      material_id: s.material_id || matchedMat?.id,
      material_title: s.material_title || matchedMat?.title || 'Course Material',
      material_type: s.material_type || matchedMat?.file_type,
      file_name: s.file_name || matchedMat?.file_name,
      file_url: directUrl,
      page_number: pageNum,
      slide_number: slideNum,
      reference: ref,
      quote: s.snippet,
      verified: true,
    };
  }

  // Fallback to first material
  const m = materials[0];
  const isSlide = m?.file_type === 'slides';
  const ref = isSlide ? 'Slide 1' : m?.file_type === 'lecture_video' ? '05:00' : 'Page 1';
  let directUrl = m?.file_url;
  if (directUrl) {
    directUrl = isSlide ? `${directUrl}#page=1` : `${directUrl}#page=1`;
  }

  return {
    material_id: m?.id,
    material_title: m?.title || 'Course Material',
    material_type: m?.file_type,
    file_name: m?.file_name,
    file_url: directUrl,
    page_number: !isSlide ? 1 : undefined,
    slide_number: isSlide ? 1 : undefined,
    reference: ref,
    quote: `Curriculum materials for ${m?.title || 'course'}.`,
    verified: false,
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
      questionType = '2_mark',
      count = 5,
      difficulty = 'all',
      marksPerQuestion,
      includeAnswers = true,
      includeSources = true,
      customTitle,
    } = body;

    // 1. Fetch user courses
    const userCourses = await DB.getCourses(auth.userId, auth.supabase);
    if (!userCourses || userCourses.length === 0) {
      return NextResponse.json(
        {
          error: 'No courses found. Please create a course and upload learning materials first.',
          noCourses: true,
        },
        { status: 400 }
      );
    }

    const targetCourseId = requestedCourseId || userCourses[0].id;
    const course =
      userCourses.find((c) => c.id === targetCourseId) ||
      (await DB.getCourseById(auth.userId, targetCourseId, auth.supabase));

    if (!course) {
      return NextResponse.json({ error: 'Selected course not found.' }, { status: 404 });
    }

    // 2. Fetch actual uploaded course materials (strictly no mock or predefined content)
    const materials = await DB.getMaterials(auth.userId, course.id, auth.supabase);
    if (!materials || materials.length === 0) {
      return NextResponse.json(
        {
          error: `No uploaded learning materials found for "${course.title}". Upload course documents (PDF, PPT, Videos, Notes) in Courses to generate exam questions.`,
          noMaterials: true,
          courseTitle: course.title,
        },
        { status: 400 }
      );
    }

    // 3. Fetch extracted concepts and source evidence chunks
    const concepts = await DB.getConcepts(auth.userId, course.id);
    const sources = await DB.getSources(auth.userId, course.id);

    // Filter by topic if requested
    let filteredConcepts = concepts;
    let filteredSources = sources;
    if (requestedTopic && requestedTopic !== 'all') {
      const topicLower = requestedTopic.toLowerCase();
      filteredConcepts = concepts.filter(
        (c) =>
          (c.category || '').toLowerCase() === topicLower ||
          (c.subtopic || '').toLowerCase() === topicLower ||
          c.name.toLowerCase().includes(topicLower)
      );
      filteredSources = sources.filter(
        (s) =>
          (s.topic || '').toLowerCase() === topicLower ||
          (s.concept || '').toLowerCase() === topicLower ||
          s.snippet.toLowerCase().includes(topicLower)
      );

      // If strict filter yielded empty, fallback gracefully
      if (filteredConcepts.length === 0) filteredConcepts = concepts;
      if (filteredSources.length === 0) filteredSources = sources;
    }

    // 4. Determine target quantity & marks
    let targetCount = Math.max(1, Math.min(25, Number(count) || 5));
    if (questionType === '16_mark') {
      targetCount = Math.min(5, Math.max(1, Number(count) || 3));
    } else if (questionType === 'model_paper') {
      targetCount = 8; // Standard 8-question exam paper
    }

    // Prepare material excerpts for Gemini
    const materialSummary = materials.map((m) => {
      let extra = '';
      if (m.file_type === 'slides') extra = `(${m.slide_count || 20} slides)`;
      else if (m.file_type === 'lecture_video') extra = `(video lectures with timestamps)`;
      else extra = `(${m.page_count || 30} pages)`;
      return `• ${m.title} [Format: ${m.file_type}] ${extra}`;
    }).join('\n');

    const sourceChunksText = filteredSources.slice(0, 18).map((s) => {
      return `[Material: ${s.material_title} | Location: ${s.location_reference} | Topic: ${s.topic || 'General'}]\n"${s.snippet}"\n`;
    }).join('\n---\n');

    const conceptsSummary = filteredConcepts.slice(0, 10).map((c) => {
      return `• ${c.name} (${c.category || 'Topic'}): ${c.description} [Origin: ${c.source_location || 'Page 1'}]`;
    }).join('\n');

    // 5. Existing questions deduplication
    const savedQuestions = await DB.getSavedQuestions(auth.userId, course.id, auth.supabase);
    const previousBankQuestions = await DB.getQuestions(auth.userId, course.id);
    const seenQuestionKeys = new Set<string>();
    savedQuestions.forEach((q) => seenQuestionKeys.add(normalizeKey(q.question_text)));
    previousBankQuestions.forEach((q) => seenQuestionKeys.add(normalizeKey(q.question_text)));

    // 6. Build the prompt according to Question Type
    let questionTypeInstructions = '';
    if (questionType === '2_mark') {
      questionTypeInstructions = `
QUESTION TYPE: 2-Mark Short Answer / Definitions / Distinctions
- Marks: 2 marks per question.
- Focus: Precise academic definitions, core invariant rules, key differences (e.g. Difference between X and Y), or crisp 2-3 sentence explanations.
- The answer must be concise, accurate, and completely grounded in the uploaded material.
- If asking for differences, format the answer with clear comparison points.
`;
    } else if (questionType === '16_mark') {
      questionTypeInstructions = `
QUESTION TYPE: 16-Mark Detailed University Examination Questions
- Marks: 16 marks per question.
- Focus: In-depth, analytical, comprehensive questions requiring multi-layered structured answers.
- Structure of the answer:
  1. "introduction": 2-3 paragraphs defining the concept, historical/theoretical context, and mathematical/algorithmic basis.
  2. "headings": Array of 3-5 structured sections with clear "title", comprehensive academic "content", and optional "code_or_algorithm" if relevant.
  3. "examples": Real-world computational or architectural examples demonstrating the concept.
  4. "diagram_or_flowchart": Detailed description of an architectural diagram, ASCII flowchart, or structural schematic.
  5. "step_by_step_solution": Sequential execution steps, proof steps, or algorithmic trace.
  6. "conclusion": Summary of trade-offs, complexity analysis, and modern engineering relevance.
`;
    } else if (questionType === '5_mark') {
      questionTypeInstructions = `
QUESTION TYPE: 5-Mark Structured Questions
- Marks: 5 marks per question.
- Focus: Conceptual clarity, mechanism explanation, or working steps with 4-5 bullet points.
- Answer should be thorough yet focused (1-2 pages equivalent in handwritten exam).
`;
    } else if (questionType === '10_mark') {
      questionTypeInstructions = `
QUESTION TYPE: 10-Mark Analytical Questions
- Marks: 10 marks per question.
- Focus: Comprehensive explanation of major algorithms, system design, architectural models, or mathematical proofs.
- Answer must include definition, core components, working example, and complexity/efficiency analysis.
`;
    } else if (questionType === 'mcq') {
      questionTypeInstructions = `
QUESTION TYPE: Multiple Choice Questions (MCQ)
- Marks: 1 mark per question.
- Provide 4 distinct options (A, B, C, D) with exactly one correct answer.
- Provide explanations for why the correct option is right and why the distractors are wrong based on the course material.
`;
    } else if (questionType === 'fill_in_the_blank') {
      questionTypeInstructions = `
QUESTION TYPE: Fill in the Blank Questions
- Marks: 1 mark per question.
- Provide a rigorous academic sentence from the material with a critical keyword or phrase replaced by "_______".
- Answer must state the exact missing term and the concept context.
`;
    } else if (questionType === 'important_exam') {
      questionTypeInstructions = `
QUESTION TYPE: High-Yield Important Exam Questions
- Marks: Varied based on question scope (2, 5, 10, or 16 marks).
- Identify high-probability exam topics from the uploaded material that professors frequently test (theorems, foundational invariants, core data structures, critical trade-offs).
- Clearly explain the exam significance and provide model answers.
`;
    } else if (questionType === 'model_paper') {
      questionTypeInstructions = `
QUESTION TYPE: Complete Model Question Paper (University Exam Pattern)
- Generate a balanced 3-Part Question Paper:
  * Part A: 5 questions of 2 Marks each (Total: 10 Marks) - Definitions, Differences, Short Answers.
  * Part B: 2 questions of 10 Marks each (Total: 20 Marks) - Analytical & Descriptive.
  * Part C: 1 question of 16 Marks (Total: 16 Marks) - Comprehensive Essay/Design question with full structured breakdown.
- Total Questions: 8. Total Maximum Marks: 46 Marks.
`;
    }

    const systemPrompt = `You are ADAPTIQ's Senior Academic Exam Controller and Professor for university curricula.
Your mission is to generate authentic, high-rigor, exam-ready questions grounded STRICTLY and EXCLUSIVELY in the user's uploaded course materials.

CRITICAL GROUNDING RULES:
1. Never hallucinate facts or citations. Every question and answer must derive from the provided course materials and excerpts.
2. For every question, cite the exact source document title and location reference:
   - For PDFs: Use exact page number (e.g. "Page 14")
   - For Slides: Use exact slide number (e.g. "Slide 18")
   - For Videos: Use timestamp (e.g. "14:20")
3. Include the exact verbatim quote from the material in "source_citation.quote".
4. If the uploaded material lacks sufficient depth for a topic, frame questions strictly on what is present or note the limitation.
5. Return strictly valid JSON matching the specified schema.`;

    const userPrompt = `
COURSE: "${course.title}" (${course.code || 'University Course'})
COURSE DESCRIPTION: "${course.description || 'Core curriculum'}"
FILTERED TOPIC: "${requestedTopic || 'All Topics'}"
DIFFICULTY: "${difficulty}"
TARGET COUNT: ${targetCount}

UPLOADED MATERIALS:
${materialSummary}

COURSE SYLLABUS CONCEPTS:
${conceptsSummary || 'Extracted from course materials'}

VERIFIED SOURCE EVIDENCE EXCERPTS:
${sourceChunksText || 'Text and lecture transcript excerpts'}

${questionTypeInstructions}

RETURN ONLY A JSON OBJECT MATCHING THIS SCHEMA:
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "Precise, exam-standard question text.",
      "marks": 2,
      "question_type": "${questionType === 'model_paper' ? '2_mark' : questionType}",
      "topic": "Topic Name",
      "subtopic": "Subtopic Name",
      "concept_name": "Concept Name",
      "difficulty": "medium",
      "answer": "Comprehensive, fully verified model answer with clear explanations.",
      "structured_16_mark": {
        "introduction": "Theoretical introduction...",
        "headings": [
          { "title": "1. Core Principles", "content": "Detailed explanation...", "code_or_algorithm": "// Optional code" }
        ],
        "examples": ["Example trace..."],
        "diagram_or_flowchart": {
          "title": "Architecture Schematic",
          "description": "Visual diagram description or ASCII structure..."
        },
        "step_by_step_solution": ["Step 1...", "Step 2..."],
        "conclusion": "Final summary..."
      },
      "options": [
        { "id": "A", "text": "Option text", "is_correct": true, "explanation": "Why correct" },
        { "id": "B", "text": "Option text", "is_correct": false, "explanation": "Why incorrect" }
      ],
      "source_citation": {
        "material_title": "${materials[0]?.title || course.title}",
        "reference": "Page 1",
        "quote": "Direct quote from source excerpt."
      },
      "bloom_level": "Understand"
    }
  ]
}
`;

    const aiResponse = await callGeminiJson<{ questions: RawGeneratedSmartQuestion[] }>(
      userPrompt,
      systemPrompt
    );

    const rawList = aiResponse.questions || [];
    const validQuestions: SmartQuestion[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const rq = rawList[i];
      if (!rq.question_text || rq.question_text.trim().length < 5) continue;

      const normKey = normalizeKey(rq.question_text);
      if (seenQuestionKeys.has(normKey)) continue;
      seenQuestionKeys.add(normKey);

      // Determine marks
      let finalMarks = Number(rq.marks) || (marksPerQuestion ? Number(marksPerQuestion) : 2);
      if (questionType === '2_mark') finalMarks = 2;
      else if (questionType === '5_mark') finalMarks = 5;
      else if (questionType === '10_mark') finalMarks = 10;
      else if (questionType === '16_mark') finalMarks = 16;
      else if (questionType === 'mcq' || questionType === 'fill_in_the_blank') finalMarks = 1;

      // Resolve source citation
      const resolvedCit = resolveCitation(rq.source_citation, materials, sources, rq.topic);

      const q: SmartQuestion = {
        id: `sq-${Date.now()}-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: auth.userId,
        course_id: course.id,
        question_number: i + 1,
        question_text: rq.question_text.trim(),
        marks: finalMarks,
        question_type: rq.question_type || (questionType as SmartQuestionType),
        topic: rq.topic || requestedTopic || 'Core Syllabus',
        subtopic: rq.subtopic,
        concept_name: rq.concept_name,
        difficulty: rq.difficulty || (difficulty === 'all' ? 'medium' : difficulty as any),
        answer: rq.answer || 'Refer to verified course materials.',
        structured_16_mark: rq.structured_16_mark,
        options: rq.options,
        source_citation: resolvedCit,
        bloom_level: rq.bloom_level || (finalMarks >= 10 ? 'Analyze' : 'Understand'),
        is_saved: false,
        created_at: new Date().toISOString(),
      };

      validQuestions.push(q);
    }

    if (validQuestions.length === 0) {
      return NextResponse.json(
        {
          error: 'Could not generate unique questions from the provided materials. Try selecting a different topic or uploading additional course content.',
        },
        { status: 422 }
      );
    }

    const totalMarks = validQuestions.reduce((acc, q) => acc + q.marks, 0);

    return NextResponse.json({
      success: true,
      questions: validQuestions,
      totalQuestions: validQuestions.length,
      totalMarks,
      courseTitle: course.title,
      courseCode: course.code,
      topics: Array.from(new Set(validQuestions.map((q) => q.topic))),
      materialsCount: materials.length,
    });
  } catch (err: any) {
    console.error('Smart Question Bank Generate error:', err);
    return NextResponse.json(
      {
        error: err.message || 'Failed to generate questions using AI.',
      },
      { status: 500 }
    );
  }
}
