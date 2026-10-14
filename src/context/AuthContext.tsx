'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/types';
import { DataStore } from '@/lib/storage';
import { api } from '@/lib/api-client';

interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  session: any | null;
  loading: boolean;
  isDemoUser: boolean;
  signIn: (email: string, password?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string; success?: boolean }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error?: string }>;
  completeOnboarding: (data: {
    study_field: string;
    preferred_language: any;
    learning_goal: string;
    daily_study_time_minutes: number;
  }) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const activeUserId =
          typeof window !== 'undefined'
            ? localStorage.getItem('adaptiq_active_user_id')
            : null;

        // Try Supabase Auth
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession?.user) {
          if (mounted) {
            const sbUser: AuthUser = {
              id: currentSession.user.id,
              email: currentSession.user.email || '',
              user_metadata: currentSession.user.user_metadata,
            };
            setUser(sbUser);
            setSession(currentSession);

            let userProf: UserProfile | null = null;
            try {
              const { data: dbProf, error: dbErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', sbUser.id)
                .maybeSingle();

              if (dbProf && !dbErr) {
                userProf = dbProf as UserProfile;
              }
            } catch (e) {
              console.warn('Supabase profile query warning:', e);
            }

            if (!userProf) {
              userProf = DataStore.getProfile(sbUser.id);
            }

            if (!userProf) {
              userProf = {
                id: `prof-${sbUser.id}`,
                user_id: sbUser.id,
                full_name: sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
                email: sbUser.email,
                avatar_url: sbUser.user_metadata?.avatar_url,
                preferred_language: 'English',
                learning_goal: 'Understand concepts & exam preparation',
                study_field: 'Computer Science',
                daily_study_time_minutes: 30,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                onboarding_completed: false,
              };
              try {
                await supabase.from('profiles').upsert(userProf, { onConflict: 'user_id' });
              } catch (e) {}
            }
            setProfile(userProf);
            DataStore.saveProfile(userProf);
            localStorage.setItem('adaptiq_active_user_id', sbUser.id);
          }
        } else if (activeUserId) {
          const existingProf = DataStore.getProfile(activeUserId);
          if (existingProf && mounted) {
            setUser({
              id: existingProf.user_id,
              email: existingProf.email,
              user_metadata: {
                full_name: existingProf.full_name,
                avatar_url: existingProf.avatar_url,
              },
            });
            setProfile(existingProf);
          }
        }
      } catch (err) {
        console.error('Error initializing auth state:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      if (newSession?.user) {
        const sbUser: AuthUser = {
          id: newSession.user.id,
          email: newSession.user.email || '',
          user_metadata: newSession.user.user_metadata,
        };
        setUser(sbUser);
        setSession(newSession);
        localStorage.setItem('adaptiq_active_user_id', sbUser.id);

        let userProf: UserProfile | null = null;
        try {
          const { data: dbProf, error: dbErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', sbUser.id)
            .maybeSingle();

          if (dbProf && !dbErr) {
            userProf = dbProf as UserProfile;
          }
        } catch (e) {
          console.warn('Supabase profile query warning on state change:', e);
        }

        if (!userProf) {
          userProf = DataStore.getProfile(sbUser.id);
        }

        if (!userProf) {
          userProf = {
            id: `prof-${sbUser.id}`,
            user_id: sbUser.id,
            full_name: sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
            email: sbUser.email,
            avatar_url: sbUser.user_metadata?.avatar_url,
            preferred_language: 'English',
            learning_goal: 'Understand concepts & exam preparation',
            study_field: 'Computer Science',
            daily_study_time_minutes: 30,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            onboarding_completed: false,
          };
          try {
            await supabase.from('profiles').upsert(userProf, { onConflict: 'user_id' });
          } catch (e) {}
        }
        setProfile(userProf);
        DataStore.saveProfile(userProf);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password?: string): Promise<{ error?: string }> => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          return { error: error.message };
        }
        if (data.user) {
          const u: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            user_metadata: data.user.user_metadata,
          };
          setUser(u);
          setSession(data.session);
          let prof: UserProfile | null = null;
          try {
            const { data: dbProf, error: dbErr } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', u.id)
              .maybeSingle();

            if (dbProf && !dbErr) {
              prof = dbProf as UserProfile;
            }
          } catch (e) {
            console.warn('Supabase profile query warning on sign in:', e);
          }

          if (!prof) {
            prof = DataStore.getProfile(u.id);
          }

          if (!prof) {
            prof = {
              id: `prof-${u.id}`,
              user_id: u.id,
              full_name: u.user_metadata?.full_name || email.split('@')[0],
              email: u.email,
              preferred_language: 'English',
              learning_goal: 'Understand concepts',
              study_field: 'Computer Science',
              daily_study_time_minutes: 30,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              onboarding_completed: true,
            };
            try {
              await supabase.from('profiles').upsert(prof, { onConflict: 'user_id' });
            } catch (e) {}
          }
          DataStore.saveProfile(prof);
          setProfile(prof);
          startTransition(() => {
            router.push('/dashboard');
          });
          return {};
        }
      }

      // Standalone login for authenticated local user
      const mockId = `user-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const u: AuthUser = {
        id: mockId,
        email,
        user_metadata: { full_name: email.split('@')[0] },
      };
      setUser(u);
      localStorage.setItem('adaptiq_active_user_id', mockId);

      let prof = DataStore.getProfile(mockId);
      if (!prof) {
        prof = {
          id: `prof-${mockId}`,
          user_id: mockId,
          full_name: email.split('@')[0],
          email: email,
          preferred_language: 'English',
          learning_goal: 'Understand concepts',
          study_field: 'Computer Science',
          daily_study_time_minutes: 30,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          onboarding_completed: true,
        };
        DataStore.saveProfile(prof);
      }
      setProfile(prof);
      startTransition(() => {
        router.push('/dashboard');
      });
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Authentication failed' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error?: string }> => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) {
          return { error: error.message };
        }
        if (data.user) {
          const u: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            user_metadata: { full_name: fullName },
          };
          setUser(u);
          localStorage.setItem('adaptiq_active_user_id', u.id);

          const prof: UserProfile = {
            id: `prof-${u.id}`,
            user_id: u.id,
            full_name: fullName,
            email: email,
            preferred_language: 'English',
            learning_goal: 'Understand concepts',
            study_field: 'Computer Science',
            daily_study_time_minutes: 30,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            onboarding_completed: false,
          };
          DataStore.saveProfile(prof);
          setProfile(prof);
          startTransition(() => {
            router.push('/onboarding');
          });
          return {};
        }
      }

      // Standalone mode user creation
      const mockId = `user-${Date.now()}`;
      const u: AuthUser = {
        id: mockId,
        email,
        user_metadata: { full_name: fullName },
      };
      setUser(u);
      localStorage.setItem('adaptiq_active_user_id', mockId);

      const prof: UserProfile = {
        id: `prof-${mockId}`,
        user_id: mockId,
        full_name: fullName,
        email: email,
        preferred_language: 'English',
        learning_goal: 'Understand concepts',
        study_field: 'Computer Science',
        daily_study_time_minutes: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_completed: false,
      };
      DataStore.saveProfile(prof);
      setProfile(prof);

      startTransition(() => {
        router.push('/onboarding');
      });
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Registration failed' };
    }
  };

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) return { error: error.message };
        return {};
      }

      // Standalone simulation of Google OAuth
      const googleMockUser: AuthUser = {
        id: `google-user-${Date.now()}`,
        email: 'user.google@example.com',
        user_metadata: {
          full_name: 'Google User',
          avatar_url:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
      };
      setUser(googleMockUser);
      localStorage.setItem('adaptiq_active_user_id', googleMockUser.id);

      const prof: UserProfile = {
        id: `prof-${googleMockUser.id}`,
        user_id: googleMockUser.id,
        full_name: googleMockUser.user_metadata?.full_name || 'Google Learner',
        email: googleMockUser.email,
        avatar_url: googleMockUser.user_metadata?.avatar_url,
        preferred_language: 'English',
        learning_goal: 'Understand concepts',
        study_field: 'Computer Science',
        daily_study_time_minutes: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_completed: false,
      };
      DataStore.saveProfile(prof);
      setProfile(prof);
      startTransition(() => {
        router.push('/onboarding');
      });
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Google authentication failed' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adaptiq_active_user_id');
      }
      startTransition(() => {
        router.push('/');
      });
    }
  };

  const resetPassword = async (email: string): Promise<{ error?: string; success?: boolean }> => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) return { error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { error: err?.message || 'Password reset request failed' };
    }
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ error?: string; success?: boolean }> => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) return { error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { error: err?.message || 'Could not update password' };
    }
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<{ error?: string }> => {
    if (!profile || !user) return { error: 'Not authenticated' };
    const updated: UserProfile = {
      ...profile,
      ...data,
      updated_at: new Date().toISOString(),
    };

    let errorResult: string | undefined;

    // 1. Persist directly to Supabase profiles table
    try {
      const { error: sbErr } = await supabase.from('profiles').upsert({
        user_id: user.id,
        full_name: updated.full_name,
        email: updated.email,
        avatar_url: updated.avatar_url,
        preferred_language: updated.preferred_language,
        learning_goal: updated.learning_goal,
        study_field: updated.study_field,
        daily_study_time_minutes: updated.daily_study_time_minutes,
        onboarding_completed: updated.onboarding_completed,
        updated_at: updated.updated_at,
      }, { onConflict: 'user_id' });

      if (sbErr) {
        console.warn('Supabase direct profile upsert error:', sbErr);
      }
    } catch (e: any) {
      console.warn('Supabase direct profile upsert warning:', e);
      errorResult = e?.message;
    }

    // 2. Persist via backend API
    try {
      await api.updateProfile(updated);
    } catch (e: any) {
      console.warn('Backend API profile update warning:', e);
      if (!errorResult) errorResult = e?.message;
    }

    // 3. Update local state & storage
    DataStore.saveProfile(updated);
    setProfile(updated);

    return errorResult ? { error: errorResult } : {};
  };

  const completeOnboarding = async (data: {
    study_field: string;
    preferred_language: any;
    learning_goal: string;
    daily_study_time_minutes: number;
  }): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };
    const current = profile || {
      id: `prof-${user.id}`,
      user_id: user.id,
      full_name: user.user_metadata?.full_name || 'Learner',
      email: user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      onboarding_completed: true,
      ...data,
    };
    const updated: UserProfile = {
      ...current,
      ...data,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    let errorResult: string | undefined;

    // 1. Persist directly to Supabase profiles table
    try {
      const { error: sbErr } = await supabase.from('profiles').upsert({
        user_id: user.id,
        full_name: updated.full_name,
        email: updated.email,
        avatar_url: updated.avatar_url,
        preferred_language: updated.preferred_language,
        learning_goal: updated.learning_goal,
        study_field: updated.study_field,
        daily_study_time_minutes: updated.daily_study_time_minutes,
        onboarding_completed: true,
        updated_at: updated.updated_at,
      }, { onConflict: 'user_id' });

      if (sbErr) {
        console.warn('Supabase onboarding direct upsert error:', sbErr);
      }
    } catch (e: any) {
      console.warn('Supabase onboarding direct upsert warning:', e);
      errorResult = e?.message;
    }

    // 2. Persist via backend API
    try {
      await api.updateProfile({
        ...updated,
        onboarding_completed: true,
      });
    } catch (e: any) {
      console.warn('Backend API onboarding update warning:', e);
      if (!errorResult) errorResult = e?.message;
    }

    // 3. Update local state & storage
    DataStore.saveProfile(updated);
    setProfile(updated);
    startTransition(() => {
      router.push('/dashboard');
    });

    return errorResult ? { error: errorResult } : {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isDemoUser: false,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
