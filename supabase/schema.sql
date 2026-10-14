-- ==============================================================================
-- ADAPTIQ SUPABASE POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    email TEXT NOT NULL,
    preferred_language TEXT DEFAULT 'English',
    learning_goal TEXT DEFAULT 'Exam preparation & concept mastery',
    study_field TEXT DEFAULT 'Computer Science',
    daily_study_time_minutes INTEGER DEFAULT 60,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COURSES TABLE
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    code TEXT,
    description TEXT,
    category TEXT DEFAULT 'Computer Science',
    color TEXT DEFAULT 'indigo',
    icon TEXT DEFAULT 'Brain',
    total_concepts INTEGER DEFAULT 0,
    mastered_concepts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. COURSE MEMBERS
CREATE TABLE IF NOT EXISTS public.course_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'student',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, user_id)
);

-- 4. COURSE MATERIALS
CREATE TABLE IF NOT EXISTS public.course_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('textbook', 'slides', 'lecture_video', 'notes', 'syllabus')),
    file_size_bytes BIGINT DEFAULT 0,
    file_url TEXT,
    page_count INTEGER,
    slide_count INTEGER,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'indexed' CHECK (status IN ('processing', 'indexed', 'failed')),
    extracted_chunks_count INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES public.course_materials(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SLIDES
CREATE TABLE IF NOT EXISTS public.slides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES public.course_materials(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    slide_number INTEGER NOT NULL,
    title TEXT,
    body_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VIDEO SEGMENTS
CREATE TABLE IF NOT EXISTS public.video_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES public.course_materials(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    start_seconds INTEGER NOT NULL,
    end_seconds INTEGER NOT NULL,
    timestamp_display TEXT NOT NULL,
    transcript_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. LEARNING UNITS
CREATE TABLE IF NOT EXISTS public.learning_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    unit_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONCEPTS
CREATE TABLE IF NOT EXISTS public.concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty_level INTEGER DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CONCEPT RELATIONSHIPS
CREATE TABLE IF NOT EXISTS public.concept_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
    target_concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
    relationship_type TEXT DEFAULT 'prerequisite',
    strength NUMERIC(3,2) DEFAULT 0.90,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. SOURCE EVIDENCE
CREATE TABLE IF NOT EXISTS public.source_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    material_id UUID REFERENCES public.course_materials(id) ON DELETE CASCADE NOT NULL,
    location_type TEXT NOT NULL,
    location_reference TEXT NOT NULL,
    snippet TEXT NOT NULL,
    confidence_score NUMERIC(3,2) NOT NULL,
    relevance_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. STUDENT MASTERY (BAYESIAN LEARNING TWIN)
CREATE TABLE IF NOT EXISTS public.student_mastery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
    mastery_probability NUMERIC(4,3) DEFAULT 0.500,
    attempt_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    confidence NUMERIC(4,3) DEFAULT 0.500,
    last_practiced TIMESTAMPTZ DEFAULT NOW(),
    forgetting_risk TEXT DEFAULT 'low' CHECK (forgetting_risk IN ('low', 'medium', 'high', 'critical')),
    retention_strength NUMERIC(4,3) DEFAULT 0.850,
    recommended_action TEXT DEFAULT 'practice_advanced',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, concept_id)
);

-- 13. STUDENT ATTEMPTS
CREATE TABLE IF NOT EXISTS public.student_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
    selected_option_id TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    misconception_detected TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. MISCONCEPTIONS
CREATE TABLE IF NOT EXISTS public.misconceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger_evidence TEXT NOT NULL,
    severity TEXT DEFAULT 'high',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'remediated', 'retested_pass')),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    remediated_at TIMESTAMPTZ
);

-- 15. QUESTIONS
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE NOT NULL,
    difficulty TEXT DEFAULT 'medium',
    question_text TEXT NOT NULL,
    code_snippet TEXT,
    bloom_level TEXT DEFAULT 'Understand',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. QUESTION HISTORY
CREATE TABLE IF NOT EXISTS public.question_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    is_correct BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    score_percentage NUMERIC(5,2) DEFAULT 0.0,
    status TEXT DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 18. STUDY PLANS
CREATE TABLE IF NOT EXISTS public.study_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    exam_date DATE,
    daily_goal_minutes INTEGER DEFAULT 60,
    streak_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. STUDY TASKS
CREATE TABLE IF NOT EXISTS public.study_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES public.study_plans(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    task_type TEXT NOT NULL,
    estimated_minutes INTEGER DEFAULT 20,
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    reason TEXT
);

-- 20. FLASHCARDS
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    code_front TEXT,
    code_back TEXT,
    source_ref TEXT NOT NULL,
    next_review_date DATE DEFAULT CURRENT_DATE,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    ease_factor NUMERIC(4,2) DEFAULT 2.50
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misconceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. Courses RLS
CREATE POLICY "Users can view own courses" ON public.courses FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own courses" ON public.courses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own courses" ON public.courses FOR DELETE USING (auth.uid() = owner_id);

-- 3. Course Materials RLS
CREATE POLICY "Users can view own materials" ON public.course_materials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own materials" ON public.course_materials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own materials" ON public.course_materials FOR DELETE USING (auth.uid() = user_id);

-- 4. Student Mastery RLS
CREATE POLICY "Users can view own mastery" ON public.student_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mastery" ON public.student_mastery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery" ON public.student_mastery FOR UPDATE USING (auth.uid() = user_id);

-- 5. Misconceptions RLS
CREATE POLICY "Users can view own misconceptions" ON public.misconceptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own misconceptions" ON public.misconceptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own misconceptions" ON public.misconceptions FOR UPDATE USING (auth.uid() = user_id);

-- 6. Study Plans & Tasks RLS
CREATE POLICY "Users can view own study plans" ON public.study_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own study plans" ON public.study_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own study tasks" ON public.study_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own study tasks" ON public.study_tasks FOR UPDATE USING (auth.uid() = user_id);

-- 7. Flashcards RLS
CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own flashcards" ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH.SIGNUP
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url, preferred_language, study_field, learning_goal)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'English',
    'Computer Science',
    'Exam preparation & concept mastery'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 16. QUESTION BANKS & SAVED QUESTIONS (SMART QUESTION BANK)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.question_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    topics JSONB DEFAULT '[]'::jsonb,
    total_questions INTEGER DEFAULT 0,
    total_marks INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    questions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    bank_id UUID REFERENCES public.question_banks(id) ON DELETE SET NULL,
    question_number INTEGER DEFAULT 1,
    question_text TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 2,
    question_type TEXT NOT NULL DEFAULT '2_mark',
    topic TEXT NOT NULL DEFAULT 'General',
    difficulty TEXT NOT NULL DEFAULT 'medium',
    answer TEXT NOT NULL,
    structured_16_mark JSONB,
    source_citation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;

-- Question Banks RLS
CREATE POLICY "Users can view own question banks" ON public.question_banks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own question banks" ON public.question_banks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own question banks" ON public.question_banks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own question banks" ON public.question_banks FOR DELETE USING (auth.uid() = user_id);

-- Saved Questions RLS
CREATE POLICY "Users can view own saved questions" ON public.saved_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved questions" ON public.saved_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved questions" ON public.saved_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved questions" ON public.saved_questions FOR DELETE USING (auth.uid() = user_id);

