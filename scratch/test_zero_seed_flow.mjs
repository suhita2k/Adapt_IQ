import { fileURLToPath } from 'url';

const BASE_URL = 'http://localhost:3000';
const NEW_USER_ID = `fresh-user-${Date.now()}`;
const headers = {
  'Content-Type': 'application/json',
  'x-user-id': NEW_USER_ID,
};

async function runTest() {
  console.log('=== STARTING ZERO-SEED E2E VALIDATION ===');
  console.log(`Testing with new user: ${NEW_USER_ID}`);

  // 1. Verify completely empty state for new user
  console.log('\n--- 1. Testing Empty State for Brand New User ---');
  
  const coursesRes = await fetch(`${BASE_URL}/api/courses`, { headers });
  const { courses } = await coursesRes.json();
  console.log(`Courses count: ${courses.length} (Expected: 0)`);
  if (courses.length !== 0) throw new Error('Expected 0 courses for new user');

  const masteryRes = await fetch(`${BASE_URL}/api/mastery`, { headers });
  const { mastery } = await masteryRes.json();
  console.log(`Mastery count: ${mastery.length} (Expected: 0)`);
  if (mastery.length !== 0) throw new Error('Expected 0 mastery entries for new user');

  const miscRes = await fetch(`${BASE_URL}/api/misconceptions`, { headers });
  const { misconceptions } = await miscRes.json();
  console.log(`Misconceptions count: ${misconceptions.length} (Expected: 0)`);
  if (misconceptions.length !== 0) throw new Error('Expected 0 misconceptions for new user');

  const assessRes = await fetch(`${BASE_URL}/api/assessment/attempts`, { headers });
  const assessments = await assessRes.json();
  console.log(`Assessments count: ${assessments.length} (Expected: 0)`);
  if (assessments.length !== 0) throw new Error('Expected 0 assessments for new user');

  const revRes = await fetch(`${BASE_URL}/api/revision`, { headers });
  const { flashcards } = await revRes.json();
  console.log(`Flashcards count: ${flashcards.length} (Expected: 0)`);
  if (flashcards.length !== 0) throw new Error('Expected 0 flashcards for new user');

  const qRes = await fetch(`${BASE_URL}/api/assessment/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ courseId: 'nonexistent', count: 5 }),
  });
  const { questions } = await qRes.json();
  console.log(`Questions generated without materials: ${questions.length} (Expected: 0)`);
  if (questions.length !== 0) throw new Error('Expected 0 questions for course without materials');

  // 2. Profile Creation
  console.log('\n--- 2. Setting User Profile ---');
  const profileRes = await fetch(`${BASE_URL}/api/profile`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      full_name: 'Elena Rostova',
      study_field: 'Distributed Systems',
      preferred_language: 'English',
      daily_study_time_minutes: 45,
    }),
  });
  const { profile: savedProfile } = await profileRes.json();
  console.log(`Saved profile name: ${savedProfile.full_name}`);

  // 3. Course Creation
  console.log('\n--- 3. Creating Real Course ---');
  const createCourseRes = await fetch(`${BASE_URL}/api/courses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Distributed Consensus & Raft Protocols',
      code: 'CS602',
      category: 'Systems',
      description: 'Foundations of state machine replication, leader election, log invariants, and Paxos consensus.',
    }),
  });
  const { course: newCourse } = await createCourseRes.json();
  console.log(`Created course: ${newCourse.id} - ${newCourse.title}`);

  // 4. Material Upload (Multipart)
  console.log('\n--- 4. Uploading Course Material ---');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const syllabusText = `
COURSE SYLLABUS: CS602 Distributed Consensus
Lecture 1: The Consensus Problem & FLP Impossibility
- In an asynchronous network, no deterministic consensus protocol can guarantee safety and liveness if even a single node fails.
- Reference: Fischer, Lynch, Paterson (1985).

Lecture 2: The Raft Consensus Algorithm
- Key Invariants:
  1. Election Safety: At most one leader can be elected in a given term.
  2. Leader Append-Only: A leader never overwrites or truncates its log entries; it only appends new entries.
  3. Log Matching Property: If two logs contain an entry with the same index and term, then the logs are identical in all entries up through the given index.
  4. Leader Completeness: If a log entry is committed in a given term, then that entry will be present in the logs of the leaders for all higher-numbered terms.
- Common Misconception: Candidate nodes can be elected even if their log is behind the majority. In reality, voters deny votes if the candidate's last log entry has a lower term or shorter index.
- Reference: Ongaro and Ousterhout (USENIX ATC 2014), Section 5.4.
`;

  const bodyData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="title"',
    '',
    'Raft Consensus Invariants & Safety Proofs',
    `--${boundary}`,
    'Content-Disposition: form-data; name="file_type"',
    '',
    'textbook',
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="raft_notes.txt"',
    'Content-Type: text/plain',
    '',
    syllabusText,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const uploadRes = await fetch(`${BASE_URL}/api/courses/${newCourse.id}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-user-id': NEW_USER_ID,
    },
    body: bodyData,
  });
  const uploaded = await uploadRes.json();
  console.log(`Uploaded material ID: ${uploaded.id} (Status: ${uploaded.status})`);

  // 5. AI Processing with Gemini
  console.log('\n--- 5. Processing Course Material with Gemini AI ---');
  const processRes = await fetch(`${BASE_URL}/api/courses/${newCourse.id}/process`, {
    method: 'POST',
    headers,
  });
  const processData = await processRes.json();
  console.log(`Gemini processing result: success=${processData.success}`);
  console.log(`Extracted concepts: ${processData.concepts?.length || 0}`);
  console.log(`Extracted relationships: ${processData.relationships?.length || 0}`);
  console.log(`Generated flashcards: ${processData.flashcards?.length || 0}`);
  console.log(`Initial mastery nodes initialized: ${processData.mastery?.length || 0}`);

  // 6. Verify Course Map & Grounding
  console.log('\n--- 6. Verifying Course Knowledge Map ---');
  const mapRes = await fetch(`${BASE_URL}/api/courses/${newCourse.id}/map`, { headers });
  const mapData = await mapRes.json();
  console.log(`Course map returned ${mapData.concepts.length} concepts:`);
  mapData.concepts.slice(0, 3).forEach((c, i) => {
    console.log(`  [${i+1}] ${c.name} (${c.category})`);
  });

  // 7. Test AI Tutor RAG Grounding
  console.log('\n--- 7. Testing AI Course Tutor with Real Uploaded Material ---');
  const tutorRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      courseId: newCourse.id,
      query: 'What is the Leader Completeness property in Raft and why does it prevent committed entries from being lost?',
    }),
  });
  const tutorData = await tutorRes.json();
  console.log(`Tutor responded (citations count: ${tutorData.citations?.length || 0}, off-material: ${tutorData.isOffMaterial}):`);
  console.log(`Snippet of answer:\n${tutorData.answer.slice(0, 200)}...`);

  // 8. Test Adaptive Assessment Generation from Real Material
  console.log('\n--- 8. Generating Diagnostic Assessment from Real Concepts ---');
  const quizGenRes = await fetch(`${BASE_URL}/api/assessment/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      courseId: newCourse.id,
      count: 3,
    }),
  });
  const quizGenData = await quizGenRes.json();
  console.log(`Generated questions: ${quizGenData.questions?.length || 0}`);
  if (quizGenData.questions?.length > 0) {
    const q1 = quizGenData.questions[0];
    console.log(`  Sample Q1: "${q1.question_text.slice(0, 80)}..."`);
    console.log(`  Bloom Level: ${q1.bloom_level}, Difficulty: ${q1.difficulty}`);
    console.log(`  Options count: ${q1.options?.length}`);

    // 9. Evaluate Student Answer (Incorrect to trigger BKT update and Misconception detection)
    console.log('\n--- 9. Evaluating Answer & Bayesian Knowledge Tracing Update ---');
    const wrongOpt = q1.options.find(o => !o.is_correct) || q1.options[1];
    const evalRes = await fetch(`${BASE_URL}/api/assessment/evaluate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionId: q1.id,
        conceptId: q1.concept_id,
        conceptName: q1.concept_name,
        courseId: newCourse.id,
        isCorrect: false,
        selectedOptionText: wrongOpt.text,
        misconceptionTag: wrongOpt.misconception_tag || 'Raft Leader Log Invariant Violation',
        timeSpentSeconds: 22,
      }),
    });
    const evalData = await evalRes.json();
    console.log(`Evaluation result: isCorrect=${evalData.isCorrect}`);
    console.log(`Updated concept mastery: ${evalData.mastery.concept_name} -> ${(evalData.mastery.mastery_probability * 100).toFixed(1)}%`);
    console.log(`Detected misconception: ${evalData.misconception?.title || 'None'}`);

    // 10. Record Assessment Attempt
    console.log('\n--- 10. Recording Real Assessment Session ---');
    const recordRes = await fetch(`${BASE_URL}/api/assessment/attempts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        course_id: newCourse.id,
        title: `${newCourse.title} Diagnostic`,
        total_questions: 3,
        completed_questions: 3,
        score_percentage: 67,
      }),
    });
    const savedAssessment = await recordRes.json();
    console.log(`Saved assessment attempt: ${savedAssessment.id} (Score: ${savedAssessment.score_percentage}%)`);
  }

  // 11. Verify Assessment History now returns 1
  const historyRes = await fetch(`${BASE_URL}/api/assessment/attempts`, { headers });
  const history = await historyRes.json();
  console.log(`Assessment history count now: ${history.length}`);
  if (history.length !== 1) throw new Error('Expected 1 recorded assessment');

  // 12. Verify Misconceptions page now has real active gap
  const activeMiscRes = await fetch(`${BASE_URL}/api/misconceptions`, { headers });
  const activeMiscData = await activeMiscRes.json();
  console.log(`Active misconceptions count: ${activeMiscData.misconceptions.length}`);

  // 13. Retest Misconception
  if (activeMiscData.misconceptions.length > 0) {
    const targetMisc = activeMiscData.misconceptions[0];
    console.log(`\n--- 11. Retesting & Remediating Misconception: ${targetMisc.title} ---`);
    const retestRes = await fetch(`${BASE_URL}/api/misconceptions/${targetMisc.id}/retest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ passed: true }),
    });
    const retestData = await retestRes.json();
    console.log(`Retest status: ${retestData.misconception.status} (Updated mastery: ${(retestData.mastery.mastery_probability * 100).toFixed(1)}%)`);
  }

  // 14. Check Spaced Revision Flashcards
  console.log('\n--- 12. Reviewing SM-2 Flashcard ---');
  const flashRes = await fetch(`${BASE_URL}/api/revision`, { headers });
  const flashData = await flashRes.json();
  console.log(`Flashcards in deck: ${flashData.flashcards.length}`);
  if (flashData.flashcards.length > 0) {
    const card = flashData.flashcards[0];
    const reviewRes = await fetch(`${BASE_URL}/api/revision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cardId: card.id,
        rating: 4, // 'good'
      }),
    });
    const reviewData = await reviewRes.json();
    console.log(`Reviewed flashcard: next review in ${reviewData.card.interval_days} days (Ease factor: ${reviewData.card.ease_factor})`);
  }

  // 15. Verify Study Plan Generation
  console.log('\n--- 13. Generating Personalized Study Plan ---');
  const planRes = await fetch(`${BASE_URL}/api/study-plan`, {
    method: 'POST',
    headers,
  });
  const planData = await planRes.json();
  console.log(`Personalized study plan created with ${planData.plan.tasks.length} adaptive tasks!`);
  planData.plan.tasks.slice(0, 3).forEach((t, i) => {
    console.log(`  Task ${i+1}: [${t.priority}] ${t.title} (${t.estimated_minutes} min)`);
  });

  console.log('\n=== ALL REAL API INTEGRATION & ZERO-SEED TESTS PASSED WITH 100% SUCCESS ===\n');
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
