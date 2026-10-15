/**
 * ADAPTIQ Unified Multimodal AI Engine
 * Backed by Google Gemini (gemini-3.8-flash / gemini-3.1-flash-lite / gemini-flash-lite-latest)
 * Strictly server-side execution.
 */

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemma-4-26b-a4b-it',
];

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded
  };
}

function getApiKey(): string {
  const key = process.env.AI_API_KEY || '';
  if (!key) {
    throw new Error('AI_API_KEY is not configured in server environment.');
  }
  return key.trim();
}

export async function callGemini(
  promptOrParts: string | GeminiPart[],
  systemInstruction?: string,
  options: { jsonMode?: boolean; temperature?: number } = {}
): Promise<string> {
  const apiKey = getApiKey();
  const temperature = options.temperature ?? 0.3;

  const parts: GeminiPart[] = typeof promptOrParts === 'string'
    ? [{ text: promptOrParts }]
    : promptOrParts;

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    // Retry up to 2 times per model on 503/429 with backoff
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload: any = {
          contents: [
            {
              parts,
            },
          ],
          generationConfig: {
            temperature,
            topP: 0.95,
          },
        };

        if (systemInstruction) {
          payload.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        if (options.jsonMode) {
          payload.generationConfig.responseMimeType = 'application/json';
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorText = await res.text();
          lastError = new Error(`Gemini ${model} HTTP ${res.status}: ${errorText}`);
          if (res.status === 429 || res.status === 503) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }
          break; // non-retryable for this model, move to next
        }

        const data = await res.json();
        const candParts = data.candidates?.[0]?.content?.parts || [];
        // Extract text while ignoring internal thought parts from thinking/reasoning models
        const textParts = candParts.filter((p: any) => p.text && !p.thought);
        const outputText = textParts.length > 0
          ? textParts.map((p: any) => p.text).join('')
          : (candParts[0]?.text || '');

        if (outputText) {
          return outputText;
        }
      } catch (err: any) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  throw lastError || new Error('All Gemini model endpoints failed.');
}

/**
 * Generate parsed JSON from AI with markdown cleanup fallback
 */
function sanitizeAndRepairJson(raw: string): string {
  let cleaned = raw.trim();

  // 1. Clean markdown code fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Quick check
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {}

  // 2. Locate first { or [ and last } or ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx !== -1) {
    const lastEnd = cleaned.lastIndexOf(endChar);
    if (lastEnd > startIdx) {
      cleaned = cleaned.substring(startIdx, lastEnd + 1);
    } else {
      cleaned = cleaned.substring(startIdx);
    }
  }

  // 3. Remove single-line and multi-line comments
  cleaned = cleaned.replace(/\/\/[^\n\r]*/g, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // 4. Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // 5. Replace curly unicode quotes with standard ASCII double quotes
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 6. Fix unescaped backslashes (e.g. LaTeX \alpha, \sigma, \partial, Windows paths)
  cleaned = cleaned.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  // 6. If truncated at the end, attempt balanced closure
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '{') openBraces++;
      else if (c === '}') openBraces = Math.max(0, openBraces - 1);
      else if (c === '[') openBrackets++;
      else if (c === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  if (inString) cleaned += '"';
  while (openBrackets > 0) {
    cleaned += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    cleaned += '}';
    openBraces--;
  }

  // Clean trailing commas again after closure
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Generate parsed JSON from AI with markdown cleanup and syntax repair fallback
 */
export async function callGeminiJson<T>(
  promptOrParts: string | GeminiPart[],
  systemInstruction?: string
): Promise<T> {
  const raw = await callGemini(promptOrParts, systemInstruction, { jsonMode: true, temperature: 0.2 });
  const cleaned = sanitizeAndRepairJson(raw);

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    // Second attempt: remove newlines inside string literals if unescaped
    try {
      const aggressive = cleaned.replace(/[\x00-\x1F\x7F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
      return JSON.parse(aggressive) as T;
    } catch {
      console.error('Failed to parse Gemini JSON output. Raw snippet:', raw.slice(0, 500));
      throw new Error(`Invalid JSON returned by AI: ${err.message}`);
    }
  }
}

/**
 * Generate semantic vector embedding using gemini-embedding-001
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          parts: [{ text: text.slice(0, 8000) }],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('Embedding API error:', res.status, err);
      return [];
    }

    const data = await res.json();
    return data.embedding?.values || [];
  } catch (err: any) {
    console.warn('Embedding generation error:', err.message);
    return [];
  }
}

/**
 * Generate semantic embeddings for an array of text chunks in parallel
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(
    texts.map(async (t) => {
      try {
        return await getEmbedding(t);
      } catch {
        return [];
      }
    })
  );
  return results;
}

/**
 * Calculate cosine similarity between two vector embeddings
 */
export function cosineSimilarity(vecA?: number[], vecB?: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
