export type UserRole = 'student' | 'instructor' | 'admin';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  preferred_language: 'English' | 'Tamil' | 'Hindi' | 'Spanish' | 'French';
  learning_goal: string;
  study_field: string;
  daily_study_time_minutes: number;
  daily_study_minutes?: number;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
}

export interface Course {
  id: string;
  course_id?: string;
  owner_id: string;
  title: string;
  code?: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  total_concepts: number;
  mastered_concepts: number;
  created_at: string;
  updated_at: string;
  materials_count: number;
  last_studied?: string;
}

export type MaterialType = 'textbook' | 'slides' | 'lecture_video' | 'notes' | 'syllabus' | 'image' | 'figure' | string;

export interface VisualElement {
  id: string;
  type: 'diagram' | 'chart' | 'figure' | 'table' | 'flowchart' | 'illustration' | 'equation';
  caption: string;
  description: string;
  location_reference: string; // e.g. "Figure 3.2, Page 45" or "Slide 12 Diagram"
  extracted_text?: string;
  data_points?: string[];
  formula?: string;
}

export interface CourseMaterial {
  id: string;
  material_id?: string;
  course_id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: MaterialType | string;
  file_size_bytes: number;
  file_url?: string;
  page_count?: number;
  slide_count?: number;
  total_units?: number;
  duration_seconds?: number;
  video_timestamps?: { time: string; label: string }[];
  visual_elements_count?: number;
  status: 'processing' | 'indexed' | 'failed' | 'uploading' | 'processed' | 'error';
  extracted_chunks_count?: number;
  uploaded_at?: string;
  created_at?: string;
}

export interface SourceEvidence {
  id: string;
  course_id: string;
  material_id: string;
  material_title: string;
  material_type: MaterialType;
  location_type: 'page' | 'slide' | 'timestamp' | 'section' | 'image';
  location_reference: string; // e.g., "Page 73", "Slide 18", "12:35", "Figure 3.1"
  snippet: string;
  confidence_score: number;
  relevance_reason: string;
  topic?: string;
  subtopic?: string;
  concept?: string;
  learning_objective?: string;
  visual_element?: VisualElement;
  embedding?: number[];
  file_name?: string;
  file_url?: string;
  page_number?: number;
  slide_number?: number;
  timestamp?: string;
}

export interface Concept {
  id: string;
  course_id: string;
  name: string;
  description: string;
  category: string; // Major topic
  subtopic?: string;
  difficulty_level: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[]; // concept IDs
  subconcepts: string[];
  learning_objectives?: string[];
  source_location?: string;
  key_formulas?: string[];
  common_pitfalls?: string[];
}

export interface ConceptRelationship {
  id: string;
  source_concept_id: string;
  target_concept_id: string;
  relationship_type: 'prerequisite' | 'extends' | 'related' | 'applied_in';
  strength: number; // 0.0 to 1.0
}

export interface StudentMastery {
  id: string;
  user_id: string;
  course_id: string;
  concept_id: string;
  concept_name: string;
  category: string;
  mastery_probability: number; // 0.0 - 1.0 (e.g. 0.92 = 92%)
  attempt_count: number;
  correct_count: number;
  incorrect_count: number;
  confidence: number; // 0.0 - 1.0
  last_practiced: string;
  forgetting_risk: 'low' | 'medium' | 'high' | 'critical';
  retention_strength: number; // Forgetting curve parameter
  recommended_action: 'review_soon' | 'practice_advanced' | 'remediate_gap' | 'mastered';
}

export interface TopicMastery {
  topic: string;
  course_id: string;
  mastery_percentage: number;
  attempt_count: number;
  correct_count: number;
  incorrect_count: number;
  accuracy: number;
  concept_count: number;
  status: 'mastered' | 'developing' | 'weak';
}

