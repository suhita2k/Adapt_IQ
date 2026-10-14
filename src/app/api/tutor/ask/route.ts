import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { callGeminiJson, getEmbedding, cosineSimilarity } from '@/lib/ai';
import { TutorMessage, SourceEvidence } from '@/types';
import { SupportedLanguage, I18N } from '@/lib/i18n';

interface TutorAiResponse {
  has_sufficient_evidence: boolean;
  source_backed_answer?: string;
  outside_knowledge_answer?: string;
  answer: string;
  is_off_material: boolean;
  citations: {
    reference: string;
    snippet: string;
    relevance_reason: string;
    media_type?: 'textbook' | 'slides' | 'lecture_video' | 'image';
  }[];
  suggested_followups: string[];
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  let courseId = searchParams.get('courseId');
  if (!courseId) {
    const userCourses = await DB.getCourses(auth.userId, auth.supabase);
    courseId = userCourses[0]?.id || 'unassigned';
  }

  const messages = await DB.getTutorMessages(auth.userId, courseId);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    let { query, courseId, conceptId, language } = body;
    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!courseId) {
      const userCourses = await DB.getCourses(auth.userId, auth.supabase);
      courseId = userCourses[0]?.id || 'unassigned';
    }

    const course = await DB.getCourseById(auth.userId, courseId, auth.supabase);
    const materials = await DB.getMaterials(auth.userId, courseId, auth.supabase);
    const availableSources = await DB.getSources(auth.userId, courseId);
    const concepts = await DB.getConcepts(auth.userId, courseId);

    // Resolve user's preferred language from request body or Supabase profile
    const userProfile = await DB.getProfile(auth.userId, auth.supabase);
    const preferredLanguage: SupportedLanguage = (language || userProfile?.preferred_language || 'English') as SupportedLanguage;

    if (materials.length === 0 || availableSources.length === 0) {
      const notFoundText = preferredLanguage === 'Tamil'
        ? 'இத்தகவல் உங்கள் பதிவேற்றப்பட்ட பாடப் பொருட்களில் கிடைக்கவில்லை.'
        : preferredLanguage === 'Hindi'
        ? 'यह जानकारी आपकी अपलोड की गई अध्ययन सामग्री में नहीं मिली।'
        : preferredLanguage === 'Spanish'
        ? 'Esta información no se encontró en el material del curso subido.'
        : preferredLanguage === 'French'
        ? 'Cette information n\'a pas été trouvée dans vos supports de cours téléversés.'
        : 'This information was not found in your uploaded course material.';

      return NextResponse.json({
        answer: notFoundText,
        isOffMaterial: true,
        citations: [],
        suggestedFollowups: [
          'How do I upload course materials (PDF, PPT, Video)?',
          'What file formats are supported?',
          'How does RAG grounding work in ADAPTIQ?'
        ],
        messageId: `msg-no-mat-${Date.now()}`
      });
    }

    const activeConcept = concepts.find((c) => c.id === conceptId);
    const materialSummary = materials.map((m) => `Document: "${m.title}" (${m.file_type})`).join('; ');

    // 1. Generate Query Vector Embedding using gemini-embedding-001
    const queryEmbedding = await getEmbedding(query);

    // 2. Intelligent Query Preprocessing & Stopword Removal
    const STOP_WORDS = new Set([
      'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
      'have', 'has', 'had', 'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'from',
      'explain', 'describe', 'tell', 'show', 'give', 'detail', 'details',
      'can', 'could', 'would', 'should', 'please', 'me', 'us', 'you', 'my', 'your',
      'this', 'that', 'these', 'those'
    ]);

    const rawWords = query.toLowerCase().replace(/[^a-z0-9\s:]/g, ' ').split(/\s+/).filter(Boolean);
    const meaningfulTokens = rawWords.filter((w: string) => !STOP_WORDS.has(w) && w.length > 2);
    const queryTokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawWords;

    // Detect explicit target location in user query (e.g., "Page 12", "Slide 42", "17:20")
    const pageMatch = query.match(/\b(?:page|p\.?)\s*(\d+)\b/i);
    const slideMatch = query.match(/\b(?:slide|s\.?)\s*(\d+)\b/i);
    const timeMatch = query.match(/\b(\d{1,2}:\d{2})\b/);

    const targetPage = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
    const targetSlide = slideMatch ? parseInt(slideMatch[1], 10) : undefined;
    const targetTime = timeMatch ? timeMatch[1] : undefined;

    // Extract 2-word and 3-word n-gram phrases for exact technical terminology matching
    const nGrams: string[] = [];
    for (let i = 0; i < rawWords.length - 1; i++) {
      nGrams.push(`${rawWords[i]} ${rawWords[i + 1]}`);
      if (i < rawWords.length - 2) {
        nGrams.push(`${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`);
      }
    }

    // 3. Hybrid Semantic Vector Search + Keyword + N-Gram + Location Boost
    const scoredSources = availableSources.map((s) => {
      let vectorScore = 0;
      if (queryEmbedding.length > 0 && s.embedding && s.embedding.length > 0) {
        vectorScore = cosineSimilarity(queryEmbedding, s.embedding);
      }

      let keywordMatches = 0;
      const combined = `${s.snippet} ${s.topic || ''} ${s.subtopic || ''} ${s.concept || ''} ${s.relevance_reason || ''} ${s.location_reference || ''} ${s.visual_element?.caption || ''} ${s.visual_element?.description || ''} ${s.visual_element?.formula || ''}`.toLowerCase();

      // Check token frequency
      for (const tok of queryTokens) {
        if (combined.includes(tok)) keywordMatches++;
      }

      // Check exact n-gram phrase matches (e.g., "access control", "cloud deployment")
      for (const phrase of nGrams) {
        if (combined.includes(phrase)) keywordMatches += 3;
      }

      if (activeConcept && combined.includes(activeConcept.name.toLowerCase())) keywordMatches += 2;

      const normKeyword = Math.min(1, keywordMatches / Math.max(1, queryTokens.length * 1.5));
      let hybridScore = vectorScore > 0 ? (vectorScore * 0.55 + normKeyword * 0.45) : normKeyword;

      // Location reference boost: if user asked for Page X or Slide Y, boost matching chunks
      if (targetPage !== undefined) {
        const sPage = s.page_number || (s.location_type === 'page' ? parseInt(s.location_reference.replace(/[^0-9]/g, ''), 10) : undefined);
        if (sPage === targetPage || s.location_reference.toLowerCase() === `page ${targetPage}`) {
          hybridScore += 1.0;
        }
      }
      if (targetSlide !== undefined) {
        const sSlide = s.slide_number || (s.location_type === 'slide' ? parseInt(s.location_reference.replace(/[^0-9]/g, ''), 10) : undefined);
        if (sSlide === targetSlide || s.location_reference.toLowerCase() === `slide ${targetSlide}`) {
          hybridScore += 1.0;
        }
      }
      if (targetTime !== undefined && (s.timestamp === targetTime || s.location_reference.includes(targetTime))) {
        hybridScore += 1.0;
      }

      return { source: s, score: hybridScore, vectorScore, keywordMatches };
    });

    scoredSources.sort((a, b) => b.score - a.score);

    // 4. Strict Evidence Gate: If no relevant content matches, refuse to hallucinate
    const bestMatch = scoredSources[0];
    const hasEvidence = bestMatch && (bestMatch.score >= 0.20 || bestMatch.keywordMatches >= 1 || targetPage !== undefined || targetSlide !== undefined);

    if (!hasEvidence) {
      const notFoundText = preferredLanguage === 'Tamil'
        ? 'இத்தகவல் உங்கள் பதிவேற்றப்பட்ட பாடப் பொருட்களில் கிடைக்கவில்லை.'
        : preferredLanguage === 'Hindi'
        ? 'यह जानकारी आपकी अपलोड की गई अध्ययन सामग्री में नहीं मिली।'
        : preferredLanguage === 'Spanish'
        ? 'Esta información no se encontró en el material del curso subido.'
        : preferredLanguage === 'French'
        ? 'Cette information n\'a pas été trouvée dans vos supports de cours téléversés.'
        : 'I could not find sufficient evidence in your uploaded course materials.';

      const userMsg: TutorMessage = {
        id: `msg-u-${Date.now()}`,
        user_id: auth.userId,
        course_id: courseId,
        role: 'user',
        content: query,
        created_at: new Date().toISOString(),
      };
      await DB.saveTutorMessage(auth.userId, userMsg);

      const assistantMsg: TutorMessage = {
        id: `msg-a-${Date.now()}`,
        user_id: auth.userId,
        course_id: courseId,
        role: 'assistant',
        content: notFoundText,
        is_off_material: true,
        citations: [],
        suggested_followups: [
          'What topics are covered in the uploaded course material?',
          'Explain the key concept from Page 1',
          'Summarize the core definitions in my syllabus'
        ],
        created_at: new Date().toISOString(),
      };
      await DB.saveTutorMessage(auth.userId, assistantMsg);

      return NextResponse.json({
        answer: notFoundText,
        isOffMaterial: true,
        citations: [],
        suggestedFollowups: assistantMsg.suggested_followups,
        messageId: assistantMsg.id,
      });
    }

    const topSources = scoredSources.filter((item) => item.score > 0.10).slice(0, 10).map((item) => item.source);

    const snippets = topSources.map((s) => {
      let visNote = '';
      if (s.visual_element) {
        visNote = ` [Visual ${s.visual_element.type?.toUpperCase()}: "${s.visual_element.caption}" - ${s.visual_element.description}${s.visual_element.formula ? ` | Formula: ${s.visual_element.formula}` : ''}${s.visual_element.data_points ? ` | Data: ${s.visual_element.data_points.join(', ')}` : ''}]`;
      }
      return `[${s.material_title} | ${s.location_type?.toUpperCase() || 'SOURCE'}: ${s.location_reference}]: "${s.snippet}"${visNote}`;
    }).join('\n\n');

    // 5. Query Gemini AI Grounded Strictly in Retrieved Real Uploaded Course Content
    const systemPrompt = `
You are the ADAPTIQ Course AI Tutor for "${course?.title || 'Academic Course'}".
You are grounded STRICTLY in the student's uploaded materials and textbooks provided below.

Uploaded Materials:
${materialSummary || 'Course Syllabus and Materials'}

ACTUAL RETRIEVED VERIFIED COURSE EXCERPTS:
${snippets}

Current Topic of Inquiry: ${activeConcept ? activeConcept.name : 'General Course Content'}
Target Explanation Language: ${preferredLanguage}

CRITICAL MULTILINGUAL MANDATE:
You MUST generate your entire response ("answer", "relevance_reason", "suggested_followups") strictly in ${preferredLanguage}.
- If ${preferredLanguage} is Tamil: respond strictly in Tamil script (தமிழ்).
- If ${preferredLanguage} is Hindi: respond strictly in Hindi script (हिन्दी).
- If ${preferredLanguage} is Spanish: respond strictly in Spanish (Español).
- If ${preferredLanguage} is French: respond strictly in French (Français).
- If ${preferredLanguage} is English: respond in English.

STRICT GROUNDING & CITATION REQUIREMENTS:
1. Base your answer EXCLUSIVELY on the verified course excerpts above.
2. If the excerpts do not contain the answer, say clearly:
   "I could not find sufficient evidence in your uploaded course materials."
   Set "has_sufficient_evidence": false.
3. NEVER fabricate page numbers or citations. Do NOT default to "Page 5" or any fixed page number.
   Every citation MUST reference the EXACT page or slide number provided in the bracketed excerpt tag (e.g. if the excerpt says "[THULIR | SLIDE: Slide 42]", cite "Slide 42"; if it says "[Page 34]", cite "Page 34").
4. If the answer IS covered in the excerpts:
   - Set "has_sufficient_evidence": true.
   - Format answer under header:
     ### SOURCE-BACKED ANSWER
     Provide a clear, student-friendly explanation citing exact locations (e.g. 📄 Page 34, 📊 Slide 42, 🎥 02:31).
   - If relevant external background helps clarify difficult concepts, separate it under header:
     ### ADDITIONAL CONTEXT (EXTERNAL KNOWLEDGE)
5. For every citation in the "citations" array:
   - "reference": Exact location string matching the source (e.g. "Page 34", "Slide 42", "Slide 25", "02:31")
   - "snippet": Direct quote from the excerpt supporting this statement
   - "relevance_reason": Clear explanation of why this source proves the answer
6. Do NOT invent citations or fabricate quotes.

Return JSON matching:
{
  "has_sufficient_evidence": true,
  "source_backed_answer": "...",
  "outside_knowledge_answer": "...",
  "answer": "...",
  "is_off_material": false,
  "citations": [
    {
      "reference": "Slide 42",
      "snippet": "...",
      "relevance_reason": "..."
    }
  ],
  "suggested_followups": [
    "Question 1 in ${preferredLanguage}?",
    "Question 2 in ${preferredLanguage}?"
  ]
}
`;

    const userPrompt = `Student Question (Respond strictly in ${preferredLanguage}): "${query}"`;
    const aiRes = await callGeminiJson<TutorAiResponse>(userPrompt, systemPrompt);

    // Save user message to persistent history
    const userMsg: TutorMessage = {
      id: `msg-u-${Date.now()}`,
      user_id: auth.userId,
      course_id: courseId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };
    await DB.saveTutorMessage(auth.userId, userMsg);

    // Transform citations with exact media type, clickable file URL with #page=N, and deep references
    const transformedCitations: SourceEvidence[] = (aiRes.citations || []).map((c, i) => {
      const ref = c.reference || 'Page 1';
      const isVid = ref.includes(':');
      const isSlide = ref.toLowerCase().includes('slide');
      const isImg = ref.toLowerCase().includes('fig') || ref.toLowerCase().includes('image');
      const locType = isVid ? 'timestamp' : isSlide ? 'slide' : isImg ? 'image' : 'page';

      // Parse numerical index for page/slide
      const numMatch = ref.match(/\d+/);
      const parsedNum = numMatch ? parseInt(numMatch[0], 10) : undefined;

      // Find best matched source chunk
      const matchedSource = availableSources.find((s) => {
        if (s.location_reference?.toLowerCase() === ref.toLowerCase()) return true;
        if (locType === 'page' && parsedNum && s.page_number === parsedNum) return true;
        if (locType === 'slide' && parsedNum && s.slide_number === parsedNum) return true;
        if (s.snippet && c.snippet && s.snippet.toLowerCase().includes(c.snippet.slice(0, 25).toLowerCase())) return true;
        return false;
      });

      const matchedMat = materials.find((m) => {
        if (matchedSource && m.id === matchedSource.material_id) return true;
        if (locType === 'timestamp' && m.file_type === 'lecture_video') return true;
        if (locType === 'slide' && m.file_type === 'slides') return true;
        if (locType === 'image' && (m.file_type === 'image' || m.file_type === 'figure')) return true;
        return m.file_type === 'textbook' || m.file_type === 'notes';
      }) || materials[0];

      const pageNum = matchedSource?.page_number || (locType === 'page' ? parsedNum : undefined);
      const slideNum = matchedSource?.slide_number || (locType === 'slide' ? parsedNum : undefined);
      const timestamp = matchedSource?.timestamp || (isVid ? ref : undefined);

      // Deep hash link: opens PDF or presentation directly at page/slide N
      let fileUrl = matchedSource?.file_url || matchedMat?.file_url;
      if (fileUrl) {
        const baseFileUrl = fileUrl.split('#')[0];
        if (locType === 'page' && pageNum) {
          fileUrl = `${baseFileUrl}#page=${pageNum}`;
        } else if (locType === 'slide' && slideNum) {
          fileUrl = `${baseFileUrl}#page=${slideNum}`;
        } else {
          fileUrl = baseFileUrl;
        }
      }

      return {
        id: `cite-${Date.now()}-${i}`,
        course_id: courseId,
        material_id: matchedMat?.id || matchedSource?.material_id || 'mat-1',
        material_title: matchedMat?.title || matchedSource?.material_title || course?.title || 'Course Material',
        material_type: matchedMat?.file_type || matchedSource?.material_type || (locType === 'timestamp' ? 'lecture_video' : locType === 'slide' ? 'slides' : 'textbook'),
        file_name: matchedMat?.file_name || matchedSource?.file_name || `${matchedMat?.title || 'document'}.pdf`,
        file_url: fileUrl,
        page_number: pageNum,
        slide_number: slideNum,
        timestamp,
        location_type: locType,
        location_reference: ref,
        snippet: c.snippet,
        confidence_score: 0.98,
        relevance_reason: c.relevance_reason,
        topic: matchedSource?.topic,
        concept: matchedSource?.concept,
        visual_element: matchedSource?.visual_element,
      };
    });

    // Save assistant response with separated source-backed and outside knowledge
    const assistantMsg: TutorMessage = {
      id: `msg-a-${Date.now()}`,
      user_id: auth.userId,
      course_id: courseId,
      role: 'assistant',
      content: aiRes.answer,
      source_backed_content: aiRes.source_backed_answer,
      outside_knowledge_content: aiRes.outside_knowledge_answer,
      created_at: new Date().toISOString(),
      is_off_material: aiRes.is_off_material || !aiRes.has_sufficient_evidence,
      citations: transformedCitations,
      suggested_followups: aiRes.suggested_followups,
    };
    await DB.saveTutorMessage(auth.userId, assistantMsg);

    // Update Learner Model: Tutor conversations consolidate cognitive retention
    if (activeConcept) {
      try {
        await DB.updateMasteryBKT(
          auth.userId,
          activeConcept.id,
          true,
          courseId,
          activeConcept.name,
          auth.supabase
        );
      } catch {
        // non-blocking
      }
    }

    return NextResponse.json({
      answer: aiRes.answer,
      hasSufficientEvidence: aiRes.has_sufficient_evidence,
      sourceBackedAnswer: aiRes.source_backed_answer,
      outsideKnowledgeAnswer: aiRes.outside_knowledge_answer,
      isOffMaterial: aiRes.is_off_material,
      citations: transformedCitations,
      suggestedFollowups: aiRes.suggested_followups,
      messageId: assistantMsg.id,
    });
  } catch (err: any) {
    console.error('Tutor ask error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
