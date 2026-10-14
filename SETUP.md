# ADAPTIQ — Complete Setup & Deployment Guide

This guide covers everything required to set up Supabase authentication, configure PostgreSQL Row Level Security (RLS), enable Google OAuth, and deploy ADAPTIQ to production.

---

## 1. Supabase Project Setup

1. Go to [Supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public API Key** from **Project Settings → API**.
3. Under **Project Settings → Database**, copy the PostgreSQL connection string.

---

## 2. Running Database Migrations & RLS

1. In the Supabase Dashboard, open the **SQL Editor**.
2. Create a new query and paste the contents of `supabase/schema.sql` located in this repository.
3. Click **Run**. This will create:
   - 20+ tables (`profiles`, `courses`, `course_materials`, `student_mastery`, `misconceptions`, `questions`, etc.).
   - Explicit Row Level Security (RLS) policies enforcing `auth.uid() = user_id` across all queries.
   - The `handle_new_user()` trigger for automated profile creation upon user registration.

---

## 3. Configuring Supabase Authentication

### Email & Password
- In **Authentication → Providers → Email**, ensure Email provider is enabled.
- Toggle "Confirm email" based on your preference (disabled for immediate testing).

### Google OAuth Configuration
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project or select an existing one.
3. Under **APIs & Services → Credentials**, create an **OAuth 2.0 Client ID**.
4. Set Application Type to **Web application**.
5. Add Authorized Redirect URI:
   ```text
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
6. Copy the **Client ID** and **Client Secret**.
7. In the Supabase Dashboard, navigate to **Authentication → Providers → Google**, enable Google, paste your Client ID and Client Secret, and save.

---

## 4. Environment Variables Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Connection
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Optional Standalone Mode (Set to false when using live Supabase)
DEMO_MODE=false
```

---

## 5. Storage Bucket Configuration

1. In the Supabase Dashboard, open **Storage**.
2. Create a new private bucket named `courses`.
3. Add the following Storage RLS policy so users can only access their own directory:
   ```sql
   CREATE POLICY "User storage isolation" ON storage.objects
   FOR ALL USING (
     bucket_id = 'courses' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

---

## 6. Production Deployment (Vercel)

1. Push your code to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEMO_MODE=false`
4. Set the build command to `npm run build` and output directory to `.next`.
5. Deploy!