export interface LearningTwinMetrics {
  overall_mastery: number;
  course_mastery: number;
  total_attempts: number;
  total_correct: number;
  total_incorrect: number;
  overall_accuracy: number;
  average_confidence: number;
  topics: TopicMastery[];
  weak_concepts: StudentMastery[];
  strong_concepts: StudentMastery[];
}

export interface Misconception {
  id: string;
  misconception_id?: string;
  user_id: string;
  course_id: string;
  concept_id: string;
  concept_name: string;
  title: string;
  description: string;
  trigger_evidence?: string;
  evidence?: string;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high';
  detected_at: string;
  status: 'active' | 'remediated' | 'retested_pass' | 'Detected' | 'Repairing' | 'Retest Required' | 'Resolved';
  retest_passed?: boolean;
  citations?: any[];
  remediation_steps: {
    step_number: number;
    title: string;
    explanation: string;
    code_example?: string;
    verified_quote: string;
    source_ref: string;
  }[];
  verification_question_id?: string;
}

export type QuestionType = 'mcq' | 'fill_in_the_blank' | 'short_answer' | 'numerical';
export type AssessmentType = 'diagnostic' | 'practice' | 'mock_exam' | 'numerical_drill' | 'short_answer' | 'mixed';

export interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  explanation: string;
  misconception_tag?: string; // If student selects this wrong answer, triggers this misconception
}

export interface Question {
  id: string;
  course_id: string;
  concept_id: string;
  concept_name: string;
  topic?: string;
  subtopic?: string;
  question_type?: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  code_snippet?: string;
  options: QuestionOption[];
  correct_answer?: string;
  explanation?: string;
  source_citation: {
    material_title: string;
    reference: string;
    quote: string;
  };
  learning_objective?: string;
  verification_status?: 'approved' | 'verified';
  verifier_notes?: string;
  bloom_level: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
}

export interface QuestionAttempt {
  id: string;
  user_id: string;
  question_id: string;
  course_id: string;
  concept_id: string;
  selected_option_id: string;
  is_correct: boolean;
  time_spent_seconds: number;
  attempted_at: string;
  misconception_detected?: string;
}

export interface Assessment {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  assessment_type?: AssessmentType;
  topic?: string;
  status: 'in_progress' | 'completed';
  total_questions: number;
  completed_questions: number;
  score_percentage: number;
  started_at: string;
  completed_at?: string;
  questions: Question[];
  current_index: number;
  answers: Record<string, string>; // questionId -> optionId/text
}

export interface StudyTask {
  id: string;
  task_id?: string;
  user_id?: string;
  course_id?: string;
  concept_id?: string;
  concept_name?: string;
  title: string;
  task_type?: 'concept_review' | 'practice_quiz' | 'remediation' | 'deep_dive';
  activity?: string;
  estimated_minutes: number;
  duration_minutes?: number;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'Critical' | 'High' | 'Medium';
  due_date: string;
  source_ref?: string;
  completed: boolean;
  completed_at?: string;
  reason: string;
}

export interface StudyPlan {
  id?: string;
  plan_id?: string;
  user_id?: string;
  course_id?: string;
  title: string;
  exam_date?: string;
  daily_goal_minutes?: number;
  daily_available_minutes?: number;
  streak_days?: number;
  tasks: StudyTask[];
  created_at?: string;
  updated_at?: string;
}

export interface Flashcard {
  id: string;
  card_id?: string;
  user_id?: string;
  course_id?: string;
  concept_id: string;
  concept_name?: string;
  front: string;
  back: string;
  front_prompt?: string;
  back_solution?: string;
  source_citation?: string;
  card_type?: 'concept' | 'formula' | 'code' | string;
  code_front?: string;
  code_back?: string;
  source_ref: string;
  difficulty_rating?: 1 | 2 | 3 | 4 | 5;
  next_review_date: string;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
}

