import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-server';
import { DB } from '@/lib/db';
import { StudyPlan, StudyTask } from '@/types';
import { SupportedLanguage, I18N } from '@/lib/i18n';

async function generatePlanInternal(
  userId: string,
  courseId: string,
  supabase?: any,
  language?: SupportedLanguage,
  dailyGoalMinutes?: number,
  examDate?: string
): Promise<StudyPlan | null> {
  const course = await DB.getCourseById(userId, courseId, supabase);
  if (!course) return null;

  const userProfile = await DB.getProfile(userId, supabase);
  const preferredLanguage: SupportedLanguage = (language || userProfile?.preferred_language || 'English') as SupportedLanguage;
  const studyBudget = dailyGoalMinutes || userProfile?.daily_study_time_minutes || 60;

  // Real course materials, concepts, mastery, misconceptions
  const concepts = await DB.getConcepts(userId, courseId);
  let masteryList = await DB.getMastery(userId, courseId, supabase);
  if (masteryList.length === 0 && concepts.length > 0) {
    masteryList = await DB.initializeCourseMastery(userId, courseId, concepts);
  }

  const misconceptions = await DB.getMisconceptions(userId, courseId, supabase);
  const activeMisc = misconceptions.filter((m) => m.status === 'active');
  const weakConcepts = masteryList
    .filter((m) => m.mastery_probability < 0.65)
    .sort((a, b) => a.mastery_probability - b.mastery_probability);
  const highRiskConcepts = masteryList.filter(
    (m) => (m.forgetting_risk === 'high' || m.forgetting_risk === 'critical') && !weakConcepts.some((w) => w.concept_id === m.concept_id)
  );

  const attempts = await DB.getAttempts(userId, courseId);
  const distinctDays = new Set(attempts.map((a) => a.attempted_at?.split('T')[0])).size;
  const streakDays = Math.max(1, distinctDays);

  const generatedTasks: StudyTask[] = [];
  let allocatedMinutes = 0;

  // 1. Urgent Misconception Remediation task
  if (activeMisc.length > 0 && allocatedMinutes + 20 <= studyBudget) {
    const targetMisc = activeMisc[0];
    const titleGen = I18N.studyPlanTitles.repairMisconception[preferredLanguage] || I18N.studyPlanTitles.repairMisconception.English;
    const reasonText = I18N.studyPlanReasons.misconception[preferredLanguage] || I18N.studyPlanReasons.misconception.English;

    generatedTasks.push({
      id: `task-m-${Date.now()}`,
      user_id: userId,
      course_id: courseId,
      concept_id: targetMisc.concept_id,
      concept_name: targetMisc.concept_name,
      title: titleGen(targetMisc.title),
      task_type: 'remediation',
      estimated_minutes: 20,
      priority: 'urgent',
      due_date: new Date().toISOString().split('T')[0],
      completed: false,
      reason: reasonText,
    });
    allocatedMinutes += 20;
  }

  // 2. High Priority: Weak Concept Reviews
  const weakTitleGen = I18N.studyPlanTitles.reviewWeakConcept[preferredLanguage] || I18N.studyPlanTitles.reviewWeakConcept.English;
  const weakReasonGen = I18N.studyPlanReasons.weakConcept[preferredLanguage] || I18N.studyPlanReasons.weakConcept.English;

  for (const c of weakConcepts) {
    if (allocatedMinutes + 15 > studyBudget || generatedTasks.length >= 4) break;
    generatedTasks.push({
      id: `task-w-${Date.now()}-${generatedTasks.length}`,
      user_id: userId,
      course_id: courseId,
      concept_id: c.concept_id,
      concept_name: c.concept_name,
      title: weakTitleGen(c.concept_name),
      task_type: 'concept_review',
      estimated_minutes: 15,
      priority: 'high',
      due_date: new Date().toISOString().split('T')[0],
      completed: false,
      reason: weakReasonGen(Math.round(c.mastery_probability * 100)),
    });
    allocatedMinutes += 15;
  }

  // 3. High Priority: Forgetting Risk Mitigation
  for (const c of highRiskConcepts) {
    if (allocatedMinutes + 15 > studyBudget || generatedTasks.length >= 4) break;
    generatedTasks.push({
      id: `task-fr-${Date.now()}-${generatedTasks.length}`,
      user_id: userId,
      course_id: courseId,
      concept_id: c.concept_id,
      concept_name: c.concept_name,
      title: `${c.concept_name} Memory Retention Consolidation`,
      task_type: 'concept_review',
      estimated_minutes: 15,
      priority: 'high',
      due_date: new Date().toISOString().split('T')[0],
      completed: false,
      reason: `Ebbinghaus cognitive decay risk is ${c.forgetting_risk}. Review core invariants to prevent memory loss.`,
    });
    allocatedMinutes += 15;
  }

  // 4. Spaced Flashcard Review
  const flashcardTitle = I18N.studyPlanTitles.flashcards[preferredLanguage] || I18N.studyPlanTitles.flashcards.English;
  const flashcardReason = I18N.studyPlanReasons.flashcards[preferredLanguage] || I18N.studyPlanReasons.flashcards.English;
  const firstConcept = concepts[0];

  generatedTasks.push({
    id: `task-rev-${Date.now()}`,
    user_id: userId,
    course_id: courseId,
    concept_id: firstConcept?.id || 'concept-core',
    concept_name: firstConcept?.name || course.title,
    title: flashcardTitle,
    task_type: 'practice_quiz',
    estimated_minutes: 10,
    priority: 'medium',
    due_date: new Date().toISOString().split('T')[0],
    completed: false,
    reason: flashcardReason,
  });
  allocatedMinutes += 10;

  // 5. Daily Diagnostic Assessment Checkpoint
  const quizTitle = I18N.studyPlanTitles.dailyQuiz[preferredLanguage] || I18N.studyPlanTitles.dailyQuiz.English;
  const quizReason = I18N.studyPlanReasons.dailyQuiz[preferredLanguage] || I18N.studyPlanReasons.dailyQuiz.English;

  generatedTasks.push({
    id: `task-quiz-${Date.now()}`,
    user_id: userId,
    course_id: courseId,
    concept_id: firstConcept?.id || 'concept-core',
    concept_name: firstConcept?.name || course.title,
    title: quizTitle,
    task_type: 'practice_quiz',
    estimated_minutes: 15,
    priority: 'medium',
    due_date: new Date().toISOString().split('T')[0],
    completed: false,
    reason: quizReason,
  });

  const planTitle =
    preferredLanguage === 'Tamil'
      ? `${course.title} தழுவல் தயாரிப்பு அட்டவணை`
      : preferredLanguage === 'Hindi'
      ? `${course.title} अनुकूली तैयारी समय सारिणी`
      : preferredLanguage === 'Spanish'
      ? `Plan de estudio adaptativo para ${course.title}`
      : preferredLanguage === 'French'
      ? `Programme d'étude adaptatif pour ${course.title}`
      : `Adaptive Study Schedule for ${course.title}`;

  const newPlan: StudyPlan = {
    id: `plan-${Date.now()}`,
    user_id: userId,
    course_id: courseId,
    title: planTitle,
    exam_date: examDate,
    daily_goal_minutes: studyBudget,
    streak_days: streakDays,
    tasks: generatedTasks,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await DB.saveStudyPlan(userId, newPlan, supabase);
  return newPlan;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  let courseId = searchParams.get('courseId') || undefined;

  const shouldRefresh = searchParams.get('refresh') === 'true';
  let plan = shouldRefresh ? null : await DB.getStudyPlan(auth.userId, courseId, auth.supabase);

  // If no plan exists or refresh requested, auto-generate it from user's real course data and latest mastery
  if (!plan) {
    const userCourses = await DB.getCourses(auth.userId, auth.supabase);
    if (userCourses.length > 0) {
      const targetCourseId = courseId || userCourses[0].id;
      plan = await generatePlanInternal(auth.userId, targetCourseId, auth.supabase);
    }
  }

  return NextResponse.json({ studyPlan: plan });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    let { courseId, dailyGoalMinutes = 60, examDate, language } = body;

    if (!courseId) {
      const userCourses = await DB.getCourses(auth.userId, auth.supabase);
      if (userCourses.length === 0) {
        return NextResponse.json({
          studyPlan: null,
          message: 'No courses found. Please create a course and upload materials to generate a study plan.',
        });
      }
      courseId = userCourses[0].id;
    }

    const plan = await generatePlanInternal(
      auth.userId,
      courseId,
      auth.supabase,
      language,
      dailyGoalMinutes,
      examDate
    );

    return NextResponse.json({ studyPlan: plan });
  } catch (err: any) {
    console.error('Study plan generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
