import fs from 'fs';
import path from 'path';
import {
  UserProfile,
  Course,
  CourseMaterial,
  Concept,
  ConceptRelationship,
  StudentMastery,
  Misconception,
  Question,
  QuestionAttempt,
  Assessment,
  StudyPlan,
  StudyTask,
  Flashcard,
  TutorMessage,
  SourceEvidence,
  EvaluationCase,
  TopicMastery,
  LearningTwinMetrics,
  QuestionBank,
  SmartQuestion,
  QuestionPaperConfig,
} from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getUserFilePath(userId: string, entity: string): string {
  ensureDataDir();
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeId}_${entity}.json`);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

function matchesCourseId(itemCourseId?: string, targetCourseId?: string): boolean {
  if (!itemCourseId || !targetCourseId) return false;
  return (
    itemCourseId === targetCourseId ||
    itemCourseId.startsWith(targetCourseId) ||
    targetCourseId.startsWith(itemCourseId)
  );
}

export class DB {
  // ==========================================
  // PROFILES
  // ==========================================
  static async getProfile(userId: string, supabase?: any): Promise<UserProfile | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data && !error) return data as UserProfile;
      } catch (err) {
        // Fallback to local
      }
    }

    const filePath = getUserFilePath(userId, 'profile');
    return readJsonFile<UserProfile | null>(filePath, null);
  }

  static async saveProfile(profile: UserProfile, supabase?: any): Promise<UserProfile> {
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(profile, { onConflict: 'user_id' });
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(profile.user_id, 'profile');
    writeJsonFile(filePath, profile);
    return profile;
  }

  // ==========================================
  // COURSES
  // ==========================================
  static async getCourses(userId: string, supabase?: any): Promise<Course[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false });

        if (data && !error && data.length > 0) return data as Course[];
      } catch (err) {
        // fallback
      }
    }

    const filePath = getUserFilePath(userId, 'courses');
    return readJsonFile<Course[]>(filePath, []);
  }

  static async getCourseById(userId: string, courseId: string, supabase?: any): Promise<Course | null> {
    const courses = await this.getCourses(userId, supabase);
    return courses.find((c) => c.id === courseId) || null;
  }

  static async createCourse(
    userId: string,
    data: { title: string; code?: string; description: string; category?: string; color?: string; icon?: string },
    supabase?: any
  ): Promise<Course> {
    const newCourse: Course = {
      id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      owner_id: userId,
      title: data.title,
      code: data.code || '',
      description: data.description || '',
      category: data.category || 'Academic',
      color: data.color || '#B1A15A',
      icon: data.icon || 'BookOpen',
      total_concepts: 0,
      mastered_concepts: 0,
      materials_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        await supabase.from('courses').insert(newCourse);
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'courses');
    const courses = readJsonFile<Course[]>(filePath, []);
    courses.unshift(newCourse);
    writeJsonFile(filePath, courses);

    return newCourse;
  }

  static async deleteCourse(userId: string, courseId: string, supabase?: any): Promise<boolean> {
    if (supabase) {
      try {
        await supabase.from('courses').delete().eq('id', courseId).eq('owner_id', userId);
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'courses');
    const courses = readJsonFile<Course[]>(filePath, []);
    const filtered = courses.filter((c) => c.id !== courseId);
    writeJsonFile(filePath, filtered);
    return true;
  }

  // ==========================================
  // MATERIALS & SOURCES
  // ==========================================
  static async getMaterials(userId: string, courseId: string, supabase?: any): Promise<CourseMaterial[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .eq('user_id', userId);

        if (data && !error && data.length > 0) return data as CourseMaterial[];
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, `materials_${courseId}`);
    return readJsonFile<CourseMaterial[]>(filePath, []);
  }

  static async addMaterial(userId: string, material: CourseMaterial, supabase?: any): Promise<CourseMaterial> {
    if (supabase) {
      try {
        await supabase.from('course_materials').insert(material);
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, `materials_${material.course_id}`);
    const materials = readJsonFile<CourseMaterial[]>(filePath, []);
    materials.unshift(material);
    writeJsonFile(filePath, materials);

    // Update material count on course
    const coursesPath = getUserFilePath(userId, 'courses');
    const courses = readJsonFile<Course[]>(coursesPath, []);
    const course = courses.find((c) => c.id === material.course_id);
    if (course) {
      course.materials_count = materials.length;
      course.updated_at = new Date().toISOString();
      writeJsonFile(coursesPath, courses);
    }

    return material;
  }

  static async getSources(userId: string, courseId: string): Promise<SourceEvidence[]> {
    const filePath = getUserFilePath(userId, `sources_${courseId}`);
    return readJsonFile<SourceEvidence[]>(filePath, []);
  }

  static async addSourceEvidence(userId: string, evidence: SourceEvidence): Promise<void> {
    const filePath = getUserFilePath(userId, `sources_${evidence.course_id}`);
    const list = readJsonFile<SourceEvidence[]>(filePath, []);
    list.unshift(evidence);
    writeJsonFile(filePath, list);
  }

  // ==========================================
  // CONCEPTS & LEARNING TWIN TOPOLOGY
  // ==========================================
  static async getConcepts(userId: string, courseId: string): Promise<Concept[]> {
    const filePath = getUserFilePath(userId, `concepts_${courseId}`);
    const direct = readJsonFile<Concept[]>(filePath, []);
    if (direct.length > 0) return direct;

    // Suffix/prefix resilience for courseId variations
    ensureDataDir();
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const files = fs.readdirSync(DATA_DIR);
    const matchedFile = files.find(
      (f) =>
        f.startsWith(`${safeId}_concepts_`) &&
        f.endsWith('.json') &&
        (f.includes(courseId) || courseId.includes(f.replace(`${safeId}_concepts_`, '').replace('.json', '')))
    );
    if (matchedFile) {
      return readJsonFile<Concept[]>(path.join(DATA_DIR, matchedFile), []);
    }
    return [];
  }

  static async saveConcepts(userId: string, courseId: string, concepts: Concept[]): Promise<void> {
    const filePath = getUserFilePath(userId, `concepts_${courseId}`);
    writeJsonFile(filePath, concepts);

    // Update total_concepts in course
    const coursesPath = getUserFilePath(userId, 'courses');
    const courses = readJsonFile<Course[]>(coursesPath, []);
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      course.total_concepts = concepts.length;
      writeJsonFile(coursesPath, courses);
    }
  }

  static async getRelationships(userId: string, courseId: string): Promise<ConceptRelationship[]> {
    const filePath = getUserFilePath(userId, `relationships_${courseId}`);
    const direct = readJsonFile<ConceptRelationship[]>(filePath, []);
    if (direct.length > 0) return direct;

    ensureDataDir();
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const files = fs.readdirSync(DATA_DIR);
    const matchedFile = files.find(
      (f) =>
        f.startsWith(`${safeId}_relationships_`) &&
        f.endsWith('.json') &&
        (f.includes(courseId) || courseId.includes(f.replace(`${safeId}_relationships_`, '').replace('.json', '')))
    );
    if (matchedFile) {
      return readJsonFile<ConceptRelationship[]>(path.join(DATA_DIR, matchedFile), []);
    }
    return [];
  }

  static async saveRelationships(userId: string, courseId: string, relationships: ConceptRelationship[]): Promise<void> {
    const filePath = getUserFilePath(userId, `relationships_${courseId}`);
    writeJsonFile(filePath, relationships);
  }

  // ==========================================
  // STUDENT MASTERY (BAYESIAN KNOWLEDGE TRACING)
  // ==========================================
  static async getMastery(userId: string, courseId?: string, supabase?: any): Promise<StudentMastery[]> {
    let list: StudentMastery[] = [];

    if (supabase) {
      try {
        let query = supabase.from('student_mastery').select('*').eq('user_id', userId);
        if (courseId) query = query.eq('course_id', courseId);
        const { data, error } = await query;
        if (data && !error && data.length > 0) {
          list = data as StudentMastery[];
        }
      } catch (err) {
        // Fallback to local
      }
    }

    if (list.length === 0) {
      const filePath = getUserFilePath(userId, 'mastery');
      const localList = readJsonFile<StudentMastery[]>(filePath, []);
      list = courseId ? localList.filter((m) => matchesCourseId(m.course_id, courseId)) : localList;
    }

    // Enrich with concept details (name, category/topic) and ensure all course concepts are represented
    if (courseId) {
      const concepts = await this.getConcepts(userId, courseId);
      const attempts = await this.getAttempts(userId, courseId, supabase);

      for (const c of concepts) {
        let item = list.find((m) => m.concept_id === c.id);
        const conceptAttempts = attempts.filter((a) => a.concept_id === c.id);

        if (!item) {
          const totalAtt = conceptAttempts.length;
          const correctAtt = conceptAttempts.filter((a) => a.is_correct).length;
          const incorrectAtt = totalAtt - correctAtt;
          
          let prob = 0.50;
          if (totalAtt > 0) {
            const acc = correctAtt / totalAtt;
            const weight = Math.min(0.85, totalAtt / (totalAtt + 3));
            prob = Math.round(((1 - weight) * 0.50 + weight * acc) * 100) / 100;
          }

          item = {
            id: `m-${Date.now()}-${c.id}`,
            user_id: userId,
            course_id: courseId,
            concept_id: c.id,
            concept_name: c.name,
            category: c.category || 'Core',
            mastery_probability: prob,
            attempt_count: totalAtt,
            correct_count: correctAtt,
            incorrect_count: incorrectAtt,
            confidence: totalAtt > 0 ? Math.min(0.98, Math.round((1 - 1 / Math.sqrt(totalAtt + 1)) * 100) / 100) : 0.40,
            last_practiced: conceptAttempts[0]?.attempted_at || new Date().toISOString(),
            forgetting_risk: prob >= 0.80 ? 'low' : prob >= 0.65 ? 'medium' : prob >= 0.45 ? 'high' : 'critical',
            retention_strength: prob >= 0.80 ? 0.90 : prob >= 0.65 ? 0.75 : prob >= 0.45 ? 0.60 : 0.35,
            recommended_action: prob >= 0.85 ? 'mastered' : prob >= 0.65 ? 'practice_advanced' : prob >= 0.45 ? 'review_soon' : 'remediate_gap',
          };
          list.push(item);
        } else {
          item.concept_name = c.name;
          item.category = c.category || item.category || 'Core';

          // If attempts file has more recent count, sync them
          if (conceptAttempts.length > item.attempt_count) {
            const totalAtt = conceptAttempts.length;
            const correctAtt = conceptAttempts.filter((a) => a.is_correct).length;
            const incorrectAtt = totalAtt - correctAtt;
            item.attempt_count = totalAtt;
            item.correct_count = correctAtt;
            item.incorrect_count = incorrectAtt;
            const acc = correctAtt / totalAtt;
            const weight = Math.min(0.85, totalAtt / (totalAtt + 3));
            item.mastery_probability = Math.round(((1 - weight) * item.mastery_probability + weight * acc) * 100) / 100;
            item.confidence = Math.min(0.98, Math.round((1 - 1 / Math.sqrt(totalAtt + 1)) * 100) / 100);
            if (conceptAttempts[0]?.attempted_at) {
              item.last_practiced = conceptAttempts[0].attempted_at;
            }
          }
        }
      }
    }

    return list;
  }

  static async initializeCourseMastery(userId: string, courseId: string, concepts: Concept[]): Promise<StudentMastery[]> {
    const filePath = getUserFilePath(userId, 'mastery');
    const existing = readJsonFile<StudentMastery[]>(filePath, []);
    
    // Create initial prior = 0.5 for newly discovered concepts (0 attempts)
    for (const c of concepts) {
      const match = existing.find((m) => m.concept_id === c.id);
      if (!match) {
        const item: StudentMastery = {
          id: `m-${Date.now()}-${c.id}`,
          user_id: userId,
          course_id: courseId,
          concept_id: c.id,
          concept_name: c.name,
          category: c.category || 'Core',
          mastery_probability: 0.50, // Initial Bayesian prior
          attempt_count: 0,
          correct_count: 0,
          incorrect_count: 0,
          confidence: 0.40,
          last_practiced: new Date().toISOString(),
          forgetting_risk: 'medium',
          retention_strength: 0.80,
          recommended_action: 'review_soon',
        };
        existing.push(item);
      } else if (match.course_id !== courseId && (matchesCourseId(match.course_id, courseId) || match.course_id === 'unassigned')) {
        match.course_id = courseId;
      }
    }

    writeJsonFile(filePath, existing);
    return existing.filter((m) => matchesCourseId(m.course_id, courseId));
  }

  static async updateMasteryBKT(
    userId: string,
    conceptId: string,
    isCorrect: boolean,
    courseId?: string,
    conceptName?: string,
    supabase?: any
  ): Promise<StudentMastery> {
    const filePath = getUserFilePath(userId, 'mastery');
    const masteryList = readJsonFile<StudentMastery[]>(filePath, []);
    let item = masteryList.find((m) => m.concept_id === conceptId);

    // Look up concept details from course concepts if available
    let resolvedCategory = 'Core';
    let resolvedName = conceptName || conceptId.replace(/[-_]/g, ' ');

    if (courseId) {
      try {
        const concepts = await this.getConcepts(userId, courseId);
        const matched = concepts.find(
          (c) =>
            c.id === conceptId ||
            c.id.toLowerCase() === conceptId.toLowerCase() ||
            (c.name && c.name.toLowerCase() === (conceptName || '').toLowerCase()) ||
            (c.name && c.name.toLowerCase() === conceptId.toLowerCase())
        );
        if (matched) {
          resolvedName = matched.name;
          resolvedCategory = matched.category || 'Core';
        }
      } catch {
        // ignore
      }
    }

    if (!item) {
      item = {
        id: `m-${Date.now()}-${conceptId}`,
        user_id: userId,
        course_id: courseId || 'unassigned',
        concept_id: conceptId,
        concept_name: resolvedName,
        category: resolvedCategory,
        mastery_probability: 0.50,
        attempt_count: 0,
        correct_count: 0,
        incorrect_count: 0,
        confidence: 0.40,
        last_practiced: new Date().toISOString(),
        forgetting_risk: 'medium',
        retention_strength: 0.80,
        recommended_action: 'review_soon',
      };
      masteryList.push(item);
    } else {
      if (courseId && (item.course_id === 'unassigned' || matchesCourseId(item.course_id, courseId))) {
        item.course_id = courseId;
      }
      if (resolvedName && (!item.concept_name || item.concept_name.startsWith('concept-') || item.concept_name.startsWith('c-'))) {
        item.concept_name = resolvedName;
      }
      if (resolvedCategory && resolvedCategory !== 'Core' && (!item.category || item.category === 'Core')) {
        item.category = resolvedCategory;
      }
    }

    // 1. Update attempt counts
    item.attempt_count += 1;
    if (isCorrect) {
      item.correct_count += 1;
    } else {
      item.incorrect_count += 1;
    }

    const n = item.attempt_count;
    const k = item.correct_count;
    const m = item.incorrect_count;
    const pPrev = item.mastery_probability;

    // 2. Adaptive Bayesian Knowledge Tracing with empirical weighting
    // Slip & Guess parameters
    const pSlip = 0.10;
    const pGuess = 0.20;

    let pPosterior: number;
    if (isCorrect) {
      const pNumerator = pPrev * (1 - pSlip);
      const pDenominator = pPrev * (1 - pSlip) + (1 - pPrev) * pGuess;
      pPosterior = pNumerator / (pDenominator || 1);
      // Transition factor increases with learning and success
      const pTransit = 0.08 + (k / n) * 0.08;
      pPosterior = pPosterior + (1 - pPosterior) * pTransit;
    } else {
      const pNumerator = pPrev * pSlip;
      const pDenominator = pPrev * pSlip + (1 - pPrev) * (1 - pGuess);
      pPosterior = pNumerator / (pDenominator || 1);
      // Repeated mistakes penalty: if multiple incorrect answers, adjust downward to increase weakness/priority
      const mistakeRatio = m / n;
      const penalty = 1.0 + mistakeRatio * 0.4;
      pPosterior = pPosterior / penalty;
    }

    // Blend Bayesian posterior with empirical accuracy as observations grow
    // No fixed percentages - scales dynamically with performance
    const accuracy = k / n;
    const empiricalWeight = Math.min(0.85, n / (n + 3));
    const blended = (1 - empiricalWeight) * pPosterior + empiricalWeight * accuracy;

    // Clamp between 0.05 and 0.99
    const clampedMastery = Math.min(0.99, Math.max(0.05, blended));
    item.mastery_probability = Math.round(clampedMastery * 100) / 100;

    // Dynamic confidence: scales with attempt count (1 - 1/sqrt(n+1))
    item.confidence = Math.min(0.98, Math.max(0.40, Math.round((1 - 1 / Math.sqrt(n + 1)) * 100) / 100));
    item.last_practiced = new Date().toISOString();

    // 3. Dynamic forgetting risk & recommended action
    if (item.mastery_probability >= 0.80) {
      item.forgetting_risk = 'low';
      item.retention_strength = Math.min(0.98, 0.85 + (item.mastery_probability - 0.80));
      item.recommended_action = 'mastered';
    } else if (item.mastery_probability >= 0.65) {
      item.forgetting_risk = 'medium';
      item.retention_strength = 0.75;
      item.recommended_action = 'practice_advanced';
    } else if (item.mastery_probability >= 0.45) {
      item.forgetting_risk = 'high';
      item.retention_strength = 0.60;
      item.recommended_action = 'review_soon';
    } else {
      item.forgetting_risk = 'critical';
      item.retention_strength = Math.max(0.20, item.mastery_probability);
      item.recommended_action = 'remediate_gap';
    }

    // 4. Mirror to Supabase if configured
    if (supabase) {
      try {
        await supabase.from('student_mastery').upsert(
          {
            user_id: userId,
            course_id: item.course_id,
            concept_id: item.concept_id,
            mastery_probability: item.mastery_probability,
            attempt_count: item.attempt_count,
            correct_count: item.correct_count,
            incorrect_count: item.incorrect_count,
            confidence: item.confidence,
            last_practiced: item.last_practiced,
            forgetting_risk: item.forgetting_risk,
            retention_strength: item.retention_strength,
            recommended_action: item.recommended_action,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,concept_id' }
        );
      } catch (err) {
        // Fallback to local
      }
    }

    writeJsonFile(filePath, masteryList);
    return item;
  }

  // ==========================================
  // LEARNING TWIN AGGREGATED METRICS
  // ==========================================
  static async getLearningTwinMetrics(userId: string, courseId?: string, supabase?: any): Promise<LearningTwinMetrics> {
    const allCourses = await this.getCourses(userId, supabase);
    const targetCourseId = courseId || allCourses[0]?.id;

    const courseMasteryList = targetCourseId ? await this.getMastery(userId, targetCourseId, supabase) : [];
    const allMasteryList = await this.getMastery(userId, undefined, supabase);

    // Compute Overall Mastery across all subjects
    const overall_mastery = allMasteryList.length > 0
      ? Math.round((allMasteryList.reduce((acc, m) => acc + m.mastery_probability, 0) / allMasteryList.length) * 100)
      : 0;

    // Compute Course-wise Mastery
    const course_mastery = courseMasteryList.length > 0
      ? Math.round((courseMasteryList.reduce((acc, m) => acc + m.mastery_probability, 0) / courseMasteryList.length) * 100)
      : 0;

    // Total attempts, correct, incorrect for the active course
    const total_attempts = courseMasteryList.reduce((acc, m) => acc + m.attempt_count, 0);
    const total_correct = courseMasteryList.reduce((acc, m) => acc + m.correct_count, 0);
    const total_incorrect = courseMasteryList.reduce((acc, m) => acc + m.incorrect_count, 0);

    const overall_accuracy = total_attempts > 0 ? Math.round((total_correct / total_attempts) * 100) : 0;
    const average_confidence = courseMasteryList.length > 0
      ? Math.round((courseMasteryList.reduce((acc, m) => acc + m.confidence, 0) / courseMasteryList.length) * 100)
      : 50;

    // Group into Topic-wise mastery
    const distinctCategories = new Set(
      courseMasteryList.map((m) => m.category).filter((c) => c && c !== 'Core' && c !== 'General')
    );
    const useCategory = distinctCategories.size > 1;

    const topicMap: Record<string, {
      topic: string;
      course_id: string;
      mastery_sum: number;
      concept_count: number;
      attempt_count: number;
      correct_count: number;
      incorrect_count: number;
    }> = {};

    for (const m of courseMasteryList) {
      const topicName = (useCategory && m.category && m.category !== 'Core' && m.category !== 'General')
        ? m.category
        : (m.concept_name || m.category || 'Core');

      if (!topicMap[topicName]) {
        topicMap[topicName] = {
          topic: topicName,
          course_id: m.course_id,
          mastery_sum: 0,
          concept_count: 0,
          attempt_count: 0,
          correct_count: 0,
          incorrect_count: 0,
        };
      }
      topicMap[topicName].mastery_sum += m.mastery_probability;
      topicMap[topicName].concept_count += 1;
      topicMap[topicName].attempt_count += m.attempt_count;
      topicMap[topicName].correct_count += m.correct_count;
      topicMap[topicName].incorrect_count += m.incorrect_count;
    }

    const topics: TopicMastery[] = Object.values(topicMap).map((t) => {
      const mastery_pct = t.concept_count > 0 ? Math.round((t.mastery_sum / t.concept_count) * 100) : 50;
      const acc = t.attempt_count > 0 ? Math.round((t.correct_count / t.attempt_count) * 100) : 0;
      return {
        topic: t.topic,
        course_id: t.course_id,
        mastery_percentage: mastery_pct,
        attempt_count: t.attempt_count,
        correct_count: t.correct_count,
        incorrect_count: t.incorrect_count,
        accuracy: acc,
        concept_count: t.concept_count,
        status: mastery_pct >= 75 ? 'mastered' : mastery_pct >= 50 ? 'developing' : 'weak',
      };
    });

    // Weak and strong concepts
    const weak_concepts = courseMasteryList
      .filter((m) => m.mastery_probability < 0.65)
      .sort((a, b) => a.mastery_probability - b.mastery_probability);

    const strong_concepts = courseMasteryList
      .filter((m) => m.mastery_probability >= 0.75)
      .sort((a, b) => b.mastery_probability - a.mastery_probability);

    return {
      overall_mastery,
      course_mastery,
      total_attempts,
      total_correct,
      total_incorrect,
      overall_accuracy,
      average_confidence,
      topics,
      weak_concepts,
      strong_concepts,
    };
  }

  // ==========================================
  // MISCONCEPTIONS
  // ==========================================
  static async getMisconceptions(userId: string, courseId?: string, supabase?: any): Promise<Misconception[]> {
    if (supabase) {
      try {
        let query = supabase.from('misconceptions').select('*').eq('user_id', userId);
        if (courseId) query = query.eq('course_id', courseId);
        const { data, error } = await query;
        if (data && !error && data.length > 0) return data as Misconception[];
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'misconceptions');
    const list = readJsonFile<Misconception[]>(filePath, []);
    return courseId ? list.filter((m) => matchesCourseId(m.course_id, courseId)) : list;
  }

  static async recordMisconception(userId: string, misconception: Misconception, supabase?: any): Promise<Misconception> {
    if (supabase) {
      try {
        await supabase.from('misconceptions').upsert(
          {
            id: misconception.id,
            user_id: userId,
            course_id: misconception.course_id,
            concept_id: misconception.concept_id,
            title: misconception.title,
            description: misconception.description,
            trigger_evidence: misconception.trigger_evidence,
            severity: misconception.severity || 'high',
            status: misconception.status || 'active',
            detected_at: misconception.detected_at || new Date().toISOString(),
            remediated_at: misconception.status === 'retested_pass' ? new Date().toISOString() : null,
          },
          { onConflict: 'id' }
        );
      } catch (err) {
        // Fallback
      }
    }

    const filePath = getUserFilePath(userId, 'misconceptions');
    const list = readJsonFile<Misconception[]>(filePath, []);
    const existingIndex = list.findIndex((m) => m.id === misconception.id);
    if (existingIndex >= 0) {
      list[existingIndex] = misconception;
    } else {
      list.unshift(misconception);
    }
    writeJsonFile(filePath, list);
    return misconception;
  }

  // ==========================================
  // ATTEMPTS & ASSESSMENTS
  // ==========================================
  static async recordAttempt(userId: string, attempt: QuestionAttempt, supabase?: any): Promise<void> {
    if (supabase) {
      try {
        await supabase.from('student_attempts').insert({
          user_id: userId,
          course_id: attempt.course_id,
          concept_id: attempt.concept_id,
          selected_option_id: attempt.selected_option_id,
          is_correct: attempt.is_correct,
          time_spent_seconds: attempt.time_spent_seconds || 15,
          misconception_detected: attempt.misconception_detected || null,
          attempted_at: attempt.attempted_at || new Date().toISOString(),
        });
      } catch (err) {
        // Fallback to local
      }
    }

    const filePath = getUserFilePath(userId, 'attempts');
    const attempts = readJsonFile<QuestionAttempt[]>(filePath, []);
    attempts.unshift(attempt);
    writeJsonFile(filePath, attempts);
  }

  static async getAttempts(userId: string, courseId?: string, supabase?: any): Promise<QuestionAttempt[]> {
    if (supabase) {
      try {
        let query = supabase.from('student_attempts').select('*').eq('user_id', userId).order('attempted_at', { ascending: false });
        if (courseId) query = query.eq('course_id', courseId);
        const { data, error } = await query;
        if (data && !error && data.length > 0) return data as QuestionAttempt[];
      } catch (err) {
        // Fallback
      }
    }

    const filePath = getUserFilePath(userId, 'attempts');
    const attempts = readJsonFile<QuestionAttempt[]>(filePath, []);
    return courseId ? attempts.filter((a) => matchesCourseId(a.course_id, courseId)) : attempts;
  }

  // ==========================================
  // STUDY PLANS & TASKS
  // ==========================================
  static async getStudyPlan(userId: string, courseId?: string, supabase?: any): Promise<StudyPlan | null> {
    if (supabase) {
      try {
        let query = supabase.from('study_plans').select('*').eq('user_id', userId);
        if (courseId) query = query.eq('course_id', courseId);
        const { data: planData, error } = await query.maybeSingle();

        if (planData && !error) {
          const { data: tasksData } = await supabase
            .from('study_tasks')
            .select('*')
            .eq('plan_id', planData.id);

          return {
            id: planData.id,
            user_id: planData.user_id,
            course_id: planData.course_id,
            title: planData.title,
            exam_date: planData.exam_date,
            daily_goal_minutes: planData.daily_goal_minutes,
            streak_days: planData.streak_days,
            tasks: (tasksData || []).map((t: any) => ({
              id: t.id,
              user_id: t.user_id,
              course_id: planData.course_id,
              concept_id: t.concept_id,
              title: t.title,
              task_type: t.task_type,
              estimated_minutes: t.estimated_minutes,
              priority: t.priority,
              due_date: t.due_date,
              completed: Boolean(t.completed),
              completed_at: t.completed_at,
              reason: t.reason,
            })),
            created_at: planData.created_at,
            updated_at: planData.updated_at,
          } as StudyPlan;
        }
      } catch (err) {
        // Fallback
      }
    }

    const filePath = getUserFilePath(userId, 'study_plan');
    const localPlan = readJsonFile<StudyPlan | null>(filePath, null);
    if (!localPlan) return null;
    if (courseId && !matchesCourseId(localPlan.course_id, courseId)) {
      return null;
    }
    return localPlan;
  }

  static async updateStudyTask(
    userId: string,
    taskId: string,
    options?: { action?: 'toggle' | 'postpone' | 'reschedule'; newDueDate?: string },
    supabase?: any
  ): Promise<StudyPlan | null> {
    const plan = await this.getStudyPlan(userId, undefined, supabase);
    if (!plan) return null;

    const task = plan.tasks.find((t) => t.id === taskId);
    if (task) {
      if (options?.action === 'postpone') {
        const currentDue = task.due_date ? new Date(task.due_date) : new Date();
        currentDue.setDate(currentDue.getDate() + 1);
        task.due_date = currentDue.toISOString().split('T')[0];
      } else if (options?.action === 'reschedule' && options.newDueDate) {
        task.due_date = options.newDueDate;
      } else {
        task.completed = !task.completed;
        task.completed_at = task.completed ? new Date().toISOString() : undefined;
      }

      if (supabase) {
        try {
          await supabase.from('study_tasks').update({
            completed: task.completed,
            completed_at: task.completed_at,
            due_date: task.due_date,
          }).eq('id', taskId);
        } catch (err) {}
      }

      const filePath = getUserFilePath(userId, 'study_plan');
      writeJsonFile(filePath, plan);
    }
    return plan;
  }

  static async toggleTask(userId: string, taskId: string, supabase?: any): Promise<StudyPlan | null> {
    return this.updateStudyTask(userId, taskId, { action: 'toggle' }, supabase);
  }

  static async markStudyTaskCompleted(
    userId: string,
    filter: { taskType?: string; conceptId?: string },
    supabase?: any
  ): Promise<void> {
    const plan = await this.getStudyPlan(userId, undefined, supabase);
    if (!plan) return;

    let modified = false;
    for (const task of plan.tasks) {
      if (!task.completed) {
        const typeMatch = !filter.taskType || task.task_type === filter.taskType;
        const conceptMatch = !filter.conceptId || task.concept_id === filter.conceptId;
        if (typeMatch && conceptMatch) {
          task.completed = true;
          task.completed_at = new Date().toISOString();
          modified = true;

          if (supabase) {
            try {
              await supabase.from('study_tasks').update({
                completed: true,
                completed_at: task.completed_at,
              }).eq('id', task.id);
            } catch (err) {}
          }
          break; // complete first matching task
        }
      }
    }

    if (modified) {
      const filePath = getUserFilePath(userId, 'study_plan');
      writeJsonFile(filePath, plan);
    }
  }

  static async saveStudyPlan(userId: string, plan: StudyPlan, supabase?: any): Promise<StudyPlan> {
    if (supabase) {
      try {
        await supabase.from('study_plans').upsert(
          {
            id: plan.id,
            user_id: userId,
            course_id: plan.course_id,
            title: plan.title,
            exam_date: plan.exam_date || null,
            daily_goal_minutes: plan.daily_goal_minutes || 60,
            streak_days: plan.streak_days || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (plan.tasks && plan.tasks.length > 0) {
          await supabase.from('study_tasks').delete().eq('plan_id', plan.id);
          const taskRows = plan.tasks.map((t) => ({
            id: t.id,
            plan_id: plan.id,
            user_id: userId,
            concept_id: t.concept_id || null,
            title: t.title,
            task_type: t.task_type,
            estimated_minutes: t.estimated_minutes,
            priority: t.priority,
            due_date: t.due_date,
            completed: Boolean(t.completed),
            completed_at: t.completed_at || null,
            reason: t.reason,
          }));
          await supabase.from('study_tasks').insert(taskRows);
        }
      } catch (err) {
        // Fallback
      }
    }

    const filePath = getUserFilePath(userId, 'study_plan');
    writeJsonFile(filePath, plan);
    return plan;
  }

  // ==========================================
  // FLASHCARDS & REVISION (SM-2)
  // ==========================================
  static async getFlashcards(userId: string, courseId?: string, supabase?: any): Promise<Flashcard[]> {
    if (supabase) {
      try {
        let query = supabase.from('flashcards').select('*').eq('user_id', userId);
        if (courseId) query = query.eq('course_id', courseId);
        const { data, error } = await query;
        if (data && !error && data.length > 0) return data as Flashcard[];
      } catch (err) {}
    }

    const filePath = getUserFilePath(userId, 'flashcards');
    const list = readJsonFile<Flashcard[]>(filePath, []);
    return courseId ? list.filter((f) => matchesCourseId(f.course_id, courseId)) : list;
  }

  static async saveFlashcards(userId: string, flashcards: Flashcard[], supabase?: any): Promise<void> {
    if (supabase && flashcards.length > 0) {
      try {
        const rows = flashcards.map((f) => ({
          id: f.id,
          user_id: userId,
          course_id: f.course_id,
          concept_id: f.concept_id || null,
          front: f.front,
          back: f.back,
          code_front: f.code_front || null,
          code_back: f.code_back || null,
          source_ref: f.source_ref,
          next_review_date: f.next_review_date,
          interval_days: f.interval_days,
          repetitions: f.repetitions,
          ease_factor: f.ease_factor,
        }));
        await supabase.from('flashcards').upsert(rows, { onConflict: 'id' });
      } catch (err) {}
    }

    const filePath = getUserFilePath(userId, 'flashcards');
    writeJsonFile(filePath, flashcards);
  }

  static async reviewFlashcard(
    userId: string,
    cardId: string,
    rating: number,
    supabase?: any
  ): Promise<Flashcard | null> {
    const filePath = getUserFilePath(userId, 'flashcards');
    const cards = readJsonFile<Flashcard[]>(filePath, []);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;

    const q = Math.max(1, Math.min(5, rating));
    card.difficulty_rating = q as any;

    if (q >= 3) {
      if (card.repetitions === 0) {
        card.interval_days = 1;
      } else if (card.repetitions === 1) {
        card.interval_days = 6;
      } else {
        card.interval_days = Math.round(card.interval_days * card.ease_factor);
      }
      card.repetitions += 1;
    } else {
      card.repetitions = 0;
      card.interval_days = 1;
    }

    card.ease_factor = Math.max(
      1.3,
      Math.round((card.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100
    );

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + card.interval_days);
    card.next_review_date = nextDate.toISOString().split('T')[0];

    // 1. Completing revision updates Student Mastery (BKT) and Learning Twin
    if (card.concept_id) {
      await this.updateMasteryBKT(
        userId,
        card.concept_id,
        q >= 3,
        card.course_id,
        card.concept_name,
        supabase
      );
    }

    // 2. Completing revision marks Flashcard task completed in Study Plan
    await this.markStudyTaskCompleted(userId, { taskType: 'practice_quiz' }, supabase);

    // 3. Persist updated card to Supabase
    if (supabase) {
      try {
        await supabase.from('flashcards').update({
          next_review_date: card.next_review_date,
          interval_days: card.interval_days,
          repetitions: card.repetitions,
          ease_factor: card.ease_factor,
        }).eq('id', card.id);
      } catch (err) {}
    }

    writeJsonFile(filePath, cards);
    return card;
  }

  // ==========================================
  // TUTOR CHAT MESSAGES
  // ==========================================
  static async getTutorMessages(userId: string, courseId: string): Promise<TutorMessage[]> {
    const filePath = getUserFilePath(userId, `chat_${courseId}`);
    return readJsonFile<TutorMessage[]>(filePath, []);
  }

  static async saveTutorMessage(userId: string, message: TutorMessage): Promise<void> {
    const filePath = getUserFilePath(userId, `chat_${message.course_id}`);
    const history = readJsonFile<TutorMessage[]>(filePath, []);
    history.push(message);
    writeJsonFile(filePath, history);
  }

  // ==========================================
  // EVALUATION CASES
  // ==========================================
  static async getEvaluationCases(userId: string): Promise<EvaluationCase[]> {
    const filePath = getUserFilePath(userId, 'evaluations');
    return readJsonFile<EvaluationCase[]>(filePath, []);
  }

  static async saveEvaluationCase(userId: string, testCase: EvaluationCase): Promise<void> {
    const filePath = getUserFilePath(userId, 'evaluations');
    const cases = readJsonFile<EvaluationCase[]>(filePath, []);
    cases.unshift(testCase);
    writeJsonFile(filePath, cases);
  }

  // ==========================================
  // ASSESSMENTS & ATTEMPTS
  // ==========================================
  static async getAssessments(userId: string, courseId?: string, supabase?: any): Promise<Assessment[]> {
    if (supabase) {
      try {
        let query = supabase.from('assessments').select('*').eq('user_id', userId);
        if (courseId) query = query.eq('course_id', courseId);
        const { data, error } = await query;
        if (data && !error && data.length > 0) return data as Assessment[];
      } catch (err) {
        // Fallback
      }
    }

    const filePath = getUserFilePath(userId, 'assessments');
    const list = readJsonFile<Assessment[]>(filePath, []);
    return courseId ? list.filter((a) => a.course_id === courseId) : list;
  }

  static async recordAssessment(userId: string, assessment: Assessment, supabase?: any): Promise<Assessment> {
    if (supabase) {
      try {
        await supabase.from('assessments').insert({
          user_id: userId,
          course_id: assessment.course_id,
          title: assessment.title,
          score_percentage: assessment.score_percentage || 0,
          status: assessment.status || 'in_progress',
          started_at: assessment.started_at || new Date().toISOString(),
          completed_at: assessment.completed_at || null,
        });
      } catch (err) {
        // Fallback to local persistence
      }
    }

    const filePath = getUserFilePath(userId, 'assessments');
    const list = readJsonFile<Assessment[]>(filePath, []);
    list.unshift(assessment);
    writeJsonFile(filePath, list);
    return assessment;
  }

  static async saveQuestions(userId: string, courseId: string, questions: Question[], supabase?: any): Promise<Question[]> {
    if (supabase) {
      try {
        const rows = questions.map((q) => ({
          course_id: courseId,
          concept_id: q.concept_id,
          difficulty: q.difficulty,
          question_text: q.question_text,
          code_snippet: q.code_snippet || null,
          bloom_level: q.bloom_level || 'Understand',
        }));
        await supabase.from('questions').insert(rows);
      } catch (err) {
        // Fallback to local persistence
      }
    }

    const filePath = getUserFilePath(userId, `questions_${courseId}`);
    writeJsonFile(filePath, questions);
    return questions;
  }

  static async getQuestions(userId: string, courseId: string): Promise<Question[]> {
    const filePath = getUserFilePath(userId, `questions_${courseId}`);
    return readJsonFile<Question[]>(filePath, []);
  }

  // ==========================================
  // SMART QUESTION BANK METHODS
  // ==========================================
  static async getQuestionBanks(
    userId: string,
    courseId?: string,
    supabase?: any
  ): Promise<QuestionBank[]> {
    if (supabase) {
      try {
        let query = supabase
          .from('question_banks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (courseId) {
          query = query.eq('course_id', courseId);
        }

        const { data, error } = await query;
        if (data && !error && data.length > 0) return data as QuestionBank[];
      } catch (err) {
        // Fallback to local
      }
    }

    const filePath = getUserFilePath(userId, 'question_banks');
    const banks = readJsonFile<QuestionBank[]>(filePath, []);
    if (courseId) {
      return banks.filter((b) => b.course_id === courseId);
    }
    return banks;
  }

  static async getQuestionBankById(
    userId: string,
    bankId: string,
    supabase?: any
  ): Promise<QuestionBank | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('question_banks')
          .select('*')
          .eq('user_id', userId)
          .eq('id', bankId)
          .maybeSingle();

        if (data && !error) return data as QuestionBank;
      } catch (err) {
        // Fallback to local
      }
    }

    const filePath = getUserFilePath(userId, 'question_banks');
    const banks = readJsonFile<QuestionBank[]>(filePath, []);
    return banks.find((b) => b.id === bankId) || null;
  }

  static async saveQuestionBank(
    userId: string,
    bank: QuestionBank,
    supabase?: any
  ): Promise<QuestionBank> {
    if (supabase) {
      try {
        await supabase.from('question_banks').upsert({
          id: bank.id,
          user_id: userId,
          course_id: bank.course_id,
          title: bank.title,
          description: bank.description,
          topics: bank.topics,
          total_questions: bank.total_questions,
          total_marks: bank.total_marks,
          config: bank.config,
          questions: bank.questions,
          created_at: bank.created_at,
          updated_at: bank.updated_at,
        });
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'question_banks');
    const banks = readJsonFile<QuestionBank[]>(filePath, []);
    const idx = banks.findIndex((b) => b.id === bank.id);
    if (idx >= 0) {
      banks[idx] = bank;
    } else {
      banks.unshift(bank);
    }
    writeJsonFile(filePath, banks);
    return bank;
  }

  static async deleteQuestionBank(
    userId: string,
    bankId: string,
    supabase?: any
  ): Promise<boolean> {
    if (supabase) {
      try {
        await supabase
          .from('question_banks')
          .delete()
          .eq('user_id', userId)
          .eq('id', bankId);
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'question_banks');
    const banks = readJsonFile<QuestionBank[]>(filePath, []);
    const filtered = banks.filter((b) => b.id !== bankId);
    writeJsonFile(filePath, filtered);
    return true;
  }

  static async getSavedQuestions(
    userId: string,
    courseId?: string,
    supabase?: any
  ): Promise<SmartQuestion[]> {
    if (supabase) {
      try {
        let query = supabase
          .from('saved_questions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (courseId) {
          query = query.eq('course_id', courseId);
        }

        const { data, error } = await query;
        if (data && !error && data.length > 0) return data as SmartQuestion[];
      } catch (err) {
        // Fallback to local
      }
    }

    const filePath = getUserFilePath(userId, 'saved_questions');
    const questions = readJsonFile<SmartQuestion[]>(filePath, []);
    if (courseId) {
      return questions.filter((q) => q.course_id === courseId);
    }
    return questions;
  }

  static async saveQuestion(
    userId: string,
    question: SmartQuestion,
    supabase?: any
  ): Promise<SmartQuestion> {
    if (supabase) {
      try {
        await supabase.from('saved_questions').upsert({
          id: question.id,
          user_id: userId,
          course_id: question.course_id,
          bank_id: question.bank_id || null,
          question_number: question.question_number,
          question_text: question.question_text,
          marks: question.marks,
          question_type: question.question_type,
          topic: question.topic,
          difficulty: question.difficulty,
          answer: question.answer,
          structured_16_mark: question.structured_16_mark || null,
          source_citation: question.source_citation,
          created_at: question.created_at,
        });
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'saved_questions');
    const questions = readJsonFile<SmartQuestion[]>(filePath, []);
    const idx = questions.findIndex((q) => q.id === question.id);
    if (idx >= 0) {
      questions[idx] = question;
    } else {
      questions.unshift(question);
    }
    writeJsonFile(filePath, questions);
    return question;
  }

  static async deleteSavedQuestion(
    userId: string,
    questionId: string,
    supabase?: any
  ): Promise<boolean> {
    if (supabase) {
      try {
        await supabase
          .from('saved_questions')
          .delete()
          .eq('user_id', userId)
          .eq('id', questionId);
      } catch (err) {
        // ignore
      }
    }

    const filePath = getUserFilePath(userId, 'saved_questions');
    const questions = readJsonFile<SmartQuestion[]>(filePath, []);
    const filtered = questions.filter((q) => q.id !== questionId);
    writeJsonFile(filePath, filtered);
    return true;
  }

  // ==========================================
  // PDF SECURE STORAGE
  // ==========================================
  static saveUserPdf(userId: string, filename: string, buffer: Buffer): string {
    ensureDataDir();
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const userPdfDir = path.join(DATA_DIR, 'pdfs', safeUserId);
    if (!fs.existsSync(userPdfDir)) {
      fs.mkdirSync(userPdfDir, { recursive: true });
    }
    const safeFileName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fullPath = path.join(userPdfDir, safeFileName);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  static getUserPdf(userId: string, filename: string): Buffer | null {
    try {
      const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFileName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const fullPath = path.join(DATA_DIR, 'pdfs', safeUserId, safeFileName);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    } catch (err) {
      console.error(`Error reading user PDF ${filename}:`, err);
    }
    return null;
  }

  // ==========================================
  // MATERIAL UPLOADED FILE STORAGE
  // ==========================================
  static saveUploadedFile(userId: string, materialId: string, filename: string, buffer: Buffer): string {
    ensureDataDir();
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadDir = path.join(DATA_DIR, 'uploads', safeUserId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const safeMatId = materialId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fullPath = path.join(uploadDir, `${safeMatId}_${safeName}`);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  static getUploadedFile(userId: string, materialId: string): { buffer: Buffer; filename: string } | null {
    try {
      const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const uploadDir = path.join(DATA_DIR, 'uploads', safeUserId);
      if (!fs.existsSync(uploadDir)) return null;

      const safeMatId = materialId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const files = fs.readdirSync(uploadDir);
      const matched = files.find((f) => f.startsWith(`${safeMatId}_`));
      if (matched) {
        const fullPath = path.join(uploadDir, matched);
        const originalName = matched.replace(`${safeMatId}_`, '');
        return {
          buffer: fs.readFileSync(fullPath),
          filename: originalName,
        };
      }
    } catch (err) {
      console.error(`Error reading uploaded file for ${materialId}:`, err);
    }
    return null;
  }
}