export interface TutorMessage {
  id: string;
  user_id: string;
  course_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  is_off_material?: boolean;
  citations?: SourceEvidence[];
  suggested_followups?: string[];
  remedied_misconception_id?: string;
  source_backed_content?: string;
  outside_knowledge_content?: string;
}

export interface EvaluationCase {
  id: string;
  category: 'RAG Grounding' | 'Misconception Accuracy' | 'Adaptive Pacing' | 'Security Isolation';
  title: string;
  input_prompt: string;
  expected_outcome: string;
  actual_outcome: string;
  status: 'passed' | 'warning' | 'failed';
  metric_score: number; // e.g. 0.98 for 98%
  latency_ms: number;
  verified_at: string;
}

export interface RagasMetricBreakdown {
  faithfulness: number; // 0.0 to 1.0 (or %)
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  citation_accuracy?: number;
  evidence_gate_accuracy?: number;
  harmonic_mean_ragas?: number;
  tested_at?: string;
}

export interface EvaluationTestSetItem {
  id: string;
  question: string;
  course_id?: string;
  course_title?: string;
  category?: 'grounded_course' | 'off_material' | 'known_location';
  known_source_location?: string;
  expected_source_location?: string;
  is_source_grounded?: boolean;
  is_off_material?: boolean;
  expected_answer: string;
  expected_citation: string;
  actual_system_answer?: string;
  actual_answer?: string;
  actual_citation?: string;
  faithfulness_score?: number;
  relevancy_score?: number;
  precision_score?: number;
  context_precision_score?: number;
  context_recall_score?: number;
  citation_accuracy_score?: number;
  latency_ms?: number;
  status?: 'passed' | 'warning' | 'failed' | 'not_tested';
  tested_at?: string;
}

export interface SimulatedStudentProfile {
  id?: string;
  profile_id?: string;
  persona_name?: string;
  student_persona?: string;
  archetype?: 'Struggling Learner' | 'Accelerated Student' | 'Misconception-Prone' | 'Balanced';
  initial_skill_estimate?: number;
  final_skill_estimate?: number;
  initial_mastery?: number;
  final_mastery?: number;
  initial_accuracy?: number;
  final_accuracy?: number;
  sessions_run: number;
  mastery_gains?: number; // e.g. 34%
  mastery_gain_pct?: number;
  weak_topic_improvement?: number; // e.g. 48%
  weak_topic_improvement_pct?: number;
  question_repetition_rate: number; // 0.0%
  personalization_effectiveness: number; // e.g. 96.4%
  adaptation_quality: string | number; // e.g. 'Optimal' or 95.1%
  is_simulation?: true;
  labeled_synthetic?: true;
  status?: 'tested' | 'not_tested';
  tested_at?: string;
  diagnostic_details?: string;
}

export interface EvaluationRun {
  id: string;
  run_type: 'rag_benchmark' | 'personalization' | 'security_suite' | 'test_set_gen' | 'full';
  title: string;
  course_id?: string;
  course_title?: string;
  score?: number; // 0 to 100
  status: 'passed' | 'warning' | 'failed' | 'completed';
  latency_ms: number;
  details: string;
  created_at: string;
  metrics?: Record<string, any>;
}

export interface WeakTopicRevisionPackage {
  concept_id: string;
  concept_name: string;
  course_id: string;
  mastery_percentage: number;
  quick_summary: string;
  revision_notes: string | string[];
  mini_slides: {
    slide_number: number;
    title: string;
    bullets?: string[];
    bullet_points?: string[];
    citation?: string;
    source_location?: string;
  }[];
  audio_brief_script: string;
  flashcards?: {
    front: string;
    back: string;
    source_citation: string;
  }[];
  practice_questions: {
    question: string;
    answer?: string;
    correct_answer?: string;
    hint?: string;
    explanation?: string;
    source_citation?: string;
  }[];
  source_citation?: string;
}

// ==========================================
// SMART QUESTION BANK
// ==========================================

