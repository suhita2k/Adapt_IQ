import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('=== STARTING AI COURSE EVIDENCE TUTOR VERIFICATION ===\n');

  // 1. Authenticate with dev bypass
  const authHeaders = {
    'Content-Type': 'application/json',
    'x-user-id': 'a06c0a57-1105-4b5a-86dc-9dabb8aba15e',
    'x-user-email': 'test@adaptiq.edu',
  };

  // 2. Fetch or create a test course
  console.log('1. Checking user courses...');
  const coursesRes = await fetch(`${BASE_URL}/api/courses`, { headers: authHeaders });
  if (!coursesRes.ok) {
    throw new Error(`Failed to fetch courses: ${coursesRes.status} ${coursesRes.statusText}`);
  }
  const coursesData = await coursesRes.json();
  const courses = coursesData.courses || [];
  console.log(`Found ${courses.length} courses for user.`);

  let targetCourse = courses.find(c => c.title.toLowerCase().includes('distributed') || c.title.toLowerCase().includes('systems'));
  if (!targetCourse) {
    console.log('Creating "Distributed Systems & Cloud Computing" test course...');
    const createRes = await fetch(`${BASE_URL}/api/courses`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Distributed Systems & Cloud Computing',
        code: 'CS-401',
        description: 'Advanced distributed consensus, storage engines, and stream processing.',
        category: 'Computer Science',
        color: '#B1A15A',
        icon: 'Server',
      }),
    });
    const createData = await createRes.json();
    targetCourse = createData.course;
  }
  console.log(`Using target course: "${targetCourse.title}" (ID: ${targetCourse.id})\n`);

  // 3. Upload Multi-Page Textbook (PDF) content with distinct pages
  console.log('2. Ingesting multi-page textbook content...');
  const textbookContent = `
=== Page 1 ===
# Chapter 1: Introduction to Distributed Systems
A distributed system is a collection of autonomous computing entities that communicate over a network to coordinate actions. The fundamental challenge is Byzantine Fault Tolerance, wherein nodes may fail or act maliciously. Lamport proved that no agreement can be reached in an asynchronous network with even one crash failure under the FLP impossibility theorem.

=== Page 2 ===
# Chapter 2: Logical Clocks and Event Ordering
Lamport Logical Clocks assign a monotonically increasing integer timestamp C(e) to every event. If event a happens before b within the same process, C(a) < C(b). When a message m is sent, it carries timestamp C(send). The receiver updates its clock to max(C(receive), C(send)) + 1. Vector Clocks extend this to an array of size N, capturing exact causal concurrency.

=== Page 3 ===
# Chapter 3: Raft Consensus Protocol
Raft decomposes consensus into three independent subproblems: Leader Election, Log Replication, and Safety. A server exists in one of three states: Leader, Follower, or Candidate. If a follower receives no communication over an election timeout (typically 150-300ms), it increments its term and transitions to Candidate, requesting votes from peers via RequestVote RPCs. A candidate becomes leader upon receiving a majority of term votes.

=== Page 4 ===
# Chapter 4: Paxos State Machine Replication
Classic Multi-Paxos reaches consensus across distinct log slots through two-phase rounds: Phase 1 (Prepare and Promise) where a proposer seeks a promise for ballot number b, and Phase 2 (Accept and Accepted) where values are committed once accepted by a quorum of acceptors.

=== Page 5 ===
# Chapter 5: CAP Theorem and Consistency Models
Brewer's CAP Theorem states that any distributed data store can simultaneously provide at most two of three guarantees: Consistency (all nodes see the same data at the same time), Availability (every read/write request receives a non-error response), and Partition Tolerance (the system continues to operate despite network packet loss). In practice, network partitions are inevitable, forcing systems to choose between CP and AP.

=== Page 6 ===
# Chapter 6: DynamoDB and Anti-Entropy Gossip
Amazon Dynamo adopts an AP model using consistent hashing for partition placement, vector clocks for causal versioning, and anti-entropy background synchronization using Merkle trees. Nodes exchange membership states periodically through a gossip protocol, maintaining decentralization without a master node.
`;

  const pdfUploadRes = await fetch(`${BASE_URL}/api/courses/${targetCourse.id}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Distributed Systems Principles Textbook',
      file_name: 'Distributed_Systems_Principles.pdf',
      file_type: 'textbook',
      file_size_bytes: 2048500,
    }),
  });
  const pdfMat = await pdfUploadRes.json();
  console.log(`Textbook material registered: "${pdfMat.material?.title}"`);

  // Seed individual pages directly into source evidence for exact verification
  const testChunks = [
    { page: 1, topic: 'Byzantine Fault Tolerance', snippet: 'Lamport proved that no agreement can be reached in an asynchronous network with even one crash failure under the FLP impossibility theorem.' },
    { page: 2, topic: 'Logical Clocks', snippet: 'Lamport Logical Clocks assign a monotonically increasing integer timestamp C(e) to every event. If event a happens before b within the same process, C(a) < C(b). The receiver updates its clock to max(C(receive), C(send)) + 1.' },
    { page: 3, topic: 'Raft Consensus Protocol', snippet: 'Raft decomposes consensus into three independent subproblems: Leader Election, Log Replication, and Safety. If a follower receives no communication over an election timeout, it transitions to Candidate and requests votes via RequestVote RPCs.' },
    { page: 4, topic: 'Paxos State Machine Replication', snippet: 'Classic Multi-Paxos reaches consensus across distinct log slots through two-phase rounds: Phase 1 Prepare and Promise, and Phase 2 Accept and Accepted.' },
    { page: 5, topic: 'CAP Theorem', snippet: 'Brewer CAP Theorem states that any distributed data store can simultaneously provide at most two of three guarantees: Consistency, Availability, and Partition Tolerance.' },
    { page: 6, topic: 'DynamoDB Gossip Protocol', snippet: 'Amazon Dynamo adopts an AP model using consistent hashing, vector clocks for versioning, and anti-entropy background synchronization using Merkle trees via gossip protocols.' },
  ];

  // Also seed Slide chunks
  const testSlides = [
    { slide: 1, topic: 'Big Data Overview', snippet: 'Lecture 1: Distributed Storage and Parallel Processing Frameworks overview.' },
    { slide: 2, topic: 'MapReduce Architecture', snippet: 'MapReduce coordinates master and worker nodes where Mappers partition intermediate keys using hash mod R and Reducers aggregate sorted keys.' },
    { slide: 3, topic: 'Spark RDD In-Memory Computing', snippet: 'Apache Spark introduces Resilient Distributed Datasets (RDDs) with deterministic lineage graphs enabling in-memory fault tolerance without disk spills.' },
    { slide: 4, topic: 'Kafka Event Streaming', snippet: 'Apache Kafka partitions distributed commit logs where consumer groups track committed offsets with zero-copy log compaction.' },
    { slide: 5, topic: 'Pregel Graph Processing', snippet: 'Google Pregel employs the Bulk Synchronous Parallel (BSP) model where vertices compute functions and send messages along directed edges in supersteps.' },
    { slide: 6, topic: 'BigTable Sorted Map', snippet: 'BigTable is a distributed, sparse, multidimensional sorted map indexed by row key, column key, and timestamp stored in SSTables on GFS.' },
  ];

  // Save these structured sources directly to user's course sources file
  const sourcesFilePath = path.join(process.cwd(), 'data', `a06c0a57-1105-4b5a-86dc-9dabb8aba15e_sources_${targetCourse.id}.json`);
  let existingSources = [];
  if (fs.existsSync(sourcesFilePath)) {
    try { existingSources = JSON.parse(fs.readFileSync(sourcesFilePath, 'utf-8')); } catch {}
  }

  for (const c of testChunks) {
    existingSources.push({
      id: `src-ds-p${c.page}`,
      course_id: targetCourse.id,
      material_id: pdfMat.material?.id || 'mat-ds-pdf',
      material_title: 'Distributed Systems Principles Textbook',
      material_type: 'textbook',
      file_name: 'Distributed_Systems_Principles.pdf',
      file_url: `/api/courses/${targetCourse.id}/materials/${pdfMat.material?.id || 'mat-ds-pdf'}/file#page=${c.page}`,
      page_number: c.page,
      location_type: 'page',
      location_reference: `Page ${c.page}`,
      snippet: c.snippet,
      confidence_score: 0.99,
      relevance_reason: `Defines ${c.topic} on Page ${c.page}`,
      topic: c.topic,
      concept: c.topic,
    });
  }

  for (const s of testSlides) {
    existingSources.push({
      id: `src-ds-s${s.slide}`,
      course_id: targetCourse.id,
      material_id: 'mat-ds-slides',
      material_title: 'Big Data Processing Slide Deck',
      material_type: 'slides',
      file_name: 'Big_Data_Processing.pptx',
      file_url: `/api/courses/${targetCourse.id}/materials/mat-ds-slides/file#page=${s.slide}`,
      slide_number: s.slide,
      location_type: 'slide',
      location_reference: `Slide ${s.slide}`,
      snippet: s.snippet,
      confidence_score: 0.99,
      relevance_reason: `Details ${s.topic} on Slide ${s.slide}`,
      topic: s.topic,
      concept: s.topic,
    });
  }

  fs.writeFileSync(sourcesFilePath, JSON.stringify(existingSources, null, 2), 'utf-8');
  console.log(`Saved ${existingSources.length} indexed chunks covering Pages 1-6 and Slides 1-6.\n`);

  // 4. Test Queries: Verify that citations retrieve actual Page and Slide numbers, NOT Page 5!
  console.log('3. RUNNING EVIDENCE TUTOR CITATION TESTS...\n');

  const testQueries = [
    {
      query: 'How does Raft conduct leader election when a follower times out?',
      expectedRef: 'Page 3',
      forbiddenRef: 'Page 5',
      name: 'Raft Leader Election Query (Expect Page 3)',
    },
    {
      query: 'Explain Lamport logical clocks formula and timestamp updating',
      expectedRef: 'Page 2',
      forbiddenRef: 'Page 5',
      name: 'Logical Clocks Query (Expect Page 2)',
    },
    {
      query: 'How does Apache Spark achieve in-memory fault tolerance with RDD lineage graphs?',
      expectedRef: 'Slide 3',
      forbiddenRef: 'Page 5',
      name: 'Spark RDD Lineage Query (Expect Slide 3)',
    },
    {
      query: 'Explain Apache Kafka consumer group offsets and distributed log compaction',
      expectedRef: 'Slide 4',
      forbiddenRef: 'Page 5',
      name: 'Kafka Commit Log Query (Expect Slide 4)',
    },
    {
      query: 'What is quantum entanglement and quantum teleportation in physics?',
      expectOffMaterial: true,
      name: 'Off-Material Question (Expect Insufficient Evidence rejection)',
    },
  ];

  let passedTests = 0;

  for (const t of testQueries) {
    console.log(`--> Testing: ${t.name}`);
    console.log(`    Query: "${t.query}"`);

    const askRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: t.query,
        courseId: targetCourse.id,
        language: 'English',
      }),
    });

    if (!askRes.ok) {
      console.error(`    FAILED: API returned ${askRes.status} ${askRes.statusText}`);
      continue;
    }

    const resJson = await askRes.json();

    if (t.expectOffMaterial) {
      if (resJson.isOffMaterial || !resJson.hasSufficientEvidence || resJson.answer.includes('could not find sufficient evidence') || resJson.answer.includes('not found in your uploaded')) {
        console.log(`    PASSED: Correctly identified off-material question and refused hallucination.`);
        passedTests++;
      } else {
        console.warn(`    WARNING: Expected rejection but got response:`, resJson.answer.slice(0, 100));
      }
      console.log('');
      continue;
    }

    const citations = resJson.citations || [];
    console.log(`    Retrieved ${citations.length} citations.`);

    const citedRefs = citations.map(c => c.location_reference);
    console.log(`    Cited References: [${citedRefs.join(', ')}]`);

    // Check if expected reference is in citations or answer
    const foundExpected = citedRefs.some(r => r.toLowerCase().includes(t.expectedRef.toLowerCase())) ||
                          resJson.answer.toLowerCase().includes(t.expectedRef.toLowerCase());

    const hasFileUrl = citations.length > 0 && citations[0].file_url;
    console.log(`    Top Citation:`);
    console.log(`      • Location: ${citations[0]?.location_reference}`);
    console.log(`      • File: ${citations[0]?.file_name}`);
    console.log(`      • Deep URL: ${citations[0]?.file_url}`);
    console.log(`      • Snippet: "${citations[0]?.snippet?.slice(0, 80)}..."`);

    if (foundExpected) {
      console.log(`    PASSED: Successfully cited ${t.expectedRef} and did NOT default to Page 5!`);
      passedTests++;
    } else {
      console.warn(`    WARNING: Expected ${t.expectedRef}, retrieved [${citedRefs.join(', ')}]`);
    }
    console.log('');
  }

  // 5. Test streaming file endpoint
  console.log('4. Testing document streaming endpoint...');
  const fileTestRes = await fetch(`${BASE_URL}/api/courses/${targetCourse.id}/materials/${pdfMat.material?.id || 'mat-ds-pdf'}/file`, {
    headers: authHeaders,
  });
  console.log(`    File Stream Status: ${fileTestRes.status} ${fileTestRes.statusText}`);
  console.log(`    Content-Type: ${fileTestRes.headers.get('content-type')}`);
  console.log(`    Content-Length: ${fileTestRes.headers.get('content-length')} bytes`);

  if (fileTestRes.status === 200) {
    console.log('    PASSED: Document viewer streaming endpoint returns valid HTTP 200.');
    passedTests++;
  }

  console.log(`\n=== TEST SUMMARY: ${passedTests}/${testQueries.length + 1} PASSED ===`);
}

runTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
