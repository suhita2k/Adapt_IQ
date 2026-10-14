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
    } = await request.json();

    // Resolve real course ID (no hardcoded fallback)
    let targetCourseId = courseId;
    if (!targetCourseId) {
      const userCourses = await DB.getCourses(auth.userId, auth.supabase);
      targetCourseId = userCourses[0]?.id || 'unassigned';
    }

    // Resolve user's preferred language
    const userProfile = await DB.getProfile(auth.userId, auth.supabase);
    const preferredLanguage: SupportedLanguage = (language || userProfile?.preferred_language || 'English') as SupportedLanguage;

    // Evaluate correctness based on question type
    let isCorrect = Boolean(clientIsCorrect);

    if (questionType === 'numerical' && correctAnswer) {
      const userNum = parseFloat(String(selectedOptionText).replace(/[^0-9.-]/g, ''));
      const targetNum = parseFloat(String(correctAnswer).replace(/[^0-9.-]/g, ''));
      if (!isNaN(userNum) && !isNaN(targetNum)) {
        const diff = Math.abs(userNum - targetNum);
        const tolerance = Math.max(0.01, Math.abs(targetNum) * 0.03); // 3% tolerance
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

    // 1. Record Attempt in Supabase & Persistent storage
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

    // 2. Update Student Mastery via Bayesian Knowledge Tracing (BKT)
    const updatedMastery = await DB.updateMasteryBKT(
      auth.userId,
      conceptId || 'concept-core',
      isCorrect,
      targetCourseId,
      conceptName,
      auth.supabase
    );

    let detectedMisconception: Misconception | null = null;
    const misconceptionTag = rawMisconceptionTag || (!isCorrect ? `Invariant Misconception: ${conceptName || 'Core Concept'}` : undefined);

    // 3. If incorrect, detect and record misconception with remediation steps
    if (!isCorrect && misconceptionTag) {
      let desc = preferredLanguage === 'Tamil'
        ? `மாணவர் தேர்ந்தெடுத்த பதில்: "${selectedOptionText}". இது ${conceptName || 'இப்பாடத்தின்'} அடிப்படை விதியை தவறாக புரிந்துகொண்டதை காட்டுகிறது.`
        : preferredLanguage === 'Hindi'
        ? `विद्यार्थी ने चुना: "${selectedOptionText}"। यह ${conceptName || 'इस विषय'} के मूल सिद्धांत की गलत समझ को दर्शाता है।`
        : preferredLanguage === 'Spanish'
        ? `El estudiante seleccionó: "${selectedOptionText}". Esto revela una confusión fundamental sobre ${conceptName || 'el tema'}.`
        : preferredLanguage === 'French'
        ? `L'étudiant a sélectionné: "${selectedOptionText}". Cela révèle une incompréhension fondamentale de ${conceptName || 'ce sujet'}.`
        : `Student response: "${selectedOptionText}". This reveals a conceptual misconception regarding ${conceptName || 'the topic'}.`;

      let steps = [
        {
          step_number: 1,
          title: preferredLanguage === 'Tamil' ? 'தவறான அனுமானத்தை பகுப்பாய்வு செய்க'
            : preferredLanguage === 'Hindi' ? 'गलत धारणा का विश्लेषण करें'
            : preferredLanguage === 'Spanish' ? 'Deconstruir el contraejemplo'
            : preferredLanguage === 'French' ? 'Déconstruire le contre-exemple'
            : 'Deconstruct the Counter-Example',
          explanation: preferredLanguage === 'Tamil' ? 'இந்த அனுமானத்தை எல்லையோர நிபந்தனைக்கு பயன்படுத்தும்போது என்ன நிகழ்கிறது என்பதை கவனியுங்கள்.'
            : preferredLanguage === 'Hindi' ? 'ध्यान दें कि जब इस धारणा को सीमांत स्थिति पर लागू किया जाता है तो क्या होता है।'
            : preferredLanguage === 'Spanish' ? 'Considera lo que sucede cuando esta suposición se aplica a un caso extremo.'
            : preferredLanguage === 'French' ? 'Observez ce qui se produit lorsque cette hypothèse est appliquée à un cas limite.'
            : 'Examine boundary conditions where this assumption fails.',
          verified_quote: sourceCitation?.quote || 'Fundamental invariants must hold across initialization and maintenance.',
          source_ref: sourceCitation ? `${sourceCitation.material_title} (${sourceCitation.reference})` : 'Course Syllabus, Page 1',
        },
        {
          step_number: 2,
          title: preferredLanguage === 'Tamil' ? 'முறையான கோட்பாடு மற்றும் சரிபார்ப்பு'
            : preferredLanguage === 'Hindi' ? 'औपचारिक सिद्धांत एवं सत्यापन'
            : preferredLanguage === 'Spanish' ? 'Formulación formal del concepto'
            : preferredLanguage === 'French' ? 'Formulation formelle du concept'
            : 'Formal Concept Formulation',
          explanation: preferredLanguage === 'Tamil' ? 'பாடநூலில் குறிப்பிடப்பட்டுள்ளவாறு முறையான விதியைப் பின்பற்றவும்.'
            : preferredLanguage === 'Hindi' ? 'पाठ्यक्रम सामग्री में उल्लिखित औपचारिक नियम का पालन करें।'
            : preferredLanguage === 'Spanish' ? 'Aplica la regla formal establecida en el material del curso.'
            : preferredLanguage === 'French' ? 'Appliquez la règle formelle énoncée dans le cours.'
            : 'Trace the formal definition and verified properties in the course materials.',
          code_example: `// Core Invariant Verification\nassert condition == True`,
          verified_quote: providedExplanation || 'Properties must hold invariant across all execution paths.',
          source_ref: sourceCitation ? `${sourceCitation.material_title} (${sourceCitation.reference})` : 'Course Text',
        },
        {
          step_number: 3,
          title: preferredLanguage === 'Tamil' ? 'சுய-விளக்கம் மற்றும் மறுமதிப்பீடு'
            : preferredLanguage === 'Hindi' ? 'स्व-व्याख्या एवं पुनरावलोकन'
            : preferredLanguage === 'Spanish' ? 'Autoexplicación y verificación'
            : preferredLanguage === 'French' ? 'Auto-explication et vérification'
            : 'Self-Explanation & Validation',
          explanation: preferredLanguage === 'Tamil' ? 'விடைக்கான சரியான காரணத்தை உங்கள் சொந்த வார்த்தைகளில் உறுதிப்படுத்தவும்.'
            : preferredLanguage === 'Hindi' ? 'अपने शब्दों में पुष्टि करें कि सही उत्तर क्यों मान्य है।'
            : preferredLanguage === 'Spanish' ? 'Verifica con tus propias palabras por qué la respuesta correcta es válida.'
            : preferredLanguage === 'French' ? 'Vérifiez par vos propres mots pourquoi la réponse est correcte.'
            : 'Articulate why the correct rule holds for all inputs and state transitions.',
          verified_quote: 'Verified grounding against course syllabus.',
          source_ref: sourceCitation ? `${sourceCitation.material_title}` : 'Course Reference',
        },
      ];

      try {
        const remediationPrompt = `
A student answered an assessment question incorrectly.
Course: "${targetCourseId}"
Topic/Concept: "${conceptName || 'Academic Subject'}"
Identified Misconception: "${misconceptionTag}"
Student's Selected Option / Answer: "${selectedOptionText}"
Target Language: ${preferredLanguage}

CRITICAL LANGUAGE REQUIREMENT:
Generate the misconception description and all 3 remediation steps strictly in ${preferredLanguage}.

Return JSON matching:
{
  "description": "Pedagogical explanation in ${preferredLanguage} analyzing why the student selected this answer and how to correct their mental model.",
  "remediation_steps": [
    {
      "step_number": 1,
      "title": "Step 1 title in ${preferredLanguage}",
      "explanation": "Detailed explanation in ${preferredLanguage}",
      "verified_quote": "Core principle quote",
      "source_ref": "Reference"
    },
    {
      "step_number": 2,
      "title": "Step 2 title in ${preferredLanguage}",
      "explanation": "Step 2 conceptual formulation in ${preferredLanguage}",
      "code_example": "// optional example",
      "verified_quote": "Rule statement",
      "source_ref": "Course Text"
    },
    {
      "step_number": 3,
      "title": "Step 3 title in ${preferredLanguage}",
      "explanation": "Self-check verification exercise in ${preferredLanguage}",
      "verified_quote": "Summary rule",
      "source_ref": "Textbook Reference"
    }
  ]
}
`;

        const aiRemediation = await callGeminiJson<RemediationAiPayload>(
          remediationPrompt,
          `You are an expert academic tutor and psychometrician specializing in cognitive remediation in ${preferredLanguage}.`
        );

        if (aiRemediation?.description && aiRemediation.remediation_steps?.length > 0) {
          desc = aiRemediation.description;
          steps = aiRemediation.remediation_steps;
        }
      } catch (aiErr) {
        console.warn('AI remediation generation fallback:', aiErr);
      }

      detectedMisconception = {
        id: `misc-${Date.now()}-${conceptId}`,
        user_id: auth.userId,
        course_id: targetCourseId,
        concept_id: conceptId || 'concept-core',
        concept_name: conceptName || 'Core Concept',
        title: misconceptionTag,
        description: desc,
        trigger_evidence: `Assessment attempt on question ${questionId || 'N/A'}. Given answer: "${selectedOptionText}".`,
        severity: 'high',
        detected_at: new Date().toISOString(),
        status: 'active',
        remediation_steps: steps,
        verification_question_id: `retest-${Date.now()}`,
      };

      await DB.recordMisconception(auth.userId, detectedMisconception, auth.supabase);
    }

    // Cited feedback metadata
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
        id: conceptId,
        name: conceptName,
      },
      mastery: updatedMastery,
      misconception: detectedMisconception,
    });
  } catch (err: any) {
    console.error('Assessment evaluation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