export type SmartQuestionType =
  | '2_mark'
  | '5_mark'
  | '10_mark'
  | '16_mark'
  | 'mcq'
  | 'fill_in_the_blank'
  | 'important_exam'
  | 'model_paper';

export interface StructuredAnswer16Mark {
  introduction: string;
  headings: {
    title: string;
    content: string;
    code_or_algorithm?: string;
    bullet_points?: string[];
  }[];
  examples?: string[];
  diagram_or_flowchart?: {
    title: string;
    description: string;
    ascii_or_mermaid?: string;
  };
  diagrams?: {
    title?: string;
    caption?: string;
    description: string;
    ascii_representation?: string;
  }[];
  worked_examples?: {
    title: string;
    steps: string[];
    result: string;
  }[];
  advantages?: string[];
  disadvantages?: string[];
  step_by_step_solution?: string[];
  conclusion: string;
}

export interface SmartQuestion {
  id: string;
  bank_id?: string;
  user_id: string;
  course_id: string;
  question_number: number;
  question_text: string;
  marks: number;
  question_type: SmartQuestionType;
  topic: string;
  subtopic?: string;
  concept_id?: string;
  concept_name?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answer: string;
  structured_16_mark?: StructuredAnswer16Mark;
  options?: QuestionOption[]; // for MCQs
  source_citation: {
    material_id?: string;
    material_title: string;
    material_type?: MaterialType;
    file_name?: string;
    file_url?: string;
    page_number?: number;
    slide_number?: number;
    reference: string; // e.g. "Page 73", "Slide 18", "12:35"
    quote: string;
    verified: boolean;
  };
  bloom_level?: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
  is_saved?: boolean;
  created_at: string;
}

export interface QuestionPaperConfig {
  course_id: string;
  title: string;
  topic?: string; // specific topic or 'all'
  question_types: SmartQuestionType[];
  marks_per_question?: number;
  total_questions: number;
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  include_answers: boolean;
  include_sources: boolean;
  max_marks?: number;
}

export interface QuestionBank {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  title: string;
  description?: string;
  topics: string[];
  total_questions: number;
  total_marks: number;
  config?: QuestionPaperConfig;
  questions: SmartQuestion[];
  created_at: string;
  updated_at: string;
}

export interface QuestionBankGenerateRequest {
  courseId: string;
  topic?: string; // topic name or 'all'
  questionType: SmartQuestionType;
  count?: number;
  difficulty?: 'all' | 'easy' | 'medium' | 'hard';
  marksPerQuestion?: number;
  includeAnswers?: boolean;
  includeSources?: boolean;
  customTitle?: string;
}

// Legacy / Alternative Aliases and Compatibility Types
export interface ConceptMastery {
  concept_id: string;
  concept_name: string;
  subconcept?: string;
  mastery_percentage: number;
  prior_percentage?: number;
  attempt_count: number;
  correct_count: number;
  incorrect_count: number;
  confidence: number;
  forgetting_risk: number;
  last_practiced: string;
  difficulty: number;
}

export interface SourceReference {
  source_id: string;
  source_type: "textbook" | "slide" | "video" | "diagram";
  title: string;
  location: string;
  page?: number;
  slide_number?: number;
  start_time?: string;
  end_time?: string;
  excerpt: string;
  relevance: number;
}

export interface AssessmentQuestion {
  question_id: string;
  concept: string;
  question_text: string;
  code_snippet?: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  difficulty: number;
  citation: SourceReference;
}

export interface QuestionHistoryItem {
  id: string;
  question_id: string;
  concept: string;
  question_text: string;
  selected_option: string;
  is_correct: boolean;
  attempted_at: string;
  prior_mastery: number;
  updated_mastery: number;
  delta: number;
}

export interface EvaluationMetrics {
  rag_faithfulness: number;
  answer_relevancy: number;
  citation_accuracy: number;
  off_material_refusal_rate: number;
  sympy_math_verification: number;
  unique_question_novelty: number;
}


