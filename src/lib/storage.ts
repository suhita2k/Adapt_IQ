import {
  UserProfile,
  Course,
  CourseMaterial,
  StudentMastery,
  Misconception,
  StudyPlan,
  Flashcard,
  TutorMessage,
  SourceEvidence,
} from '@/types';

const isBrowser = typeof window !== 'undefined';

function getKey(userId: string, key: string) {
  return `adaptiq_user_${userId}_${key}`;
}

export class DataStore {
  static getProfile(userId: string): UserProfile | null {
    if (!isBrowser) return null;
    const raw = localStorage.getItem(getKey(userId, 'profile'));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  static saveProfile(profile: UserProfile): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(profile.user_id, 'profile'), JSON.stringify(profile));
  }

  static getCourses(userId: string): Course[] {
    if (!isBrowser) return [];
    const raw = localStorage.getItem(getKey(userId, 'courses'));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }

  static saveCourses(userId: string, courses: Course[]): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, 'courses'), JSON.stringify(courses));
  }

  static addCourse(userId: string, course: Omit<Course, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Course {
    const courses = this.getCourses(userId);
    const newCourse: Course = {
      ...course,
      id: `course-${Date.now()}`,
      owner_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    courses.unshift(newCourse);
    this.saveCourses(userId, courses);
    return newCourse;
  }

  static getMaterials(userId: string, courseId: string): CourseMaterial[] {
    if (!isBrowser) return [];
    const raw = localStorage.getItem(getKey(userId, `materials_${courseId}`));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }

  static saveMaterials(userId: string, courseId: string, materials: CourseMaterial[]): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, `materials_${courseId}`), JSON.stringify(materials));
  }

  static addMaterial(userId: string, material: Omit<CourseMaterial, 'id' | 'uploaded_at'>): CourseMaterial {
    const materials = this.getMaterials(userId, material.course_id);
    const newMaterial: CourseMaterial = {
      ...material,
      id: `mat-${Date.now()}`,
      uploaded_at: new Date().toISOString(),
    };
    materials.unshift(newMaterial);
    this.saveMaterials(userId, material.course_id, materials);

    // Increment course material count
    const courses = this.getCourses(userId);
    const courseIndex = courses.findIndex(c => c.id === material.course_id);
    if (courseIndex >= 0) {
      courses[courseIndex].materials_count += 1;
      courses[courseIndex].updated_at = new Date().toISOString();
      this.saveCourses(userId, courses);
    }

    return newMaterial;
  }

  static getMastery(userId: string, courseId?: string): StudentMastery[] {
    if (!isBrowser) return [];
    const raw = localStorage.getItem(getKey(userId, 'mastery'));
    if (raw) {
      try {
        const all = JSON.parse(raw) as StudentMastery[];
        return courseId ? all.filter(m => m.course_id === courseId) : all;
      } catch {
        return [];
      }
    }
    return [];
  }

  static saveMastery(userId: string, masteryList: StudentMastery[]): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, 'mastery'), JSON.stringify(masteryList));
  }

  static updateMasteryAfterAttempt(
    userId: string,
    courseId: string,
    conceptId: string,
    isCorrect: boolean
  ): StudentMastery | null {
    const all = this.getMastery(userId);
    const target = all.find(m => m.concept_id === conceptId && m.course_id === courseId);

    if (!target) {
      return null;
    }

    target.attempt_count += 1;
    if (isCorrect) {
      target.correct_count += 1;
    } else {
      target.incorrect_count += 1;
    }

    const n = target.attempt_count;
    const k = target.correct_count;
    const m = target.incorrect_count;
    const pPrev = target.mastery_probability;

    const pSlip = 0.10;
    const pGuess = 0.20;

    let pPosterior: number;
    if (isCorrect) {
      const pNum = pPrev * (1 - pSlip);
      const pDen = pPrev * (1 - pSlip) + (1 - pPrev) * pGuess;
      pPosterior = pNum / (pDen || 1);
      const pTransit = 0.08 + (k / n) * 0.08;
      pPosterior = pPosterior + (1 - pPosterior) * pTransit;
    } else {
      const pNum = pPrev * pSlip;
      const pDen = pPrev * pSlip + (1 - pPrev) * (1 - pGuess);
      pPosterior = pNum / (pDen || 1);
      const mistakeRatio = m / n;
      const penalty = 1.0 + mistakeRatio * 0.4;
      pPosterior = pPosterior / penalty;
    }

    const accuracy = k / n;
    const empiricalWeight = Math.min(0.85, n / (n + 3));
    const blended = (1 - empiricalWeight) * pPosterior + empiricalWeight * accuracy;

    target.mastery_probability = Math.min(0.99, Math.max(0.05, Math.round(blended * 100) / 100));
    target.confidence = Math.min(0.98, Math.max(0.40, Math.round((1 - 1 / Math.sqrt(n + 1)) * 100) / 100));
    target.last_practiced = new Date().toISOString();

    if (target.mastery_probability >= 0.80) {
      target.forgetting_risk = 'low';
      target.retention_strength = Math.min(0.98, 0.85 + (target.mastery_probability - 0.80));
      target.recommended_action = 'mastered';
    } else if (target.mastery_probability >= 0.65) {
      target.forgetting_risk = 'medium';
      target.retention_strength = 0.75;
      target.recommended_action = 'practice_advanced';
    } else if (target.mastery_probability >= 0.45) {
      target.forgetting_risk = 'high';
      target.retention_strength = 0.60;
      target.recommended_action = 'review_soon';
    } else {
      target.forgetting_risk = 'critical';
      target.retention_strength = Math.max(0.20, target.mastery_probability);
      target.recommended_action = 'remediate_gap';
    }

    this.saveMastery(userId, all);
    return target;
  }

  static getMisconceptions(userId: string, courseId?: string): Misconception[] {
    if (!isBrowser) return [];
    const raw = localStorage.getItem(getKey(userId, 'misconceptions'));
    if (raw) {
      try {
        const all = JSON.parse(raw) as Misconception[];
        return courseId ? all.filter(m => m.course_id === courseId) : all;
      } catch {
        return [];
      }
    }
    return [];
  }

  static saveMisconceptions(userId: string, misconceptions: Misconception[]): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, 'misconceptions'), JSON.stringify(misconceptions));
  }

  static resolveMisconception(userId: string, misconceptionId: string): void {
    const list = this.getMisconceptions(userId);
    const item = list.find(m => m.id === misconceptionId);
    if (item) {
      item.status = 'retested_pass';
      this.saveMisconceptions(userId, list);
      this.updateMasteryAfterAttempt(userId, item.course_id, item.concept_id, true);
    }
  }

  static getStudyPlan(userId: string, courseId?: string): StudyPlan | null {
    if (!isBrowser) return null;
    const raw = localStorage.getItem(getKey(userId, 'study_plan'));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  static saveStudyPlan(userId: string, plan: StudyPlan): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, 'study_plan'), JSON.stringify(plan));
  }

  static toggleTaskCompletion(userId: string, taskId: string): boolean {
    const plan = this.getStudyPlan(userId);
    if (!plan) return false;
    const task = plan.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      task.completed_at = task.completed ? new Date().toISOString() : undefined;
      this.saveStudyPlan(userId, plan);
      return task.completed;
    }
    return false;
  }

  static getFlashcards(userId: string, courseId?: string): Flashcard[] {
    if (!isBrowser) return [];
    const raw = localStorage.getItem(getKey(userId, 'flashcards'));
    if (raw) {
      try {
        const all = JSON.parse(raw) as Flashcard[];
        return courseId ? all.filter(fc => fc.course_id === courseId) : all;
      } catch {
        return [];
      }
    }
    return [];
  }

  static saveFlashcards(userId: string, cards: Flashcard[]): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, 'flashcards'), JSON.stringify(cards));
  }

  static getTutorMessages(userId: string, courseId: string): TutorMessage[] {
    if (!isBrowser) return [];
    const raw = localStorage.getItem(getKey(userId, `tutor_history_${courseId}`));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }

  static saveTutorMessages(userId: string, courseId: string, messages: TutorMessage[]): void {
    if (!isBrowser) return;
    localStorage.setItem(getKey(userId, `tutor_history_${courseId}`), JSON.stringify(messages));
  }
}
