# ADAPTIQ — Adaptive Intelligence for Personalized Learning

> Turn your course materials into a personalized AI learning system that understands what you study, what you know, and what you should learn next.

ADAPTIQ is a complete, production-grade AI learning platform featuring secure authentication, multi-tenant PostgreSQL with Row Level Security (RLS), private course-grounded RAG retrieval, Bayesian Student Learning Twins, adaptive diagnostic assessments, automated misconception repair, and dynamic study planning.

---

## 🌟 Key Capabilities

1. **Secure Multi-Tenant Authentication & RLS**:
   - Supabase Auth supporting Email/Password, Google OAuth, password reset, and session persistence.
   - Strict database-level isolation: Every query is scoped to `auth.uid() = user_id`. User A can never access User B's courses, files, or mastery.

2. **Course Evidence RAG Tutor with Strict Citations**:
   - Conversational AI tutor grounded strictly in uploaded course materials (Textbooks, Slides, Video Lectures).
   - Verifiable citation cards (e.g., *Textbook — Page 73*, *Slides — Slide 18*, *Lecture — 38:21*) with an interactive source chunk inspector.
   - Off-material refusal gate: Gracefully rejects queries outside course syllabus to prevent hallucinations.

3. **Student Learning Twin (Bayesian Knowledge Tracing)**:
   - Dynamic interactive knowledge graph mapping concepts, prerequisite relationships, and mastery probabilities in real time.
   - Forgetting risk estimation using Ebbinghaus retention curves to predict memory decay.

4. **Adaptive Diagnostic Assessments**:
   - Evaluates understanding across Bloom's Taxonomy levels (Remember, Understand, Apply, Analyze).
   - Real-time diagnostic feedback with misconception tagging on distractors.

5. **Misconception Diagnosis & Socratic Repair Workshop**:
   - Identifies the exact theoretical gap behind errors (e.g. *Missing or Non-Terminating Base Case Invariant in Recursion*).
   - Multi-step guided Socratic repair with side-by-side code corrections and verified citations.
   - Instant re-test challenge that updates learning twin mastery upon successful completion.

6. **Dynamic Study Planner & Spaced Revision**:
   - AI-prioritized daily tasks balancing exam countdowns, retention strength, and urgent misconception repairs.
   - Interactive SM-2 spaced repetition flashcard deck.

7. **Zero-Setup Demo Mode (Alex Persona)**:
   - 1-click **"Explore Demo"** button to immediately test all full-stack features pre-loaded with CS201 Data Structures & Algorithms.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide React, Recharts, Canvas Confetti.
- **Backend / Database**: Supabase (Auth, PostgreSQL, Row Level Security, Storage Buckets).
- **AI & Analytics**: Bayesian Knowledge Tracing (BKT), Spaced Repetition (SM-2), Vector Similarity RAG with citation alignment.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd adaoriq
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

For immediate local testing, `DEMO_MODE=true` is enabled by default. To connect live Supabase cloud authentication, provide:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Acceptance Test Walkthrough

Follow these steps to verify the full hackathon user journey:

1. **Landing Page**: Visit `/` and click **"View Demo (Alex Persona)"** or **"Get Started"**.
2. **Dashboard**: View personalized learner greeting (*"Good day, Alex 👋"*), enrolled courses, mastery stats, and active misconceptions.
3. **AI Course Tutor**: Navigate to `/tutor`. Ask: *"Explain recursion and why base cases are required."* Inspect the verified citations (*Textbook Page 73*, *Slide 18*, *Lecture 38:21*). Ask an off-topic question like *"What is the recipe for chocolate chip cookies?"* to verify the grounding rejection gate.
4. **Adaptive Assessment**: Take the diagnostic quiz on `/assessment`. Select an incorrect option on recursion to trigger the base-case misconception alert.
5. **Misconception Repair**: Navigate to `/misconceptions`. Walk through the Socratic Call Stack explanation, view the code fix, and click **"Launch Retest Verification"**. Submit the correct base case guard to resolve the misconception.
6. **Learning Twin**: Open `/learning-twin` to see the real-time knowledge graph update with increased mastery probability and reduced forgetting risk.
7. **Study Plan & Revision**: Check off daily tasks on `/study-plan` and review spaced repetition flashcards on `/revision`.
8. **Evaluation Benchmarks**: Open `/evaluation` and click **"Run Automated Benchmark"** to verify 100% test pass rates across grounding accuracy and tenant security.
9. **Log Out & Re-Authentication**: Sign out and log back in to confirm that all progress, mastery, and resolved states are persistently preserved.

---

## 🔒 Security & Database Schema

The full PostgreSQL schema with Row Level Security policies and triggers is located at `supabase/schema.sql`.

Refer to [`SETUP.md`](./SETUP.md) for step-by-step instructions on setting up Supabase, configuring Google OAuth, and production deployment.
