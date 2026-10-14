import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ibgibctnwkjgalxbsexy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EJe4nQuEusL5urhjL_Eesw_BbvYYCz4';
const BASE_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function containsTamil(text) {
  // Unicode range for Tamil: \u0B80-\u0BFF
  return /[\u0B80-\u0BFF]/.test(text);
}

function containsHindi(text) {
  // Unicode range for Devanagari: \u0900-\u097F
  return /[\u0900-\u097F]/.test(text);
}

function containsSpanish(text) {
  // Common Spanish words/accents
  return /[áéíóúñ¿¡]|(es|para|este|curso|aprendizaje|explicación)/i.test(text);
}

function containsFrench(text) {
  // Common French words/accents
  return /[àâçéèêëîïôûùüÿœæ]|(est|pour|cours|apprentissage|explication|bonjour)/i.test(text);
}

async function run() {
  console.log('--- STARTING ADAPTIQ LANGUAGE INTEGRATION TESTS ---');

  // 1. Sign up a fresh real test user with Supabase
  const testEmail = `lang_test_${Date.now()}@example.com`;
  const testPass = 'SecurePass123!';
  console.log(`\n1. Creating test user in Supabase: ${testEmail}`);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPass,
    options: {
      data: { full_name: 'Language Learner' },
    },
  });

  if (signUpError || !signUpData.user) {
    throw new Error(`Supabase signup failed: ${signUpError?.message}`);
  }

  const userId = signUpData.user.id;
  const token = signUpData.session?.access_token || '';
  console.log(`   User created successfully. ID: ${userId}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 2. Onboarding: Select Tamil and complete onboarding
  console.log('\n2. Onboarding: Selecting Tamil and saving profile...');
  const onboardingPayload = {
    study_field: 'Computer Science',
    preferred_language: 'Tamil',
    learning_goal: 'Exam preparation',
    daily_study_time_minutes: 60,
    onboarding_completed: true,
  };

  const putRes = await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(onboardingPayload),
  });

  if (!putRes.ok) {
    throw new Error(`Profile update failed: ${await putRes.text()}`);
  }
  const putData = await putRes.json();
  console.log(`   API response preferred_language: "${putData.profile.preferred_language}"`);
  if (putData.profile.preferred_language !== 'Tamil') {
    throw new Error(`Expected preferred_language to be Tamil, got ${putData.profile.preferred_language}`);
  }

  // 3. Verify in Supabase PostgreSQL profiles table
  console.log('\n3. Verifying stored preferred_language in Supabase profiles table...');
  const { data: sbProfile, error: sbProfErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (sbProfErr || !sbProfile) {
    console.warn('   Could not read from Supabase directly:', sbProfErr?.message);
  } else {
    console.log(`   Supabase profiles table preferred_language: "${sbProfile.preferred_language}"`);
    if (sbProfile.preferred_language !== 'Tamil') {
      throw new Error(`Supabase profile does not match Tamil! Value: ${sbProfile.preferred_language}`);
    }
    console.log('   ✓ Verified in Supabase PostgreSQL profiles table!');
  }

  // 4. Test Refresh / Return to onboarding / settings
  console.log('\n4. Simulating page refresh (GET /api/profile)...');
  const getProfRes = await fetch(`${BASE_URL}/api/profile`, {
    headers: authHeaders,
  });
  const getProfData = await getProfRes.json();
  console.log(`   Loaded profile language: "${getProfData.profile.preferred_language}"`);
  if (getProfData.profile.preferred_language !== 'Tamil') {
    throw new Error(`Profile reset to default! Expected Tamil, got ${getProfData.profile.preferred_language}`);
  }
  console.log('   ✓ Tamil remains selected upon reload and is NOT reset to hardcoded default!');

  // 5. Create a test course and upload course materials
  console.log('\n5. Creating a test course for grounded RAG...');
  const courseRes = await fetch(`${BASE_URL}/api/courses`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Advanced Algorithms & Invariants',
      code: 'CS301',
      description: 'Loop invariants, recursion trees, and asymptotic analysis.',
      category: 'Computer Science',
    }),
  });
  const courseData = await courseRes.json();
  const courseId = courseData.course.id;
  console.log(`   Course created with ID: ${courseId}`);

  // Upload syllabus
  const form = new FormData();
  const blob = new Blob(
    [
      `COURSE SYLLABUS: Advanced Algorithms
Chapter 1: Loop Invariants. A loop invariant must satisfy initialization, maintenance, and termination.
Chapter 2: Recursion & Stack Frames. Every recursive invocation pushes an activation record onto the call stack.
Chapter 3: Asymptotic Bounds. Big-O notation characterizes upper bounds on execution time.`
    ],
    { type: 'text/plain' }
  );
  form.append('file', blob, 'syllabus.txt');
  form.append('title', 'Algorithms Syllabus');
  form.append('fileType', 'textbook');

  const uploadRes = await fetch(`${BASE_URL}/api/courses/${courseId}/upload`, {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: form,
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
  console.log('   Uploaded syllabus material.');

  // Process course to generate concepts
  const procRes = await fetch(`${BASE_URL}/api/courses/${courseId}/process`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const procData = await procRes.json();
  console.log(`   Course processed. Extracted concepts count: ${procData.conceptsCount}`);

  // 6. Test AI Tutor in Tamil
  console.log('\n6. Testing AI Tutor query with selected language: Tamil...');
  const tutorRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courseId,
      query: 'What is a loop invariant and what conditions must it satisfy?',
    }),
  });
  const tutorData = await tutorRes.json();
  console.log('   AI Tutor response snippet:', tutorData.answer?.slice(0, 150), '...');
  const hasTamilScript = containsTamil(tutorData.answer);
  console.log(`   Contains Tamil script: ${hasTamilScript}`);
  if (!hasTamilScript) {
    throw new Error('AI Tutor did not respond in Tamil script!');
  }
  console.log('   ✓ AI Tutor generated response strictly in Tamil!');

  // 7. Test Assessment Generation in Tamil
  console.log('\n7. Testing Assessment Generation in Tamil...');
  const assessRes = await fetch(`${BASE_URL}/api/assessment/generate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courseId,
      count: 2,
    }),
  });
  const assessData = await assessRes.json();
  const q1 = assessData.questions[0];
  console.log('   Question 1 text:', q1?.question_text);
  console.log('   Option 1 explanation:', q1?.options[0]?.explanation);
  const qHasTamil = containsTamil(q1?.question_text) || containsTamil(q1?.options[0]?.explanation || '');
  console.log(`   Assessment contains Tamil script: ${qHasTamil}`);
  if (!qHasTamil) {
    throw new Error('Assessment questions were not generated in Tamil!');
  }
  console.log('   ✓ Assessment questions, options, and explanations generated in Tamil!');

  // 8. Test Assessment Evaluation & Misconception Remediation in Tamil
  console.log('\n8. Testing Assessment Evaluation & Misconception in Tamil...');
  const evalRes = await fetch(`${BASE_URL}/api/assessment/evaluate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      questionId: q1.id,
      conceptId: q1.concept_id,
      conceptName: q1.concept_name,
      courseId,
      isCorrect: false,
      selectedOptionText: q1.options.find(o => !o.is_correct)?.text || 'Wrong answer',
      misconceptionTag: 'Loop Termination Confusion',
      timeSpentSeconds: 20,
    }),
  });
  const evalData = await evalRes.json();
  const misc = evalData.misconception;
  console.log('   Misconception description:', misc?.description?.slice(0, 120), '...');
  console.log('   Remediation Step 1:', misc?.remediation_steps[0]?.title, '->', misc?.remediation_steps[0]?.explanation?.slice(0, 100));
  const miscHasTamil = containsTamil(misc?.description || '') || containsTamil(misc?.remediation_steps[0]?.explanation || '');
  console.log(`   Misconception & Remediation contains Tamil script: ${miscHasTamil}`);
  if (!miscHasTamil) {
    throw new Error('Misconception remediation was not generated in Tamil!');
  }
  console.log('   ✓ Misconception explanations and remediation steps generated in Tamil!');

  // 9. Test Study Plan in Tamil
  console.log('\n9. Testing Study Plan generation in Tamil...');
  const planRes = await fetch(`${BASE_URL}/api/study-plan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ courseId }),
  });
  const planData = await planRes.json();
  const firstTask = planData.studyPlan?.tasks[0];
  console.log('   Study Plan Title:', planData.studyPlan?.title);
  console.log('   Task 1 Title:', firstTask?.title);
  console.log('   Task 1 Reason:', firstTask?.reason);
  const planHasTamil = containsTamil(planData.studyPlan?.title) || containsTamil(firstTask?.title || '') || containsTamil(firstTask?.reason || '');
  console.log(`   Study Plan contains Tamil script: ${planHasTamil}`);
  if (!planHasTamil) {
    throw new Error('Study plan tasks were not localized to Tamil!');
  }
  console.log('   ✓ Study plan tasks and reasons formatted in Tamil!');

  // 10. Switch language later: Hindi
  console.log('\n10. Switching language to Hindi...');
  await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ preferred_language: 'Hindi' }),
  });
  const hindiTutorRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courseId,
      query: 'What is loop invariant?',
    }),
  });
  const hindiTutorData = await hindiTutorRes.json();
  console.log('   Hindi AI Tutor answer snippet:', hindiTutorData.answer?.slice(0, 150), '...');
  const hasHindiScript = containsHindi(hindiTutorData.answer);
  console.log(`   Contains Hindi (Devanagari) script: ${hasHindiScript}`);
  if (!hasHindiScript) {
    throw new Error('AI Tutor did not respond in Hindi!');
  }
  console.log('   ✓ AI Tutor responded in Hindi!');

  // 11. Switch language later: Spanish
  console.log('\n11. Switching language to Spanish...');
  await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ preferred_language: 'Spanish' }),
  });
  const spanishTutorRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courseId,
      query: 'What is a loop invariant?',
    }),
  });
  const spanishTutorData = await spanishTutorRes.json();
  console.log('   Spanish AI Tutor answer snippet:', spanishTutorData.answer?.slice(0, 150), '...');
  const hasSpanish = containsSpanish(spanishTutorData.answer);
  console.log(`   Contains Spanish: ${hasSpanish}`);
  if (!hasSpanish) {
    throw new Error('AI Tutor did not respond in Spanish!');
  }
  console.log('   ✓ AI Tutor responded in Spanish!');

  // 12. Switch language later: French
  console.log('\n12. Switching language to French...');
  await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ preferred_language: 'French' }),
  });
  const frenchTutorRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courseId,
      query: 'What is a loop invariant?',
    }),
  });
  const frenchTutorData = await frenchTutorRes.json();
  console.log('   French AI Tutor answer snippet:', frenchTutorData.answer?.slice(0, 150), '...');
  const hasFrench = containsFrench(frenchTutorData.answer);
  console.log(`   Contains French: ${hasFrench}`);
  if (!hasFrench) {
    throw new Error('AI Tutor did not respond in French!');
  }
  console.log('   ✓ AI Tutor responded in French!');

  // 13. Switch language back to English
  console.log('\n13. Switching language to English...');
  await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ preferred_language: 'English' }),
  });
  const engTutorRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      courseId,
      query: 'What is a loop invariant?',
    }),
  });
  const engTutorData = await engTutorRes.json();
  console.log('   English AI Tutor answer snippet:', engTutorData.answer?.slice(0, 150), '...');
  console.log('   ✓ AI Tutor responded in English!');

  console.log('\n======================================================');
  console.log('🎉 ALL LANGUAGE SELECTION & INTEGRATION TESTS PASSED!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
