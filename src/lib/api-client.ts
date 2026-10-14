import {
  UserProfile,
  Course,
  CourseMaterial,
  Concept,
  ConceptRelationship,
  StudentMastery,
  Misconception,
  Question,
  StudyPlan,
  Flashcard,
  TutorMessage,
  SourceEvidence,
  EvaluationCase,
  Assessment,
  TopicMastery,
  LearningTwinMetrics,
  QuestionBank,
  SmartQuestion,
  QuestionBankGenerateRequest,
} from '@/types';

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const activeUserId = localStorage.getItem('adaptiq_active_user_id');
    if (activeUserId) {
      headers['x-user-id'] = activeUserId;
    }

    // Try extracting supabase session token from local storage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item?.access_token) {
            headers['Authorization'] = `Bearer ${item.access_token}`;
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return headers;
}

export const api = {
  // Profiles
  async getProfile(): Promise<UserProfile> {
    const res = await fetch('/api/profile', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load user profile');
    const data = await res.json();
    return data.profile;
  },

  async updateProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const data = await res.json();
    return data.profile;
  },

  // Courses
  async getCourses(): Promise<Course[]> {
    const res = await fetch('/api/courses', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load courses');
    const data = await res.json();
    return data.courses || [];
  },

  async createCourse(course: {
    title: string;
    code?: string;
    description: string;
    category?: string;
  }): Promise<Course> {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(course),
    });
    if (!res.ok) throw new Error('Failed to create course');
    const data = await res.json();
    return data.course;
  },

  async getCourseDetails(courseId: string): Promise<{
    course: Course;
    materials: CourseMaterial[];
    concepts: Concept[];
    mastery: StudentMastery[];
  }> {
    const res = await fetch(`/api/courses/${courseId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load course details');
    return res.json();
  },

  async deleteCourse(courseId: string): Promise<boolean> {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.ok;
  },

  // Upload & Process
  async uploadMaterial(courseId: string, formData: FormData): Promise<CourseMaterial> {
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const activeUserId = localStorage.getItem('adaptiq_active_user_id');
      if (activeUserId) headers['x-user-id'] = activeUserId;
    }

    const res = await fetch(`/api/courses/${courseId}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload material');
    const data = await res.json();
    return data.material;
  },

  async processCourse(courseId: string): Promise<{
    success: boolean;
    conceptsCount: number;
    concepts: Concept[];
  }> {
    const res = await fetch(`/api/courses/${courseId}/process`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Course AI processing failed');
    return res.json();
  },

  async getCourseMap(courseId: string): Promise<{
    concepts: Concept[];
    relationships: ConceptRelationship[];
    mastery: StudentMastery[];
  }> {
    const res = await fetch(`/api/courses/${courseId}/map`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load course map');
    return res.json();
  },

  async getCourseSources(courseId: string): Promise<{
    materials: CourseMaterial[];
    sources: SourceEvidence[];
  }> {
    const res = await fetch(`/api/courses/${courseId}/sources`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load source evidence');
    return res.json();
  },

  // AI Tutor
  async getTutorHistory(courseId: string): Promise<TutorMessage[]> {
    const res = await fetch(`/api/tutor/ask?courseId=${courseId}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  },

  async askTutor(payload: {
    query: string;
    courseId?: string;
    conceptId?: string;
    language?: string;
  }): Promise<{
    answer: string;
    isOffMaterial: boolean;
    citations: SourceEvidence[];
    suggestedFollowups: string[];
    messageId: string;
  }> {
    const res = await fetch('/api/tutor/ask', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('AI Tutor query failed');
    return res.json();
  },

  // Assessment & Mastery
  async generateAssessment(payload: {
    courseId?: string;
    conceptId?: string;
    difficulty?: string;
    count?: number;
    language?: string;
  }): Promise<Question[]> {
    const res = await fetch('/api/assessment/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to generate diagnostic assessment');
    const data = await res.json();
    return data.questions || [];
  },

  async generateAssessmentDetailed(payload: {
    courseId?: string;
    topic?: string;
    conceptId?: string;
    difficulty?: string;
    count?: number;
    assessmentType?: string;
    language?: string;
  }): Promise<{ questions: Question[]; message?: string; assessment_id?: string }> {
    const res = await fetch('/api/assessment/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to generate diagnostic assessment');
    const data = await res.json();
    return { questions: data.questions || [], message: data.message, assessment_id: data.assessment_id };
  },

  async evaluateAttempt(payload: {
    questionId: string;
    conceptId: string;
    conceptName: string;
    courseId?: string;
    isCorrect?: boolean;
    selectedOptionText: string;
    questionType?: string;
    correctAnswer?: string;
    explanation?: string;
    sourceCitation?: any;
    misconceptionTag?: string;
    timeSpentSeconds?: number;
    language?: string;
  }): Promise<{
    success: boolean;
    isCorrect: boolean;
    why_correct?: string;
    explanation?: string;
    source_citation?: any;
    relevant_concept?: { id: string; name: string };
    mastery: StudentMastery;
    misconception: Misconception | null;
  }> {
    const res = await fetch('/api/assessment/evaluate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Evaluation submission failed');
    return res.json();
  },

  async getAssessments(courseId?: string): Promise<Assessment[]> {
    const url = courseId ? `/api/assessment/attempts?courseId=${courseId}` : '/api/assessment/attempts';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch assessments');
    return res.json();
  },

  async recordAssessment(assessmentData: Partial<Assessment>): Promise<Assessment> {
    const res = await fetch('/api/assessment/attempts', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(assessmentData),
    });
    if (!res.ok) throw new Error('Failed to record assessment');
    return res.json();
  },

  async getMastery(courseId?: string): Promise<StudentMastery[]> {
    const url = courseId ? `/api/mastery?courseId=${courseId}` : '/api/mastery';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch mastery');
    const data = await res.json();
    return data.mastery || [];
  },

  async getMasteryWithMetrics(courseId?: string): Promise<{
    mastery: StudentMastery[];
    metrics: LearningTwinMetrics;
  }> {
    const url = courseId ? `/api/mastery?courseId=${courseId}` : '/api/mastery';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch mastery metrics');
    const data = await res.json();
    return {
      mastery: data.mastery || [],
      metrics: data.metrics,
    };
  },

  // Misconceptions
  async getMisconceptions(courseId?: string): Promise<Misconception[]> {
    const url = courseId ? `/api/misconceptions?courseId=${courseId}` : '/api/misconceptions';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch misconceptions');
    const data = await res.json();
    return data.misconceptions || [];
  },

  async completeRemediationStep(
    misconceptionId: string,
    stepNumber: number,
    notes?: string
  ): Promise<{ misconception: Misconception }> {
    const res = await fetch(`/api/misconceptions/${misconceptionId}/remediate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ stepNumber, notes }),
    });
    if (!res.ok) throw new Error('Failed to complete remediation step');
    return res.json();
  },

  async submitRetest(
    misconceptionId: string,
    isCorrect: boolean,
    explanation?: string
  ): Promise<{ passed: boolean; misconception: Misconception; mastery?: StudentMastery }> {
    const res = await fetch(`/api/misconceptions/${misconceptionId}/retest`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isCorrect, explanation }),
    });
    if (!res.ok) throw new Error('Retest submission failed');
    return res.json();
  },

  // Study Plan
  async getStudyPlan(courseId?: string): Promise<StudyPlan | null> {
    const url = courseId ? `/api/study-plan?courseId=${courseId}` : '/api/study-plan';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.studyPlan;
  },

  async updateStudyTask(
    taskId: string,
    action: 'toggle' | 'postpone' | 'reschedule' = 'toggle',
    newDueDate?: string
  ): Promise<StudyPlan> {
    const res = await fetch('/api/study-plan/task', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ taskId, action, newDueDate }),
    });
    if (!res.ok) throw new Error('Failed to update task');
    const data = await res.json();
    return data.studyPlan;
  },

  async toggleStudyTask(taskId: string): Promise<StudyPlan> {
    return this.updateStudyTask(taskId, 'toggle');
  },

  async generateStudyPlan(payload?: {
    courseId?: string;
    dailyGoalMinutes?: number;
    examDate?: string;
    language?: string;
  }): Promise<StudyPlan> {
    const res = await fetch('/api/study-plan', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error('Failed to recalculate study plan');
    const data = await res.json();
    return data.studyPlan;
  },

  // Revision / Flashcards
  async getFlashcards(courseId?: string): Promise<Flashcard[]> {
    const url = courseId ? `/api/revision?courseId=${courseId}` : '/api/revision';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.flashcards || [];
  },

  async reviewFlashcard(cardId: string, rating: number): Promise<Flashcard> {
    const res = await fetch('/api/revision', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cardId, rating }),
    });
    if (!res.ok) throw new Error('Failed to record flashcard review');
    const data = await res.json();
    return data.flashcard;
  },

  // Evaluation
  async getEvaluationMetrics(): Promise<{
    metrics: any;
    cases: EvaluationCase[];
  }> {
    const res = await fetch('/api/evaluation', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load evaluation metrics');
    return res.json();
  },

  async runBenchmark(prompt?: string): Promise<any> {
    const res = await fetch('/api/evaluation', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Benchmark run failed');
    return res.json();
  },

  // Smart Question Bank
  async getQuestionBanks(courseId?: string, includeQuestions = true): Promise<{
    banks: QuestionBank[];
    savedQuestions: SmartQuestion[];
  }> {
    const url = courseId
      ? `/api/question-bank?courseId=${courseId}&includeQuestions=${includeQuestions}`
      : `/api/question-bank?includeQuestions=${includeQuestions}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load question banks');
    return res.json();
  },

  async getQuestionBankById(bankId: string): Promise<QuestionBank> {
    const res = await fetch(`/api/question-bank/${bankId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load question bank details');
    const data = await res.json();
    return data.bank;
  },

  async generateSmartQuestions(payload: QuestionBankGenerateRequest): Promise<{
    success: boolean;
    questions: SmartQuestion[];
    totalQuestions: number;
    totalMarks: number;
    courseTitle: string;
    courseCode?: string;
    topics: string[];
    materialsCount: number;
  }> {
    const res = await fetch('/api/question-bank/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate questions');
    }
    return data;
  },

  async analyzeAndGenerateQuestions(payload: {
    courseId: string;
    selectedMaterialIds?: string[];
    preferredLanguage?: string;
  }): Promise<{
    success: boolean;
    courseId: string;
    courseTitle: string;
    courseCode?: string;
    analyzedMaterialsCount: number;
    analyzedMaterials: { id: string; title: string; file_type: string; page_or_slide_count?: number }[];
    twoMarkBankId: string;
    sixteenMarkBankId: string;
    twoMarkQuestions: SmartQuestion[];
    sixteenMarkQuestions: SmartQuestion[];
    twoMarkPdfUrl: string;
    sixteenMarkPdfUrl: string;
    twoMarkPdfSize: number;
    sixteenMarkPdfSize: number;
  }> {
    const res = await fetch('/api/question-bank/analyze-and-generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to analyze course materials and generate question papers');
    }
    return data;
  },

  async saveQuestionBank(bankData: {
    courseId: string;
    courseTitle?: string;
    title: string;
    description?: string;
    topics?: string[];
    questions: SmartQuestion[];
    config?: any;
  }): Promise<QuestionBank> {
    const res = await fetch('/api/question-bank', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(bankData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save question bank');
    return data.bank;
  },

  async saveIndividualQuestion(question: SmartQuestion): Promise<SmartQuestion> {
    const res = await fetch('/api/question-bank', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'save_question',
        question,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save question');
    return data.question;
  },

  async deleteQuestionBank(bankId: string, isQuestion = false): Promise<boolean> {
    const url = isQuestion
      ? `/api/question-bank/${bankId}?type=question`
      : `/api/question-bank/${bankId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.ok;
  },
};
