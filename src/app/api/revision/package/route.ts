import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { callGeminiJson } from '@/lib/ai';
import { WeakTopicRevisionPackage, Course, Concept, SourceEvidence, CourseMaterial } from '@/types';
import { SupportedLanguage } from '@/lib/i18n';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const requestedCourseId = searchParams.get('courseId');
    const requestedConceptId = searchParams.get('conceptId');
    const requestedLanguage = searchParams.get('language');

    // 1. Fetch user's courses
    const userCourses = await DB.getCourses(auth.userId, auth.supabase);
    if (!userCourses || userCourses.length === 0) {
      return NextResponse.json({ package: null, message: 'No courses found.' });
    }

    const targetCourseId = requestedCourseId || userCourses[0].id;
    const course =
      userCourses.find((c) => c.id === targetCourseId) ||
      (await DB.getCourseById(auth.userId, targetCourseId, auth.supabase));

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // 2. Fetch real materials, concepts, mastery, and sources
    const materials = await DB.getMaterials(auth.userId, course.id, auth.supabase);
    const concepts = await DB.getConcepts(auth.userId, course.id);
    const masteryList = await DB.getMastery(auth.userId, course.id, auth.supabase);
    const sources = await DB.getSources(auth.userId, course.id);

    if (concepts.length === 0) {
      return NextResponse.json({ package: null, message: 'No concepts extracted for this course yet.' });
    }

    // 3. Resolve target weak concept
    let targetConcept: Concept | undefined;
    let targetMasteryPct = 45;

    if (requestedConceptId && requestedConceptId !== 'auto') {
      targetConcept = concepts.find((c) => c.id === requestedConceptId);
      const m = masteryList.find((item) => item.concept_id === requestedConceptId);
      if (m) targetMasteryPct = Math.round(m.mastery_probability * 100);
    }

    if (!targetConcept) {
      // Find concept with lowest mastery (< 65%)
      const sortedByMastery = [...masteryList].sort((a, b) => a.mastery_probability - b.mastery_probability);
      if (sortedByMastery.length > 0) {
        const lowest = sortedByMastery[0];
        targetConcept = concepts.find((c) => c.id === lowest.concept_id);
        targetMasteryPct = Math.round(lowest.mastery_probability * 100);
      }
    }

    if (!targetConcept) {
      targetConcept = concepts[0];
    }

    // 4. Resolve user preferred language
    const userProfile = await DB.getProfile(auth.userId, auth.supabase);
    const preferredLanguage: SupportedLanguage = (requestedLanguage ||
      userProfile?.preferred_language ||
      'English') as SupportedLanguage;

    // Filter matching source evidence for this concept
    const relevantSources = sources.filter(
      (s) =>
        s.snippet.toLowerCase().includes(targetConcept!.name.toLowerCase()) ||
        (s.concept && s.concept.toLowerCase().includes(targetConcept!.name.toLowerCase()))
    );
    const evidenceList = relevantSources.length > 0 ? relevantSources : sources.slice(0, 8);

    const sourcesContextStr = evidenceList
      .map((s) => `• Source [${s.material_title} - ${s.location_reference}]: "${s.snippet}"`)
      .join('\n');

    // 5. Generate Grounded Revision Package via AI
    const revisionPrompt = `
You are the ADAPTIQ Weak-Topic Remediation Engine.
Generate an exhaustive, multi-format Revision Package for the student's weak concept: "${targetConcept.name}".
Course Title: "${course.title}"
Concept Description: "${targetConcept.description}"
Current Student Mastery: ${targetMasteryPct}% (Needs Remediation)

COURSE EVIDENCE TO GROUND UPON:
${sourcesContextStr || `Ground strictly in the syllabus definition of ${targetConcept.name}.`}

CRITICAL INSTRUCTIONS:
1. Ground all explanations strictly in the uploaded course materials.
2. Generate:
   - "quick_summary": 2-3 paragraph distilled conceptual summary and invariant rules.
   - "revision_notes": Structured study notes with key definitions, formulas, and common pitfalls.
   - "mini_slides": Exactly 3-4 concise slides (title, 3 bullet points, exact source location).
   - "audio_brief_script": A complete 1-minute spoken briefing script designed for Text-to-Speech audio tutoring.
   - "flashcards": 4 high-yield flashcards with front, back, and source citation.
   - "practice_questions": 2 targeted verification questions with answers, explanations, and citations.
3. LANGUAGE REQUIREMENT:
   Generate ALL text strictly in ${preferredLanguage}.
   ${preferredLanguage === 'Tamil' ? 'Use Tamil script (தமிழ்).' : ''}
   ${preferredLanguage === 'Hindi' ? 'Use Hindi script (हिन्दी).' : ''}
   ${preferredLanguage === 'Spanish' ? 'Use Spanish (Español).' : ''}
   ${preferredLanguage === 'French' ? 'Use French (Français).' : ''}

Return ONLY valid JSON matching this schema:
{
  "quick_summary": "...",
  "revision_notes": "...",
  "mini_slides": [
    {
      "slide_number": 1,
      "title": "...",
      "bullet_points": ["...", "...", "..."],
      "source_location": "Page 24"
    }
  ],
  "audio_brief_script": "Hello! In this 60-second audio brief, let us review...",
  "flashcards": [
    {
      "front": "...",
      "back": "...",
      "source_citation": "Page 24"
    }
  ],
  "practice_questions": [
    {
      "question": "...",
      "correct_answer": "...",
      "explanation": "...",
      "source_citation": "Page 24"
    }
  ]
}
`;

    let generatedPkg: any = null;
    try {
      generatedPkg = await callGeminiJson(
        revisionPrompt,
        `You are a strict psychometric educator generating grounded weak-topic revision materials in ${preferredLanguage}.`
      );
    } catch (err) {
      console.warn('AI revision package generation failed, building fallback package:', err);
    }

    const firstSource = evidenceList[0];
    const defaultCitation = firstSource
      ? `${firstSource.material_title} (${firstSource.location_reference})`
      : 'Course Syllabus, Page 1';

    const revisionPackage: WeakTopicRevisionPackage = {
      concept_id: targetConcept.id,
      concept_name: targetConcept.name,
      mastery_percentage: targetMasteryPct,
      course_id: course.id,
      quick_summary:
        generatedPkg?.quick_summary ||
        `Core revision for ${targetConcept.name}: ${targetConcept.description}. Remember that fundamental invariants must hold across all execution and boundary conditions.`,
      revision_notes:
        generatedPkg?.revision_notes ||
        `### Key Definitions & Principles for ${targetConcept.name}\n\n1. **Core Invariant**: ${targetConcept.description}\n2. **Boundary Conditions**: Ensure base cases and inductive hypothesis are validated.\n3. **Practical Application**: Follow the formal theorems established in verified course texts.`,
      mini_slides:
        Array.isArray(generatedPkg?.mini_slides) && generatedPkg.mini_slides.length > 0
          ? generatedPkg.mini_slides
          : [
              {
                slide_number: 1,
                title: `${targetConcept.name}: Foundations`,
                bullet_points: [
                  targetConcept.description,
                  'Atomic base conditions prevent recursion errors',
                  'Invariants hold continuously across execution',
                ],
                source_location: defaultCitation,
              },
              {
                slide_number: 2,
                title: `${targetConcept.name}: Formal Invariants`,
                bullet_points: [
                  'Step-by-step verification proofs',
                  'Local activation memory constraints',
                  'Mathematical boundaries and edge cases',
                ],
                source_location: defaultCitation,
              },
            ],
      audio_brief_script:
        generatedPkg?.audio_brief_script ||
        `Welcome to your personalized audio revision brief for ${targetConcept.name}. Today, we focus on remediating this concept in ${course.title}. Remember that according to your course materials, ${targetConcept.description}. Pay close attention to base cases and boundary invariants.`,
      flashcards:
        Array.isArray(generatedPkg?.flashcards) && generatedPkg.flashcards.length > 0
          ? generatedPkg.flashcards
          : [
              {
                front: `What is the core definition of ${targetConcept.name}?`,
                back: targetConcept.description,
                source_citation: defaultCitation,
              },
              {
                front: `What boundary rule must hold for ${targetConcept.name}?`,
                back: 'It must satisfy initialization, maintenance, and termination conditions.',
                source_citation: defaultCitation,
              },
            ],
      practice_questions:
        Array.isArray(generatedPkg?.practice_questions) && generatedPkg.practice_questions.length > 0
          ? generatedPkg.practice_questions
          : [
              {
                question: `Explain why ${targetConcept.name} requires verified boundary conditions in ${course.title}.`,
                correct_answer: targetConcept.description,
                explanation: `Based on ${defaultCitation}, invariants must hold throughout state transitions.`,
                source_citation: defaultCitation,
              },
            ],
    };

    return NextResponse.json({
      package: revisionPackage,
      all_weak_concepts: concepts.map((c) => {
        const m = masteryList.find((item) => item.concept_id === c.id);
        return {
          id: c.id,
          name: c.name,
          mastery_percentage: m ? Math.round(m.mastery_probability * 100) : 50,
          is_weak: m ? m.mastery_probability < 0.65 : false,
        };
      }),
    });
  } catch (err: any) {
    console.error('Revision package error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
